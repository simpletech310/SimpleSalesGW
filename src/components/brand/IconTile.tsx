import type { LucideIcon } from "lucide-react";

/**
 * IconTile — dark purple rounded square with a white outline icon.
 * Matches the icon cluster on the SOP cover page (shield / server / monitor /
 * activity). Pair four of these in a 2×2 grid for landing hero surfaces.
 */

export function IconTile({
  Icon,
  size = "md",
  className,
}: {
  Icon: LucideIcon;
  size?: "sm" | "md" | "lg";
  className?: string;
}) {
  const iconSize = size === "sm" ? 18 : size === "lg" ? 32 : 24;
  return (
    <div className={`gtn-icon-tile ${size === "lg" ? "gtn-icon-tile--lg" : ""} ${className ?? ""}`}>
      <Icon size={iconSize} strokeWidth={1.6} />
    </div>
  );
}
