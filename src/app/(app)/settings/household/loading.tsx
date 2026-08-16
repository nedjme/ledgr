import { Skeleton } from "@/components/ui/skeleton";
import { Card, CardContent } from "@/components/ui/card";

export default function HouseholdSettingsLoading() {
  return (
    <div className="space-y-6">
      <Card>
        <CardContent className="space-y-3">
          <Skeleton className="h-4 w-24" />
          <Skeleton className="h-9 w-full" />
        </CardContent>
      </Card>
      <Card>
        <CardContent className="space-y-3">
          <Skeleton className="h-4 w-20" />
          <Skeleton className="h-9 w-2/3" />
        </CardContent>
      </Card>
      <Card>
        <CardContent className="space-y-4">
          <Skeleton className="h-9 w-full" />
          <div className="flex flex-wrap gap-2">
            {Array.from({ length: 6 }).map((_, i) => (
              <Skeleton key={i} className="h-6 w-20 rounded-full" />
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
