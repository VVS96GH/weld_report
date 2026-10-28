/**
 * Sign-in by e-mail and password (owner, 2026-10-28), the same rules as the Welding Statistics
 * Platform: scrypt hashes (the same format), a random session token in the `wr_session` cookie
 * (the platform's is `wp_session`: one host, two ports share cookies), only its SHA-256 kept.
 * Roles: admin — users, data refresh and every shared setting; user — reads and downloads.
 */
import { createHash, randomBytes, randomInt, scrypt as scryptCb, timingSafeEqual } from "node:crypto";
import { promisify } from "node:util";

import { queryFresh } from "@/lib/db";

const scrypt = promisify(scryptCb) as (pw: string, salt: Buffer, len: number, o: object) => Promise<Buffer>;

export const SESSION_COOKIE = "wr_session";
export const SESSION_DAYS = 14;
const N = 2 ** 14;
const R = 8;
const P = 1;

export type Role = "admin" | "user";
export type User = {
  id: number;
  email: string;
  name: string;
  role: Role;
  active: boolean;
  must_change_password: boolean;
  created_at: string;
  last_login_at: string | null;
};

export async function hashPassword(pw: string): Promise<string> {
  const salt = randomBytes(16);
  const h = await scrypt(pw, salt, 32, { N, r: R, p: P, maxmem: 64 * 1024 * 1024 });
  return `scrypt$${N}$${R}$${P}$${salt.toString("base64")}$${h.toString("base64")}`;
}

export async function verifyPassword(pw: string, stored: string): Promise<boolean> {
  const [kind, n, r, p, salt, digest] = stored.split("$");
  if (kind !== "scrypt" || !salt || !digest) return false;
  try {
    const want = Buffer.from(digest, "base64");
    const got = await scrypt(pw, Buffer.from(salt, "base64"), want.length, {
      N: Number(n),
      r: Number(r),
      p: Number(p),
      maxmem: 64 * 1024 * 1024,
    });
    return got.length === want.length && timingSafeEqual(got, want);
  } catch {
    return false;
  }
}

export const tokenHash = (t: string) => createHash("sha256").update(t).digest("hex");
export const newToken = () => randomBytes(32).toString("base64url");

/** A temporary password an administrator hands over: 14 characters, easy to type. */
export function newPassword(): string {
  const a = "abcdefghjkmnpqrstuvwxyzABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  return Array.from({ length: 14 }, () => a[randomInt(a.length)]).join("");
}

const USER_COLS =
  "u.id::int AS id, u.email, u.name, u.role, u.active, u.must_change_password, u.created_at::text, u.last_login_at::text";

/** The user of a session token (active, not expired), or null. */
export async function userByToken(token: string | undefined | null): Promise<User | null> {
  if (!token) return null;
  const [u] = await queryFresh<User>(
    `SELECT ${USER_COLS} FROM user_session s JOIN app_user u ON u.id = s.user_id
      WHERE s.token_hash = $1 AND s.expires_at > now() AND u.active`,
    [tokenHash(token)],
  );
  return u ?? null;
}

// a guesser: after 5 wrong passwords for one e-mail, that e-mail waits 5 minutes
const MAX_FAILS = 5;
const LOCK_MS = 300_000;
const fails = new Map<string, number[]>();

export type LoginResult = { ok: true; token: string; user: User; expires: Date } | { ok: false; message: string };

export async function login(emailRaw: string, password: string): Promise<LoginResult> {
  const email = emailRaw.trim().toLowerCase();
  const now = Date.now();
  const recent = (fails.get(email) ?? []).filter((t) => now - t < LOCK_MS);
  fails.set(email, recent);
  if (recent.length >= MAX_FAILS) return { ok: false, message: "Too many attempts: try again in a few minutes" };
  const [row] = await queryFresh<User & { password_hash: string }>(
    `SELECT ${USER_COLS}, u.password_hash FROM app_user u WHERE u.email = $1`,
    [email],
  );
  if (!row || !row.active || !(await verifyPassword(password, row.password_hash))) {
    recent.push(now);
    return { ok: false, message: "Wrong e-mail or password" };
  }
  fails.delete(email);
  const token = newToken();
  const expires = new Date(now + SESSION_DAYS * 86_400_000);
  await queryFresh("INSERT INTO user_session (token_hash, user_id, expires_at) VALUES ($1, $2, $3)", [
    tokenHash(token),
    row.id,
    expires.toISOString(),
  ]);
  await queryFresh("DELETE FROM user_session WHERE expires_at < now()");
  await queryFresh("UPDATE app_user SET last_login_at = now() WHERE id = $1", [row.id]);
  const { password_hash: _drop, ...user } = row;
  void _drop;
  return { ok: true, token, user, expires };
}

