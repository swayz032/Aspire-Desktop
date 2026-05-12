// Identity values come from intake form (suite_profiles via useTenant) — no hardcoded constants

export function formatTimestamp(date: Date): string {
  return date.toISOString();
}

export function formatRelativeTime(timestamp: string): string {
  const now = new Date();
  const then = new Date(timestamp);
  const diffMs = now.getTime() - then.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMs / 3600000);
  const diffDays = Math.floor(diffMs / 86400000);

  if (diffMins < 1) return 'Just now';
  if (diffMins < 60) return `${diffMins}m ago`;
  if (diffHours < 24) return `${diffHours}h ago`;
  if (diffDays < 7) return `${diffDays}d ago`;
  
  return then.toLocaleDateString('en-US', { 
    month: 'short', 
    day: 'numeric' 
  });
}

export function formatDateTime(timestamp: string): string {
  const date = new Date(timestamp);
  return date.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
  });
}

export function formatDate(timestamp: string): string {
  const date = new Date(timestamp);
  return date.toLocaleDateString('en-US', {
    month: 'long',
    day: 'numeric',
    year: 'numeric',
  });
}

export function formatTime(timestamp: string): string {
  const date = new Date(timestamp);
  return date.toLocaleTimeString('en-US', {
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
  });
}

export function formatDuration(seconds: number): string {
  const mins = Math.floor(seconds / 60);
  const secs = seconds % 60;
  return `${mins}:${String(secs).padStart(2, '0')}`;
}

export function formatPhoneNumber(phone: string): string {
  const cleaned = phone.replace(/\D/g, '');
  if (cleaned.length === 10) {
    return `(${cleaned.slice(0, 3)}) ${cleaned.slice(3, 6)}-${cleaned.slice(6)}`;
  }
  if (cleaned.length === 11) {
    return `+${cleaned[0]} (${cleaned.slice(1, 4)}) ${cleaned.slice(4, 7)}-${cleaned.slice(7)}`;
  }
  return phone;
}

export function formatMaskedPhone(phone: string): string {
  const formatted = formatPhoneNumber(phone);
  return formatted.replace(/\d(?=\d{4})/g, '*');
}

export function formatMoney(amount: number, currency: string = 'USD'): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency,
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  }).format(amount);
}

export function formatDisplayId(displayId?: string | null, uuid?: string | null): string {
  if (displayId) return String(displayId).trim().toUpperCase();
  return '';
}

export function formatSuiteContext(suiteId?: string | null, officeId?: string | null, displayId?: string | null): string {
  const suite = displayId ? String(displayId).trim().toUpperCase() : '';
  return suite ? `Suite ${suite}` : 'Suite';
}

export function formatFullContext(businessName?: string | null, suiteId?: string | null, displayId?: string | null): string {
  const name = businessName || 'Your Business';
  const suite = displayId ? String(displayId).trim().toUpperCase() : '';
  return suite ? `${name} · Suite ${suite}` : name;
}

export function getRandomPastDate(maxDaysAgo: number = 30): Date {
  const now = new Date();
  const daysAgo = Math.floor(Math.random() * maxDaysAgo);
  const hoursAgo = Math.floor(Math.random() * 24);
  const minsAgo = Math.floor(Math.random() * 60);
  return new Date(now.getTime() - (daysAgo * 86400000) - (hoursAgo * 3600000) - (minsAgo * 60000));
}

export function getRecentDate(hoursAgo: number): Date {
  return new Date(Date.now() - hoursAgo * 3600000);
}

// ---------------------------------------------------------------------------
// Front Desk Hub utilities (Pass A)
// ---------------------------------------------------------------------------

/**
 * formatRelativeTime — extended version with "Just now", "X min ago",
 * "X hr ago", "Yesterday", and "Mon DD" for older dates.
 *
 * NOTE: lib/formatters.ts already exports formatRelativeTime (lines 7-24)
 * using a `Xm ago` / `Xh ago` / `Xd ago` pattern. This overload adds the
 * richer display variants expected by TodayFeed and the workspace list rows
 * ("Just now", "15 min ago", "1 hr ago", "Yesterday", "May 11").
 *
 * The existing formatRelativeTime uses abbreviated units — we keep that for
 * non-feed contexts (receipt ledger etc.) and export this as
 * formatRelativeTimeFull for the Front Desk Hub. Pass B workspaces import
 * the right variant per call site.
 */
export function formatRelativeTimeFull(iso: string): string {
  const now = new Date();
  const then = new Date(iso);
  const diffMs = now.getTime() - then.getTime();
  const diffMins = Math.floor(diffMs / 60_000);
  const diffHours = Math.floor(diffMs / 3_600_000);
  const diffDays = Math.floor(diffMs / 86_400_000);

  if (diffMins < 1) return 'Just now';
  if (diffMins < 60) return `${diffMins} min ago`;
  if (diffHours < 24) return `${diffHours} hr ago`;
  if (diffDays === 1) return 'Yesterday';
  if (diffDays < 7) {
    return then.toLocaleDateString('en-US', { weekday: 'short' });
  }
  return then.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

/**
 * hashStringToColor — deterministic avatar color from a string.
 *
 * Maps the string to one of 10 saturated colors curated to match the existing
 * workspace mock fixtures (those colors were hand-picked; this palette mirrors
 * exactly the colors already in use). Same input always returns same color.
 */
const AVATAR_PALETTE: readonly string[] = [
  '#3B82F6', // blue
  '#22C55E', // green
  '#F59E0B', // amber
  '#8B5CF6', // violet
  '#EC4899', // pink
  '#06B6D4', // cyan
  '#EF4444', // red
  '#10B981', // emerald
  '#F97316', // orange
  '#A855F7', // purple
];

export function hashStringToColor(s: string): string {
  let hash = 0;
  for (let i = 0; i < s.length; i++) {
    hash = (hash * 31 + s.charCodeAt(i)) >>> 0; // unsigned 32-bit
  }
  return AVATAR_PALETTE[hash % AVATAR_PALETTE.length];
}

/**
 * extractInitials — first letter of first two words, uppercase.
 *
 * Examples:
 *   "Brighton Office Build" → "BO"
 *   "Sarah Klein"           → "SK"
 *   "Maria"                 → "M"
 *   ""                      → "?"
 */
export function extractInitials(name: string): string {
  const words = name.trim().split(/\s+/).filter(Boolean);
  if (words.length === 0) return '?';
  if (words.length === 1) return words[0][0].toUpperCase();
  return (words[0][0] + words[1][0]).toUpperCase();
}

/**
 * extractAreaCode — pull the 3-digit area code from a US phone string.
 *
 * Accepts E.164 (+16175550188), 11-digit (16175550188), 10-digit (6175550188),
 * or formatted ((617) 555-0188 / 617-555-0188). Returns null for non-US shapes.
 *
 * Examples:
 *   "+16175550188" → "617"
 *   "(617) 555-0188" → "617"
 *   "+442071234567" → null  (UK number — not 10 or 11 US digits)
 */
export function extractAreaCode(phone: string): string | null {
  const digits = phone.replace(/\D/g, '');
  if (digits.length === 10) return digits.slice(0, 3);
  if (digits.length === 11 && digits[0] === '1') return digits.slice(1, 4);
  return null;
}

export function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

