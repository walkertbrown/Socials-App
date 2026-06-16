"use client";

import { useState, useEffect, useRef } from "react";
import type { DmThread, DmMessage } from "@/lib/db/dm-threads";

type Platform = "instagram" | "facebook";

export function MessagesClient({ initialThreads }: { initialThreads: DmThread[] }) {
  const [threads, setThreads] = useState(initialThreads);
  const [platform, setPlatform] = useState<Platform>("instagram");
  const [activeThreadId, setActiveThreadId] = useState<string | null>(null);
  const [messages, setMessages] = useState<DmMessage[]>([]);
  const [replyText, setReplyText] = useState("");
  const [sending, setSending] = useState(false);
  const [activeTab, setActiveTab] = useState<"inbox" | "settings">("inbox");
  const bottomRef = useRef<HTMLDivElement>(null);

  const filtered = threads.filter((t) => t.platform === platform);
  const igUnread = threads.filter((t) => t.platform === "instagram").reduce((s, t) => s + t.unread_count, 0);
  const fbUnread = threads.filter((t) => t.platform === "facebook").reduce((s, t) => s + t.unread_count, 0);
  const activeThread = threads.find((t) => t.id === activeThreadId) ?? null;

  async function openThread(thread: DmThread) {
    setActiveThreadId(thread.id);
    setMessages([]);
    const res = await fetch(`/api/messages/${thread.id}`);
    if (res.ok) {
      const msgs: DmMessage[] = await res.json();
      setMessages(msgs);
      // Clear unread in local state.
      setThreads((prev) => prev.map((t) => (t.id === thread.id ? { ...t, unread_count: 0 } : t)));
    }
  }

  async function sendReply() {
    if (!activeThreadId || !replyText.trim() || sending) return;
    setSending(true);
    const text = replyText.trim();
    setReplyText("");
    const res = await fetch(`/api/messages/${activeThreadId}/reply`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ text }),
    });
    if (res.ok) {
      // Optimistically append.
      setMessages((prev) => [
        ...prev,
        {
          id: `tmp-${Date.now()}`,
          thread_id: activeThreadId,
          platform_message_id: `tmp-${Date.now()}`,
          direction: "outbound",
          body: text,
          sent_at: new Date().toISOString(),
          auto_reply_rule_id: null,
          created_at: new Date().toISOString(),
        },
      ]);
    } else {
      setReplyText(text);
    }
    setSending(false);
  }

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100vh", fontFamily: "system-ui, sans-serif", background: "#f5f5f5" }}>
      {/* Header */}
      <div style={{ background: "#1a1a1a", color: "#fff", padding: "12px 20px", display: "flex", alignItems: "center", gap: 24 }}>
        <span style={{ fontWeight: 700, fontSize: 16 }}>Messages</span>
        <button onClick={() => setActiveTab("inbox")} style={tabStyle(activeTab === "inbox")}>Inbox</button>
        <button onClick={() => setActiveTab("settings")} style={tabStyle(activeTab === "settings")}>Auto-reply rules</button>
      </div>

      {activeTab === "settings" ? (
        <RulesSettings />
      ) : (
        <div style={{ display: "flex", flex: 1, overflow: "hidden" }}>
          {/* Sidebar */}
          <div style={{ width: 300, borderRight: "1px solid #e0e0e0", display: "flex", flexDirection: "column", background: "#fff" }}>
            {/* Platform tabs */}
            <div style={{ display: "flex", borderBottom: "1px solid #e0e0e0" }}>
              {(["instagram", "facebook"] as Platform[]).map((p) => {
                const unread = p === "instagram" ? igUnread : fbUnread;
                return (
                  <button key={p} onClick={() => setPlatform(p)} style={{ flex: 1, padding: "10px 0", background: platform === p ? "#f0f0f0" : "#fff", border: "none", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", gap: 6, fontWeight: platform === p ? 700 : 400 }}>
                    {p === "instagram" ? "Instagram" : "Facebook"}
                    {unread > 0 && <span style={{ background: "#e53935", color: "#fff", borderRadius: 10, padding: "1px 7px", fontSize: 11 }}>{unread}</span>}
                  </button>
                );
              })}
            </div>

            {/* Thread list */}
            <div style={{ flex: 1, overflowY: "auto" }}>
              {filtered.length === 0 && (
                <div style={{ padding: 20, color: "#999", fontSize: 14 }}>No messages yet.</div>
              )}
              {filtered.map((t) => (
                <button key={t.id} onClick={() => openThread(t)} style={{ display: "block", width: "100%", textAlign: "left", padding: "12px 16px", background: activeThreadId === t.id ? "#e8f0fe" : "#fff", border: "none", borderBottom: "1px solid #f0f0f0", cursor: "pointer" }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 2 }}>
                    <span style={{ fontWeight: t.unread_count > 0 ? 700 : 400, fontSize: 14 }}>
                      {t.participant_name ?? t.thread_id.split(":")[1]}
                    </span>
                    <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
                      {t.auto_replied_at && <span style={{ fontSize: 10, color: "#2e7d32", background: "#e8f5e9", borderRadius: 4, padding: "1px 5px" }}>auto</span>}
                      {t.unread_count > 0 && <span style={{ background: "#1976d2", color: "#fff", borderRadius: 10, padding: "1px 7px", fontSize: 11 }}>{t.unread_count}</span>}
                    </div>
                  </div>
                  <div style={{ fontSize: 12, color: "#666", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                    {t.last_message_preview ?? ""}
                  </div>
                  {t.last_message_at && (
                    <div style={{ fontSize: 11, color: "#999", marginTop: 2 }}>
                      {new Date(t.last_message_at).toLocaleString()}
                    </div>
                  )}
                </button>
              ))}
            </div>
          </div>

          {/* Thread view */}
          <div style={{ flex: 1, display: "flex", flexDirection: "column", background: "#fff" }}>
            {!activeThread ? (
              <div style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center", color: "#999" }}>
                Select a conversation
              </div>
            ) : (
              <>
                <div style={{ padding: "12px 20px", borderBottom: "1px solid #e0e0e0", fontWeight: 600 }}>
                  {activeThread.participant_name ?? activeThread.thread_id.split(":")[1]}
                </div>
                <div style={{ flex: 1, overflowY: "auto", padding: 20, display: "flex", flexDirection: "column", gap: 8 }}>
                  {messages.map((m) => (
                    <div key={m.id} style={{ display: "flex", justifyContent: m.direction === "outbound" ? "flex-end" : "flex-start" }}>
                      <div style={{ maxWidth: "70%", background: m.direction === "outbound" ? "#1976d2" : "#f0f0f0", color: m.direction === "outbound" ? "#fff" : "#111", borderRadius: 12, padding: "8px 12px" }}>
                        <div style={{ fontSize: 14 }}>{m.body}</div>
                        <div style={{ display: "flex", gap: 6, marginTop: 3, alignItems: "center", justifyContent: "flex-end" }}>
                          {m.auto_reply_rule_id && <span style={{ fontSize: 10, background: "rgba(255,255,255,0.25)", borderRadius: 4, padding: "1px 5px" }}>auto</span>}
                          <span style={{ fontSize: 10, opacity: 0.7 }}>{new Date(m.sent_at).toLocaleTimeString()}</span>
                        </div>
                      </div>
                    </div>
                  ))}
                  <div ref={bottomRef} />
                </div>
                <div style={{ padding: "12px 16px", borderTop: "1px solid #e0e0e0", display: "flex", gap: 8 }}>
                  <textarea
                    value={replyText}
                    onChange={(e) => setReplyText(e.target.value)}
                    onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); sendReply(); } }}
                    placeholder="Reply… (Enter to send, Shift+Enter for newline)"
                    rows={2}
                    style={{ flex: 1, resize: "none", border: "1px solid #ccc", borderRadius: 8, padding: "8px 10px", fontSize: 14, fontFamily: "inherit" }}
                  />
                  <button onClick={sendReply} disabled={sending || !replyText.trim()} style={{ padding: "8px 18px", background: "#1976d2", color: "#fff", border: "none", borderRadius: 8, cursor: "pointer", fontWeight: 600, opacity: sending || !replyText.trim() ? 0.5 : 1 }}>
                    {sending ? "…" : "Send"}
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

// ── Auto-reply rules settings tab ─────────────────────────────────────────────

type Rule = { id: string; trigger_pattern: string; reply_text: string; active: boolean };

function RulesSettings() {
  const [rules, setRules] = useState<Rule[]>([]);
  const [addingStep, setAddingStep] = useState<null | "trigger" | "reply">(null);
  const [newTrigger, setNewTrigger] = useState("");
  const [newReply, setNewReply] = useState("");

  useEffect(() => { fetchRules(); }, []);

  async function fetchRules() {
    const res = await fetch("/api/auto-replies");
    if (res.ok) setRules(await res.json());
  }

  async function toggle(rule: Rule) {
    await fetch(`/api/auto-replies/${rule.id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ active: !rule.active }) });
    fetchRules();
  }

  async function remove(id: string) {
    await fetch(`/api/auto-replies/${id}`, { method: "DELETE" });
    fetchRules();
  }

  async function saveRule() {
    if (!newTrigger.trim() || !newReply.trim()) return;
    await fetch("/api/auto-replies", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ trigger_pattern: newTrigger.trim(), reply_text: newReply.trim() }) });
    setAddingStep(null); setNewTrigger(""); setNewReply("");
    fetchRules();
  }

  return (
    <div style={{ maxWidth: 640, margin: "32px auto", padding: "0 20px" }}>
      <h2 style={{ marginBottom: 16 }}>Auto-reply rules</h2>
      <p style={{ color: "#666", fontSize: 14, marginBottom: 24 }}>Rules fire once per conversation, on the opening message only. Haiku classifies conservatively — complaints and ambiguous messages always go to manual.</p>
      {rules.map((r) => (
        <div key={r.id} style={{ background: "#fff", border: "1px solid #e0e0e0", borderRadius: 8, padding: 14, marginBottom: 10 }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 12 }}>
            <div style={{ flex: 1 }}>
              <div style={{ fontWeight: 600, marginBottom: 4 }}>{r.trigger_pattern}</div>
              <div style={{ fontSize: 13, color: "#555" }}>{r.reply_text}</div>
            </div>
            <div style={{ display: "flex", gap: 8, flexShrink: 0 }}>
              <button onClick={() => toggle(r)} style={{ fontSize: 12, padding: "4px 10px", borderRadius: 6, border: "1px solid #ccc", background: r.active ? "#e8f5e9" : "#fafafa", cursor: "pointer" }}>
                {r.active ? "Active" : "Off"}
              </button>
              <button onClick={() => remove(r.id)} style={{ fontSize: 12, padding: "4px 10px", borderRadius: 6, border: "1px solid #ffcdd2", background: "#fff8f8", color: "#c62828", cursor: "pointer" }}>Delete</button>
            </div>
          </div>
        </div>
      ))}

      {addingStep === null && (
        <button onClick={() => setAddingStep("trigger")} style={{ marginTop: 8, padding: "8px 18px", background: "#1a1a1a", color: "#fff", border: "none", borderRadius: 8, cursor: "pointer" }}>+ Add rule</button>
      )}
      {addingStep === "trigger" && (
        <div style={{ background: "#fff", border: "1px solid #e0e0e0", borderRadius: 8, padding: 16, marginTop: 8 }}>
          <div style={{ marginBottom: 10, fontWeight: 600 }}>What messages should trigger this rule?</div>
          <textarea value={newTrigger} onChange={(e) => setNewTrigger(e.target.value)} placeholder='e.g. "asking about reservations or table booking"' rows={2} style={{ width: "100%", border: "1px solid #ccc", borderRadius: 6, padding: 8, fontSize: 14, fontFamily: "inherit", resize: "none", boxSizing: "border-box" }} />
          <div style={{ display: "flex", gap: 8, marginTop: 8 }}>
            <button onClick={() => { if (newTrigger.trim()) setAddingStep("reply"); }} disabled={!newTrigger.trim()} style={{ padding: "6px 16px", background: "#1a1a1a", color: "#fff", border: "none", borderRadius: 6, cursor: "pointer", opacity: newTrigger.trim() ? 1 : 0.4 }}>Next</button>
            <button onClick={() => { setAddingStep(null); setNewTrigger(""); }} style={{ padding: "6px 14px", border: "1px solid #ccc", background: "#fff", borderRadius: 6, cursor: "pointer" }}>Cancel</button>
          </div>
        </div>
      )}
      {addingStep === "reply" && (
        <div style={{ background: "#fff", border: "1px solid #e0e0e0", borderRadius: 8, padding: 16, marginTop: 8 }}>
          <div style={{ marginBottom: 4, fontWeight: 600 }}>Trigger: <span style={{ fontWeight: 400, color: "#555" }}>{newTrigger}</span></div>
          <div style={{ marginBottom: 10, fontWeight: 600 }}>What should the auto-reply say?</div>
          <textarea value={newReply} onChange={(e) => setNewReply(e.target.value)} placeholder="Hi! Thanks for reaching out…" rows={3} style={{ width: "100%", border: "1px solid #ccc", borderRadius: 6, padding: 8, fontSize: 14, fontFamily: "inherit", resize: "none", boxSizing: "border-box" }} />
          <div style={{ display: "flex", gap: 8, marginTop: 8 }}>
            <button onClick={saveRule} disabled={!newReply.trim()} style={{ padding: "6px 16px", background: "#1a1a1a", color: "#fff", border: "none", borderRadius: 6, cursor: "pointer", opacity: newReply.trim() ? 1 : 0.4 }}>Save rule</button>
            <button onClick={() => setAddingStep("trigger")} style={{ padding: "6px 14px", border: "1px solid #ccc", background: "#fff", borderRadius: 6, cursor: "pointer" }}>Back</button>
          </div>
        </div>
      )}
    </div>
  );
}

function tabStyle(active: boolean): React.CSSProperties {
  return { background: "none", border: "none", color: active ? "#fff" : "#aaa", fontWeight: active ? 700 : 400, cursor: "pointer", fontSize: 14, paddingBottom: 2, borderBottom: active ? "2px solid #fff" : "2px solid transparent" };
}
