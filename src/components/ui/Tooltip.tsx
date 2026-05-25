"use client";

import * as React from "react";
import * as RadixTooltip from "@radix-ui/react-tooltip";

/**
 * Branded tooltip primitive. Thin wrapper around @radix-ui/react-tooltip so
 * the rest of the app can declare hover help with one component:
 *
 *   <Tooltip content="What's this?"><Button>Foo</Button></Tooltip>
 *
 * Used pervasively by the help system (FieldHelp, GlossaryTerm, etc.).
 */

export function TooltipProvider({ children, delayDuration = 200 }: { children: React.ReactNode; delayDuration?: number }) {
  return <RadixTooltip.Provider delayDuration={delayDuration}>{children}</RadixTooltip.Provider>;
}

type TooltipProps = {
  content: React.ReactNode;
  /** The trigger element (renders as-is via asChild). */
  children: React.ReactNode;
  /** Tooltip placement. Defaults to `top`. */
  side?: "top" | "right" | "bottom" | "left";
  /** Forces the tooltip open (controlled). */
  open?: boolean;
  /** Maximum width of the content. Defaults to 280px. */
  maxWidth?: number;
  /** Additional class names for the content surface. */
  className?: string;
};

export function Tooltip({
  content,
  children,
  side = "top",
  open,
  maxWidth = 280,
  className,
}: TooltipProps) {
  return (
    <RadixTooltip.Root open={open}>
      <RadixTooltip.Trigger asChild>{children}</RadixTooltip.Trigger>
      <RadixTooltip.Portal>
        <RadixTooltip.Content
          side={side}
          sideOffset={6}
          collisionPadding={8}
          className={
            "z-50 rounded-md bg-gtn-navy text-white text-xs leading-snug font-medium " +
            "shadow-pop px-2.5 py-1.5 max-w-xs " +
            "data-[state=delayed-open]:animate-in data-[state=closed]:animate-out " +
            "data-[state=closed]:fade-out-0 data-[state=delayed-open]:fade-in-0 " +
            "data-[state=delayed-open]:zoom-in-95 data-[state=closed]:zoom-out-95 " +
            (className ?? "")
          }
          style={{ maxWidth }}
        >
          {content}
          <RadixTooltip.Arrow className="fill-gtn-navy" width={10} height={5} />
        </RadixTooltip.Content>
      </RadixTooltip.Portal>
    </RadixTooltip.Root>
  );
}
