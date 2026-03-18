import React, { useState, useEffect, useCallback, memo } from 'react';
import { View, Text, Pressable, StyleSheet, ScrollView, Platform } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { supabase } from '@/lib/supabase';
import { useAuthFetch } from '@/lib/authenticatedFetch';
import { useFrontdeskCalls } from '@/hooks/useFrontdeskCalls';
import type { PanelContentProps } from './types';
import { timeAgo } from './utils';
import { PageErrorBoundary } from '@/components/PageErrorBoundary';

const BLUE    = '#0ea5e9';
const SURFACE = 'rgba(6,6,10,0.98)';
const GLASS   = 'rgba(255,255,255,0.06)';
const BORDER  = 'rgba(255,255,255,0.11)';
const TP      = '#FFFFFF';
const TS      = 'rgba(255,255,255,0.45)';
const TT      = 'rgba(255,255,255,0.25)';
const C_GREEN = '#22c55e';
const C_RED   = '#ef4444';

const GLASS_WEB: any = Platform.OS === 'web'
  ? { backdropFilter: 'blur(20px)', boxShadow: '0 4px 24px rgba(0,0,0,0.3)' }
  : {};

type Tab = 'mail' | 'office' | 'calls' | 'contacts';

interface MailItem {
  id: string;
  from_name?: string;
  from_email?: string;
  subject?: string;
  preview?: string;
  received_at?: string;
  is_read?: boolean;
}
interface OfficeItem {
  id: string;
  title?: string;
  description?: string;
  source?: string;
  created_at?: string;
}
interface Contact {
  id: string;
  name?: string;
  role?: string;
  phone?: string;
  email?: string;
}
interface Call {
  id: string;
  caller_name?: string;
  from?: string;
  status?: string;
  started_at?: string;
}

function nameColor(name: string): string {
  const palette = ['#0ea5e9','#22c55e','#a855f7','#f59e0b','#ef4444','#14b8a6','#f97316'];
  let h = 0;
  for (let i = 0; i < name.length; i++) h = (h * 31 + name.charCodeAt(i)) & 0xFFFFFF;
  return palette[Math.abs(h) % palette.length];
}

function initials(name: string): string {
  return name.trim().split(/\s+/).map(w => w[0]).join('').toUpperCase().slice(0, 2);
}

const Avatar = memo(function Avatar({ name, size = 44 }: { name: string; size?: number }) {
  const col = nameColor(name);
  return (
    <View style={[s.avatar, { width: size, height: size, borderRadius: size / 2, backgroundColor: `${col}22`, borderColor: `${col}55` }]}>
      <Text style={[s.avatarText, { fontSize: size * 0.35, color: col }]}>{initials(name)}</Text>
    </View>
  );
});

