import { SkeletonBlock, SkeletonRow } from "@/components/brand";

export default function NotificationsLoading() {
  return (
    <div className="space-y-4 max-w-4xl" aria-busy="true">
      <SkeletonBlock width="200px" height="2rem" />
      <SkeletonBlock width="280px" height="0.875rem" />
      {Array.from({ length: 4 }).map((_, i) => (
        <div key={i} className="rounded-lg bg-card border shadow-card overflow-hidden">
          <div className="px-4 py-3 bg-gtn-lavender">
            <SkeletonBlock width="180px" height="0.75rem" className="!bg-white/40" />
          </div>
          <SkeletonRow cols={3} />
          <SkeletonRow cols={3} />
        </div>
      ))}
    </div>
  );
}
