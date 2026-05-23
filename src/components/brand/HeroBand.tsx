import type { ReactNode } from "react";

/**
 * HeroBand — dark navy hero surface with geometric shape decorations
 * (circles + diamonds) baked into the ::before/::after pseudo-elements via
 * `.gtn-hero-band` in globals.css. Matches the SOP cover page hero.
 *
 * Renders an eyebrow, a display title, an optional subtitle, and optional
 * action elements (buttons). Use for landing screens — home, login,
 * /help, /me.
 */

export function HeroBand({
  eyebrow,
  title,
  subtitle,
  actions,
  children,
  className,
}: {
  eyebrow?: string;
  title: ReactNode;
  subtitle?: ReactNode;
  actions?: ReactNode;
  /** Optional extra content rendered below subtitle (e.g. meta blocks). */
  children?: ReactNode;
  className?: string;
}) {
  return (
    <section className={`gtn-hero-band ${className ?? ""}`}>
      {eyebrow && <p className="gtn-eyebrow mb-3">{eyebrow}</p>}
      <h1 className="gtn-display gtn-display--onDark mb-2">{title}</h1>
      {subtitle && (
        <p className="text-base text-gtn-eyebrow/90 max-w-2xl">{subtitle}</p>
      )}
      {children && <div className="mt-6">{children}</div>}
      {actions && <div className="mt-6 flex flex-wrap gap-3">{actions}</div>}
    </section>
  );
}
