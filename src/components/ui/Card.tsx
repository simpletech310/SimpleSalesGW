import * as React from "react";
import { cn } from "@/lib/utils";

/**
 * v3.0 — refined-SaaS card.
 *
 * Default is a flat, bordered surface (no heavy shadow). Use `elevated`
 * for the rare floated case (popovers, modal-adjacent panels). Padding
 * is now `p-4 md:p-5` for a tighter, more dashboard-like rhythm.
 */
type CardProps = React.HTMLAttributes<HTMLDivElement> & {
  elevated?: boolean;
  /** Remove the default padding when composing with custom internal layout */
  flush?: boolean;
};

const Card = React.forwardRef<HTMLDivElement, CardProps>(
  ({ className, elevated, flush, ...props }, ref) => (
    <div
      ref={ref}
      className={cn(
        "rounded-xl bg-surface border border-line-subtle",
        elevated && "shadow-card",
        !flush && "p-4 md:p-5",
        className,
      )}
      {...props}
    />
  ),
);
Card.displayName = "Card";

const CardHeader = React.forwardRef<HTMLDivElement, React.HTMLAttributes<HTMLDivElement>>(
  ({ className, ...props }, ref) => (
    <div ref={ref} className={cn("flex flex-col space-y-1 pb-3", className)} {...props} />
  ),
);
CardHeader.displayName = "CardHeader";

const CardTitle = React.forwardRef<HTMLHeadingElement, React.HTMLAttributes<HTMLHeadingElement>>(
  ({ className, ...props }, ref) => (
    <h3
      ref={ref}
      className={cn("text-base font-semibold text-ink-strong tracking-tight", className)}
      {...props}
    />
  ),
);
CardTitle.displayName = "CardTitle";

const CardDescription = React.forwardRef<HTMLParagraphElement, React.HTMLAttributes<HTMLParagraphElement>>(
  ({ className, ...props }, ref) => (
    <p ref={ref} className={cn("text-sm text-ink-muted", className)} {...props} />
  ),
);
CardDescription.displayName = "CardDescription";

const CardContent = React.forwardRef<HTMLDivElement, React.HTMLAttributes<HTMLDivElement>>(
  ({ className, ...props }, ref) => (
    <div ref={ref} className={cn("", className)} {...props} />
  ),
);
CardContent.displayName = "CardContent";

const CardFooter = React.forwardRef<HTMLDivElement, React.HTMLAttributes<HTMLDivElement>>(
  ({ className, ...props }, ref) => (
    <div ref={ref} className={cn("flex items-center pt-4", className)} {...props} />
  ),
);
CardFooter.displayName = "CardFooter";

export { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter };
