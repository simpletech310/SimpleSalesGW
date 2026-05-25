import * as React from "react";
import Link from "next/link";
import { PageHeader, type PageHeaderProps } from "@/components/brand/PageHeader";
import { Button } from "@/components/ui/Button";
import { cn } from "@/lib/utils";

/**
 * v3.0 — FormPage template.
 *
 * Used by every create/edit route: /leads/new, /leads/[id]/edit,
 * /leads/[id]/discovery-call, /leads/[id]/handoff, /leads/[id]/outreach,
 * /me, and assessment forms.
 *
 * Anatomy:
 *   - PageHeader (title + subtitle, optional cancel link in actions)
 *   - One or more <FormSection /> cards stacked vertically
 *   - Sticky <FormFooter /> with Cancel + Submit
 *
 * The form itself is owned by the caller — wrap the whole template in a
 * <form action={...}> server action, or pass a controlled client form.
 */
type Props = PageHeaderProps & {
  /** Form contents */
  children: React.ReactNode;
  /** Optional sticky footer (Cancel + Submit). Omit if the form has no
   *  consistent action row (rare). */
  footer?: React.ReactNode;
  /** Max width — default 880 keeps a single column readable. Use "lg"
   *  for two-column forms that want more breathing room. */
  width?: "sm" | "md" | "lg" | "xl";
};

export function FormPage({
  title,
  subtitle,
  eyebrow,
  actions,
  meta,
  crumbs,
  children,
  footer,
  width = "md",
}: Props) {
  const max =
    width === "sm" ? "max-w-[640px]" :
    width === "md" ? "max-w-[880px]" :
    width === "lg" ? "max-w-[1040px]" :
    "max-w-[1240px]";
  return (
    <div className={cn("mx-auto", max)}>
      <PageHeader
        title={title}
        subtitle={subtitle}
        eyebrow={eyebrow}
        actions={actions}
        meta={meta}
        crumbs={crumbs}
      />
      <div className="space-y-4 md:space-y-5 pb-24 md:pb-6">{children}</div>
      {footer && (
        <div className="sticky bottom-0 md:static inset-x-0 z-10 mt-5 -mx-4 md:mx-0 px-4 md:px-0">
          <div className="rounded-t-xl md:rounded-xl bg-surface border border-line-subtle px-4 md:px-5 py-3 flex items-center justify-end gap-2 shadow-pop md:shadow-card">
            {footer}
          </div>
        </div>
      )}
    </div>
  );
}

/**
 * Card wrapping a labeled section of a form.
 *
 * Use multiple sections to break a long form into scannable chunks:
 *   <FormPage>
 *     <FormSection title="Basic info" subtitle="Name & contact">…</FormSection>
 *     <FormSection title="Address">…</FormSection>
 *   </FormPage>
 */
export function FormSection({
  title,
  subtitle,
  children,
  className,
  cols = 1,
}: {
  title?: React.ReactNode;
  subtitle?: React.ReactNode;
  children: React.ReactNode;
  className?: string;
  /** Grid columns for the field grid inside this section */
  cols?: 1 | 2;
}) {
  return (
    <section className={cn("rounded-xl bg-surface border border-line-subtle overflow-hidden", className)}>
      {(title || subtitle) && (
        <header className="px-4 md:px-5 py-3.5 border-b border-line-subtle">
          {title && <h2 className="text-base font-semibold text-ink-strong">{title}</h2>}
          {subtitle && <p className="text-sm text-ink-muted mt-0.5">{subtitle}</p>}
        </header>
      )}
      <div
        className={cn(
          "p-4 md:p-5 grid gap-4",
          cols === 2 ? "md:grid-cols-2" : "grid-cols-1",
        )}
      >
        {children}
      </div>
    </section>
  );
}

/** One field cluster (label + control + optional hint). */
export function FormField({
  label,
  htmlFor,
  hint,
  error,
  required,
  children,
  className,
  /** Make this field span both columns in a 2-col FormSection */
  full,
}: {
  label?: React.ReactNode;
  htmlFor?: string;
  hint?: React.ReactNode;
  error?: React.ReactNode;
  required?: boolean;
  children: React.ReactNode;
  className?: string;
  full?: boolean;
}) {
  return (
    <div className={cn("flex flex-col gap-1.5", full && "md:col-span-2", className)}>
      {label && (
        <label htmlFor={htmlFor} className="text-sm font-medium text-ink-strong leading-tight">
          {label}
          {required && <span className="text-danger ml-0.5" aria-label="required">*</span>}
        </label>
      )}
      {children}
      {error ? (
        <p className="text-xs text-danger mt-0.5">{error}</p>
      ) : hint ? (
        <p className="text-xs text-ink-muted">{hint}</p>
      ) : null}
    </div>
  );
}

/** Standard cancel-link + submit-button pair for FormPage `footer`. */
export function FormActions({
  cancelHref,
  cancelLabel = "Cancel",
  submitLabel = "Save",
  submitName,
  submitValue,
  busy,
  disabled,
}: {
  cancelHref?: string;
  cancelLabel?: string;
  submitLabel?: string;
  submitName?: string;
  submitValue?: string;
  busy?: boolean;
  disabled?: boolean;
}) {
  return (
    <>
      {cancelHref && (
        <Button asChild variant="ghost" size="sm">
          <Link href={cancelHref}>{cancelLabel}</Link>
        </Button>
      )}
      <Button type="submit" size="sm" name={submitName} value={submitValue} disabled={busy || disabled}>
        {busy ? "Saving…" : submitLabel}
      </Button>
    </>
  );
}