export async function logout(token: string | undefined): Promise<void> {
  if (token) await queryFresh("DELETE FROM user_session WHERE token_hash = $1", [tokenHash(token)]);
}

export async function changePassword(user: User, current: string, next: string): Promise<string | null> {
  const [row] = await queryFresh<{ password_hash: string }>("SELECT password_hash FROM app_user WHERE id = $1", [user.id]);
  if (!row || !(await verifyPassword(current, row.password_hash))) return "The current password is wrong";
  if (next.length < 8) return "The new password needs at least 8 characters";
  if (next === current) return "The new password must differ from the current one";
  await queryFresh("UPDATE app_user SET password_hash = $1, must_change_password = false WHERE id = $2", [
    await hashPassword(next),
    user.id,
  ]);
  return null;
}

// ---- administration ----
const EMAIL = /^[^@\s]+@[^@\s]+\.[^@\s]+$/;

export async function listUsers(): Promise<User[]> {
  return queryFresh<User>(`SELECT ${USER_COLS} FROM app_user u ORDER BY u.email`);
}

export async function addUser(b: {
  email: string;
  name?: string;
  role?: Role;
  password?: string | null;
}): Promise<{ user: User; password: string | null } | { error: string; status: number }> {
  const email = b.email.trim().toLowerCase();
  if (!EMAIL.test(email)) return { error: "Not an e-mail address", status: 400 };
  if (b.password && b.password.length < 8) return { error: "A password needs at least 8 characters", status: 400 };
  const role: Role = b.role === "admin" ? "admin" : "user";
  const [taken] = await queryFresh("SELECT 1 FROM app_user WHERE email = $1", [email]);
  if (taken) return { error: "This e-mail already has an account", status: 409 };
  const temp = b.password ? null : newPassword();
  const [user] = await queryFresh<User>(
    `INSERT INTO app_user (email, name, role, password_hash, must_change_password) VALUES ($1, $2, $3, $4, true)
     RETURNING id::int, email, name, role, active, must_change_password, created_at::text, last_login_at::text`,
    [email, (b.name ?? "").trim(), role, await hashPassword(b.password || temp || "")],
  );
  return { user: user!, password: temp };
}

export async function updateUser(
  me: User,
  id: number,
  b: { name?: string; role?: Role; active?: boolean },
): Promise<{ user: User } | { error: string; status: number }> {
  const [u] = await queryFresh<User>(`SELECT ${USER_COLS} FROM app_user u WHERE u.id = $1`, [id]);
  if (!u) return { error: `No user ${id}`, status: 404 };
  const losingAdmin = u.role === "admin" && u.active && (b.role === "user" || b.active === false);
  if (losingAdmin) {
    const [{ n }] = await queryFresh<{ n: number }>("SELECT count(*)::int AS n FROM app_user WHERE role = 'admin' AND active");
    if (n <= 1) return { error: "The last administrator stays: make another one first", status: 403 };
  }
  if (u.id === me.id && b.active === false) return { error: "You cannot switch off your own account", status: 403 };
  const [user] = await queryFresh<User>(
    `UPDATE app_user SET name = coalesce($2, name), role = coalesce($3, role), active = coalesce($4, active)
      WHERE id = $1 RETURNING id::int, email, name, role, active, must_change_password, created_at::text, last_login_at::text`,
    [id, b.name?.trim() ?? null, b.role === "admin" || b.role === "user" ? b.role : null, typeof b.active === "boolean" ? b.active : null],
  );
  if (b.active === false) await queryFresh("DELETE FROM user_session WHERE user_id = $1", [id]);
  return { user: user! };
}

export async function resetPassword(id: number): Promise<string | null> {
  const temp = newPassword();
  const rows = await queryFresh(
    "UPDATE app_user SET password_hash = $1, must_change_password = true WHERE id = $2 RETURNING id",
    [await hashPassword(temp), id],
  );
  if (!rows.length) return null;
  await queryFresh("DELETE FROM user_session WHERE user_id = $1", [id]);
  return temp;
}

/** The first administrator (command line): created, or made admin with this password. */
export async function ensureAdmin(emailRaw: string, password: string, name = ""): Promise<void> {
  const email = emailRaw.trim().toLowerCase();
  await queryFresh(
    `INSERT INTO app_user (email, name, role, password_hash, must_change_password) VALUES ($1, $2, 'admin', $3, true)
     ON CONFLICT (email) DO UPDATE SET role = 'admin', active = true, password_hash = EXCLUDED.password_hash,
       must_change_password = true`,
    [email, name, await hashPassword(password)],
  );
}
