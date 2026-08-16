"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import {
  anchorParam,
  isCurrentPeriod,
  periodLabel,
  shiftAnchor,
  type Period,
} from "@/lib/period";

export function PeriodToggle({ period, anchor }: { period: Period; anchor: Date }) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  function navigate(next: { period?: Period; anchor?: string | null }) {
    const params = new URLSearchParams(searchParams);
    if (next.period) params.set("period", next.period);
    if (next.anchor === null) params.delete("anchor");
    else if (next.anchor) params.set("anchor", next.anchor);
    router.push(`${pathname}?${params.toString()}`);
  }

  const atPresent = isCurrentPeriod(period, anchor);

  return (
    <div className="flex flex-wrap items-center gap-3">
      <div className="flex items-center gap-1">
        <Button
          variant="ghost"
          size="icon-sm"
          title="Previous period"
          onClick={() => navigate({ anchor: anchorParam(shiftAnchor(period, anchor, -1)) })}
        >
          <ChevronLeft className="size-4" />
        </Button>
        <button
          type="button"
          onClick={() => navigate({ anchor: null })}
          disabled={atPresent}
          className="min-w-32 rounded-lg px-2 py-1 text-center text-sm font-medium hover:bg-muted disabled:cursor-default disabled:hover:bg-transparent"
        >
          {periodLabel(period, anchor)}
        </button>
        <Button
          variant="ghost"
          size="icon-sm"
          title="Next period"
          disabled={atPresent}
          onClick={() => navigate({ anchor: anchorParam(shiftAnchor(period, anchor, 1)) })}
        >
          <ChevronRight className="size-4" />
        </Button>
      </div>
      <Tabs
        value={period}
        onValueChange={(v) => v && navigate({ period: v as Period, anchor: null })}
      >
        <TabsList>
          <TabsTrigger value="week">Week</TabsTrigger>
          <TabsTrigger value="month">Month</TabsTrigger>
        </TabsList>
      </Tabs>
    </div>
  );
}
