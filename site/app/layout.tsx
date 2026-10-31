import type { Metadata, Viewport } from "next";
import { Barlow_Condensed, Lilita_One, Nunito } from "next/font/google";
import { OFFSEASON } from "@/content/offseason";
import "@/styles/globals.css";

// Same font slots as the contest app (src/app/layout.tsx), self-hosted at build time.
const display = Lilita_One({ weight: "400", subsets: ["latin"], variable: "--font-display-face" });
const condensed = Barlow_Condensed({ weight: ["700", "800"], subsets: ["latin"], variable: "--font-condensed-face" });
const nunito = Nunito({ subsets: ["latin"], weight: ["400", "700", "800", "900"], variable: "--font-nunito" });

// A static export can't read the request, so the address is fixed at build time (SITE_URL).
const SITE_URL = process.env.SITE_URL ?? "https://fearfactor.riznyouth.com";
const image = { url: "/brand/og-image.jpg", width: 1200, height: 630, alt: "RIZN Fear Factor, grades 7 to 12" };

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: OFFSEASON.title,
  description: OFFSEASON.description,
  applicationName: "RIZN Youth",
  robots: { index: false, follow: false },
  icons: { icon: [{ url: "/favicon.ico", sizes: "48x48" }, { url: "/icon.png", type: "image/png" }], apple: "/apple-icon.png" },
  openGraph: { type: "website", siteName: "RIZN Youth", title: OFFSEASON.title, description: OFFSEASON.description, url: "/", locale: "en_CA", images: [image] },
  twitter: { card: "summary_large_image", title: OFFSEASON.title, description: OFFSEASON.description, images: [image] },
};

export const viewport: Viewport = { width: "device-width", initialScale: 1, themeColor: "#0a0e1a" };

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${display.variable} ${condensed.variable} ${nunito.variable}`}>
      <body>{children}</body>
    </html>
  );
}
