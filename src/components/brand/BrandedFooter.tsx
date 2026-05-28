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
  // v3.3.25 — adopt the real gatewaytelnet.com voice + footer details.
  rightLabel = "We listen more, talk less.",
  className,
}: {
  versionLabel?: string;
  /** Center text — defaults to "GATEWAY TELNET · License #1100895 · (818) 775-1234" */
  centerLabel?: string;
  rightLabel?: string;
  className?: string;
}) {
  return (
    <footer className={`gtn-footer-band ${className ?? ""}`}>
      <div>{versionLabel}</div>
      <div className="gtn-footer-band__center">
        {centerLabel ?? "GATEWAY TELNET · License #1100895 · (818) 775-1234"}
      </div>
      <div className="gtn-footer-band__right">{rightLabel}</div>
    </footer>
  );
}
