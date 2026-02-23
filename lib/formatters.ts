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
  if (displayId) return displayId;
  if (uuid) return uuid.slice(0, 8);
  return '';
}

export function formatSuiteContext(suiteId?: string | null, officeId?: string | null, displayId?: string | null): string {
  const suite = displayId || (suiteId ? suiteId.slice(0, 8) : '');
  return suite ? `Suite ${suite}` : 'Suite';
}

export function formatFullContext(businessName?: string | null, suiteId?: string | null, displayId?: string | null): string {
  const name = businessName || 'Your Business';
  const suite = displayId || (suiteId ? suiteId.slice(0, 8) : '');
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

export function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}