function InboxPanelContentInner(_props: PanelContentProps) {
  const { authenticatedFetch }  = useAuthFetch();
  const { calls: rawCalls }     = useFrontdeskCalls();
  const calls                   = (rawCalls || []) as unknown as Call[];
  const [tab, setTab]           = useState<Tab>('office');
  const [mail, setMail]         = useState<MailItem[]>([]);
  const [office, setOffice]     = useState<OfficeItem[]>([]);
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [loading, setLoading]   = useState(false);

  const loadMail = useCallback(async () => {
    setLoading(true);
    try {
      const { data } = await supabase.from('emails').select('*').order('received_at', { ascending: false }).limit(30);
      setMail(data || []);
    } catch { /* ignore */ } finally { setLoading(false); }
  }, []);

  const loadOffice = useCallback(async () => {
    setLoading(true);
    try {
      const res = await authenticatedFetch('/api/inbox?limit=20');
      const d   = await res.json();
      setOffice(d.items || d || []);
    } catch { /* ignore */ } finally { setLoading(false); }
  }, [authenticatedFetch]);

  const loadContacts = useCallback(async () => {
    setLoading(true);
    try {
      const { data } = await supabase.from('contacts').select('*').order('name').limit(30);
      setContacts(data || []);
    } catch { /* ignore */ } finally { setLoading(false); }
  }, []);

  useEffect(() => {
    if (tab === 'mail')     loadMail();
    if (tab === 'office')   loadOffice();
    if (tab === 'contacts') loadContacts();
  }, [tab]);

  const handleAct = useCallback(async (id: string) => {
    try { await authenticatedFetch(`/api/inbox/${id}/act`, { method: 'POST' }); } catch { /* ignore */ }
  }, [authenticatedFetch]);

  const handleDismiss = useCallback(async (id: string) => {
    try {
      await authenticatedFetch(`/api/inbox/${id}/dismiss`, { method: 'POST' });
      setOffice(prev => prev.filter(o => o.id !== id));
    } catch { /* ignore */ }
  }, [authenticatedFetch]);

  const handleCallBack = useCallback(async (phone: string) => {
    try {
      await fetch('/api/calls/outbound', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ to: phone }),
      });
    } catch { /* ignore */ }
  }, []);

  const missedCalls = calls.filter(c => c.status === 'missed' || c.status === 'no-answer');

  const TABS: { key: Tab; icon: string; label: string; badge?: number }[] = [
    { key: 'office',   icon: 'briefcase',     label: 'Office', badge: office.length  },
    { key: 'calls',    icon: 'call',          label: 'Calls',  badge: missedCalls.length },
    { key: 'mail',     icon: 'mail',          label: 'Mail',   badge: mail.filter(m => !m.is_read).length },
    { key: 'contacts', icon: 'people',        label: 'People'  },
  ];

  return (
    <View style={s.root}>
      <View style={s.orbBehind} pointerEvents="none" />

      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={s.tabBar} contentContainerStyle={s.tabBarContent}>
        {TABS.map(t => (
          <Pressable key={t.key} onPress={() => setTab(t.key)} style={[s.tab, tab === t.key && s.tabActive]}>
            <Ionicons name={t.icon as any} size={15} color={tab === t.key ? '#FFF' : TS} />
            <Text style={[s.tabText, tab === t.key && s.tabTextActive]}>{t.label}</Text>
            {(t.badge ?? 0) > 0 && (
              <View style={[s.tabBadge, tab === t.key && s.tabBadgeActive]}>
                <Text style={s.tabBadgeText}>{t.badge}</Text>
              </View>
            )}
          </Pressable>
        ))}
      </ScrollView>

      <ScrollView style={s.list} showsVerticalScrollIndicator={false}>
        {loading && <Text style={s.emptyText}>Loading…</Text>}

        {tab === 'mail' && !loading && (
          <>
            {mail.length === 0 && <Text style={s.emptyText}>No emails</Text>}
            {mail.map(m => (
              <View key={m.id} style={[s.card, !m.is_read && s.cardUnread]}>
                <Avatar name={m.from_name || m.from_email || 'U'} />
                <View style={s.cardBody}>
                  <View style={s.cardTopRow}>
                    <Text style={s.cardTitle} numberOfLines={1}>{m.from_name || m.from_email}</Text>
                    <Text style={s.cardTime}>{m.received_at ? timeAgo(m.received_at) : ''}</Text>
                  </View>
                  {m.subject && <Text style={s.cardSubject} numberOfLines={1}>{m.subject}</Text>}
                  {m.preview  && <Text style={s.cardPreview} numberOfLines={1}>{m.preview}</Text>}
                </View>
                {!m.is_read && <View style={s.unreadDot} />}
              </View>
            ))}
          </>
        )}

        {tab === 'office' && !loading && (
          <>
            {office.length === 0 && <Text style={s.emptyText}>Inbox clear</Text>}
            {office.map(item => (
              <View key={item.id} style={s.card}>
                <View style={s.officeIconWrap}>
                  <Ionicons name="notifications" size={18} color={BLUE} />
                </View>
                <View style={s.cardBody}>
                  <Text style={s.cardTitle} numberOfLines={2}>{item.title || 'Notification'}</Text>
                  {item.description && <Text style={s.cardPreview} numberOfLines={2}>{item.description}</Text>}
                  {item.created_at && <Text style={s.cardTime2}>{timeAgo(item.created_at)}</Text>}
                  <View style={s.officeActions}>
                    <Pressable style={s.solidSmBtn} onPress={() => handleAct(item.id)}>
                      <Text style={s.solidSmBtnText}>Act</Text>
                    </Pressable>
                    <Pressable style={s.ghostSmBtn} onPress={() => handleDismiss(item.id)}>
                      <Text style={s.ghostSmBtnText}>Dismiss</Text>
                    </Pressable>
                  </View>
                </View>
              </View>
            ))}
          </>
        )}

        {tab === 'calls' && !loading && (
          <>
            {calls.length === 0 && <Text style={s.emptyText}>No recent calls</Text>}
            {calls.map(call => {
              const isMissed = call.status === 'missed' || call.status === 'no-answer';
              return (
                <View key={call.id} style={s.card}>
                  <View style={[s.callIconWrap, { backgroundColor: isMissed ? 'rgba(239,68,68,0.15)' : 'rgba(34,197,94,0.15)' }]}>
                    <Ionicons name="call" size={18} color={isMissed ? C_RED : C_GREEN} />
                  </View>
                  <View style={s.cardBody}>
                    <Text style={s.cardTitle} numberOfLines={1}>{call.caller_name || call.from || 'Unknown'}</Text>
                    {isMissed && <Text style={[s.cardPreview, { color: C_RED }]}>Missed call</Text>}
                    {call.started_at && <Text style={s.cardTime2}>{timeAgo(call.started_at)}</Text>}
                    {call.from && (
                      <Pressable style={[s.ghostSmBtn, { marginTop: 6 }]} onPress={() => handleCallBack(call.from!)}>
                        <Ionicons name="call" size={12} color={BLUE} />
                        <Text style={s.ghostSmBtnText}>Return Call</Text>
                      </Pressable>
                    )}
                  </View>
                </View>
              );
            })}
          </>
        )}

        {tab === 'contacts' && !loading && (
          <>
            {contacts.length === 0 && <Text style={s.emptyText}>No contacts</Text>}
            {contacts.map(c => (
              <View key={c.id} style={s.card}>
                <Avatar name={c.name || 'U'} />
                <View style={s.cardBody}>
                  <Text style={s.cardTitle} numberOfLines={1}>{c.name}</Text>
                  {c.role && <Text style={s.cardPreview} numberOfLines={1}>{c.role}</Text>}
                </View>
                <View style={s.contactActions}>
                  {c.phone && (
                    <Pressable style={s.iconBtn} onPress={() => handleCallBack(c.phone!)}>
                      <Ionicons name="call" size={16} color={BLUE} />
                    </Pressable>
                  )}
                  {c.email && (
                    <Pressable style={s.iconBtn}>
                      <Ionicons name="mail" size={16} color={BLUE} />
                    </Pressable>
                  )}
                </View>
              </View>
            ))}
          </>
        )}

        <View style={s.bottomSpacer} />
      </ScrollView>
    </View>
  );
}

