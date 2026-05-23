/**
 * Self-service assessment magic-link token utilities.
 * Token is a 256-bit cryptographically random URL-safe string.
 */

import crypto from "node:crypto";
import { prisma } from "@/lib/prisma";
import { AssessmentStatus } from "@prisma/client";

export function generateToken(): string {
  return crypto.randomBytes(32).toString("base64url");
}

/** Short, irreversible token fingerprint for logs — never log the full token. */
export function tokenFingerprint(token: string): string {
  return crypto.createHash("sha256").update(token).digest("hex").slice(0, 12);
}

export type TokenResolution =
  | { ok: true; assessmentId: string; leadId: string; expiresAt: Date | null }
  | { ok: false; reason: "not_found" | "expired" | "completed" };

export async function resolveToken(token: string): Promise<TokenResolution> {
  if (!token || token.length < 16) return { ok: false, reason: "not_found" };
  const assessment = await prisma.assessment.findUnique({
    where: { magicLinkToken: token },
    select: {
      id: true,
      leadId: true,
      status: true,
      magicLinkExpiresAt: true,
    },
  });
  if (!assessment) return { ok: false, reason: "not_found" };
  if (assessment.status === AssessmentStatus.COMPLETED) return { ok: false, reason: "completed" };
  if (assessment.magicLinkExpiresAt && assessment.magicLinkExpiresAt.getTime() < Date.now()) {
    return { ok: false, reason: "expired" };
  }
  return {
    ok: true,
    assessmentId: assessment.id,
    leadId: assessment.leadId,
    expiresAt: assessment.magicLinkExpiresAt,
  };
}

/** Days until expiry; used by the create endpoint. */
export function expiryFromDays(days: number): Date {
  const ms = Math.max(1, days) * 24 * 60 * 60 * 1000;
  return new Date(Date.now() + ms);
}
