import { SkeletonCard, SkeletonHero } from "@/components/brand";

/**
 * Default loading shell — Next.js Suspense fallback for every route under
 * /(app). Renders a branded skeleton so users see immediate feedback during
 * SSR navigation.
 *
 * Individual routes can override with their own loading.tsx for a more
 * tailored skeleton (e.g. table layout vs detail layout).
 */
export default function Loading() {
  return (
    <div className="space-y-6 max-w-5xl mx-auto" aria-live="polite" aria-busy="true">
      <SkeletonHero />
      <div className="grid sm:grid-cols-3 gap-3">
        <SkeletonCard lines={2} />
        <SkeletonCard lines={2} />
        <SkeletonCard lines={2} />
      </div>
      <SkeletonCard lines={4} />
    </div>
  );
}