const s = StyleSheet.create({
  root:           { flex: 1, backgroundColor: SURFACE, position: 'relative' },
  orbBehind:      {
    position: 'absolute', top: -60, right: -60, width: 220, height: 220,
    borderRadius: 110, backgroundColor: 'rgba(14,165,233,0.10)',
    ...(Platform.OS === 'web' ? { filter: 'blur(60px)' } as any : {}),
  },
  tabBar:         { maxHeight: 52, marginTop: 12 },
  tabBarContent:  { paddingHorizontal: 12, gap: 6, alignItems: 'center', paddingVertical: 4 },
  tab:            { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 14, paddingVertical: 9, borderRadius: 20, backgroundColor: GLASS, borderWidth: 1, borderColor: BORDER },
  tabActive:      { backgroundColor: BLUE, borderColor: BLUE },
  tabText:        { fontSize: 13, fontWeight: '600', color: TS },
  tabTextActive:  { color: '#FFF' },
  tabBadge:       { backgroundColor: 'rgba(255,255,255,0.2)', borderRadius: 9, minWidth: 18, height: 18, paddingHorizontal: 4, alignItems: 'center', justifyContent: 'center' },
  tabBadgeActive: { backgroundColor: 'rgba(255,255,255,0.3)' },
  tabBadgeText:   { fontSize: 10, fontWeight: '800', color: '#FFF' },
  list:           { flex: 1, paddingTop: 8 },
  emptyText:      { fontSize: 14, color: TT, textAlign: 'center', paddingTop: 40 },
  card:           { marginHorizontal: 16, marginBottom: 8, backgroundColor: GLASS, borderRadius: 14, borderWidth: 1, borderColor: BORDER, padding: 14, flexDirection: 'row', alignItems: 'flex-start', gap: 12, ...GLASS_WEB },
  cardUnread:     { backgroundColor: 'rgba(14,165,233,0.06)', borderColor: 'rgba(14,165,233,0.2)' },
  avatar:         { borderWidth: 1.5, alignItems: 'center', justifyContent: 'center', flexShrink: 0 },
  avatarText:     { fontWeight: '700' },
  cardBody:       { flex: 1 },
  cardTopRow:     { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 3 },
  cardTitle:      { fontSize: 15, fontWeight: '700', color: TP, flex: 1, marginRight: 8 },
  cardTime:       { fontSize: 10, color: TT, flexShrink: 0 },
  cardTime2:      { fontSize: 10, color: TT, marginTop: 4 },
  cardSubject:    { fontSize: 13, fontWeight: '600', color: TS },
  cardPreview:    { fontSize: 12, color: TS, marginTop: 2 },
  unreadDot:      { width: 8, height: 8, borderRadius: 4, backgroundColor: BLUE, flexShrink: 0, marginTop: 4 },
  officeIconWrap: { width: 40, height: 40, borderRadius: 20, backgroundColor: 'rgba(14,165,233,0.15)', alignItems: 'center', justifyContent: 'center', flexShrink: 0 },
  callIconWrap:   { width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center', flexShrink: 0 },
  officeActions:  { flexDirection: 'row', gap: 8, marginTop: 10 },
  solidSmBtn:     { paddingHorizontal: 14, paddingVertical: 7, borderRadius: 8, backgroundColor: BLUE },
  solidSmBtnText: { fontSize: 12, fontWeight: '700', color: '#FFF' },
  ghostSmBtn:     { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 14, paddingVertical: 7, borderRadius: 8, borderWidth: 1, borderColor: BLUE },
  ghostSmBtnText: { fontSize: 12, fontWeight: '600', color: BLUE },
  contactActions: { flexDirection: 'row', gap: 8, flexShrink: 0 },
  iconBtn:        { width: 36, height: 36, borderRadius: 18, backgroundColor: 'rgba(14,165,233,0.12)', borderWidth: 1, borderColor: 'rgba(14,165,233,0.3)', alignItems: 'center', justifyContent: 'center' },
  bottomSpacer:   { height: 32 },
});

export default function InboxPanelContent(props: any) {
  return (
    <PageErrorBoundary pageName="inbox-panel-content">
      <InboxPanelContentInner {...props} />
    </PageErrorBoundary>
  );
}
