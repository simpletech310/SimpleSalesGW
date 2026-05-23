import type { ReactNode } from "react";

/**
 * Pill — branded pill chip matching the bottom-of-cover meta tags on the SOP
 * cover ("GATEWAY TELNET INTERNAL USE ONLY"). Optional leading dot is the
 * tiny circle visible on the brand pills.
 *
 * Useful for status chips, role tags, and metadata anywhere we want a
 * branded label badge.
 */

export type PillTone = "navy" | "purple" | "green" | "amber" | "red";

const TONE_CLASS: Record<PillTone, string> = {
  navy:   "",
  purple: "gtn-pill--purple",
  green:  "gtn-pill--green",
  amber:  "gtn-pill--amber",
  red:    "gtn-pill--red",
};

export function Pill({
  tone = "navy",
  dot = false,
  children,
  className,
}: {
  tone?: PillTone;
  dot?: boolean;
  children: ReactNode;
  className?: string;
}) {
  return (
    <span className={`gtn-pill ${TONE_CLASS[tone]} ${className ?? ""}`}>
      {dot && <span className="gtn-pill__dot" aria-hidden />}
      {children}
    </span>
  );
}
