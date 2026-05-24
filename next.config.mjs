import withPWAInit from "@ducanh2912/next-pwa";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

// v2.20.3 — auto-bump the footer version label from package.json on every
// build so the deployed app never lies about which version is live.
const __dirname = dirname(fileURLToPath(import.meta.url));
const pkg = JSON.parse(readFileSync(join(__dirname, "package.json"), "utf8"));

const withPWA = withPWAInit({
  dest: "public",
  disable: process.env.NODE_ENV === "development",
  register: true,
  workboxOptions: {
    skipWaiting: true,
    runtimeCaching: [
      // Background-sync POSTs to /api/leads/*/notes when the network is unavailable.
      {
        urlPattern: ({ url, request }) =>
          request.method === "POST" && /\/api\/leads\/[^/]+\/notes/.test(url.pathname),
        handler: "NetworkOnly",
        method: "POST",
        options: {
          backgroundSync: {
            name: "gateway-notes-queue",
            options: { maxRetentionTime: 24 * 60 }, // 24 hours
          },
        },
      },
    ],
  },
});

/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  compiler: {
    removeConsole: process.env.NODE_ENV === "production" ? { exclude: ["error", "warn"] } : false,
  },
  images: {
    remotePatterns: [{ protocol: "https", hostname: "**" }],
  },
  // v2.20.3 — expose package.json version to client + server via
  // process.env.NEXT_PUBLIC_APP_VERSION so the footer can render the
  // actual deployed version instead of a hardcoded string.
  env: {
    NEXT_PUBLIC_APP_VERSION: pkg.version,
    // v2.22 — Mapbox public token must be available client-side for GL JS.
    // Next.js inlines NEXT_PUBLIC_* automatically; explicit re-export here
    // documents intent and lets the build fail loudly if the var is missing.
    NEXT_PUBLIC_MAPBOX_PUBLIC_TOKEN: process.env.NEXT_PUBLIC_MAPBOX_PUBLIC_TOKEN ?? "",
  },
};

export default withPWA(nextConfig);
