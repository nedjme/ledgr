import { HeroSkeleton, StatCardsSkeleton, ChartCardSkeleton, ListSkeleton } from "@/components/skeletons";

export default function HouseholdDashboardLoading() {
  return (
    <div className="space-y-6">
      <HeroSkeleton />
      <StatCardsSkeleton />
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <ChartCardSkeleton />
        <ChartCardSkeleton />
      </div>
      <ListSkeleton rows={6} />
    </div>
  );
}
