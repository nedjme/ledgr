import {
  startOfWeek,
  endOfWeek,
  startOfMonth,
  endOfMonth,
  addWeeks,
  subWeeks,
  addMonths,
  subMonths,
  formatISO,
} from "date-fns";

export type Period = "week" | "month";

export function periodRange(period: Period, anchor = new Date()) {
  const start = period === "week" ? startOfWeek(anchor) : startOfMonth(anchor);
  const end = period === "week" ? endOfWeek(anchor) : endOfMonth(anchor);

  return {
    start: formatISO(start, { representation: "date" }),
    end: formatISO(end, { representation: "date" }),
  };
}

export function parsePeriod(value: string | undefined): Period {
  return value === "week" ? "week" : "month";
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
  return direction === 1 ? addMonths(anchor, 1) : subMonths(anchor, 1);
}

export function isCurrentPeriod(period: Period, anchor: Date): boolean {
  return periodRange(period, anchor).end >= anchorParam(new Date());
}

export function periodLabel(period: Period, anchor: Date): string {
  const { start, end } = periodRange(period, anchor);
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
