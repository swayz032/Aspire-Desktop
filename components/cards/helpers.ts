/**
 * Shared helper functions for research card components.
 * Extracted to eliminate duplication across HotelCard, ProductCard, BusinessCard.
 */

/** Render rating stars from a numeric score (0-5). Half stars at >= .25 */
export function renderStars(rating: number): string {
  const full = Math.floor(rating);
  const hasHalf = rating - full >= 0.25;
  const empty = 5 - full - (hasHalf ? 1 : 0);
  return (
    '\u2605'.repeat(full) +
    (hasHalf ? '\u00BD' : '') +
    '\u2606'.repeat(empty)
  );
}

/** Abbreviate large numbers: 3227 -> "3.2K" */
export function fmtCount(n: number | undefined): string {
  if (!n) return '0';
  if (n >= 1000) return `${(n / 1000).toFixed(1)}K`;
  return String(n);
}

/** Extract domain from a URL for display: "https://www.hilton.com/foo" -> "hilton.com" */
export function domainOf(url: string | undefined): string {
  if (!url) return '';
  try {
    return new URL(url).hostname.replace('www.', '');
  } catch {
    return url;
  }
}

/** Format price with currency symbol */
export function fmtPrice(price: number | string | undefined, currency = '$'): string {
  if (price == null) return '';
  const num = typeof price === 'string' ? parseFloat(price.replace(/[^0-9.]/g, '')) : price;
  if (isNaN(num)) return String(price);
  return `${currency}${num.toFixed(2)}`;
}

/** Format dollar amounts with commas, no cents for values >= $1000 */
export function fmtDollar(value: number | string | undefined | null): string {
  if (value == null) return '';
  const num = typeof value === 'string' ? parseFloat(value.replace(/[^0-9.-]/g, '')) : value;
  if (isNaN(num)) return String(value);
  if (Math.abs(num) >= 1000) {
    return `$${Math.round(num).toLocaleString('en-US')}`;
  }
  return `$${num.toFixed(2)}`;
}

/** Format square footage: 2635 → "2,635 sqft" */
export function fmtSqft(sqft: number | undefined | null): string {
  if (sqft == null) return '';
  return `${Math.round(sqft).toLocaleString('en-US')} sqft`;
}

/** Format percentage: 12.5 → "12.5%" */
export function fmtPercent(pct: number | undefined | null): string {
  if (pct == null) return '';
  return `${pct.toFixed(1)}%`;
}
