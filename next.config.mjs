import withPWAInit from "@ducanh2912/next-pwa";

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
};

export default withPWA(nextConfig);
