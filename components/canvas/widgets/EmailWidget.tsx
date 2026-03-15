import React, { useEffect, useState, useCallback, useMemo } from 'react';
import {
  View, Text, Pressable, FlatList, StyleSheet, Platform,
  TextInput, ScrollView,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { supabase } from '@/lib/supabase';
import { useAuthFetch } from '@/lib/authenticatedFetch';
import { playClickSound, playTabSwitchSound } from '@/lib/sounds';

interface EmailItem {
  id: string;
  sender_name: string;
  sender_email: string;
  subject: string;
  preview_text: string;
  body?: string;
  timestamp: string;
  is_read: boolean;
}

interface EmailWidgetProps {
  suiteId: string;
  officeId: string;
  actorId?: string;
}

const AVATAR_COLORS = ['#3B82F6', '#10B981', '#F59E0B', '#EF4444', '#8B5CF6', '#F97316'];

function colorFromName(name: string): string {
  const hash = name.split('').reduce((acc, c) => acc + c.charCodeAt(0), 0);
  return AVATAR_COLORS[hash % AVATAR_COLORS.length];
}

function initials(name: string): string {
  const parts = name.trim().split(' ');
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

function timeAgo(ts: string): string {
  const diff = Date.now() - new Date(ts).getTime();
  const m = Math.floor(diff / 60000);
  if (m < 1) return 'now';
  if (m < 60) return `${m}m`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h`;
  const d = Math.floor(h / 24);
  return d === 1 ? 'Yesterday' : `${d}d`;
}

const b1 = `Hi,\n\nAttached is the Q4 revenue report for your review. Total revenue was up 23% year over year, driven primarily by our enterprise segment.\n\nKey highlights:\n- Enterprise ARR: $4.2M (+31%)\n- SMB ARR: $1.8M (+12%)\n- Net Revenue Retention: 118%\n\nLet me know if you have questions.\n\nBest,\nSarah`;
const b2 = `Team,\n\nThe product launch is scheduled for Friday at 9am PST. All teams are aligned.\n\nFinal checklist:\n- Engineering sign-off complete\n- Marketing assets ready\n- Sales team briefed\n- Support team trained\n\nMarcus`;
const b3 = `Hi,\n\nThe Acme Corp agreement expires April 15th. Given the account growth ($240K ARR), I recommend starting renewal discussions now.\n\nProposed terms:\n- 2-year term\n- 15% uplift on base\n- Add enterprise support\n\nCan we schedule a call?\n\nBest,\nJennifer`;
const b4 = `Hi everyone,\n\nAgenda for tomorrow sync at 10am:\n\n1. Q4 Retrospective (15 min)\n2. 2026 Roadmap discussion (20 min)\n3. Hiring plan review (15 min)\n4. Open Q&A (10 min)\n\nDavid`;
const b5 = `Hi,\n\nReminder: Invoice #1042 for $12,400.00 is due March 10th.\n\nDetails:\n- Services: Platform license Q1 2026\n- Amount: $12,400.00\n- Due: March 10, 2026\n- Method: ACH\n\nPlease confirm receipt.\n\nPriya Sharma\nFinance Team`;

const DEMO_EMAILS: EmailItem[] = [
  { id: '1', sender_name: 'Sarah Johnson', sender_email: 'sarah@acme.com', subject: 'Q4 Revenue Report', preview_text: 'Attached is the Q4 revenue report. Total revenue was up 23% YoY...', body: b1, timestamp: new Date(Date.now() - 20 * 60000).toISOString(), is_read: false },
  { id: '2', sender_name: 'Marcus Chen', sender_email: 'marcus@company.com', subject: 'Product Launch — Friday', preview_text: 'The product launch is scheduled for Friday. All teams are aligned...', body: b2, timestamp: new Date(Date.now() - 2 * 3600000).toISOString(), is_read: false },
  { id: '3', sender_name: 'Jennifer Walsh', sender_email: 'jwalsh@legal.com', subject: 'Contract Renewal — Acme Corp', preview_text: 'The Acme Corp contract is up for renewal next month. I recommend a call...', body: b3, timestamp: new Date(Date.now() - 5 * 3600000).toISOString(), is_read: true },
  { id: '4', sender_name: 'David Kim', sender_email: 'dkim@team.com', subject: 'Team Sync — Agenda', preview_text: 'Agenda for tomorrow team sync: Q4 Review, Roadmap 2026, Hiring plan...', body: b4, timestamp: new Date(Date.now() - 24 * 3600000).toISOString(), is_read: true },
  { id: '5', sender_name: 'Priya Sharma', sender_email: 'priya@finance.com', subject: 'Invoice #1042 Due', preview_text: 'Invoice #1042 for $12,400 is due March 10th. Please confirm receipt...', body: b5, timestamp: new Date(Date.now() - 2 * 24 * 3600000).toISOString(), is_read: true },
];

export function EmailWidget({ suiteId, officeId }: EmailWidgetProps) {
  const { authenticatedFetch } = useAuthFetch();
  const [items, setItems] = useState<EmailItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');

  const fetchItems = useCallback(async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('inbox_items')
        .select('*')
        .eq('suite_id', suiteId)
        .eq('office_id', officeId)
        .order('created_at', { ascending: false })
        .limit(20);
      if (error) throw error;
      const formatted = (data || []).map((item: any) => ({
        id: item.id,
        sender_name: item.sender_name || 'System',
        sender_email: item.sender_email || '',
        subject: item.subject || 'No Subject',
        preview_text: item.body_preview || item.content || '',
        body: item.content || '',
        timestamp: item.created_at,
        is_read: item.is_read ?? false,
      }));
      setItems(formatted.length > 0 ? formatted : DEMO_EMAILS);
    } catch {
      setItems(DEMO_EMAILS);
    } finally {
      setLoading(false);
    }
  }, [suiteId, officeId]);

  useEffect(() => { fetchItems(); }, [fetchItems]);

  const filtered = useMemo(() =>
    items.filter(i =>
      !searchQuery ||
      i.sender_name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      i.subject.toLowerCase().includes(searchQuery.toLowerCase())
    ),
    [items, searchQuery]
  );

  const selectedItem = items.find(i => i.id === selectedId) ?? null;

  return (
    <View style={s.root}>
      {/* LEFT PANEL */}
      <View style={s.left}>
        {/* Header */}
        <View style={s.leftHeader}>
          <Text style={s.leftTitle}>Inbox</Text>
          <Pressable style={s.composeBtn} onPress={() => playClickSound()}>
            <Ionicons name="create-outline" size={19} color="rgba(255,255,255,0.7)" />
          </Pressable>
        </View>

        {/* Search */}
        <View style={s.searchWrap}>
          <Ionicons name="search" size={14} color="rgba(255,255,255,0.3)" />
          <TextInput
            style={s.searchInput}
            value={searchQuery}
            onChangeText={setSearchQuery}
            placeholder="Search…"
            placeholderTextColor="rgba(255,255,255,0.25)"
          />
        </View>

        {/* Thread list */}
        <FlatList
          data={filtered}
          keyExtractor={i => i.id}
          showsVerticalScrollIndicator={false}
          renderItem={({ item }) => {
            const bg = colorFromName(item.sender_name);
            const selected = item.id === selectedId;
            return (
              <Pressable
                style={[s.thread, selected && s.threadSelected]}
                onPress={() => {
                  Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
                  playClickSound();
                  setSelectedId(item.id);
                }}
              >
                {selected && <View style={s.selectedBar} />}
                <View style={[s.avatar, { backgroundColor: bg }]}>
                  <Text style={s.avatarText}>{initials(item.sender_name)}</Text>
                </View>
                <View style={s.threadBody}>
                  <View style={s.threadTop}>
                    <Text style={[s.senderName, !item.is_read && s.senderBold]} numberOfLines={1}>
                      {item.sender_name}
                    </Text>
                    <Text style={s.threadTime}>{timeAgo(item.timestamp)}</Text>
                  </View>
                  <Text style={s.threadSubject} numberOfLines={1}>{item.subject}</Text>
                  <Text style={s.threadPreview} numberOfLines={1}>{item.preview_text}</Text>
                </View>
                {!item.is_read && <View style={s.unreadDot} />}
              </Pressable>
            );
          }}
          ListEmptyComponent={
            <View style={s.emptyState}>
              <Text style={s.emptyText}>{loading ? 'Loading…' : 'No messages'}</Text>
            </View>
          }
        />
      </View>

      {/* RIGHT PANEL */}
      <View style={s.right}>
        {selectedItem ? (
          <ScrollView contentContainerStyle={s.detailContent} showsVerticalScrollIndicator={false}>
            {/* Sender row */}
            <View style={s.detailSenderRow}>
              <View style={[s.detailAvatar, { backgroundColor: colorFromName(selectedItem.sender_name) }]}>
                <Text style={s.detailAvatarText}>{initials(selectedItem.sender_name)}</Text>
              </View>
              <View style={s.detailSenderInfo}>
                <Text style={s.detailSenderName}>{selectedItem.sender_name}</Text>
                <Text style={s.detailSenderEmail}>{selectedItem.sender_email}</Text>
              </View>
              <Text style={s.detailTime}>{timeAgo(selectedItem.timestamp)}</Text>
            </View>

            {/* Subject */}
            <Text style={s.detailSubject}>{selectedItem.subject}</Text>

            {/* Body */}
            <Text style={s.detailBody}>{selectedItem.body || selectedItem.preview_text}</Text>

            {/* Actions */}
            <View style={s.detailActions}>
              <Pressable style={s.replyBtn} onPress={() => playClickSound()}>
                <Ionicons name="arrow-undo" size={15} color="#FFF" />
                <Text style={s.replyBtnText}>Reply</Text>
              </Pressable>
              <Pressable style={s.forwardBtn} onPress={() => playClickSound()}>
                <Ionicons name="arrow-redo-outline" size={15} color="rgba(255,255,255,0.6)" />
                <Text style={s.forwardBtnText}>Forward</Text>
              </Pressable>
            </View>
          </ScrollView>
        ) : (
          <View style={s.noSelect}>
            <Ionicons name="mail-outline" size={36} color="rgba(255,255,255,0.1)" />
            <Text style={s.noSelectText}>Select a message</Text>
          </View>
        )}
      </View>
    </View>
  );
}

const s = StyleSheet.create({
  root: {
    flex: 1,
    flexDirection: 'row',
    backgroundColor: '#060910',
  },
  left: {
    width: 240,
    backgroundColor: '#080D14',
    borderRightWidth: 1,
    borderRightColor: 'rgba(255,255,255,0.07)',
  },
  leftHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingTop: 20,
    paddingBottom: 12,
  },
  leftTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#FFF',
  },
  composeBtn: {
    width: 32,
    height: 32,
    borderRadius: 8,
    backgroundColor: 'rgba(255,255,255,0.06)',
    justifyContent: 'center',
    alignItems: 'center',
    ...(Platform.OS === 'web' ? ({ cursor: 'pointer' }) : {}),
  },
  searchWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.06)',
    borderRadius: 8,
    marginHorizontal: 12,
    marginBottom: 8,
    paddingHorizontal: 10,
    paddingVertical: 7,
    gap: 6,
  },
  searchInput: {
    flex: 1,
    fontSize: 13,
    color: '#FFF',
    ...(Platform.OS === 'web' ? ({ outlineStyle: 'none' }) : {}),
  },
  thread: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 11,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,255,255,0.04)',
    gap: 10,
    position: 'relative',
    ...(Platform.OS === 'web' ? ({ cursor: 'pointer' }) : {}),
  },
  threadSelected: {
    backgroundColor: 'rgba(59,130,246,0.08)',
  },
  selectedBar: {
    position: 'absolute',
    left: 0,
    top: 0,
    bottom: 0,
    width: 3,
    backgroundColor: '#3B82F6',
    borderRadius: 2,
  },
  avatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
    flexShrink: 0,
  },
  avatarText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#FFF',
  },
  threadBody: { flex: 1, gap: 2 },
  threadTop: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  senderName: {
    fontSize: 13,
    color: 'rgba(255,255,255,0.6)',
    fontWeight: '500',
    flex: 1,
  },
  senderBold: {
    color: '#FFF',
    fontWeight: '700',
  },
  threadTime: {
    fontSize: 10,
    color: 'rgba(255,255,255,0.3)',
    marginLeft: 4,
  },
  threadSubject: {
    fontSize: 12,
    color: 'rgba(255,255,255,0.55)',
    fontWeight: '600',
  },
  threadPreview: {
    fontSize: 11,
    color: 'rgba(255,255,255,0.3)',
  },
  unreadDot: {
    width: 7,
    height: 7,
    borderRadius: 4,
    backgroundColor: '#3B82F6',
    flexShrink: 0,
  },
  emptyState: {
    paddingVertical: 40,
    alignItems: 'center',
  },
  emptyText: {
    color: 'rgba(255,255,255,0.25)',
    fontSize: 13,
  },
  right: {
    flex: 1,
    backgroundColor: '#06090F',
  },
  detailContent: {
    padding: 24,
    paddingTop: 20,
    gap: 16,
  },
  detailSenderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginBottom: 4,
  },
  detailAvatar: {
    width: 44,
    height: 44,
    borderRadius: 22,
    justifyContent: 'center',
    alignItems: 'center',
    flexShrink: 0,
  },
  detailAvatarText: {
    fontSize: 15,
    fontWeight: '700',
    color: '#FFF',
  },
  detailSenderInfo: { flex: 1 },
  detailSenderName: {
    fontSize: 15,
    fontWeight: '700',
    color: '#FFF',
  },
  detailSenderEmail: {
    fontSize: 12,
    color: 'rgba(255,255,255,0.4)',
    marginTop: 1,
  },
  detailTime: {
    fontSize: 11,
    color: 'rgba(255,255,255,0.3)',
  },
  detailSubject: {
    fontSize: 20,
    fontWeight: '800',
    color: '#FFF',
    lineHeight: 26,
  },
  detailBody: {
    fontSize: 14,
    color: 'rgba(255,255,255,0.65)',
    lineHeight: 22,
  },
  detailActions: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 8,
  },
  replyBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#3B82F6',
    paddingHorizontal: 18,
    paddingVertical: 10,
    borderRadius: 20,
    ...(Platform.OS === 'web' ? ({ cursor: 'pointer' }) : {}),
  },
  replyBtnText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#FFF',
  },
  forwardBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.15)',
    paddingHorizontal: 18,
    paddingVertical: 10,
    borderRadius: 20,
    ...(Platform.OS === 'web' ? ({ cursor: 'pointer' }) : {}),
  },
  forwardBtnText: {
    fontSize: 13,
    fontWeight: '600',
    color: 'rgba(255,255,255,0.6)',
  },
  noSelect: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    gap: 12,
  },
  noSelectText: {
    fontSize: 14,
    color: 'rgba(255,255,255,0.2)',
  },
});
