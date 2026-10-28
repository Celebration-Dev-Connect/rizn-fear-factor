import type { Metadata, Viewport } from "next";
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

export const metadata: Metadata = {
  title: "RIZN Fear Factor",
  description: "Night Pass and costume contest",
  robots: { index: false, follow: false },
};

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
