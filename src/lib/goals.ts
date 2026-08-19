import { subMonths, addWeeks, addMonths, addYears, subDays, formatISO, startOfDay } from "date-fns";

export function goalProgress(targetAmount: number, progress: number): number {
  if (targetAmount <= 0) return 0;
  return Math.min(100, Math.max(0, (progress / targetAmount) * 100));
}

// Default selected window for the read-only historical reference dropdown
// (see goal-savings-history.tsx) -- purely informational, the simulation
// itself is driven entirely by events (see below), not by history.
export const SAVINGS_TRAILING_MONTHS = 3;

// Selectable windows for the read-only "historical reference" info panel.
// The widest one determines how far back budgets/page.tsx needs to fetch
// transactions for -- see MAX_SAVINGS_WINDOW_MONTHS.
export const SAVINGS_WINDOW_OPTIONS = [1, 3, 6, 12] as const;
export const MAX_SAVINGS_WINDOW_MONTHS = Math.max(...SAVINGS_WINDOW_OPTIONS);

export function trailingMonthsRange(months: number, from = new Date()) {
  return {
    start: formatISO(subMonths(from, months), { representation: "date" }),
    end: formatISO(from, { representation: "date" }),
  };
}

// Average monthly income, spend, and net (income - spend) for one owner in
// one currency, over the given transactions. `months` should match however
// wide a range `transactions` was actually fetched for (see
// trailingMonthsRange) -- this doesn't filter by date itself.
export function averageMonthlySavings(
  transactions: { user_id: string; amount: number; currency: string }[],
  ownerId: string,
  currency: string,
  months: number,
): { income: number; spend: number; net: number } {
  // Postgres numeric columns (amount included) come back from Supabase as
  // strings, not numbers -- Number() here isn't defensive boilerplate, a
  // naive `sum + t.amount` silently concatenates instead of adding once
  // there's more than one matching row (see account_balances() callers'
  // own Number(b.balance) for the same reason).
  const relevant = transactions.filter((t) => t.user_id === ownerId && t.currency === currency);
  const income = relevant.filter((t) => t.amount > 0).reduce((sum, t) => sum + Number(t.amount), 0) / months;
  const spend =
    relevant.filter((t) => t.amount < 0).reduce((sum, t) => sum + Math.abs(Number(t.amount)), 0) / months;
  return { income, spend, net: income - spend };
}

// The same average, computed once per selectable window from one widely-
// fetched transaction set -- powers the read-only historical reference
// dropdown without a fresh query per window change. Unlike
// averageMonthlySavings, this does filter by date itself (each window
// needs a different slice of the same fetched range).
export function averageMonthlySavingsByWindow(
  transactions: { user_id: string; amount: number; currency: string; occurred_at: string }[],
  ownerId: string,
  currency: string,
  windows: readonly number[] = SAVINGS_WINDOW_OPTIONS,
  from = new Date(),
): { months: number; income: number; spend: number; net: number }[] {
  return windows.map((months) => {
    const start = formatISO(subMonths(from, months), { representation: "date" });
    const scoped = transactions.filter((t) => t.occurred_at >= start);
    return { months, ...averageMonthlySavings(scoped, ownerId, currency, months) };
  });
}

// The flat, one-occurrence-per-entry shape simulateCompletionDate,
// projectBalancePath, and goalTimelineSeries consume -- they only need to
// understand "an amount on a date", never recurrence itself. A recurring
// stored event is turned into a run of these via expandRecurringEvents
// before it reaches any of them.
export type SimulationEvent = { amount: number; occurs_on: string };

export type RecurrenceKind = "once" | "weekly" | "monthly" | "yearly";

// The stored/edited shape -- what description_category_rules-style CRUD
// works with, category included so a recurring one can be checked against
// that category's budget (see check_recurring_event_budget_cap, 0025).
export type RecurringSimulationEvent = {
  amount: number;
  occurs_on: string;
  recurrence: RecurrenceKind;
  recurrence_end: string | null;
};

