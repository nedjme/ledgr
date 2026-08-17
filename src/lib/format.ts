export function formatCurrency(amount: number, currency = "MAD") {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency,
    currencyDisplay: "narrowSymbol",
  }).format(amount);
}

// For axis ticks, where "1.2K" reads faster than "1,200" and repeating a
// currency code on every tick is redundant once it's shown once elsewhere
// (e.g. the card header) -- full precision belongs in the tooltip instead.
export function formatCompactNumber(amount: number) {
  return new Intl.NumberFormat("en-US", {
    notation: "compact",
    maximumFractionDigits: 1,
  }).format(amount);
}
