"use client";

import Link from "next/link";
import { useEffect } from "react";
import { AlertOctagon, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { HeroBand, IconTile } from "@/components/brand";

/**
 * Error boundary for every route under /(app).
 *
 * Renders a branded "Something went wrong" screen with a Try Again button
 * (Next's reset() helper re-renders the segment), plus links to Help and
 * Home. The actual error is logged to the console for engineers.
 */
export default function AppError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    // Engineers see this in browser console + Vercel logs.
    // eslint-disable-next-line no-console
    console.error("[AppError]", error);
  }, [error]);

  return (
    <div className="space-y-6 max-w-3xl mx-auto">
      <HeroBand
        eyebrow="SOMETHING WENT WRONG"
        title="We hit an unexpected error"
        subtitle="The portal stayed up — just this screen couldn't render. Try again, or jump somewhere else and try a different path."
      >
        <div className="grid grid-cols-2 gap-3 max-w-xs">
          <IconTile Icon={AlertOctagon} size="lg" />
          <IconTile Icon={RefreshCw} size="lg" />
        </div>
      </HeroBand>

      <Card>
        <h2 className="gtn-section-label mb-2">What you can do</h2>
        <ul className="text-sm text-gtn-grey-2 space-y-1 list-disc pl-5">
          <li>Try again — the most common cause is a temporary network blip.</li>
          <li>Go back home and re-navigate.</li>
          <li>If it keeps happening, ping the team with the error code below.</li>
        </ul>
        {error.digest && (
          <p className="text-[10px] text-gtn-grey-3 mt-3 font-mono">
            Error reference: {error.digest}
          </p>
        )}
        <div className="flex gap-2 mt-4 flex-wrap">
          <Button onClick={() => reset()}>
            <RefreshCw size={14} className="mr-2" /> Try again
          </Button>
          <Button variant="secondary" asChild>
            <Link href="/">Take me home</Link>
          </Button>
          <Button variant="ghost" asChild>
            <Link href="/help">Open help center</Link>
          </Button>
        </div>
      </Card>
    </div>
  );
}
