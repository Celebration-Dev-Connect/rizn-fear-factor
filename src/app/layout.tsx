import type { Metadata, Viewport } from "next";
import { Creepster, Nunito } from "next/font/google";
import { RehearsalBanner } from "@/components/RehearsalBanner";
import { StateProvider } from "@/components/StateProvider";
import "@/styles/globals.css";

// Self-hosted at build time: no request goes to Google at runtime (Constitution I).
const creepster = Creepster({ weight: "400", subsets: ["latin"], variable: "--font-creepster" });
const nunito = Nunito({ subsets: ["latin"], weight: ["400", "700", "800", "900"], variable: "--font-nunito" });

export const metadata: Metadata = {
  title: "RIZN Fear Factor",
  description: "Night Pass and costume contest",
  robots: { index: false, follow: false },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: "#1a0b2e",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${creepster.variable} ${nunito.variable}`}>
      <body>
        <StateProvider>
          <RehearsalBanner />
          {children}
        </StateProvider>
      </body>
    </html>
  );
}
