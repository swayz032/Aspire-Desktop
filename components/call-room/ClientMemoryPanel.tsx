// components/call-room/ClientMemoryPanel.tsx
import React, { useEffect, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import type { ClientContext } from './types';
import { CallRoomClock } from './CallRoomClock';
import { useAuthFetch } from '@/lib/authenticatedFetch';

interface CallerIdLookupResult {
  display_name?: string;
  role?: string;
  contact_type?: 'routing' | 'sms' | 'call_history' | 'unknown' | string;
  last_interaction_at?: string | null;
  formatted_number?: string;
}

const SOURCE_LABEL: Record<string, string> = {
  routing: 'Routing contact',
  sms: 'Recent SMS',
  call_history: 'Recent call',
};

export function ClientMemoryPanel({ client }: { client: ClientContext }): React.ReactElement {
  const { authenticatedFetch } = useAuthFetch();
  const [resolved, setResolved] = useState<CallerIdLookupResult | null>(null);
  const [loading, setLoading] = useState(false);

  // Real caller-id lookup. Only fires when we have a proper E.164 phone +
  // no name pre-set (the caller may already be known via the route params).
  useEffect(() => {
    let cancelled = false;
    const phone = (client.phoneE164 || '').trim();
    if (!/^\+\d{7,15}$/.test(phone)) {
      setResolved(null);
      return;
    }
    setLoading(true);
    (async () => {
      try {
        const r = await authenticatedFetch(
          `/api/calls/caller-id-lookup?phone=${encodeURIComponent(phone)}`,
        );
        if (!r.ok) {
          if (!cancelled) setResolved(null);
          return;
        }
        const data = (await r.json()) as CallerIdLookupResult;
        if (!cancelled) setResolved(data);
      } catch {
        if (!cancelled) setResolved(null);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [authenticatedFetch, client.phoneE164]);

  // Merge: route params take precedence (CRM-known caller), otherwise
  // surface the resolved name. service/urgency/note remain from route
  // params for now — those come from a contact card on the dialer page.
  const displayName = client.name || resolved?.display_name || null;
  const sourceLabel =
    !client.name && resolved?.contact_type && resolved.contact_type !== 'unknown'
      ? SOURCE_LABEL[resolved.contact_type] || null
      : null;

  if (!displayName && !client.service && !loading) {
    return (
      <View style={styles.panel} testID="client-memory-empty">
        <PanelHeader />
        <Text style={styles.empty}>New caller · No history yet</Text>
      </View>
    );
  }
  return (
    <View style={styles.panel} testID="client-memory">
      <PanelHeader />
      {displayName && <Text style={styles.name}>{displayName}</Text>}
      <Text style={styles.phone}>{formatPhone(client.phoneE164)}</Text>
      {sourceLabel ? (
        <Text style={styles.sourceLabel}>{sourceLabel}</Text>
      ) : null}
      <View style={styles.divider} />
      {client.service && <Row label="Service" value={client.service} />}
      {client.urgency && <UrgencyRow level={client.urgency} />}
      {client.note && (
        <View style={styles.noteBlock}>
          <Text style={styles.rowLabel}>Note</Text>
          <Text style={styles.noteText}>{client.note}</Text>
        </View>
      )}
    </View>
  );
}

// Panel header — section label on the left, premium local-time clock on
// the right. Both sit on the panel's translucent glass; no separate
// background fill on either element.
function PanelHeader() {
  return (
    <View style={styles.headerRow}>
      <Text style={styles.sectionLabel}>CLIENT MEMORY</Text>
      <CallRoomClock />
    </View>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.row}>
      <Text style={styles.rowLabel}>{label}</Text>
      <Text style={styles.rowValue}>{value}</Text>
    </View>
  );
}

function UrgencyRow({ level }: { level: 'low' | 'medium' | 'high' }) {
  const borderColor =
    level === 'high' ? '#dc2626' : level === 'medium' ? '#eab308' : 'rgba(120,170,220,0.6)';
  const textColor =
    level === 'high' ? '#fca5a5' : level === 'medium' ? '#fde68a' : 'rgba(120,170,220,0.95)';
  return (
    <View style={styles.row}>
      <Text style={styles.rowLabel}>Urgency</Text>
      <View style={[styles.pill, { borderColor }]}>
        <Text style={[styles.pillText, { color: textColor }]}>{level.toUpperCase()}</Text>
      </View>
    </View>
  );
}

function formatPhone(e164: string): string {
  const m = e164.match(/^\+1(\d{3})(\d{3})(\d{4})$/);
  if (!m) return e164;
  return `(${m[1]}) ${m[2]}-${m[3]}`;
}

const styles = StyleSheet.create({
  panel: {
    padding: 18,
    backgroundColor: 'rgba(255,255,255,0.03)',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.05)',
    width: '100%',
    // Both side panels share the same minHeight so their tints match.
    // Auto-grows if content needs more, but never extends down to the controls bar.
    minHeight: 280,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    marginBottom: 14,
    gap: 12,
  },
  sectionLabel: {
    color: 'rgba(255,255,255,0.5)',
    fontSize: 11,
    fontWeight: '600',
    letterSpacing: 1.2,
  },
  name: { color: '#fff', fontSize: 18, fontWeight: '600' },
  phone: {
    color: 'rgba(255,255,255,0.5)',
    fontSize: 14,
    marginTop: 2,
    fontVariant: ['tabular-nums'],
  },
  sourceLabel: {
    color: 'rgba(120,170,220,0.85)',
    fontSize: 11,
    fontWeight: '600',
    letterSpacing: 0.6,
    marginTop: 6,
    textTransform: 'uppercase',
  },
  divider: { height: 1, backgroundColor: 'rgba(255,255,255,0.06)', marginVertical: 14 },
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginVertical: 6,
  },
  rowLabel: { color: 'rgba(255,255,255,0.55)', fontSize: 13 },
  rowValue: { color: 'rgba(255,255,255,0.85)', fontSize: 13 },
  // Restrained urgency pill — thin border only, no filled background that would compete
  pill: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 999,
    borderWidth: 1,
    backgroundColor: 'transparent',
  },
  pillText: { fontSize: 11, fontWeight: '600', letterSpacing: 0.5 },
  noteBlock: { marginTop: 10 },
  noteText: { color: 'rgba(255,255,255,0.78)', fontSize: 13, marginTop: 4, lineHeight: 18 },
  empty: { color: 'rgba(255,255,255,0.45)', fontSize: 14, fontStyle: 'italic' },
});
