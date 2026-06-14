// @react-pdf/renderer document for the weekly insights report.
// This component only renders stored narrative text — it NEVER calls Claude.
// The data is passed in from the already-stored weekly_reports row.
//
// Layout: Pelican Club header, three narrative blocks, post table, footer.
// Footer: small "Powered by Proven" text.

import React from "react";
import {
  Document,
  Page,
  Text,
  View,
  StyleSheet,
} from "@react-pdf/renderer";
import type { WeeklyReport } from "@/lib/db/weekly-reports";
import type { WeekPayload } from "@/lib/report/compute-week";

const styles = StyleSheet.create({
  page: {
    fontFamily: "Helvetica",
    fontSize: 10,
    paddingTop: 40,
    paddingBottom: 50,
    paddingHorizontal: 40,
    color: "#1a1a1a",
  },
  // Header
  header: {
    marginBottom: 20,
    borderBottomWidth: 2,
    borderBottomColor: "#1a1a1a",
    paddingBottom: 10,
  },
  venueName: {
    fontSize: 20,
    fontFamily: "Helvetica-Bold",
    marginBottom: 4,
  },
  weekLabel: {
    fontSize: 10,
    color: "#555",
  },
  // Section
  section: {
    marginBottom: 16,
  },
  sectionTitle: {
    fontSize: 12,
    fontFamily: "Helvetica-Bold",
    marginBottom: 6,
    color: "#1a1a1a",
  },
  bodyText: {
    fontSize: 10,
    lineHeight: 1.5,
    color: "#333",
  },
  // Table
  table: {
    marginTop: 8,
  },
  tableRow: {
    flexDirection: "row",
    borderBottomWidth: 1,
    borderBottomColor: "#e0e0e0",
    paddingVertical: 4,
  },
  tableHeader: {
    flexDirection: "row",
    borderBottomWidth: 2,
    borderBottomColor: "#1a1a1a",
    paddingVertical: 4,
  },
  colFormat: { width: "20%", fontFamily: "Helvetica-Bold", fontSize: 9 },
  colPosts: { width: "12%", textAlign: "right", fontSize: 9 },
  colReach: { width: "18%", textAlign: "right", fontSize: 9 },
  colViews: { width: "15%", textAlign: "right", fontSize: 9 },
  colLikes: { width: "15%", textAlign: "right", fontSize: 9 },
  colComments: { width: "20%", textAlign: "right", fontSize: 9 },
  // Snapshot bar
  snapshotRow: {
    flexDirection: "row",
    marginBottom: 4,
    gap: 24,
  },
  snapshotItem: {
    flexDirection: "column",
  },
  snapshotLabel: {
    fontSize: 8,
    color: "#888",
    marginBottom: 1,
  },
  snapshotValue: {
    fontSize: 12,
    fontFamily: "Helvetica-Bold",
  },
  // Footer
  footer: {
    position: "absolute",
    bottom: 20,
    left: 40,
    right: 40,
    flexDirection: "row",
    justifyContent: "space-between",
    borderTopWidth: 1,
    borderTopColor: "#ccc",
    paddingTop: 6,
  },
  footerText: {
    fontSize: 8,
    color: "#aaa",
  },
  note: {
    fontSize: 8,
    color: "#888",
    fontStyle: "italic",
    marginTop: 4,
  },
});

function fmt(n: number | null | undefined): string {
  if (n == null) return "—";
  return n.toLocaleString("en-US");
}

function fmtSigned(n: number | null | undefined): string {
  if (n == null) return "—";
  return n >= 0 ? `+${n.toLocaleString("en-US")}` : n.toLocaleString("en-US");
}

interface Props {
  report: WeeklyReport;
  payload: WeekPayload;
}

export function InsightsReportDocument({ report, payload }: Props) {
  const ig = payload.igSnapshot;
  const fb = payload.fbSnapshot;
  const weekLabel = `Week of ${payload.weekStart} – ${payload.weekEnd}`;

  return (
    <Document title={`Pelican Club Weekly Report ${payload.weekStart}`}>
      <Page size="LETTER" style={styles.page}>
        {/* Header */}
        <View style={styles.header}>
          <Text style={styles.venueName}>The Pelican Club</Text>
          <Text style={styles.weekLabel}>Weekly Social Media Report — {weekLabel}</Text>
        </View>

        {/* Account snapshot bar */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>This Week at a Glance</Text>
          <View style={styles.snapshotRow}>
            <View style={styles.snapshotItem}>
              <Text style={styles.snapshotLabel}>IG Reach</Text>
              <Text style={styles.snapshotValue}>{fmt(ig?.reach)}</Text>
            </View>
            <View style={styles.snapshotItem}>
              <Text style={styles.snapshotLabel}>IG Views</Text>
              <Text style={styles.snapshotValue}>{fmt(ig?.views)}</Text>
            </View>
            <View style={styles.snapshotItem}>
              <Text style={styles.snapshotLabel}>Net Followers (IG)</Text>
              <Text style={styles.snapshotValue}>{fmtSigned(ig?.net_followers)}</Text>
            </View>
            <View style={styles.snapshotItem}>
              <Text style={styles.snapshotLabel}>Link Taps (IG)</Text>
              <Text style={styles.snapshotValue}>{fmt(ig?.link_taps)}</Text>
            </View>
            <View style={styles.snapshotItem}>
              <Text style={styles.snapshotLabel}>FB Reach</Text>
              <Text style={styles.snapshotValue}>{fmt(fb?.reach)}</Text>
            </View>
            <View style={styles.snapshotItem}>
              <Text style={styles.snapshotLabel}>FB Engagement</Text>
              <Text style={styles.snapshotValue}>{fmt(fb?.engagement)}</Text>
            </View>
          </View>
        </View>

        {/* Win of the Week */}
        {report.win_text && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Win of the Week</Text>
            <Text style={styles.bodyText}>{report.win_text}</Text>
          </View>
        )}

        {/* Recommended Focus */}
        {report.recommend_text && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Recommended Focus</Text>
            <Text style={styles.bodyText}>{report.recommend_text}</Text>
          </View>
        )}

        {/* Flag of the Week */}
        {report.flag_text && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Flag of the Week</Text>
            <Text style={styles.bodyText}>{report.flag_text}</Text>
          </View>
        )}

        {/* Format Breakdown Table */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Format Breakdown</Text>
          <Text style={styles.note}>Stories not included (24h expiry).</Text>
          <View style={styles.table}>
            <View style={styles.tableHeader}>
              <Text style={styles.colFormat}>Format</Text>
              <Text style={styles.colPosts}>Posts</Text>
              <Text style={styles.colReach}>Med. Reach</Text>
              <Text style={styles.colViews}>Med. Views</Text>
              <Text style={styles.colLikes}>Likes</Text>
              <Text style={styles.colComments}>Comments</Text>
            </View>
            {payload.formatBreakdown.map((row) => (
              <View key={row.format} style={styles.tableRow}>
                <Text style={styles.colFormat}>{row.format}</Text>
                <Text style={styles.colPosts}>{row.postCount}</Text>
                <Text style={styles.colReach}>
                  {row.medianReach.ok
                    ? fmt(Math.round(row.medianReach.value))
                    : "not enough data yet"}
                </Text>
                <Text style={styles.colViews}>
                  {row.medianViews.ok
                    ? row.medianViews.value != null
                      ? fmt(Math.round(row.medianViews.value))
                      : "—"
                    : "not enough data yet"}
                </Text>
                <Text style={styles.colLikes}>{fmt(row.totalLikes)}</Text>
                <Text style={styles.colComments}>{fmt(row.totalComments)}</Text>
              </View>
            ))}
          </View>
        </View>

        {/* Footer */}
        <View style={styles.footer} fixed>
          <Text style={styles.footerText}>
            The Pelican Club — {weekLabel}
          </Text>
          <Text style={styles.footerText}>Powered by Proven</Text>
        </View>
      </Page>
    </Document>
  );
}
