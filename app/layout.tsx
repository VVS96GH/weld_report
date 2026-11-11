import type { Metadata, Viewport } from "next";
import { Cinzel, IBM_Plex_Mono, Inter, Poppins } from "next/font/google";
import "./globals.css";
import "./styles/responsive.css"; // after globals: its phone rules win

import { ReportShell } from "@/components/ReportShell";
import { Watermark } from "@/components/Watermark";
import { DEFAULT_DENSITY, DEFAULT_MOOD, DEFAULT_THEME, PRE_PAINT_SCRIPT, TEN_HTML_BACKGROUND } from "@/lib/theme/axes";

// Self-hosted through next/font: downloaded at build time and served from
// /_next/static, so no font CDN is contacted at runtime (T.EN spec §3).
const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin"],
  weight: ["300", "400", "500", "600", "700"],
});

const poppins = Poppins({
  variable: "--font-poppins",
  subsets: ["latin"],
  weight: ["600", "700", "800"],
});

const plexMono = IBM_Plex_Mono({
  variable: "--font-plex-mono",
  subsets: ["latin"],
  weight: ["400", "600"],
});

// Only the five legacy mockup moods use Cinzel for the report title.
const cinzel = Cinzel({
  variable: "--font-cinzel",
  subsets: ["latin"],
  weight: ["400", "600", "700"],
});

export const metadata: Metadata = {
  title: "Welding Statistics Dashboard",
  description: "Weekly welding progress, NDE status, and PWHT/rejection report.",
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: "#00284C", // token-lint: allow-hex — spec §2 theme-color
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="en"
      data-theme={DEFAULT_THEME}
      data-mood={DEFAULT_MOOD}
      data-density={DEFAULT_DENSITY}
      className={`${inter.variable} ${poppins.variable} ${plexMono.variable} ${cinzel.variable}`}
      // The pre-paint script below may rewrite these attributes from localStorage
      // before React hydrates; the values it writes are the same ones the client
      // components later read from <html>, so React must not "fix" them back.
      suppressHydrationWarning
    >
      <head>
        {/* First frame is never white: the T.EN navy gradient literal is painted on
            <html> before any stylesheet resolves (spec §2). Removed by the pre-paint
            script when the persisted mood is a legacy one. */}
        <style id="ten-prepaint-bg">{`html[data-mood="ten"]{background:${TEN_HTML_BACKGROUND}}`}</style>
        <script dangerouslySetInnerHTML={{ __html: PRE_PAINT_SCRIPT }} />
      </head>
      <body>
        <ReportShell>{children}</ReportShell>
        <Watermark />
      </body>
    </html>
  );
}
