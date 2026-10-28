"use client";

import { useState } from "react";

import { useMe } from "@/lib/me";

export function PasswordForm() {
  const me = useMe();
  const [current, setCurrent] = useState("");
  const [next, setNext] = useState("");
  const [again, setAgain] = useState("");
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (next !== again)
      return setMsg({ ok: false, text: "The two new passwords differ." });
    const r = await fetch("/api/auth/password", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ current, new: next }),
    }).catch(() => null);
    if (r?.ok) {
      setMsg({ ok: true, text: "Password changed." });
      setCurrent("");
      setNext("");
      setAgain("");
    } else {
      const m = ((await r?.json().catch(() => null)) as { error?: string } | null)?.error;
      setMsg({ ok: false, text: m ?? "Could not change the password." });
    }
  }

  return (
    <form className="card mt-6 flex max-w-md flex-col gap-4" onSubmit={submit}>
      <div className="card-header">{me ? me.email : "…"}</div>
      <label className="login-field">
        <span>Current password</span>
        <input
          type="password"
          autoComplete="current-password"
          required
          value={current}
          onChange={(e) => setCurrent(e.target.value)}
        />
      </label>
      <label className="login-field">
        <span>New password</span>
        <input
          type="password"
          autoComplete="new-password"
          minLength={8}
          required
          value={next}
          onChange={(e) => setNext(e.target.value)}
        />
      </label>
      <label className="login-field">
        <span>New password again</span>
        <input
          type="password"
          autoComplete="new-password"
          minLength={8}
          required
          value={again}
          onChange={(e) => setAgain(e.target.value)}
        />
      </label>
      {msg ? (
        <p className={`text-sm ${msg.ok ? "text-good-text" : "text-bad-text"}`}>
          {msg.text}
        </p>
      ) : null}
      <button type="submit" className="login-btn">
        Change password
      </button>
    </form>
  );
}
