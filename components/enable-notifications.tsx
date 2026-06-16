"use client";

import { useEffect, useState } from "react";

// Convert the VAPID public key (base64url) into the byte array PushManager wants.
function urlB64ToUint8Array(base64: string): Uint8Array {
  const padding = "=".repeat((4 - (base64.length % 4)) % 4);
  const b64 = (base64 + padding).replace(/-/g, "+").replace(/_/g, "/");
  const raw = atob(b64);
  const out = new Uint8Array(raw.length);
  for (let i = 0; i < raw.length; i++) out[i] = raw.charCodeAt(i);
  return out;
}

type State = "unsupported" | "off" | "on" | "working" | "error" | "denied";

// One-time setup on her phone: tap to allow notifications. After that, video
// reminders are pushed to this device. Safe to render anywhere she's logged in.
export function EnableNotifications() {
  const [state, setState] = useState<State>("off");

  useEffect(() => {
    if (typeof window === "undefined") return;
    if (!("serviceWorker" in navigator) || !("PushManager" in window)) {
      setState("unsupported");
      return;
    }
    if (Notification.permission === "denied") setState("denied");
    navigator.serviceWorker
      .getRegistration()
      .then((reg) => reg?.pushManager.getSubscription())
      .then((sub) => sub && setState("on"))
      .catch(() => {});
  }, []);

  async function enable() {
    setState("working");
    try {
      const key = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
      if (!key) throw new Error("missing key");
      const reg = await navigator.serviceWorker.register("/sw.js");
      await navigator.serviceWorker.ready;
      const permission = await Notification.requestPermission();
      if (permission !== "granted") return setState("denied");
      const sub = await reg.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlB64ToUint8Array(key) as BufferSource,
      });
      const res = await fetch("/api/push/subscribe", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(sub.toJSON()),
      });
      setState(res.ok ? "on" : "error");
    } catch {
      setState("error");
    }
  }

  if (state === "unsupported") return null;
  if (state === "on")
    return <span className="text-xs" style={{ color: "var(--green)" }}>🔔 Reminders on</span>;

  const label =
    state === "working" ? "Enabling…" : state === "denied" ? "Blocked in settings" : "🔔 Enable reminders";

  return (
    <button
      onClick={enable}
      disabled={state === "working" || state === "denied"}
      className="text-xs underline disabled:opacity-50"
      style={{ color: "var(--text-secondary)" }}
    >
      {label}
      {state === "error" && " — try again"}
    </button>
  );
}
