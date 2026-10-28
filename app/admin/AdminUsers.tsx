"use client";

import { useCallback, useEffect, useState } from "react";

import { useMe } from "@/lib/me";

type User = {
  id: number;
  email: string;
  name: string;
  role: "admin" | "user";
  active: boolean;
  created_at: string;
  last_login_at: string | null;
};

const when = (v: string | null) =>
  v
    ? new Date(v).toLocaleString("en-GB", {
        dateStyle: "medium",
        timeStyle: "short",
      })
    : "—";
// this site's API answers {error: "…"}
const errorOf = (b: unknown) => (b as { error?: string } | null)?.error ?? "The server does not answer";

/** JSON call to this site's API: [status, body]. */
async function call<T>(url: string, method = "GET", body?: unknown): Promise<[number, T | null]> {
  const r = await fetch(url, {
    method,
    cache: "no-store",
    headers: body ? { "Content-Type": "application/json" } : undefined,
    body: body ? JSON.stringify(body) : undefined,
  }).catch(() => null);
  if (!r) return [0, null];
  return [r.status, (await r.json().catch(() => null)) as T | null];
}

export function AdminUsers() {
  const me = useMe();
  const [users, setUsers] = useState<User[] | null>(null);
  const [denied, setDenied] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  // a password shown once: after adding a user or resetting one
  const [shown, setShown] = useState<{
    email: string;
    password: string;
  } | null>(null);
  const [email, setEmail] = useState("");
  const [name, setName] = useState("");
  const [role, setRole] = useState<"admin" | "user">("user");
  const [password, setPassword] = useState("");

  const load = useCallback(async () => {
    const [st, b] = await call<{ users: User[] }>("/api/admin/users");
    if (st === 403) setDenied(true);
    setUsers(b?.users ?? []);
  }, []);

  useEffect(() => {
    let alive = true;
    void call<{ users: User[] }>("/api/admin/users").then(([st, b]) => {
      if (!alive) return;
      if (st === 403) setDenied(true);
      setUsers(b?.users ?? []);
    });
    return () => {
      alive = false;
    };
  }, []);

  async function add(e: React.FormEvent) {
    e.preventDefault();
    setMsg(null);
    const [st, b] = await call<{ user: User; password: string | null }>("/api/admin/users", "POST", {
      email,
      name,
      role,
      password: password || null,
    });
    if (st !== 200 || !b?.user) return setMsg(errorOf(b));
    if (b.password) setShown({ email: b.user.email, password: b.password });
    else setMsg(`Added ${b.user.email}.`);
    setEmail("");
    setName("");
    setPassword("");
    setRole("user");
    await load();
  }

  async function patch(
    u: User,
    body: { role?: "admin" | "user"; active?: boolean; name?: string },
  ) {
    setMsg(null);
    const [st, b] = await call<User>(`/api/admin/users/${u.id}`, "PATCH", body);
    if (st !== 200) setMsg(errorOf(b));
    await load();
  }

  async function reset(u: User) {
    if (!window.confirm(`Make a new temporary password for ${u.email}? The old one stops working.`)) return;
    const [st, b] = await call<{ password: string }>(`/api/admin/users/${u.id}/reset`, "POST");
    if (st === 200 && b?.password) setShown({ email: u.email, password: b.password });
    else setMsg(errorOf(b));
  }

  if (denied)
    return <p className="mt-6 text-sm text-bad-text">Administrators only.</p>;

  return (
    <div className="mt-6 flex flex-col gap-6">
      {shown ? (
        <div role="status" className="admin-secret">
          <div>
            Temporary password for <b>{shown.email}</b> — shown once, hand it
            over and ask to change it in “My password”:
          </div>
          <code>{shown.password}</code>
          <button
            type="button"
            className="ms-btn"
            onClick={() => void navigator.clipboard?.writeText(shown.password)}
          >
            Copy
          </button>
          <button
            type="button"
            className="ms-btn"
            onClick={() => setShown(null)}
          >
            Done
          </button>
        </div>
      ) : null}

      <form className="admin-add card" onSubmit={add}>
        <div className="card-header">Add a user</div>
        <div className="admin-add-row">
          <label>
            <span>E-mail (login)</span>
            <input
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
          </label>
          <label>
            <span>Name</span>
            <input value={name} onChange={(e) => setName(e.target.value)} />
          </label>
          <label>
            <span>Role</span>
            <select
              value={role}
              onChange={(e) => setRole(e.target.value as "admin" | "user")}
            >
              <option value="user">User</option>
              <option value="admin">Administrator</option>
            </select>
          </label>
          <label>
            <span>Password (optional)</span>
            <input
              type="password"
              minLength={8}
              autoComplete="new-password"
              placeholder="empty: a temporary one is made"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
          </label>
          <button type="submit" className="login-btn">
            Add
          </button>
        </div>
        {msg ? <p className="mt-2 text-sm text-muted">{msg}</p> : null}
      </form>

      <div className="card">
        <div className="card-header">Users</div>
        <div className="table-scroll">
          <table className="data-table admin-users">
            <thead>
              <tr>
                <th>E-mail</th>
                <th>Name</th>
                <th>Role</th>
                <th>Active</th>
                <th>Last sign-in</th>
                <th>Added</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {(users ?? []).map((u) => (
                <tr key={u.id} className={u.active ? "" : "opacity-50"}>
                  <td>
                    {u.email}
                    {me?.id === u.id ? (
                      <span className="ms-2 text-faint">(you)</span>
                    ) : null}
                  </td>
                  <td>{u.name}</td>
                  <td>
                    <select
                      value={u.role}
                      onChange={(e) =>
                        void patch(u, {
                          role: e.target.value as "admin" | "user",
                        })
                      }
                    >
                      <option value="user">User</option>
                      <option value="admin">Administrator</option>
                    </select>
                  </td>
                  <td>
                    <label className="inline-flex items-center gap-2">
                      <input
                        type="checkbox"
                        checked={u.active}
                        onChange={(e) =>
                          void patch(u, { active: e.target.checked })
                        }
                      />
                      {u.active ? "on" : "off"}
                    </label>
                  </td>
                  <td>{when(u.last_login_at)}</td>
                  <td>{when(u.created_at)}</td>
                  <td>
                    <button
                      type="button"
                      className="ms-btn"
                      onClick={() => void reset(u)}
                    >
                      Reset password
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
