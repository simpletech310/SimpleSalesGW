import { PrismaClient, Prisma } from "@prisma/client";

/**
 * v3.0.1 — Prisma client hardened against transient connection drops.
 *
 * Background:
 *   Vercel runs each route handler in a serverless function. The function
 *   container is reused across invocations to stay warm, and the cached
 *   `globalThis.prisma` keeps the pool alive between calls. But the
 *   underlying TCP connection to Postgres (especially Neon / Supabase /
 *   any direct unpooled URL) can be silently closed on the server side
 *   when idle. The next query then explodes with:
 *
 *     prisma:error Error in PostgreSQL connection: Error { kind: Closed }
 *
 *   The route returns 500 and React's global error boundary fires. The
 *   user sees a generic "The app crashed before it could load" screen.
 *
 * Fix:
 *   $use middleware that catches connection-level errors, drops the
 *   stale pool, reconnects, and retries the query exactly once.
 *
 *   $use was chosen over $extends because $extends widens the client's
 *   TypeScript type in ways that break helpers (e.g. inventory delegate
 *   lookup) which take a bare PrismaClient parameter. $use is marked
 *   deprecated in Prisma docs but is still fully supported through the
 *   end of Prisma 5.x — by the time we move to Prisma 6 we'll have the
 *   recommended infra fix in place (Neon pooler / Vercel Postgres) and
 *   can drop this guard entirely.
 *
 *   The infra fix that *eliminates* this class of error is to use a
 *   pooled DATABASE_URL: e.g. Neon's `-pooler` endpoint, or Vercel
 *   Postgres with `?pgbouncer=true&connection_limit=1`. This retry is
 *   belt-and-suspenders so a single dropped connection doesn't blow up
 *   the user's session.
 */

function isTransientConnectionError(err: unknown): boolean {
  if (!err) return false;
  const msg = (err as { message?: unknown }).message;
  if (typeof msg !== "string") return false;
  return (
    msg.includes("Error { kind: Closed") ||
    msg.includes("kind: Closed") ||
    msg.includes("connection terminated") ||
    msg.includes("Connection terminated") ||
    msg.includes("ECONNRESET") ||
    msg.includes("Closed: Closed") ||
    msg.includes("Can't reach database server") ||
    msg.includes("Server has closed the connection")
  );
}

function createPrismaClient(): PrismaClient {
  const client = new PrismaClient({
    log: process.env.NODE_ENV === "development" ? ["error", "warn"] : ["error"],
  });

  client.$use(async (params, next) => {
    try {
      return await next(params);
    } catch (err) {
      if (!isTransientConnectionError(err)) throw err;
      // eslint-disable-next-line no-console
      console.warn(
        `[prisma] transient connection error on ${params.model ?? "?"}.${params.action}, reconnecting and retrying once:`,
        err instanceof Error ? err.message : String(err),
      );
      try {
        await client.$disconnect();
      } catch {
        /* ignore — best-effort */
      }
      await client.$connect();
      // Retry exactly once. If this still fails, the error bubbles up
      // and the caller (route handler) handles it normally.
      return await next(params);
    }
  });

  return client;
}

const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient };

export const prisma: PrismaClient = globalForPrisma.prisma ?? createPrismaClient();

if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = prisma;

// Re-export Prisma namespace so callers don't need a separate import.
export { Prisma };
