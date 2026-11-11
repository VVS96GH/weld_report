/**
 * A faint diagonal copyright notice over every page (owner, 2026-11-11: protect the site from
 * copying). It shows on screen, in printouts and in the PDFs, and never catches a click.
 */
const TEXT = "© All rights reserved by Viktor Savin · Copying prohibited";

const SVG =
  `<svg xmlns='http://www.w3.org/2000/svg' width='640' height='330'>` +
  `<text x='20' y='285' transform='rotate(-24 20 285)' font-family='Inter, Arial, sans-serif' ` +
  `font-size='16' font-weight='600' fill='rgb(128,128,128)' fill-opacity='0.16'>${TEXT}</text></svg>`;

export function Watermark() {
  return (
    <div
      aria-hidden="true"
      className="wm-overlay"
      style={{ backgroundImage: `url("data:image/svg+xml;utf8,${encodeURIComponent(SVG)}")` }}
    />
  );
}
