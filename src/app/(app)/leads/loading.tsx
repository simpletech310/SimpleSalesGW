import { SkeletonBlock, SkeletonRow } from "@/components/brand";

export default function LeadsListLoading() {
  return (
    <div className="space-y-4" aria-busy="true">
      <SkeletonBlock width="160px" height="2rem" />
      <SkeletonBlock width="280px" height="0.875rem" />
      <div className="rounded-lg bg-card border shadow-card overflow-hidden">
        <SkeletonRow cols={5} />
        <SkeletonRow cols={5} />
        <SkeletonRow cols={5} />
        <SkeletonRow cols={5} />
        <SkeletonRow cols={5} />
      </div>
    </div>
  );
}
