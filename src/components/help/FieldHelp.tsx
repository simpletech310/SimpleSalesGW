"use client";

import { HelpCircle } from "lucide-react";
import type { ReactNode } from "react";
import { Tooltip } from "@/components/ui/Tooltip";

/**
 * FieldHelp — small `?` icon meant to sit next to a form Label. Hover shows
 * the plain-English help text in a tooltip.
 *
 * Usage:
 *   <div className="flex items-center gap-1">
 *     <Label>Seats</Label>
 *     <FieldHelp>Number of users at the customer who need IT support.</FieldHelp>
 *   </div>
 */
export function FieldHelp({
  children,
  size = 14,
  className,
}: {
  children: ReactNode;
  size?: number;
  className?: string;
}) {
  return (
    <Tooltip content={children} maxWidth={280}>
      <button
        type="button"
        aria-label="Help"
        className={`inline-flex items-center justify-center text-gtn-grey-2 hover:text-gtn-purple transition-colors cursor-help ${className ?? ""}`}
      >
        <HelpCircle size={size} />
      </button>
    </Tooltip>
  );
}
