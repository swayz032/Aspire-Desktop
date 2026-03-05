import { useEffect, useRef, useState } from 'react';

export const AVATAR_COLORS = [
  '#3B82F6', '#10B981', '#F59E0B', '#EF4444', '#8B5CF6', '#F97316',
  '#06B6D4', '#EC4899', '#84CC16', '#6366F1',
];

export function colorFromName(name: string): string {
  if (!name) return AVATAR_COLORS[0];
  const hash = name.split('').reduce((acc, c) => acc + c.charCodeAt(0), 0);
  return AVATAR_COLORS[hash % AVATAR_COLORS.length];
}

export function initials(name: string): string {
  if (!name) return '?';
  const parts = name.trim().split(' ');
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

export function timeAgo(ts: string): string {
  const diff = Date.now() - new Date(ts).getTime();
  const m = Math.floor(diff / 60000);
  if (m < 1) return 'now';
  if (m < 60) return `${m}m`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h`;
  const d = Math.floor(h / 24);
  return d === 1 ? 'Yesterday' : `${d}d`;
}

export function formatCurrency(val: number, decimals = 0): string {
  if (val >= 1_000_000) return `$${(val / 1_000_000).toFixed(1)}M`;
  if (val >= 1_000) return `$${(val / 1_000).toFixed(1)}k`;
  return `$${val.toFixed(decimals)}`;
}

/** Animates a numeric value from 0 to target over `duration` ms */
export function useCountUp(target: number, duration = 800, trigger = true): number {
  const [value, setValue] = useState(0);
  const frame = useRef<number | null>(null);

  useEffect(() => {
    if (!trigger || target === 0) { setValue(0); return; }
    const start = Date.now();
    const tick = () => {
      const elapsed = Date.now() - start;
      const progress = Math.min(elapsed / duration, 1);
      const eased = 1 - Math.pow(1 - progress, 3);
      setValue(Math.round(eased * target));
      if (progress < 1) {
        frame.current = requestAnimationFrame(tick);
      }
    };
    frame.current = requestAnimationFrame(tick);
    return () => { if (frame.current) cancelAnimationFrame(frame.current); };
  }, [target, duration, trigger]);

  return value;
}

export function statusColor(status: string): string {
  const s = status?.toLowerCase?.() ?? '';
  if (s === 'open' || s === 'active' || s === 'paid') return '#10B981';
  if (s === 'overdue' || s === 'expired' || s === 'failed') return '#EF4444';
  if (s === 'draft' || s === 'pending') return '#F59E0B';
  if (s === 'cancelled' || s === 'void') return '#6B7280';
  return '#6B7280';
}
