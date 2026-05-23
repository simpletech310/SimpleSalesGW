import { type ClassValue, clsx } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function initials(name: string | null | undefined): string {
  if (!name) return "??";
  return name
    .split(/\s+/)
    .filter(Boolean)
    .map((n) => n[0]!.toUpperCase())
    .slice(0, 2)
    .join("");
}

export function formatScore(n: number | null | undefined): string {
  if (n === null || n === undefined) return "—";
  return String(n);
}

export function scoreBadgeClass(n: number | null | undefined): string {
  if (n === null || n === undefined) return "gtn-score-badge";
  if (n >= 70) return "gtn-score-badge gtn-score-badge--green";
  if (n >= 50) return "gtn-score-badge gtn-score-badge--amber";
  return "gtn-score-badge gtn-score-badge--red";
}
