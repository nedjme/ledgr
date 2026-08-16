import { Skeleton } from "@/components/ui/skeleton";
import { ListSkeleton } from "@/components/skeletons";

export default function TransactionsLoading() {
  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center gap-3">
        <Skeleton className="h-8 w-40" />
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-8 w-44" />
      </div>
      <ListSkeleton rows={10} />
    </div>
  );
}
