import { Skeleton } from "@/components/ui/skeleton";
import { Card, CardContent } from "@/components/ui/card";

export default function CategoriesLoading() {
  return (
    <Card>
      <CardContent className="space-y-4">
        <Skeleton className="h-9 w-full" />
        <div className="flex flex-wrap gap-2">
          {Array.from({ length: 8 }).map((_, i) => (
            <Skeleton key={i} className="h-6 w-20 rounded-full" />
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
