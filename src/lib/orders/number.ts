// Display only: counters, stored order numbers, URLs and historical records stay intact.
export function formatOrderNumber(value: string): string {
  const match = /^(\d+)-(\d{4})$/.exec(value);
  return match ? `${match[1].padStart(5, "0")}-${match[2]}` : value;
}
