import { HeroSkeleton, StatCardsSkeleton, ChartCardSkeleton, ListSkeleton } from "@/components/skeletons";

export default function DashboardLoading() {
  return (
    <div className="space-y-6">
      <HeroSkeleton />
      <StatCardsSkeleton />
      <ChartCardSkeleton />
      <ListSkeleton rows={5} />
    </div>
  );
}
