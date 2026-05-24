import { SkeletonBlock, SkeletonCard } from "@/components/brand";

export default function LeadDetailLoading() {
  return (
    <div className="space-y-6" aria-busy="true">
      <SkeletonBlock width="100%" height="56px" />
      <div className="space-y-2">
        <SkeletonBlock width="240px" height="2rem" />
        <SkeletonBlock width="180px" height="0.875rem" />
      </div>
      <SkeletonBlock width="100%" height="80px" />
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <SkeletonCard lines={1} />
        <SkeletonCard lines={1} />
        <SkeletonCard lines={1} />
      </div>
      <SkeletonCard lines={5} />
      <SkeletonCard lines={3} />
    </div>
  );
}
