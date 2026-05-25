import * as React from "react";
import { Slot } from "@radix-ui/react-slot";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

/**
 * v3.0 — refined-SaaS button.
 *
 * Existing variant keys preserved (default, secondary, ghost, destructive,
 * link, accent) so call sites don't break. Visual language updated:
 * - calmer borders and surfaces
 * - tighter hover/active states
 * - consistent focus ring (handled globally via :focus-visible)
 * - new sizes: xs (24), sm (32), md/default (36), lg (44)
 */
const buttonVariants = cva(
  [
    "inline-flex items-center justify-center gap-1.5 whitespace-nowrap",
    "rounded-md font-medium select-none",
    "transition-all duration-120 ease-smooth",
    "disabled:pointer-events-none disabled:opacity-50",
    "active:scale-[.98]",
  ].join(" "),
  {
    variants: {
      variant: {
        // Primary CTA — purple, the strongest action on the page
        default:
          "bg-gtn-purple text-white shadow-card hover:bg-[#4a3fb8] hover:shadow-[0_2px_8px_rgba(91,79,207,0.25)]",
        // Dark navy alt — used when primary purple conflicts with surrounding purple chrome
        primary:
          "bg-gtn-navy text-white hover:bg-gtn-navy-2 shadow-card",
        // Quiet outlined button
        secondary:
          "bg-surface text-ink-strong border border-line hover:bg-surface-3 hover:border-line-strong",
        // Outline — same shape, no fill
        outline:
          "bg-transparent text-ink-strong border border-line hover:bg-surface-3",
        // Borderless
        ghost:
          "bg-transparent text-ink hover:bg-surface-3 hover:text-ink-strong",
        destructive:
          "bg-gtn-red text-white hover:bg-[#b53127] shadow-card",
        link:
          "text-gtn-purple underline-offset-4 hover:underline px-0",
        // Legacy alias for "accent" — keep purple primary behavior
        accent:
          "bg-gtn-purple text-white hover:bg-[#4a3fb8] shadow-card",
      },
      size: {
        xs:      "h-7 px-2 text-xs",
        sm:      "h-8 px-3 text-sm",
        default: "h-9 px-3.5 text-sm",
        md:      "h-9 px-3.5 text-sm",
        lg:      "h-11 px-5 text-base",
        icon:    "h-9 w-9 p-0",
        "icon-sm": "h-8 w-8 p-0",
      },
    },
    defaultVariants: { variant: "default", size: "default" },
  },
);

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
  asChild?: boolean;
}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, asChild = false, ...props }, ref) => {
    const Comp = asChild ? Slot : "button";
    return (
      <Comp
        className={cn(buttonVariants({ variant, size, className }))}
        ref={ref}
        {...props}
      />
    );
  },
);
Button.displayName = "Button";

export { Button, buttonVariants };
