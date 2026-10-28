import { AdminUsers } from "./AdminUsers";

export const metadata = { title: "Administration — Welding Statistics Dashboard" };

/** Administration: who may sign in, and with which role (owner, 2026-10-28). */
export default function AdminPage() {
  return (
    <div className="main-content admin-page">
      <h1 className="admin-title">Administration</h1>
      <p className="login-sub">
        Users sign in with their e-mail and password. <b>Administrator</b>: manages users, refreshes the data and changes the
        shared settings (Views, columns, graph sizes, CUM files, notes). <b>User</b>: reads the reports, downloads the exports
        and PDFs.
      </p>
      <AdminUsers />
    </div>
  );
}
