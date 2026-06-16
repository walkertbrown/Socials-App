"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";

// Single login screen. There is no sign-up — the one account is created
// in the Supabase dashboard (see SETUP.md).
export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    const supabase = createSupabaseBrowserClient();
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) {
      setError(error.message);
      setLoading(false);
      return;
    }
    router.push("/board");
    router.refresh();
  }

  return (
    <div
      className="flex flex-1 items-center justify-center p-6"
      style={{ background: "var(--bg)" }}
    >
      <form
        onSubmit={handleSubmit}
        className="w-full max-w-sm space-y-4 p-8"
        style={{
          background: "var(--surface)",
          border: "1px solid var(--border)",
          borderRadius: "var(--radius)",
          boxShadow: "var(--shadow)",
        }}
      >
        <h1
          className="text-2xl tracking-tight"
          style={{ fontFamily: "var(--font-serif)", fontWeight: 600, color: "var(--text-primary)" }}
        >
          Provenance
        </h1>
        <p className="text-sm" style={{ color: "var(--text-secondary)" }}>Sign in to continue.</p>
        <input
          type="email"
          required
          placeholder="Email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          className="w-full rounded-md px-3 py-2 text-sm"
          style={{
            border: "1px solid var(--border-hi)",
            background: "var(--surface-hi)",
            color: "var(--text-primary)",
          }}
        />
        <div style={{ position: "relative" }}>
          <input
            type={showPassword ? "text" : "password"}
            required
            placeholder="Password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="w-full rounded-md px-3 py-2 text-sm"
            style={{
              border: "1px solid var(--border-hi)",
              background: "var(--surface-hi)",
              color: "var(--text-primary)",
              paddingRight: 36,
            }}
          />
          <button
            type="button"
            onClick={() => setShowPassword((v) => !v)}
            style={{ position: "absolute", right: 8, top: "50%", transform: "translateY(-50%)", background: "none", border: "none", cursor: "pointer", color: "var(--text-dim)", padding: 2, lineHeight: 1 }}
            aria-label={showPassword ? "Hide password" : "Show password"}
          >
            {showPassword ? (
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94"/>
                <path d="M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19"/>
                <line x1="1" y1="1" x2="23" y2="23"/>
              </svg>
            ) : (
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/>
                <circle cx="12" cy="12" r="3"/>
              </svg>
            )}
          </button>
        </div>
        {error && <p className="text-sm" style={{ color: "var(--red)" }}>{error}</p>}
        <button
          type="submit"
          disabled={loading}
          className="w-full rounded-md px-4 py-2 text-sm font-medium transition-colors hover:opacity-90 disabled:opacity-50"
          style={{ background: "var(--gold)", color: "var(--bg)" }}
        >
          {loading ? "Signing in…" : "Sign in"}
        </button>
      </form>
    </div>
  );
}