// Expands each stored event into its actual occurrences from `from` up to
// `horizon` (or its own recurrence_end, if sooner) -- a monthly rent
// starting 3 months ago and continuing indefinitely becomes one
// SimulationEvent per future month between now and the horizon. A "once"
// event is already exactly one occurrence.
export function expandRecurringEvents(
  events: RecurringSimulationEvent[],
  horizon: Date,
  from = new Date(),
): SimulationEvent[] {
  // occurs_on/recurrence_end are pure dates -- every occurrence below is
  // built at midnight. Comparing that against a raw `from` (real
  // wall-clock time, always later than midnight on the same day) would
  // silently drop anything happening "today," including the very first
  // occurrence of a recurring event that starts today. Normalizing once
  // here makes "today" actually mean today.
  from = startOfDay(from);
  const expanded: SimulationEvent[] = [];
  for (const e of events) {
    // Number() -- Postgres numeric columns come back from Supabase as
    // strings, and every occurrence would otherwise be added via string
    // concatenation once expanded (see averageMonthlySavings for the same
    // issue). Coerced once here, at the one place raw stored events become
    // the flat shape everything downstream consumes.
    const amount = Number(e.amount);
    if (e.recurrence === "once") {
      expanded.push({ amount, occurs_on: e.occurs_on });
      continue;
    }
    const end = e.recurrence_end ? new Date(`${e.recurrence_end}T00:00:00`) : horizon;
    const cappedEnd = end < horizon ? end : horizon;
    let cursor = new Date(`${e.occurs_on}T00:00:00`);
    while (cursor <= cappedEnd) {
      if (cursor >= from) {
        expanded.push({ amount, occurs_on: formatISO(cursor, { representation: "date" }) });
      }
      cursor =
        e.recurrence === "weekly"
          ? addWeeks(cursor, 1)
          : e.recurrence === "monthly"
            ? addMonths(cursor, 1)
            : addYears(cursor, 1);
    }
  }
  return expanded;
}

// How far to expand recurring events when the caller doesn't already have
// a tighter bound in mind (simulateCompletionDate has no natural horizon
// of its own -- it just walks forward until completion or the steady-state
// fallback). Generous enough that a monthly commitment keeps affecting the
// projection for as long as any realistic goal timeline would care about,
// and generous enough that every indefinite recurring event's own start
// date necessarily falls inside this window (see steadyStateMonthlyRate).
const MAX_SIMULATION_YEARS = 10;

// The rate that holds forever once every open-ended recurring event
// (recurrence_end null) has started -- there's no baseline savings rate
// anymore (see this file's own history), so this is purely the sum of
// those events' monthly-equivalents. A recurring event with an end date,
// or a one-time event, doesn't belong here: it's already fully
// represented as discrete bumps within the expansion window, nothing
// "steady" about it.
function steadyStateMonthlyRate(events: RecurringSimulationEvent[]): number {
  let rate = 0;
  for (const e of events) {
    if (e.recurrence === "once" || e.recurrence_end) continue;
    const amount = Number(e.amount);
    rate += e.recurrence === "weekly" ? amount * (30.44 / 7) : e.recurrence === "yearly" ? amount / 12 : amount;
  }
  return rate;
}

