/**
 * Calendar date in the restaurant's operational timezone (Toronto).
 *
 * Intl.DateTimeFormat(...).format() is locale-dependent and may output
 * MM/DD/YYYY on some browsers, which <input type="date"> and our API reject.
 * formatToParts() guarantees that we assemble YYYY-MM-DD ourselves.
 */
export function pcOperationalDate(now: Date = new Date()): string {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: 'America/Toronto',
    calendar: 'gregory',
    numberingSystem: 'latn',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(now);
  const part = (type: Intl.DateTimeFormatPartTypes): string =>
    parts.find((item) => item.type === type)?.value ?? '';
  const year = part('year');
  const month = part('month').padStart(2, '0');
  const day = part('day').padStart(2, '0');
  if (!/^\d{4}$/.test(year) || !/^\d{2}$/.test(month) || !/^\d{2}$/.test(day)) {
    throw new Error('INVALID_OPERATIONAL_DATE');
  }
  return `${year}-${month}-${day}`;
}
