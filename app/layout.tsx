import type { Metadata } from "next";
import { Cinzel, Inter } from "next/font/google";
import "./globals.css";

import { ReportShell } from "@/components/ReportShell";

const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin"],
  weight: ["300", "400", "500", "600", "700"],
});

const cinzel = Cinzel({
  variable: "--font-cinzel",
  subsets: ["latin"],
  weight: ["400", "600", "700"],
});

export const metadata: Metadata = {
  title: "Welding Statistics Dashboard",
  description: "Weekly welding progress, NDE status, and PWHT/rejection report.",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en" data-theme="dark" data-mood="pastel" className={`${inter.variable} ${cinzel.variable}`}>
      <body>
        <ReportShell>{children}</ReportShell>
      </body>
    </html>
  );
}
