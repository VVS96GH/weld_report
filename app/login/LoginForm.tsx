"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useState } from "react";

import { resetMe } from "@/lib/me";

/** Where to go after signing in: a page of this site only. */
function safeNext(v: string | null): string {
  return v && v.startsWith("/") && !v.startsWith("//") && !v.startsWith("/login") ? v : "/";
}

export function LoginForm() {
  const router = useRouter();
  const sp = useSearchParams();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    const r = await fetch("/api/auth/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, password }),
    }).catch(() => null);
    setBusy(false);
    if (!r?.ok) {
      const body = (await r?.json().catch(() => null)) as { error?: string } | null;
      setError(body?.error ?? "Sign-in failed: the server does not answer");
      return;
    }
    const user = (await r.json().catch(() => null)) as { must_change_password?: boolean } | null;
    resetMe();
    // a password an administrator set: change it first
    router.replace(user?.must_change_password ? "/account?first=1" : safeNext(sp.get("next")));
    router.refresh();
  }

  return (
    <form className="login-form" onSubmit={submit}>
      <label className="login-field">
        <span>E-mail</span>
        <input type="email" autoComplete="username" required autoFocus value={email} onChange={(e) => setEmail(e.target.value)} />
      </label>
      <label className="login-field">
        <span>Password</span>
        <input type="password" autoComplete="current-password" required value={password} onChange={(e) => setPassword(e.target.value)} />
      </label>
      {error ? <p className="login-error">{error}</p> : null}
      <button type="submit" className="login-btn" disabled={busy}>
        {busy ? "Signing in…" : "Sign in"}
      </button>
      <p className="login-hint">Forgot the password? Ask an administrator to reset it.</p>
    </form>
  );
}
