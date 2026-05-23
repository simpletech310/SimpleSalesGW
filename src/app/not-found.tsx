import Link from "next/link";
import { Compass, MapPin } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { HeroBand, IconTile } from "@/components/brand";

/**
 * Branded 404. Renders inside the root layout (no AppShell), so it works
 * for unauthenticated 404s too — we explicitly send users home or to /help.
 */
export default function NotFound() {
  return (
    <div className="min-h-dvh bg-background py-12 px-4">
      <div className="space-y-6 max-w-3xl mx-auto">
        <HeroBand
          eyebrow="404 · NOT FOUND"
          title="That page doesn't exist"
          subtitle="The link might be stale, or you might have permission to view a lead someone else linked you to. Try one of the paths below — or open the help center."
        >
          <div className="grid grid-cols-2 gap-3 max-w-xs">
            <IconTile Icon={MapPin} size="lg" />
            <IconTile Icon={Compass} size="lg" />
          </div>
        </HeroBand>

        <Card>
          <h2 className="gtn-section-label mb-3">Where to go</h2>
          <div className="flex flex-wrap gap-2">
            <Button asChild>
              <Link href="/">Home (your pipeline)</Link>
            </Button>
            <Button asChild variant="secondary">
              <Link href="/leads">All leads</Link>
            </Button>
            <Button asChild variant="secondary">
              <Link href="/accounts">All customers</Link>
            </Button>
            <Button asChild variant="ghost">
              <Link href="/help">Help center</Link>
            </Button>
          </div>
        </Card>
      </div>
    </div>
  );
}
