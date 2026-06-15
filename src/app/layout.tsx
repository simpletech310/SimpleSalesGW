import type { Metadata, Viewport } from "next";
import { Montserrat, Carlito, Inter, JetBrains_Mono } from "next/font/google";
import "./globals.css";
import { Toaster } from "sonner";
import { AuthSessionProvider } from "@/components/SessionProvider";

// v3.7 — Montserrat is the shared Gateway brand UI font (matches
// gatewaytelnet.com + the SOP and Agent portals, so all three look like one
// product). Carlito/Inter remain loaded as fallbacks (Carlito keeps the
// Calibri-compatible PDF spec intact); JetBrains Mono is the code font.
const montserrat = Montserrat({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700", "800", "900"],
  variable: "--font-montserrat",
  display: "swap",
});
const carlito = Carlito({
  subsets: ["latin"],
  weight: ["400", "700"],
  variable: "--font-carlito",
  display: "swap",
});
const inter = Inter({ subsets: ["latin"], variable: "--font-inter", display: "swap" });
const jetbrains = JetBrains_Mono({ subsets: ["latin"], variable: "--font-jetbrains", display: "swap" });

export const metadata: Metadata = {
  title: "Gateway TelNet Sales Portal",
  description: "Gateway TelNet's complete sales workflow — lead to handoff.",
  manifest: "/manifest.json",
  icons: [{ rel: "icon", url: "/icons/icon.svg", type: "image/svg+xml" }],
  appleWebApp: { capable: true, statusBarStyle: "black-translucent", title: "Gateway" },
};

export const viewport: Viewport = {
  themeColor: "#231F20",
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${montserrat.variable} ${carlito.variable} ${inter.variable} ${jetbrains.variable}`}>
      <body className="min-h-dvh bg-background text-gtn-text">
        <AuthSessionProvider>{children}</AuthSessionProvider>
        <Toaster richColors position="top-center" />
      </body>
    </html>
  );
}
