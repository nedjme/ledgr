import { differenceInCalendarDays } from "date-fns";

export function goalProgress(targetAmount: number, contributed: number): number {
  if (targetAmount <= 0) return 0;
  return Math.min(100, Math.max(0, (contributed / targetAmount) * 100));
}

export type GoalPace = "on-track" | "behind" | "done";

// Compares actual progress against the straight-line pace needed to land
// on target_date -- e.g. 40% of the way there at the 40%-of-time mark is
// on track, at the 70%-of-time mark it's behind. Only meaningful with a
// target date; goals without one just show raw progress, no pace read.
export function goalPace(
  targetAmount: number,
  contributed: number,
  createdAt: string,
  targetDate: string,
): GoalPace {
  if (contributed >= targetAmount) return "done";

  const start = new Date(`${createdAt.slice(0, 10)}T00:00:00`);
  const end = new Date(`${targetDate}T00:00:00`);
  const totalDays = Math.max(1, differenceInCalendarDays(end, start));
  const elapsedDays = Math.min(totalDays, Math.max(0, differenceInCalendarDays(new Date(), start)));

  const expectedPct = (elapsedDays / totalDays) * 100;
  const actualPct = goalProgress(targetAmount, contributed);

  // A little slack so landing a few points under the straight-line pace
  // (normal for lumpy, real-world contributions) doesn't read as "behind".
  return actualPct >= expectedPct - 10 ? "on-track" : "behind";
}
