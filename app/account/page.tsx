import { PasswordForm } from "./PasswordForm";

export const metadata = { title: "My password — Welding Statistics Dashboard" };

/** My password: change it (it may be the same as the work account's). */
export default function AccountPage() {
  return (
    <div className="main-content admin-page">
      <h1 className="admin-title">My password</h1>
      <p className="login-sub">At least 8 characters. It may be the same as your work account&apos;s password.</p>
      <PasswordForm />
    </div>
  );
}
