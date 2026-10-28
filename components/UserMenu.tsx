"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";

import { resetMe, useMe } from "@/lib/me";

/** The signed-in user in the header: administration (admins), my password, sign out. */
export function UserMenu() {
  const me = useMe();
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const box = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      if (box.current && !box.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", onDown);
    return () => document.removeEventListener("mousedown", onDown);
  }, [open]);
  if (!me) return null;

  async function signOut() {
    await fetch("/api/auth/logout", { method: "POST" }).catch(() => null);
    resetMe();
    router.replace("/login");
    router.refresh();
  }

  return (
    <div ref={box} className="user-menu">
      <button
        type="button"
        className="header-btn user-menu-btn"
        aria-haspopup="menu"
        aria-expanded={open}
        title={me.email}
        onClick={() => setOpen((o) => !o)}
      >
        {(me.name || me.email).charAt(0).toUpperCase()}
      </button>
      {open ? (
        <div className="user-menu-panel" role="menu">
          <div className="user-menu-who">
            {me.email}
            <span>{me.role === "admin" ? "Administrator" : "User"}</span>
          </div>
          {me.role === "admin" ? (
            <Link role="menuitem" href="/admin" onClick={() => setOpen(false)}>
              Administration
            </Link>
          ) : null}
          <Link role="menuitem" href="/account" onClick={() => setOpen(false)}>
            My password
          </Link>
          <button role="menuitem" type="button" onClick={() => void signOut()}>
            Sign out
          </button>
        </div>
      ) : null}
    </div>
  );
}
