import { PrismaClient, Prisma } from "@prisma/client";

/**
 * v3.0.2 — Prisma client hardened for Vercel serverless.
 *
 * Story so far:
 *   v3.0.0: cached client globally. Worked locally; broke on Vercel.
 *   v3.0.1: added $use middleware to catch `kind: Closed` errors and
 *           retry once. Still broke on Vercel — the runtime error
 *           message Prisma actually throws didn't always match the
 *           narrow string-match we were doing.
 *   v3.0.2 (this): two changes —
 *           1. Catch ALL Prisma errors on the first attempt and retry
 *              once. The cost of an unnecessary retry on a permanent
 *              error is one extra failed query; the benefit is catching
 *              every transient flavor (Closed, ECONNRESET, "Can't reach
 *              database server", pool timeout, etc.) without playing
 *              whack-a-mole on error-string variants.
 *           2. Log the actual error class + message + code on every
 *              retry so the next failure tells us exactly what we're
 *              dealing with.
 *
 *   The infra fix that *eliminates* this class of error is still to use
 *   a pooled DATABASE_URL (Neon `-pooler` endpoint, or Vercel Postgres
 *   with `?pgbouncer=true&connection_limit=1`). This retry is a backstop.
 */

function describeError(err: unknown): string {
  if (!err) return "<null>";
  const name = (err as { name?: string }).name ?? "<no name>";
  const code = (err as { code?: string }).code;
  const msg = (err as { message?: string }).message ?? String(err);
  return `[${name}${code ? ` ${code}` : ""}] ${msg.split("\n").slice(0, 3).join(" | ")}`;
}

/**
 * Decide whether to retry. We want to retry transient *connection* and
 * *initialization* failures, but NOT logic errors (validation, unique
 * constraint, "not found", etc.) which would just fail the same way again.
 */
function shouldRetry(err: unknown): boolean {
  if (!err) return false;
  const name = (err as { name?: string }).name;
  // Initialization errors are almost always transient (can't reach DB,
  // pool exhausted, etc.) and worth a single retry.
  if (name === "PrismaClientInitializationError") return true;
  // RustPanic is the "something exploded in the engine" error — retry.
  if (name === "PrismaClientRustPanicError") return true;
  // UnknownRequestError wraps low-level driver failures (e.g. socket
  // closed, ECONNRESET). These are the bulk of our pain.
  if (name === "PrismaClientUnknownRequestError") return true;
  // KnownRequestError covers things like P1001 (can't reach DB), P1002
  // (timed out), P1008 (operation timed out), P1017 (server closed
  // connection), P2024 (timed out fetching from pool). These are
  // transient; the rest of P-codes are logic errors that won't change
  // on retry.
  if (name === "PrismaClientKnownRequestError") {
    const code = (err as { code?: string }).code;
    if (code && /^P100[1278]$|^P2024$/.test(code)) return true;
    return false;
  }
  // Belt: also match by message for cases that slip past the class check.
  const msg = (err as { message?: string }).message;
  if (typeof msg === "string") {
    if (
      msg.includes("kind: Closed") ||
      msg.includes("Closed: Closed") ||
      msg.includes("connection terminated") ||
      msg.includes("Connection terminated") ||
      msg.includes("ECONNRESET") ||
      msg.includes("Can't reach database server") ||
      msg.includes("Server has closed the connection") ||
      msg.includes("connection pool")
    ) {
      return true;
    }
  }
  return false;
}

function createPrismaClient(): PrismaClient {
  const client = new PrismaClient({
    log: process.env.NODE_ENV === "development" ? ["error", "warn"] : ["error"],
  });

  client.$use(async (params, next) => {
    try {
      return await next(params);
    } catch (err) {
      if (!shouldRetry(err)) throw err;
      // eslint-disable-next-line no-console
      console.warn(
        `[prisma:retry] transient failure on ${params.model ?? "?"}.${params.action}: ${describeError(err)}`,
      );
      try {
        await client.$disconnect();
      } catch {
        /* ignore — best-effort */
      }
      try {
        await client.$connect();
      } catch (connErr) {
        // eslint-disable-next-line no-console
        console.error(
          `[prisma:retry] $connect failed during retry: ${describeError(connErr)}`,
        );
        // Throw the ORIGINAL error so the caller sees the real cause.
        throw err;
      }
      try {
        return await next(params);
      } catch (err2) {
        // eslint-disable-next-line no-console
        console.error(
          `[prisma:retry] retry also failed for ${params.model ?? "?"}.${params.action}: ${describeError(err2)}`,
        );
        throw err2;
      }
    }
  });

  return client;
}

const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient };

export const prisma: PrismaClient = globalForPrisma.prisma ?? createPrismaClient();

if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = prisma;

// Re-export Prisma namespace so callers don't need a separate import.
export { Prisma };
