"use client";

import { useEffect, useState } from "react";

import { toggleLayoutEdit } from "./CardResizer";

/** ⤡ in the header: the layout edit mode on / off (components/CardResizer). */
export function LayoutEditButton({ className = "header-btn" }: { className?: string }) {
  const [on, setOn] = useState(false);
  useEffect(() => {
    const d = document.documentElement;
    const mo = new MutationObserver(() => setOn(d.hasAttribute("data-layout-edit")));
    mo.observe(d, { attributes: true, attributeFilter: ["data-layout-edit"] });
    return () => mo.disconnect();
  }, []);
  return (
    <button
      type="button"
      className={`${className} layout-edit-btn${on ? " is-on" : ""}`}
      aria-pressed={on}
      title={on ? "Done editing the layout" : "Edit the layout: resize tables and charts"}
      aria-label="Edit the layout"
      onClick={toggleLayoutEdit}
    >
      <span aria-hidden="true">⤡</span>
    </button>
  );
}
