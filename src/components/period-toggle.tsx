"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { PeriodDatePicker } from "@/components/period-date-picker";
import { CustomRangePicker } from "@/components/custom-range-picker";
import { CompareToggle } from "@/components/compare-toggle";
import { cn } from "@/lib/utils";
import { anchorParam, isCurrentPeriod, periodLabel, shiftAnchor, type DateRange, type Period } from "@/lib/period";

// A single flat min-width sized for "September 2026" turns a short "2026"
// into an oddly wide, sparse-looking button -- scaled per period type
// instead, roughly matching each one's longest realistic label ("Aug 10 –
// Aug 16, 2026" for week is the widest).
export const PERIOD_LABEL_MIN_WIDTH: Record<Period, string> = {
  year: "min-w-16",
  month: "min-w-32",
  week: "min-w-44",
};

// Same widths, applied from sm: up only -- the compare picker drops its
// min-width on mobile (where it has no prev/next chevrons to line up
// with) and picks it back up once those return at sm:.
export const PERIOD_LABEL_MIN_WIDTH_SM: Record<Period, string> = {
  year: "sm:min-w-16",
  month: "sm:min-w-32",
  week: "sm:min-w-44",
};

// `period: null` (All time) only makes sense combined with `allowAll` --
// only the transactions page passes that (an unfiltered browse view is a
// coherent state there; a hero/summary card always needs *some* period).
// `allowYear`/`allowCustom` are separate flags so the dashboards can offer
// Year and Custom without "All time" cluttering a card that always shows a
// number for the selected span. Selecting "custom" swaps the prev/next/
// date-picker row for a range picker (there's no single anchor to
// navigate within a free range). Compare is offered whenever there's a
// bounded period to compare against (i.e. not "All time") -- what it
// compares to is always the equivalent previous unit, no separate choice.
export function PeriodToggle({
  period,
  anchor,
  allowAll = false,
  allowYear = false,
  allowCustom = false,
  customRange = null,
  compareOn = false,
  compareAnchor,
  compareRange = null,
}: {
  period: Period | "custom" | null;
  anchor: Date;
  allowAll?: boolean;
  allowYear?: boolean;
  allowCustom?: boolean;
  customRange?: DateRange | null;
  compareOn?: boolean;
  compareAnchor?: Date;
  compareRange?: DateRange | null;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  function navigate(next: { period?: Period | "all" | "custom"; anchor?: string | null }) {
    const params = new URLSearchParams(searchParams);
    params.delete("page");
    if (next.period === "all") {
      params.delete("period");
      params.delete("anchor");
    } else if (next.period === "custom") {
      params.set("period", "custom");
      params.delete("anchor");
    } else if (next.period) {
      params.set("period", next.period);
      params.delete("start");
      params.delete("end");
    }
    if (next.anchor === null) params.delete("anchor");
    else if (next.anchor) params.set("anchor", next.anchor);
    router.push(`${pathname}?${params.toString()}`, { scroll: false });
  }

  const isBoundedPeriod = period !== null && period !== "custom";
  const atPresent = isBoundedPeriod && isCurrentPeriod(period, anchor);

  return (
    <div className="flex flex-wrap items-center gap-3">
      {/* Order is mobile-first: the type tabs on their own top row, then
          the date nav, then Compare -- on sm:+ it reverts to the original
          left-to-right reading order (date nav, Compare, tabs), which
          already fits on one line at that width. */}
      {isBoundedPeriod && (
        <div className="order-2 flex items-center gap-1 sm:order-1">
          <Button
            variant="ghost"
            size="icon-sm"
            title="Previous period"
            onClick={() => navigate({ anchor: anchorParam(shiftAnchor(period, anchor, -1)) })}
          >
            <ChevronLeft className="size-4" />
          </Button>
          <PeriodDatePicker
            period={period}
            anchor={anchor}
            onSelect={(date) => navigate({ anchor: anchorParam(date) })}
            title="Choose a period"
            className={cn(
              "rounded-lg px-2 py-1 text-center text-sm font-medium transition-colors hover:bg-muted",
              PERIOD_LABEL_MIN_WIDTH[period],
            )}
          >
            {periodLabel(period, anchor)}
          </PeriodDatePicker>
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
      )}
      {period === "custom" && (
        <CustomRangePicker
          range={customRange}
          onSelect={(range) => {
            const params = new URLSearchParams(searchParams);
            params.delete("page");
            params.set("period", "custom");
            params.delete("anchor");
            params.set("start", range.start);
            params.set("end", range.end);
            router.push(`${pathname}?${params.toString()}`, { scroll: false });
          }}
          title="Choose a date range"
          className="order-2 min-w-40 rounded-lg px-2 py-1 text-center text-sm font-medium transition-colors hover:bg-muted sm:order-1"
        />
      )}
      {period !== null && (
        <CompareToggle
          compareOn={compareOn}
          period={period}
          compareAnchor={compareAnchor ?? new Date()}
          compareRange={compareRange}
          className="order-3 sm:order-2"
        />
      )}
      <Tabs
        value={period ?? "all"}
        onValueChange={(v) => {
          if (!v) return;
          if (v === "all" || v === "custom") navigate({ period: v });
          else navigate({ period: v as Period, anchor: null });
        }}
        className="order-1 sm:order-3"
      >
        <TabsList className="h-9 p-1 group-data-horizontal/tabs:h-9">
          {allowAll && (
            <TabsTrigger value="all" className="px-3 py-1.5">
              All time
            </TabsTrigger>
          )}
          <TabsTrigger value="week" className="px-3 py-1.5">
            Week
          </TabsTrigger>
          <TabsTrigger value="month" className="px-3 py-1.5">
            Month
          </TabsTrigger>
          {allowYear && (
            <TabsTrigger value="year" className="px-3 py-1.5">
              Year
            </TabsTrigger>
          )}
          {allowCustom && (
            <TabsTrigger value="custom" className="px-3 py-1.5">
              Custom
            </TabsTrigger>
          )}
        </TabsList>
      </Tabs>
    </div>
  );
}
