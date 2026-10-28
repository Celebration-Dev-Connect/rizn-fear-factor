import type { Metadata, Viewport } from "next";
import { headers } from "next/headers";
import { Barlow_Condensed, Lilita_One, Nunito } from "next/font/google";
import { RehearsalBanner } from "@/components/RehearsalBanner";
import { StateProvider } from "@/components/StateProvider";
import "@/styles/globals.css";

// Font slots (spec 002 research §10). next/font downloads these at build time and serves them from
// our own origin, so no request goes to Google at runtime (Constitution I).
//
// The poster uses Cubano (display), Asket Condensed ExtraBold (condensed), and Kuhlman (accent).
// Those come from Adobe Fonts, whose licence doesn't allow self-hosting, so open-licensed
// look-alikes fill the slots. If RIZN supply a font file licensed for self-hosted web use, put it
// in src/fonts/ and swap the slot to next/font/local, keeping the variable name, e.g.:
//   import localFont from "next/font/local";
//   const display = localFont({ src: "../fonts/Cubano-Regular.woff2", variable: "--font-display-face" });
const display = Lilita_One({ weight: "400", subsets: ["latin"], variable: "--font-display-face" });
const condensed = Barlow_Condensed({ weight: ["700", "800"], subsets: ["latin"], variable: "--font-condensed-face" });
const nunito = Nunito({ subsets: ["latin"], weight: ["400", "700", "800", "900"], variable: "--font-nunito" });

const TITLE = "RIZN Fear Factor · Night Pass";
const DESCRIPTION =
  "Get your Night Pass and vote in the RIZN Fear Factor costume contest. Friday, October 30 at Celebration Church, grades 7–12.";

/**
 * Share-card tags (Open Graph and Twitter/X) need absolute URLs, but the image is built before the
 * domain is known, so the origin comes from the request (Caddy forwards Host and the scheme).
 * Favicons come from src/app/icon.png, apple-icon.png, and favicon.ico (`npm run brand:assets`).
 */
export async function generateMetadata(): Promise<Metadata> {
  const h = await headers();
  const host = h.get("x-forwarded-host") ?? h.get("host") ?? "localhost:3000";
  const proto = h.get("x-forwarded-proto") ?? (host.startsWith("localhost") ? "http" : "https");
  const image = { url: "/brand/og-image.jpg", width: 1200, height: 630, alt: "RIZN Fear Factor, grades 7 to 12: Night Pass and costume contest" };
  return {
    metadataBase: new URL(`${proto}://${host}`),
    title: TITLE,
    description: DESCRIPTION,
    applicationName: "RIZN Fear Factor",
    // Link previews still work; the app just stays out of search results.
    robots: { index: false, follow: false },
    openGraph: {
      type: "website",
      siteName: "RIZN Fear Factor",
      title: TITLE,
      description: DESCRIPTION,
      url: "/",
      locale: "en_CA",
      images: [image],
    },
    twitter: { card: "summary_large_image", title: TITLE, description: DESCRIPTION, images: [image] },
  };
}

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: "#0a0e1a",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${display.variable} ${condensed.variable} ${nunito.variable}`}>
      <body>
        <StateProvider>
          <RehearsalBanner />
          {children}
        </StateProvider>
      </body>
    </html>
  );
}
