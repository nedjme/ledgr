"use client";

import { ChevronLeft, ChevronRight } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { PeriodDatePicker } from "@/components/period-date-picker";
import { CustomRangePicker } from "@/components/custom-range-picker";
import { CompareToggle } from "@/components/compare-toggle";
import { cn } from "@/lib/utils";
import { useOptimisticParams } from "@/lib/use-optimistic-params";
import {
  anchorParam,
  isCurrentPeriod,
  periodLabel,
  resolvePeriod,
  shiftAnchor,
  type Period,
} from "@/lib/period";

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
  allowAll = false,
  allowYear = false,
  allowCustom = false,
}: {
  allowAll?: boolean;
  allowYear?: boolean;
  allowCustom?: boolean;
}) {
  // Derived straight from the client-known (optimistic) URL rather than
  // passed down as props from the server-rendered page -- see
  // use-optimistic-params.ts for why a plain `useSearchParams()` isn't
  // enough on its own. The page still calls `resolvePeriod` itself for the
  // data it fetches; this is a second, cheap (pure, no I/O) call purely for
  // this instant display.
  const { params: rawParams, navigate: navigateParams } = useOptimisticParams();
  const isAllTime = allowAll && !rawParams.period;
  const resolved = resolvePeriod(rawParams);
  const period = isAllTime ? null : resolved.mode;
  const anchor = resolved.anchor;
  const customRange = resolved.customRange;

  function navigate(next: { period?: Period | "all" | "custom"; anchor?: string | null }) {
    navigateParams((params) => {
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
    });
  }

  const isBoundedPeriod = period !== null && period !== "custom";
  const atPresent = isBoundedPeriod && isCurrentPeriod(period, anchor);

  function handleTabChange(v: string | null) {
    if (!v) return;
    if (v === "all" || v === "custom") navigate({ period: v });
    else navigate({ period: v as Period, anchor: null });
  }

  const tabTriggers = (
    <>
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
    </>
  );

  return (
    <Card size="sm" className="w-full gap-3 overflow-hidden px-3 pt-0 sm:w-auto sm:pt-3">
      {/* Full-bleed on mobile -- flush against the card's top/left/right
          edges instead of sitting inset with the rest of the toolbar, so
          it reads as the card's own top bar rather than just another
          floating control. Swaps for the compact inline version (below,
          sharing a row with the date nav) once there's room at sm:+. */}
      <div className="-mx-3 sm:hidden">
        <Tabs value={period ?? "all"} onValueChange={handleTabChange}>
          <TabsList className="h-11 w-full rounded-none rounded-t-2xl p-1 group-data-horizontal/tabs:h-11">
            {tabTriggers}
          </TabsList>
        </Tabs>
      </div>
      <div className="flex flex-wrap items-center gap-3">
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
            navigateParams((params) => {
              params.delete("page");
              params.set("period", "custom");
              params.delete("anchor");
              params.set("start", range.start);
              params.set("end", range.end);
            });
          }}
          title="Choose a date range"
          className="order-2 min-w-40 rounded-lg px-2 py-1 text-center text-sm font-medium transition-colors hover:bg-muted sm:order-1"
        />
      )}
      {period !== null && (
        <CompareToggle period={period} className="order-3 sm:order-2" />
      )}
      {/* Compact inline version -- sm: and up only, where it shares the
          row with the date nav and Compare instead of needing its own
          full-bleed bar. */}
      <Tabs
        value={period ?? "all"}
        onValueChange={handleTabChange}
        className="hidden sm:order-3 sm:block"
      >
        <TabsList className="h-9 p-1 group-data-horizontal/tabs:h-9">{tabTriggers}</TabsList>
      </Tabs>
      </div>
    </Card>
  );
}
