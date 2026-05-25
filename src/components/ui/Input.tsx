import * as React from "react";
import { cn } from "@/lib/utils";

/**
 * v3.0 — refined-SaaS form primitives.
 *
 * Input/Textarea: 36px (sm) / 40px (md) heights, calmer border, lavender
 * focus ring (consistent with global :focus-visible). Mobile-safe.
 */
const Input = React.forwardRef<HTMLInputElement, React.InputHTMLAttributes<HTMLInputElement>>(
  ({ className, type, ...props }, ref) => (
    <input
      type={type}
      ref={ref}
      className={cn(
        "flex h-9 w-full rounded-md border border-line bg-surface px-3 text-sm text-ink-strong",
        "transition-colors duration-120 ease-smooth",
        "placeholder:text-ink-faint",
        "hover:border-line-strong",
        "focus:outline-none focus:border-brand focus:ring-4 focus:ring-brand/15",
        "disabled:cursor-not-allowed disabled:opacity-50 disabled:bg-surface-2",
        // ensure mobile tap target without changing visual height
        "md:h-9 min-h-[40px] md:min-h-0",
        className,
      )}
      {...props}
    />
  ),
);
Input.displayName = "Input";

const Textarea = React.forwardRef<HTMLTextAreaElement, React.TextareaHTMLAttributes<HTMLTextAreaElement>>(
  ({ className, ...props }, ref) => (
    <textarea
      ref={ref}
      className={cn(
        "flex min-h-[96px] w-full rounded-md border border-line bg-surface px-3 py-2 text-sm text-ink-strong",
        "transition-colors duration-120 ease-smooth",
        "placeholder:text-ink-faint",
        "hover:border-line-strong",
        "focus:outline-none focus:border-brand focus:ring-4 focus:ring-brand/15",
        "disabled:cursor-not-allowed disabled:opacity-50 disabled:bg-surface-2",
        className,
      )}
      {...props}
    />
  ),
);
Textarea.displayName = "Textarea";

const Label = React.forwardRef<HTMLLabelElement, React.LabelHTMLAttributes<HTMLLabelElement>>(
  ({ className, ...props }, ref) => (
    <label
      ref={ref}
      className={cn("text-sm font-medium leading-tight text-ink-strong", className)}
      {...props}
    />
  ),
);
Label.displayName = "Label";

/** Helper text shown below an input (hints + error states) */
type FieldHintProps = React.HTMLAttributes<HTMLParagraphElement> & {
  tone?: "default" | "error";
};
const FieldHint = React.forwardRef<HTMLParagraphElement, FieldHintProps>(
  ({ className, tone = "default", ...props }, ref) => (
    <p
      ref={ref}
      className={cn(
        "text-xs mt-1.5",
        tone === "error" ? "text-danger" : "text-ink-muted",
        className,
      )}
      {...props}
    />
  ),
);
FieldHint.displayName = "FieldHint";

export { Input, Textarea, Label, FieldHint };
