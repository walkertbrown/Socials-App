"use client";

// scheduler-view.tsx — the send Scheduler: an editable list of "N emails on this
// date" batches, prefilled with the warm-up ramp. STEP 1 is dry-run: the daily
// drip (and the manual "Run due batch" button) only SIMULATE — nothing is sent.

import { useState, useEffect } from "react";
import { addDays, todayChicago } from "@/lib/outreach/schedule-plan";

interface ApiRow {
  id?: string;
  scheduled_date: string;
  target_count: number;
  sent_count?: number;
  status?: string; // 'pending' | 'done'
}

interface ScheduleData {
  rows: ApiRow[];
  poolSize: number;
  totalScheduled: number;
  totalSent: number;
  prefill: { scheduled_date: string; target_count: number }[] | null;
}

export function SchedulerView() {
  const [data, setData] = useState<ScheduleData | null>(null);
  const [rows, setRows] = useState<ApiRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [running, setRunning] = useState(false);
  const [runMsg, setRunMsg] = useState<string | null>(null);

  // No synchronous setState before the first await, so the mount effect doesn't
  // trip the cascading-render rule — and refreshes after save/run update the list
  // in place rather than blanking it to "Loading…".
  async function load() {
    try {
      const res = await fetch("/api/outreach/schedule");
      if (!res.ok) throw new Error(await res.text());
      const d = (await res.json()) as ScheduleData;
      setData(d);
      setRows(d.rows);
      setError(null);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { void load(); }, []);

  function patchRow(i: number, patch: Partial<ApiRow>) {
    setRows((prev) => prev.map((r, idx) => (idx === i ? { ...r, ...patch } : r)));
  }
  function removeRow(i: number) {
    setRows((prev) => prev.filter((_, idx) => idx !== i));
  }
  function addRow() {
    const last = rows[rows.length - 1];
    const nextDate = last ? addDays(last.scheduled_date, 1) : addDays(todayChicago(), 1);
    setRows((prev) => [...prev, { scheduled_date: nextDate, target_count: 50, status: "pending" }]);
  }
  function usePrefill() {
    if (data?.prefill) setRows(data.prefill.map((p) => ({ ...p, status: "pending" })));
  }

  async function save() {
    setSaving(true);
    setRunMsg(null);
    try {
      const payload = rows.map((r) => ({ id: r.id, scheduled_date: r.scheduled_date, target_count: r.target_count }));
      const res = await fetch("/api/outreach/schedule", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ rows: payload }),
      });
      if (!res.ok) throw new Error(await res.text());
      await load();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setSaving(false);
    }
  }

  async function runDue() {
    setRunning(true);
    setRunMsg(null);
    try {
      const res = await fetch("/api/outreach/schedule/run", { method: "POST" });
      if (!res.ok) throw new Error(await res.text());
      const r = await res.json();
      if (!r.ran) {
        setRunMsg(r.reason === "not_configured" ? "Scheduler table not set up yet — apply migration 0018." : "Nothing due today.");
      } else {
        const short = r.shortfall ? ` (${r.shortfall} short — fewer approved drafts than the batch called for)` : "";
        setRunMsg(`Simulated batch for ${r.scheduled_date}: ${r.sent} of ${r.requested} marked sent${short}. No real email sent.`);
      }
      await load();
    } catch (e) {
      setRunMsg((e as Error).message);
    } finally {
      setRunning(false);
    }
  }

  if (loading) return <div style={{ color: "var(--text-dim)", fontSize: 14, padding: "32px 0" }}>Loading schedule…</div>;
  if (error) return <div style={{ color: "var(--red)", fontSize: 14, padding: "32px 0" }}>Could not load schedule: {error}</div>;

  const scheduled = rows.reduce((s, r) => s + (Number(r.target_count) || 0), 0);
  const poolSize = data?.poolSize ?? 0;
  const totalSent = data?.totalSent ?? 0;
  const showPrefill = rows.length === 0 && data?.prefill && data.prefill.length > 0;

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      {/* Dry-run banner */}
      <div style={{ padding: "8px 12px", borderRadius: 6, background: "var(--gold-dim)", border: "1px solid var(--gold-border)", fontSize: 12, color: "var(--gold)" }}>
        Simulation mode — batches are marked &ldquo;sent&rdquo; for preview only. No real email goes out yet.
      </div>

      {/* Tally */}
      <p style={{ fontSize: 13, color: "var(--text-secondary)", margin: 0 }}>
        Scheduled <strong style={{ color: "var(--text-primary)" }}>{scheduled.toLocaleString()}</strong> of{" "}
        <strong style={{ color: "var(--text-primary)" }}>{poolSize.toLocaleString()}</strong> sendable
        {totalSent > 0 && <> · {totalSent.toLocaleString()} simulated-sent</>}
      </p>

      {showPrefill ? (
        <div style={{ border: "1px solid var(--border)", borderRadius: 8, padding: 16, background: "var(--surface)" }}>
          <p className="eyebrow" style={{ marginBottom: 10 }}>Suggested warm-up plan</p>
          <div style={{ display: "flex", flexDirection: "column", gap: 6, marginBottom: 14 }}>
            {data!.prefill!.map((p, i) => (
              <div key={i} style={{ display: "flex", justifyContent: "space-between", fontSize: 13, color: "var(--text-secondary)" }}>
                <span>{p.scheduled_date}</span>
                <span className="tabular-nums">{p.target_count} emails</span>
              </div>
            ))}
          </div>
          <div style={{ display: "flex", gap: 10 }}>
            <button onClick={usePrefill} className="btn-teal" style={{ padding: "8px 14px", borderRadius: 6, fontSize: 13, fontWeight: 600 }}>Use this plan</button>
            <button onClick={addRow} style={{ padding: "8px 14px", borderRadius: 6, fontSize: 13, border: "1px solid var(--border-hi)", background: "var(--surface-hi)", color: "var(--text-secondary)" }}>Start blank</button>
          </div>
        </div>
      ) : (
        <>
          {/* Editable rows */}
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {rows.map((r, i) => {
              const done = r.status === "done";
              return (
                <div key={r.id ?? `new-${i}`} style={{ display: "flex", alignItems: "center", gap: 10, padding: "8px 10px", borderRadius: 6, border: "1px solid var(--border)", background: done ? "var(--surface-hi)" : "var(--surface)" }}>
                  <input type="date" value={r.scheduled_date} disabled={done}
                    onChange={(e) => patchRow(i, { scheduled_date: e.target.value })}
                    style={{ flex: 1, background: "transparent", border: "none", color: "var(--text-primary)", fontSize: 13 }} />
                  <input type="number" min={0} value={r.target_count} disabled={done}
                    onChange={(e) => patchRow(i, { target_count: Math.max(0, parseInt(e.target.value || "0", 10)) })}
                    style={{ width: 70, textAlign: "right", background: "transparent", border: "1px solid var(--border)", borderRadius: 4, padding: "4px 6px", color: "var(--text-primary)", fontSize: 13 }} />
                  <span style={{ fontSize: 12, color: "var(--text-dim)" }}>emails</span>
                  {done ? (
                    <span style={{ fontSize: 11, color: "var(--gold)", minWidth: 70, textAlign: "right" }}>✓ {r.sent_count} sent</span>
                  ) : (
                    <button onClick={() => removeRow(i)} aria-label="Remove" style={{ minWidth: 70, textAlign: "right", background: "none", border: "none", color: "var(--text-dim)", cursor: "pointer", fontSize: 16 }}>✕</button>
                  )}
                </div>
              );
            })}
          </div>

          <div style={{ display: "flex", flexWrap: "wrap", gap: 10 }}>
            <button onClick={addRow} style={{ padding: "8px 14px", borderRadius: 6, fontSize: 13, border: "1px solid var(--border-hi)", background: "var(--surface-hi)", color: "var(--text-secondary)" }}>+ Add date</button>
            <button onClick={save} disabled={saving} className="btn-teal" style={{ padding: "8px 14px", borderRadius: 6, fontSize: 13, fontWeight: 600 }}>{saving ? "Saving…" : "Save schedule"}</button>
            <button onClick={runDue} disabled={running} style={{ padding: "8px 14px", borderRadius: 6, fontSize: 13, border: "1px solid var(--gold-border)", background: "var(--gold-dim)", color: "var(--gold)" }}>{running ? "Running…" : "Run due batch now (simulate)"}</button>
          </div>
        </>
      )}

      {runMsg && <p style={{ fontSize: 13, color: "var(--text-secondary)", margin: 0 }}>{runMsg}</p>}
    </div>
  );
}