// Projects when `remainingAmount` gets covered -- purely from the events
// you've added (a bonus lands and covers a chunk in one jump; a recurring
// rent payment keeps setting the running total back), since there's no
// implicit background rate anymore. Balance only ever changes at an
// event's exact date, so this is just each occurrence's amount subtracted
// in order, not a day-by-day walk. Recurring events are expanded
// internally (see expandRecurringEvents) up to MAX_SIMULATION_YEARS out.
// null when nothing ever closes the gap: no events add up to enough, and
// no open-ended recurring event's steady rate would eventually get there
// either.
export function simulateCompletionDate(
  remainingAmount: number,
  events: RecurringSimulationEvent[],
  from = new Date(),
): Date | null {
  if (remainingAmount <= 0) return from;

  from = startOfDay(from);
  const horizon = addYears(from, MAX_SIMULATION_YEARS);
  const flatEvents = expandRecurringEvents(events, horizon, from);
  const sortedEvents = flatEvents
    .map((e) => ({ amount: e.amount, date: new Date(`${e.occurs_on}T00:00:00`) }))
    .filter((e) => e.date >= from)
    .sort((a, b) => a.date.getTime() - b.date.getTime());

  let deficit = remainingAmount;
  for (const event of sortedEvents) {
    deficit -= event.amount;
    if (deficit <= 0) return event.date;
  }

  // No event within the expansion window closed the gap -- every open-
  // ended recurring event has necessarily already started by now
  // (MAX_SIMULATION_YEARS is generous relative to any realistic start
  // date), so from here the only way it could still close is at their
  // steady combined monthly rate.
  const steadyRate = steadyStateMonthlyRate(events);
  if (steadyRate <= 0) return null;
  const monthsToClose = deficit / steadyRate;
  return addMonths(horizon, Math.ceil(monthsToClose));
}

// How far out to look when a goal has no target_date -- both for judging
// "at-risk" (does a future dip undo it) and as the chart's default window.
const DEFAULT_HORIZON_MONTHS = 12;

export type GoalPace = "on-track" | "behind" | "done" | "stalled" | "at-risk";

export type BalancePath = { finalBalance: number; minBalance: number; minDate: Date };

// Projects the balance forward to `until`, tracking both where it ends up
// and the lowest point it touches along the way. Balance only changes at
// an event's exact date, so the true minimum can only occur right after
// one -- no need to sample in between.
function projectBalancePath(
  progress: number,
  events: RecurringSimulationEvent[],
  until: Date,
  from = new Date(),
): BalancePath {
  from = startOfDay(from);
  const flatEvents = expandRecurringEvents(events, until, from);
  const sortedEvents = flatEvents
    .map((e) => ({ amount: e.amount, date: new Date(`${e.occurs_on}T00:00:00`) }))
    // >= from, not > -- progress is the real current balance, which
    // doesn't yet include a planned event dated today (that's the whole
    // point of planning it), so today's events are still "ahead."
    .filter((e) => e.date >= from && e.date <= until)
    .sort((a, b) => a.date.getTime() - b.date.getTime());

  let balance = progress;
  let minBalance = balance;
  let minDate = from;

  for (const event of sortedEvents) {
    balance += event.amount;
    if (balance < minBalance) {
      minBalance = balance;
      minDate = event.date;
    }
  }

  return { finalBalance: balance, minBalance, minDate };
}

// Compares the real, projected (event-aware) completion date against
// target_date -- replaces the old straight-line "% of time elapsed vs. %
// contributed" comparison now that there's no manual contribution log to
// measure against. "stalled" is a real, distinct state from "behind":
// behind means the current pace gets there, just too late; stalled means
// it never gets there at all. "at-risk" is distinct from "done": you have
// the money right now, but a planned event (or a negative rate) leaves you
// under target right at `targetDate` itself (or DEFAULT_HORIZON_MONTHS out,
// if there's no target date) -- a *temporary* dip that fully recovers by
// then is "done", not "at-risk": what matters for a goal with a deadline is
// whether you have it by the deadline, not whether it wobbled in between
// (see projectBalancePath, which the caller can also use to surface that
// wobble as its own, separate piece of information). Returns null only
// when the goal isn't reached yet and there's no target_date to judge pace
// against.
export function goalPace(
  targetAmount: number,
  progress: number,
  events: RecurringSimulationEvent[],
  targetDate: string | null,
): GoalPace | null {
  const horizonEnd = targetDate
    ? new Date(`${targetDate}T00:00:00`)
    : addMonths(new Date(), DEFAULT_HORIZON_MONTHS);

  if (progress >= targetAmount) {
    const { finalBalance } = projectBalancePath(progress, events, horizonEnd);
    return finalBalance >= targetAmount ? "done" : "at-risk";
  }
  if (!targetDate) return null;

  const projected = simulateCompletionDate(targetAmount - progress, events);
  if (!projected) return "stalled";
  return projected <= horizonEnd ? "on-track" : "behind";
}

