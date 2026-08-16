import Link from "next/link";
import { Button } from "@/components/ui/button";

export function Pagination({
  page,
  totalPages,
  basePath,
  params,
}: {
  page: number;
  totalPages: number;
  basePath: string;
  params: Record<string, string | undefined>;
}) {
  if (totalPages <= 1) return null;

  function hrefFor(targetPage: number) {
    const usp = new URLSearchParams();
    for (const [key, value] of Object.entries(params)) {
      if (value) usp.set(key, value);
    }
    if (targetPage > 1) usp.set("page", String(targetPage));
    const qs = usp.toString();
    return qs ? `${basePath}?${qs}` : basePath;
  }

  const hasPrev = page > 1;
  const hasNext = page < totalPages;

  return (
    <div className="flex items-center justify-center gap-3">
      {hasPrev ? (
        <Button
          variant="outline"
          size="sm"
          nativeButton={false}
          render={<Link href={hrefFor(page - 1)} />}
        >
          Previous
        </Button>
      ) : (
        <Button variant="outline" size="sm" disabled>
          Previous
        </Button>
      )}
      <span className="text-sm text-muted-foreground">
        Page {page} of {totalPages}
      </span>
      {hasNext ? (
        <Button
          variant="outline"
          size="sm"
          nativeButton={false}
          render={<Link href={hrefFor(page + 1)} />}
        >
          Next
        </Button>
      ) : (
        <Button variant="outline" size="sm" disabled>
          Next
        </Button>
      )}
    </div>
  );
}
