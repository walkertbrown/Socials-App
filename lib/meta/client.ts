import "server-only";
import { getMetaCredentials } from "@/lib/db/meta-credentials";

const GRAPH = "https://graph.facebook.com/v25.0";

interface GraphOpts {
  method?: "GET" | "POST";
  params?: Record<string, string>;
  token: string;
}

// Minimal Facebook Graph API helper. Throws a plain-English error on failure.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export async function graph(path: string, opts: GraphOpts): Promise<any> {
  const method = opts.method ?? "GET";
  const params = { ...(opts.params ?? {}), access_token: opts.token };

  let res: Response;
  if (method === "GET") {
    const url = new URL(`${GRAPH}/${path}`);
    for (const [k, v] of Object.entries(params)) url.searchParams.set(k, v);
    res = await fetch(url.toString());
  } else {
    res = await fetch(`${GRAPH}/${path}`, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams(params).toString(),
    });
  }

  const json = await res.json();
  if (!res.ok || json.error) {
    throw new Error(json.error?.message || `Graph API error (HTTP ${res.status})`);
  }
  return json;
}

// Loads the stored Meta credentials, erroring clearly if not connected yet.
export async function requireCredentials() {
  const c = await getMetaCredentials();
  if (!c?.page_token || !c.page_id) {
    throw new Error("Meta isn't connected yet — no page token saved.");
  }
  return c;
}
