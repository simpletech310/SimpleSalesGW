import type { ReactNode } from "react";

/**
 * NumberedStep — large dark-purple circle badge (1, 2, 3...) followed by a
 * heading and body content. Matches the numbered steps from the SOP PDF
 * interior pages. Use for high-level multi-step instructions.
 */

export function NumberedStep({
  n,
  title,
  children,
  size = "md",
  className,
}: {
  n: number;
  title: string;
  children?: ReactNode;
  size?: "sm" | "md";
  className?: string;
}) {
  return (
    <section
      className={`flex gap-4 items-start ${className ?? ""}`}
      aria-labelledby={`step-${n}-title`}
    >
      <div className={`gtn-step-badge ${size === "sm" ? "gtn-step-badge--sm" : ""}`}>{n}</div>
      <div className="flex-1 min-w-0 pt-1">
        <h3
          id={`step-${n}-title`}
          className="gtn-section-label mb-1.5"
        >
          {title}
        </h3>
        {children && (
          <div className="text-sm text-gtn-navy leading-relaxed">{children}</div>
        )}
      </div>
    </section>
  );
}
