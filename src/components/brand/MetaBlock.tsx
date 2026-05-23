import type { ReactNode } from "react";

/**
 * MetaBlock — labeled metadata block with a left purple rule.
 * Matches the cover-page metadata (DEPARTMENT / Technical etc.) in the SOP.
 */

export function MetaBlock({
  label,
  value,
  children,
  className,
}: {
  label: string;
  value?: ReactNode;
  children?: ReactNode;
  className?: string;
}) {
  return (
    <div className={`gtn-meta-block ${className ?? ""}`}>
      <p className="gtn-meta-block__label">{label}</p>
      <div className="gtn-meta-block__value">{value ?? children}</div>
    </div>
  );
}
