export function groupByCurrency<T extends { currency: string }>(
  rows: T[],
): Map<string, T[]> {
  const groups = new Map<string, T[]>();
  for (const row of rows) {
    const list = groups.get(row.currency);
    if (list) list.push(row);
    else groups.set(row.currency, [row]);
  }
  return groups;
}
