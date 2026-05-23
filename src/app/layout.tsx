import type { Metadata, Viewport } from "next";
import { Inter, JetBrains_Mono } from "next/font/google";
import "./globals.css";
import { Toaster } from "sonner";
import { AuthSessionProvider } from "@/components/SessionProvider";

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
  themeColor: "#0F0E2E",
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${inter.variable} ${jetbrains.variable}`}>
      <body className="min-h-dvh bg-background text-gtn-text">
        <AuthSessionProvider>{children}</AuthSessionProvider>
        <Toaster richColors position="top-center" />
      </body>
    </html>
  );
}
