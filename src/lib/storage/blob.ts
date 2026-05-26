/**
 * Vercel Blob storage helpers — centralizes allow-lists and size caps.
 */

import { del, head } from "@vercel/blob";

// v3.3.13 — bumped to 100 MB to support short site walkthrough videos
// (1-2 min from a phone @ 1080p ≈ 80-90 MB).
export const MAX_FILE_BYTES = 100 * 1024 * 1024; // 100 MB

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
  // images — added heic/heif for iPhone uploads
  "image/jpeg",
  "image/png",
  "image/gif",
  "image/webp",
  "image/svg+xml",
  "image/heic",
  "image/heif",
  // v3.3.13 — videos so reps can record a site walkthrough on their phone
  "video/mp4",
  "video/quicktime",
  "video/webm",
  "video/x-m4v",
] as const;

/**
 * v3.3.13 — Lead attachment categories. Free-text in the DB so the
 * enum can grow without a migration. UI uses this list to drive the
 * dropdown + filter chips. Reps and SE/vCIO instantly know what each
 * file is without opening it.
 */
export const ATTACHMENT_CATEGORIES = [
  { value: "site_photo",      label: "Site photo",          hint: "Server rack, network closet, signage, layout shots" },
  { value: "site_video",      label: "Site walkthrough",    hint: "Short video tour — server room, office floor, exits" },
  { value: "business_card",   label: "Business card",       hint: "Stakeholder business card photos" },
  { value: "flyer_marketing", label: "Flyer / marketing",   hint: "Brochures, capability sheets, ads they shared" },
  { value: "floor_plan",      label: "Floor plan",          hint: "Layouts useful for cabling / cameras / access" },
  { value: "equipment_photo", label: "Equipment photo",     hint: "Firewall, switch, PBX, NVR, camera, reader photos" },
  { value: "invoice_quote",   label: "Invoice / quote",     hint: "Competing quote, current bill, contract pages" },
  { value: "compliance_doc",  label: "Compliance doc",      hint: "SOC2 cert, audit letter, insurance renewal" },
  { value: "document_other",  label: "Other document",      hint: "Anything else worth keeping with this lead" },
] as const;

export type AttachmentCategory = typeof ATTACHMENT_CATEGORIES[number]["value"];

export function isAttachmentCategory(s: string): s is AttachmentCategory {
  return ATTACHMENT_CATEGORIES.some((c) => c.value === s);
}

export function attachmentCategoryLabel(s: string | null | undefined): string | null {
  if (!s) return null;
  const found = ATTACHMENT_CATEGORIES.find((c) => c.value === s);
  return found?.label ?? null;
}

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
