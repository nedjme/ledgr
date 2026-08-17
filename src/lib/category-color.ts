// The validated categorical palette (see the dataviz skill + globals.css
// --chart-1..5) only guarantees colorblind-safe separation for 5 slots
// shown together -- it's the fallback for a category with no manual color,
// assigned by a stable hash of its id (rather than by rank, which would
// shift a category's color every time the ranking changes between
// periods). A manual pick (categories.color) is a free hex value instead,
// so it isn't guaranteed to stay distinguishable from another manually-set
// category in the same chart.
export const CATEGORY_SERIES_COLORS = [
  "var(--chart-1)",
  "var(--chart-2)",
  "var(--chart-3)",
  "var(--chart-4)",
  "var(--chart-5)",
];
export const OTHER_COLOR = "var(--muted-foreground)";

// Literal hex twins of the palette above, offered as quick-pick presets in
// the free-form category color picker -- CSS vars can't be used as an
// <input type="color"> value or compared against a stored hex string.
export const CATEGORY_PRESET_HEX = [
  "#2a78d6",
  "#eb6834",
  "#1baf7a",
  "#eda100",
  "#e87ba4",
];

function colorSlotOf(id: string): number {
  let hash = 0;
  for (let i = 0; i < id.length; i++) {
    hash = (hash * 31 + id.charCodeAt(i)) >>> 0;
  }
  return hash % CATEGORY_SERIES_COLORS.length;
}

export function categoryColor(id: string | null, color?: string | null): string {
  if (id === null) return OTHER_COLOR;
  return color ?? CATEGORY_SERIES_COLORS[colorSlotOf(id)];
}
