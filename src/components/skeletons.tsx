import { Skeleton } from "@/components/ui/skeleton";
import { Card, CardContent } from "@/components/ui/card";

export function HeroSkeleton() {
  return <Skeleton className="h-44 w-full rounded-2xl" />;
}

export function StatCardsSkeleton() {
  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
      <Card>
        <CardContent className="space-y-2">
          <Skeleton className="h-4 w-16" />
          <Skeleton className="h-7 w-24" />
        </CardContent>
      </Card>
      <Card>
        <CardContent className="space-y-2">
          <Skeleton className="h-4 w-16" />
          <Skeleton className="h-7 w-24" />
        </CardContent>
      </Card>
    </div>
  );
}

export function ChartCardSkeleton() {
  return (
    <Card>
      <CardContent className="space-y-4">
        <Skeleton className="h-4 w-32" />
        <Skeleton className="h-40 w-full" />
      </CardContent>
    </Card>
  );
}

export function ListSkeleton({ rows = 6 }: { rows?: number }) {
  return (
    <Card>
      <CardContent className="space-y-3">
        {Array.from({ length: rows }).map((_, i) => (
          <div key={i} className="flex items-center gap-3">
            <Skeleton className="size-10 shrink-0 rounded-full" />
            <div className="flex-1 space-y-1.5">
              <Skeleton className="h-4 w-1/3" />
              <Skeleton className="h-3 w-1/4" />
            </div>
            <Skeleton className="h-4 w-16" />
          </div>
        ))}
      </CardContent>
    </Card>
  );
}
