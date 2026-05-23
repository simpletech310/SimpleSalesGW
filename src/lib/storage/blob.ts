/**
 * Vercel Blob storage helpers — centralizes allow-lists and size caps.
 */

import { del, head } from "@vercel/blob";

export const MAX_FILE_BYTES = 25 * 1024 * 1024; // 25 MB

export const ALLOWED_CONTENT_TYPES = [
  // documents
  "application/pdf",
  "application/msword",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "application/vnd.ms-excel",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  "application/vnd.ms-powerpoint",
  "application/vnd.openxmlformats-officedocument.presentationml.presentation",
  // text + csv
  "text/plain",
  "text/csv",
  "text/markdown",
  // images
  "image/jpeg",
  "image/png",
  "image/gif",
  "image/webp",
  "image/svg+xml",
] as const;

export function isAllowedContentType(ctype: string): boolean {
  return (ALLOWED_CONTENT_TYPES as readonly string[]).includes(ctype);
}

export function formatBytes(n: number): string {
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`;
  return `${(n / 1024 / 1024).toFixed(1)} MB`;
}

/** Convenience wrappers in case routes need them. */
export const blobHead = head;
export const blobDel = del;
