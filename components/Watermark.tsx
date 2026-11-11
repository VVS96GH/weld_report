"use client";

import { useEffect, useState } from "react";

import { useMe } from "@/lib/me";

/**
 * A faint diagonal "name · e-mail · date time" over every page of a signed-in user (owner,
 * 2026-11-11: protect the site from copying). A screenshot, a printout and the PDF (printed as the
 * asking user) show who took it. It never catches a click.
 */
export function Watermark() {
  const me = useMe();
  const [stamp, setStamp] = useState("");
  useEffect(() => {
    const tick = () =>
      setStamp(
        new Date().toLocaleString("en-GB", {
          day: "2-digit",
          month: "short",
          year: "numeric",
          hour: "2-digit",
          minute: "2-digit",
        }),
      );
    const first = setTimeout(tick, 0);
    const every = setInterval(tick, 60_000);
    return () => {
      clearTimeout(first);
      clearInterval(every);
    };
  }, []);
  if (!me) return null;
  const text = `${me.name || me.email} · ${me.email} · ${stamp}`
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;");
  const svg =
    `<svg xmlns='http://www.w3.org/2000/svg' width='520' height='240'>` +
    `<text x='0' y='150' transform='rotate(-24 0 150)' font-family='Inter, Arial, sans-serif' ` +
    `font-size='15' fill='rgb(128,128,128)' fill-opacity='0.16'>${text}</text></svg>`;
  return (
    <div
      aria-hidden="true"
      className="wm-overlay"
      style={{
        backgroundImage: `url("data:image/svg+xml;utf8,${encodeURIComponent(svg)}")`,
      }}
    />
  );
}
