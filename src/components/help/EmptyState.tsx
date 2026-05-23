import Link from "next/link";
import type { LucideIcon } from "lucide-react";
import type { ReactNode } from "react";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { IconTile } from "@/components/brand/IconTile";

/**
 * EmptyState — branded empty list state with optional CTA. Replaces the
 * ad-hoc `<p className="text-sm text-gtn-grey-2">No leads yet</p>` pattern
 * across the app with something inviting that points the user at their
 * next move.
 *
 * Usage:
 *   <EmptyState
 *     Icon={Inbox}
 *     title="No leads yet"
 *     body="Add your first lead and the portal will score it the moment you save."
 *     cta={{ label: "Add a lead", href: "/leads/new" }}
 *   />
 */
export function EmptyState({
  Icon,
  title,
  body,
  cta,
  secondaryCta,
  className,
}: {
  Icon?: LucideIcon;
  title: string;
  body: ReactNode;
  cta?: { label: string; href: string };
  secondaryCta?: { label: string; href: string };
  className?: string;
}) {
  return (
    <Card className={`flex flex-col items-center text-center py-10 px-6 ${className ?? ""}`}>
      {Icon && (
        <div className="mb-4">
          <IconTile Icon={Icon} size="lg" />
        </div>
      )}
      <h3 className="gtn-section-label mb-2">{title}</h3>
      <p className="text-sm text-gtn-grey-2 max-w-md mb-5 leading-relaxed">{body}</p>
      <div className="flex flex-wrap gap-2 justify-center">
        {cta && (
          <Button asChild>
            <Link href={cta.href}>{cta.label}</Link>
          </Button>
        )}
        {secondaryCta && (
          <Button asChild variant="secondary">
            <Link href={secondaryCta.href}>{secondaryCta.label}</Link>
          </Button>
        )}
      </div>
    </Card>
  );
}
