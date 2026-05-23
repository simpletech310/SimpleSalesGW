import { GatewayLogo } from "@/components/brand/GatewayLogo";

/**
 * PageHeaderBand — interior-page chrome with a split layout:
 *   [ Gateway TELNET logo on darker navy ] [ PAGE TITLE on navy ]
 *
 * Matches the running header on every interior page of the Gateway-branded SOPs.
 * Use at the top of major detail / admin pages (Lead detail, Account detail,
 * /admin/*, /accounts/[id]/discovery/[assessmentId]).
 */

export function PageHeaderBand({
  pageTitle,
  showLogo = true,
  className,
}: {
  pageTitle: string;
  showLogo?: boolean;
  className?: string;
}) {
  return (
    <header className={`gtn-header-band ${className ?? ""}`}>
      {showLogo && (
        <div className="gtn-header-band__brand">
          <GatewayLogo variant="onDark" size="sm" />
        </div>
      )}
      <div className="gtn-header-band__title">{pageTitle}</div>
    </header>
  );
}
