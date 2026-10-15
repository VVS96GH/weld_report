"use client";

import { type RefObject, useLayoutEffect } from "react";

const GUTTER = 8;

/**
 * Keeps an open pop-up panel fully on screen (owner, 2026-10-15: "пусть его
 * будет видно целиком"): a panel anchored at its control's left edge that would
 * run past the right edge of the window is re-anchored to the control's right
 * edge instead, and the other way round. Panels laid out in the flow (the
 * Welder Performance side panel) are left alone.
 */
export function useKeepInView(ref: RefObject<HTMLElement | null>, open: boolean): void {
  useLayoutEffect(() => {
    const el = ref.current;
    if (!open || !el || getComputedStyle(el).position !== "absolute") return;
    el.style.insetInlineStart = "";
    el.style.insetInlineEnd = "";
    const r = el.getBoundingClientRect();
    const vw = document.documentElement.clientWidth;
    if (r.right > vw - GUTTER) {
      el.style.insetInlineStart = "auto";
      el.style.insetInlineEnd = "0";
      const r2 = el.getBoundingClientRect();
      // still too wide on that side (a narrow screen): pin it to the window instead
      if (r2.left < GUTTER) {
        el.style.insetInlineEnd = `${r2.left - GUTTER}px`;
      }
    } else if (r.left < GUTTER) {
      el.style.insetInlineStart = `${GUTTER - r.left}px`;
    }
  }, [ref, open]);
}
