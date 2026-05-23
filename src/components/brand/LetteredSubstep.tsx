import type { ReactNode } from "react";

/**
 * LetteredSubstep — smaller purple circle (A, B, C...) inside a soft lavender
 * background block, with a label + content layout. Matches the lettered
 * substeps under "DOCUMENT WORK IN CONNECTWISE" on the SOP page 4 example.
 */

export function LetteredSubstep({
  letter,
  title,
  children,
  className,
}: {
  letter: string;
  title: string;
  children?: ReactNode;
  className?: string;
}) {
  return (
    <div
      className={`flex gap-3 items-start rounded-md p-3 ${className ?? ""}`}
      style={{ backgroundColor: "var(--gtn-callout-bg)" }}
    >
      <div className="gtn-letter-badge">{letter}</div>
      <div className="flex-1 min-w-0">
        <p className="text-sm text-gtn-navy">
          <strong className="font-semibold">{title}</strong>
          {children && <span> — </span>}
          {children}
        </p>
      </div>
    </div>
  );
}
