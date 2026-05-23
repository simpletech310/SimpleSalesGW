/**
 * Branded skeleton placeholders — lavender shimmer blocks matching the
 * Gateway palette. Use as in-component loading state OR composed into a
 * route-level loading.tsx skeleton.
 */

export function SkeletonBlock({
  width = "100%",
  height = "1rem",
  className,
}: {
  width?: string;
  height?: string;
  className?: string;
}) {
  return (
    <div
      className={`rounded bg-gtn-lavender animate-pulse ${className ?? ""}`}
      style={{ width, height }}
      aria-hidden
    />
  );
}

/** Pre-composed card skeleton — title bar + 3 lines of body. */
export function SkeletonCard({ lines = 3 }: { lines?: number }) {
  return (
    <div className="rounded-lg bg-card border shadow-card p-4 space-y-3">
      <SkeletonBlock width="40%" height="1.25rem" />
      <div className="space-y-2">
        {Array.from({ length: lines }).map((_, i) => (
          <SkeletonBlock key={i} width={i === lines - 1 ? "70%" : "100%"} height="0.75rem" />
        ))}
      </div>
    </div>
  );
}

/** Hero band skeleton — a dark navy block matching HeroBand height. */
export function SkeletonHero() {
  return (
    <div className="rounded-lg bg-gtn-navy/80 animate-pulse" style={{ height: 200 }} aria-hidden />
  );
}

/** Table-row skeleton — 4 cells in lavender. */
export function SkeletonRow({ cols = 4 }: { cols?: number }) {
  return (
    <div className="flex items-center gap-3 px-4 py-3 border-t border-gtn-lavender-2 first:border-0">
      {Array.from({ length: cols }).map((_, i) => (
        <SkeletonBlock key={i} width={i === 0 ? "30%" : "20%"} height="0.875rem" />
      ))}
    </div>
  );
}

/** Plain inline replacement for ad-hoc `<p>Loading…</p>` strings. */
export function InlineLoading({ label = "Loading…" }: { label?: string }) {
  return (
    <div className="flex items-center gap-2 text-sm text-gtn-grey-2">
      <span className="inline-block w-3 h-3 rounded-full border-2 border-gtn-purple border-t-transparent animate-spin" aria-hidden />
      <span>{label}</span>
    </div>
  );
}
