/**
 * BrandedFooter — three-up lavender footer band matching the SOP page footer:
 *   [ V1.0 — 2026 ] [ GATEWAY TELNET · MIDDLE ] [ DOC TITLE / TAGLINE ]
 *
 * Used everywhere across the app (replaces the existing simple footer). Also
 * adopted by the print views so paper output matches.
 */

export function BrandedFooter({
  versionLabel = "V1.0 — 2026",
  centerLabel,
  rightLabel = "Sales made simple. Operations made sure.",
  className,
}: {
  versionLabel?: string;
  /** Center text — defaults to "GATEWAY TELNET" */
  centerLabel?: string;
  rightLabel?: string;
  className?: string;
}) {
  return (
    <footer className={`gtn-footer-band ${className ?? ""}`}>
      <div>{versionLabel}</div>
      <div className="gtn-footer-band__center">{centerLabel ?? "GATEWAY TELNET"}</div>
      <div className="gtn-footer-band__right">{rightLabel}</div>
    </footer>
  );
}
