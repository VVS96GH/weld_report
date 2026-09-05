import type { MetadataRoute } from "next";

/**
 * Web app manifest (Next 16 metadata file convention → served at /manifest.webmanifest).
 * Content lifted from the brand kit's site.webmanifest (docs/brand-README.md) with the
 * app's own name; theme colour agrees with `viewport.themeColor` in app/layout.tsx and
 * the brand navy in app/styles/tokens.css.
 */
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Welding Statistics Dashboard",
    short_name: "Weld Report",
    description: "Weekly welding progress, NDE status, and PWHT/rejection report.",
    start_url: "/welding/1",
    display: "standalone",
    theme_color: "#00284C",
    background_color: "#00284C",
    icons: [
      { src: "/brand/icon-192.png", sizes: "192x192", type: "image/png" },
      { src: "/brand/icon-512.png", sizes: "512x512", type: "image/png" },
    ],
  };
}
