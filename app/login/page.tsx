import { Suspense } from "react";

import { LoginForm } from "./LoginForm";

export const metadata = { title: "Sign in — Welding Statistics Dashboard" };

/** Sign in by e-mail and password (owner, 2026-10-28). */
export default function LoginPage() {
  return (
    <div className="login-wrap">
      <div className="login-card">
        <h1 className="login-title">Sign in</h1>
        <p className="login-sub">Welding Statistics Dashboard — your e-mail and password.</p>
        <Suspense fallback={null}>
          <LoginForm />
        </Suspense>
      </div>
    </div>
  );
}
