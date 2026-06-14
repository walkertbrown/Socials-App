import { NextResponse, type NextRequest } from "next/server";
import { getUserOrNull } from "@/lib/auth/require-user";
import { getReportByWeek } from "@/lib/db/weekly-reports";
import type { WeekPayload } from "@/lib/report/compute-week";

// Node runtime — @react-pdf/renderer requires Node APIs (Buffer, stream).
export const runtime = "nodejs";
export const maxDuration = 30;

// Render and stream a PDF for the given week.
// Auth-gated. Renders the STORED narrative text — NEVER calls Claude.
//
// GET /api/reports/[week]/pdf
// Returns: application/pdf stream
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ week: string }> }
) {
  const user = await getUserOrNull();
  if (!user) return new NextResponse("Unauthorized", { status: 401 });

  const { week } = await params;
  if (!week || !/^\d{4}-\d{2}-\d{2}$/.test(week)) {
    return new NextResponse("Invalid week format (YYYY-MM-DD required)", { status: 400 });
  }

  const report = await getReportByWeek(week);
  if (!report) {
    return new NextResponse("Report not found", { status: 404 });
  }

  const payload = report.payload as WeekPayload | null;
  if (!payload) {
    return new NextResponse("Report not yet computed", { status: 404 });
  }

  // Import @react-pdf dynamically to keep the module out of the edge bundle.
  // renderToBuffer is the Node-side API — renders to a Buffer in one call.
  const { renderToBuffer } = await import("@react-pdf/renderer");
  const { InsightsReportDocument } = await import("@/lib/report/pdf-document");

  // createElement avoids JSX transpilation issues in a non-JSX route file.
  // The cast to unknown then ReactElement<DocumentProps> is needed because
  // createElement returns ReactElement<Props> which doesn't structurally match
  // ReactElement<DocumentProps> at the type level — but at runtime they're the same.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const React = await import("react");
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const element = React.createElement(InsightsReportDocument as any, { report, payload });

  // renderToBuffer renders the stored narratives — no compute, no LLM calls.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const buffer = await renderToBuffer(element as any);

  // Convert Buffer to Uint8Array for the NextResponse BodyInit compatibility.
  const uint8 = new Uint8Array(buffer);
  const filename = `pelican-club-weekly-${week}.pdf`;
  return new NextResponse(uint8, {
    status: 200,
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="${filename}"`,
      "Content-Length": String(uint8.length),
    },
  });
}
