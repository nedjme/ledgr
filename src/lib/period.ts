import {
  startOfWeek,
  endOfWeek,
  startOfMonth,
  endOfMonth,
  startOfYear,
  endOfYear,
  addWeeks,
  subWeeks,
  addMonths,
  subMonths,
  addYears,
  subYears,
  subDays,
  differenceInCalendarDays,
  formatISO,
} from "date-fns";

export type Period = "week" | "month" | "year";

export function periodRange(period: Period, anchor = new Date()) {
  const start =
    period === "week" ? startOfWeek(anchor) : period === "month" ? startOfMonth(anchor) : startOfYear(anchor);
  const end =
    period === "week" ? endOfWeek(anchor) : period === "month" ? endOfMonth(anchor) : endOfYear(anchor);

  return {
    start: formatISO(start, { representation: "date" }),
    end: formatISO(end, { representation: "date" }),
  };
}

export function parsePeriod(value: string | undefined): Period {
  return value === "week" || value === "year" ? value : "month";
}

export function parseAnchor(value: string | undefined): Date {
  if (value && /^\d{4}-\d{2}-\d{2}$/.test(value)) {
    const parsed = new Date(`${value}T00:00:00`);
    if (!Number.isNaN(parsed.getTime())) return parsed;
  }
  return new Date();
}

export function anchorParam(date: Date): string {
  return formatISO(date, { representation: "date" });
}

export function shiftAnchor(period: Period, anchor: Date, direction: 1 | -1): Date {
  if (period === "week") {
    return direction === 1 ? addWeeks(anchor, 1) : subWeeks(anchor, 1);
  }
  if (period === "year") {
    return direction === 1 ? addYears(anchor, 1) : subYears(anchor, 1);
  }
  return direction === 1 ? addMonths(anchor, 1) : subMonths(anchor, 1);
}

export function isCurrentPeriod(period: Period, anchor: Date): boolean {
  return periodRange(period, anchor).end >= anchorParam(new Date());
}

export function periodLabel(period: Period, anchor: Date): string {
  const { start, end } = periodRange(period, anchor);
  if (period === "year") {
    return new Date(`${start}T00:00:00`).toLocaleDateString(undefined, { year: "numeric" });
  }
  if (period === "month") {
    return new Date(`${start}T00:00:00`).toLocaleDateString(undefined, {
      month: "long",
      year: "numeric",
    });
  }
  const startLabel = new Date(`${start}T00:00:00`).toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
  });
  const endLabel = new Date(`${end}T00:00:00`).toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
  return `${startLabel} – ${endLabel}`;
}

// A free-form start/end range, independent of the anchor-based Period
// system above.
export type DateRange = { start: string; end: string };

export function parseDateRange(
  startValue: string | undefined,
  endValue: string | undefined,
): DateRange | null {
  const dateRe = /^\d{4}-\d{2}-\d{2}$/;
  if (!startValue || !endValue || !dateRe.test(startValue) || !dateRe.test(endValue)) return null;
  return startValue <= endValue ? { start: startValue, end: endValue } : { start: endValue, end: startValue };
}

export function dateRangeLabel(range: DateRange): string {
  const start = new Date(`${range.start}T00:00:00`);
  const end = new Date(`${range.end}T00:00:00`);
  const sameYear = start.getFullYear() === end.getFullYear();
  const startLabel = start.toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
    year: sameYear ? undefined : "numeric",
  });
  const endLabel = end.toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" });
  return `${startLabel} – ${endLabel}`;
}

// Compare is a plain on/off toggle, but *which* other instance of the same
// period type it points at is fully pickable -- any month vs. any month,
// any week vs. any week, and so on. Defaults to the immediately-preceding
// one the moment you switch it on (the common case, zero extra clicks),
// and the compare picker (prev/next + jump, same UI as the primary one,
// just locked to the same period type) lets you move it to any other
// instance from there.
function defaultPreviousRange(mode: Period | "custom", anchor: Date, range: DateRange): DateRange {
  if (mode === "custom") {
    const start = new Date(`${range.start}T00:00:00`);
    const end = new Date(`${range.end}T00:00:00`);
    const days = differenceInCalendarDays(end, start) + 1;
    const compareEnd = subDays(start, 1);
    return { start: anchorParam(subDays(compareEnd, days - 1)), end: anchorParam(compareEnd) };
  }
  return periodRange(mode, shiftAnchor(mode, anchor, -1));
}

export type ResolvedPeriod = {
  mode: Period | "custom";
  anchor: Date;
  customRange: DateRange | null;
  // The actual filter range for a DB query. Only null when mode is
  // "custom" and no valid range has been picked yet.
  range: DateRange | null;
  label: string;
  // Ready to splice into an href's query string, e.g.
  // `/transactions?category=${id}&${queryParams}`.
  queryParams: string;
  compareOn: boolean;
  // The anchor for the compare picker when mode is week/month/year --
  // always populated (even when compareOn is false) so switching Compare
  // on has an immediate, sensible position to show.
  compareAnchor: Date;
  compareRange: DateRange | null;
  compareLabel: string | null;
};

// Shared by every page that reads period/anchor/start/end/compare* search
// params (both dashboards, and used as the basis for the transactions
// page's extra "all time" state) -- keeps the parsing, range, label, and
// href-query-string logic in one place instead of hand-rolled per page.
export function resolvePeriod(params: {
  period?: string;
  anchor?: string;
  start?: string;
  end?: string;
  compare?: string;
  compareAnchor?: string;
  compareStart?: string;
  compareEnd?: string;
}): ResolvedPeriod {
  const anchor = parseAnchor(params.anchor);
  const compareOn = params.compare === "on";

  if (params.period === "custom") {
    const customRange = parseDateRange(params.start, params.end);
    const explicitCompareRange = parseDateRange(params.compareStart, params.compareEnd);
    const compareRange = compareOn
      ? (explicitCompareRange ?? (customRange ? defaultPreviousRange("custom", anchor, customRange) : null))
      : null;
    const compareSuffix =
      compareOn && compareRange ? `&compare=on&compareStart=${compareRange.start}&compareEnd=${compareRange.end}` : "";
    return {
      mode: "custom",
      anchor,
      customRange,
      range: customRange,
      label: customRange ? dateRangeLabel(customRange) : "Custom range",
      queryParams:
        (customRange ? `period=custom&start=${customRange.start}&end=${customRange.end}` : "period=custom") +
        compareSuffix,
      compareOn,
      compareAnchor: anchor,
      compareRange,
      compareLabel: compareRange ? `vs ${dateRangeLabel(compareRange)}` : null,
    };
  }

  const period = parsePeriod(params.period);
  const range = periodRange(period, anchor);
  const compareAnchor = params.compareAnchor
    ? parseAnchor(params.compareAnchor)
    : shiftAnchor(period, anchor, -1);
  const compareRange = compareOn ? periodRange(period, compareAnchor) : null;
  const compareSuffix = compareOn ? `&compare=on&compareAnchor=${anchorParam(compareAnchor)}` : "";
  return {
    mode: period,
    anchor,
    customRange: null,
    range,
    label: periodLabel(period, anchor),
    queryParams: `period=${period}&anchor=${anchorParam(anchor)}${compareSuffix}`,
    compareOn,
    compareAnchor,
    compareRange,
    compareLabel: compareRange ? `vs ${periodLabel(period, compareAnchor)}` : null,
  };
}
