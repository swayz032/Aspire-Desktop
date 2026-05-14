const LEGAL_SUFFIX_RE =
  /\s*,?\s+(llc|l\.l\.c\.|inc|inc\.|incorporated|corp|corp\.|corporation|co|co\.|company|ltd|ltd\.|limited|pllc|p\.l\.l\.c\.)$/i;

export function stripLegalSuffixes(name: string | null | undefined): string {
  const raw = (name ?? '').trim();
  if (!raw) return '';

  let next = raw;
  let prev = '';
  while (next !== prev) {
    prev = next;
    next = next.replace(LEGAL_SUFFIX_RE, '').trim().replace(/[,\s]+$/, '').trim();
  }
  return next || raw;
}