// Exposed separately from goalPace's own done/at-risk verdict -- a goal can
// be "done" (you'll have the target by the deadline) while still dipping
// below it temporarily along the way, which is worth surfacing but isn't
// itself a reason to call the goal at risk.
export function goalDipInfo(
  targetAmount: number,
  progress: number,
  events: RecurringSimulationEvent[],
  until: Date,
): { minBalance: number; minDate: Date } | null {
  const { minBalance, minDate } = projectBalancePath(progress, events, until);
  return minBalance < targetAmount ? { minBalance, minDate } : null;
}

export type TimelinePoint = { timestamp: number; date: string; balance: number };

// Purely cosmetic lead-in so an event dated today still has a visible
// "before" state to its left -- see goalTimelineSeries's own comment.
const LEADING_CONTEXT_DAYS = 5;

// Balance trajectory from `startingBalance` -- flat except for a sharp step
// at each event's date (an exact before/after pair of points), since
// there's no implicit background rate anymore: nothing moves the balance
// except the events you've actually added.
export function goalTimelineSeries(
  startingBalance: number,
  events: RecurringSimulationEvent[],
  horizon: Date,
  from = new Date(),
): TimelinePoint[] {
  from = startOfDay(from);
  const flatEvents = expandRecurringEvents(events, horizon, from);
  const sortedEvents = flatEvents
    .map((e) => ({ amount: e.amount, date: new Date(`${e.occurs_on}T00:00:00`) }))
    // >= from, not > -- an event dated today hasn't happened yet as far as
    // the real (already-fetched) starting balance is concerned, so it
    // still belongs in the projection, not just anything strictly later.
    .filter((e) => e.date >= from && e.date <= horizon)
    .sort((a, b) => a.date.getTime() - b.date.getTime());

  const points: { date: Date; balance: number }[] = [];
  let balance = startingBalance;
  // A few days of flat lead-in before "today" -- an event dated today is
  // the earliest thing the projection can show, so without this the jump
  // would land right on the chart's left edge with nothing to its left,
  // reading as "the balance was already this high" instead of a visible
  // rise from where it actually started.
  points.push({ date: subDays(from, LEADING_CONTEXT_DAYS), balance });
  points.push({ date: from, balance });

  for (const event of sortedEvents) {
    points.push({ date: event.date, balance });
    balance += event.amount;
    points.push({ date: event.date, balance });
  }
  points.push({ date: horizon, balance });

  return points.map((p) => ({
    timestamp: p.date.getTime(),
    date: formatISO(p.date, { representation: "date" }),
    balance: p.balance,
  }));
}

// The chart's (and projectBalancePath's, via goalPace) window: far enough to
// cover the target date, every planned event, and the projected
// completion, whichever is latest, plus a month of trailing context. Works
// off the raw (unexpanded) events -- for a recurring one, its own end date
// (or start, if open-ended) is a reasonable stand-in without needing a
// horizon to expand it against first (target_date/DEFAULT_HORIZON_MONTHS
// already bound the common open-ended case).
export function resolveSimulationHorizon(
  targetDate: string | null,
  events: RecurringSimulationEvent[],
  projected: Date | null,
  from = new Date(),
): Date {
  const dates: Date[] = [];
  if (targetDate) dates.push(new Date(`${targetDate}T00:00:00`));
  for (const e of events) dates.push(new Date(`${e.recurrence_end ?? e.occurs_on}T00:00:00`));
  if (projected) dates.push(projected);
  if (dates.length === 0) return addMonths(from, DEFAULT_HORIZON_MONTHS);
  const latest = new Date(Math.max(...dates.map((d) => d.getTime()), addMonths(from, 1).getTime()));
  return addMonths(latest, 1);
}
