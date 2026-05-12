import React, { useState, useEffect } from 'react';
import { View, StyleSheet, Platform } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import {
  ensureInvisibleScrollCss,
  Avatar,
  ListHeader,
  DetailHeader,
  ActionButton,
  styleTokens as t,
} from '@/components/front-desk/inboxShared';

/**
 * CallbackQueueWorkspace — bucket-grouped callback list (Due Today /
 * Overdue / Scheduled). MOCK only.
 */

type Bucket = 'due_today' | 'overdue' | 'scheduled';

const BUCKET_LABEL: Record<Bucket, string> = {
  due_today: 'Due Today',
  overdue: 'Overdue',
  scheduled: 'Scheduled',
};

const BUCKET_COLOR: Record<Bucket, string> = {
  due_today: '#F59E0B',
  overdue: '#EF4444',
  scheduled: '#3B82F6',
};

type Callback = {
  id: string;
  bucket: Bucket;
  name: string;
  initials: string;
  avatarColor: string;
  phone: string;
  promiseTime: string; // "2:00 PM"
  dueLabel: string; // "Due in 1h" / "Overdue 23h" / "Tomorrow 9:00 AM"
  context: string;
};

const MOCK: Callback[] = [
  // Due Today (3)
  { id: 'q1', bucket: 'due_today', name: 'Maria Lewis', initials: 'ML', avatarColor: '#F59E0B', phone: '(617) 555-0142', promiseTime: '2:00 PM', dueLabel: 'Due in 1h', context: 'Wanted update on the kitchen quote.' },
  { id: 'q2', bucket: 'due_today', name: 'David Reed', initials: 'DR', avatarColor: '#A855F7', phone: '(617) 555-0319', promiseTime: '4:30 PM', dueLabel: 'Due in 3h', context: 'Question about porch railing height.' },
  { id: 'q3', bucket: 'due_today', name: 'Sarah Klein', initials: 'SK', avatarColor: '#10B981', phone: '(617) 555-0411', promiseTime: '5:00 PM', dueLabel: 'Due in 4h', context: 'Ready to sign the contract.' },

  // Overdue (2)
  { id: 'q4', bucket: 'overdue', name: 'Carlos Rivera', initials: 'CR', avatarColor: '#EF4444', phone: '(617) 555-0334', promiseTime: 'Yesterday 3:00 PM', dueLabel: 'Overdue 23h', context: 'Bathroom remodel quote follow-up.' },
  { id: 'q5', bucket: 'overdue', name: 'Margaret Wu', initials: 'MW', avatarColor: '#F97316', phone: '(617) 555-0744', promiseTime: 'Yesterday 11:00 AM', dueLabel: 'Overdue 1d 3h', context: 'Scheduling for next month kitchen project.' },

  // Scheduled (4)
  { id: 'q6', bucket: 'scheduled', name: 'Greg Patel', initials: 'GP', avatarColor: '#0EA5E9', phone: '(617) 555-0671', promiseTime: 'Tomorrow 9:00 AM', dueLabel: 'Tomorrow 9:00 AM', context: 'Site visit confirmation.' },
  { id: 'q7', bucket: 'scheduled', name: 'Linda Park', initials: 'LP', avatarColor: '#10B981', phone: '(617) 555-0517', promiseTime: 'Thu 2:00 PM', dueLabel: 'Thu 2:00 PM', context: 'Window replacement quote review.' },
  { id: 'q8', bucket: 'scheduled', name: 'Roy Atkins', initials: 'RA', avatarColor: '#A855F7', phone: '(617) 555-0388', promiseTime: 'Fri 10:00 AM', dueLabel: 'Fri 10:00 AM', context: 'Roof inspection report walk-through.' },
  { id: 'q9', bucket: 'scheduled', name: 'Tara Singh', initials: 'TS', avatarColor: '#EC4899', phone: '(617) 555-0203', promiseTime: 'Mon 11:00 AM', dueLabel: 'Mon 11:00 AM', context: 'Basement finish kickoff discussion.' },
];

const BUCKET_ORDER: Bucket[] = ['due_today', 'overdue', 'scheduled'];

type Mode = { kind: 'list' } | { kind: 'detail'; id: string };

export function CallbackQueueWorkspace({ onBackToMenu }: { onBackToMenu?: () => void }) {
  const [mode, setMode] = useState<Mode>({ kind: 'list' });
  useEffect(() => {
    ensureInvisibleScrollCss();
  }, []);

  if (Platform.OS !== 'web') return <View style={styles.fill} />;

  if (mode.kind === 'list') {
    return <QueueList onBackToMenu={onBackToMenu} onPick={(id) => setMode({ kind: 'detail', id })} />;
  }
  const item = MOCK.find((c) => c.id === mode.id);
  if (!item) return <QueueList onBackToMenu={onBackToMenu} onPick={(id) => setMode({ kind: 'detail', id })} />;
  return <QueueDetail item={item} onBack={() => setMode({ kind: 'list' })} />;
}

function QueueList({ onBackToMenu, onPick }: { onBackToMenu?: () => void; onPick: (id: string) => void }) {
  const [open, setOpen] = useState<Record<Bucket, boolean>>({
    due_today: true,
    overdue: true,
    scheduled: true,
  });

  return (
    <div style={t.listWrap}>
      <ListHeader icon="time-outline" title="Callback Queue" onBackToMenu={onBackToMenu} />
      <div className="aspire-invisible-scroll" style={t.listScroll}>
        {BUCKET_ORDER.map((b) => {
          const items = MOCK.filter((m) => m.bucket === b);
          const color = BUCKET_COLOR[b];
          const isOpen = open[b];
          return (
            <div key={b} style={{ marginBottom: 6 }}>
              <button
                onClick={() => setOpen((o) => ({ ...o, [b]: !o[b] }))}
                style={bucketHeader}
                onMouseEnter={(e) => ((e.currentTarget as HTMLElement).style.background = 'rgba(255,255,255,0.04)')}
                onMouseLeave={(e) => ((e.currentTarget as HTMLElement).style.background = 'transparent')}
              >
                <div
                  style={{
                    width: 6,
                    height: 6,
                    borderRadius: 3,
                    background: color,
                    boxShadow: `0 0 8px ${color}80`,
                    flexShrink: 0,
                  }}
                />
                <span style={bucketTitle}>{BUCKET_LABEL[b]}</span>
                <span style={bucketCount}>{items.length}</span>
                <div style={{ flex: 1 }} />
                <div style={{ transform: isOpen ? 'rotate(90deg)' : 'rotate(0deg)', transition: 'transform 0.15s ease' }}>
                  <Ionicons name="chevron-forward" size={14} color="rgba(255,255,255,0.55)" />
                </div>
              </button>

              {isOpen
                ? items.map((c) => (
                    <button
                      key={c.id}
                      onClick={() => onPick(c.id)}
                      style={t.rowBtn}
                      onMouseEnter={(e) => ((e.currentTarget as HTMLElement).style.background = 'rgba(255,255,255,0.04)')}
                      onMouseLeave={(e) => ((e.currentTarget as HTMLElement).style.background = 'transparent')}
                    >
                      <Avatar initials={c.initials} color={c.avatarColor} />
                      <div style={t.rowText}>
                        <div style={t.rowTopLine}>
                          <span style={t.rowName}>{c.name}</span>
                          <span
                            style={{
                              ...t.entityPill,
                              color,
                              background: `${color}1A`,
                              border: `1px solid ${color}44`,
                              fontSize: 10,
                            }}
                          >
                            {c.dueLabel}
                          </span>
                        </div>
                        <div style={t.rowMidLine}>
                          <span style={t.rowPreview}>Callback promised at {c.promiseTime}</span>
                        </div>
                      </div>
                    </button>
                  ))
                : null}
            </div>
          );
        })}
      </div>
    </div>
  );
}

function QueueDetail({ item, onBack }: { item: Callback; onBack: () => void }) {
  const color = BUCKET_COLOR[item.bucket];
  return (
    <div style={t.detailWrap}>
      <DetailHeader onBack={onBack} initials={item.initials} avatarColor={item.avatarColor} name={item.name} phone={item.phone} />
      <div className="aspire-invisible-scroll" style={t.detailScroll}>
        <div style={t.detailCallerCard}>
          <div
            style={{
              alignSelf: 'flex-start',
              display: 'inline-flex',
              alignItems: 'center',
              gap: 6,
              paddingTop: 4,
              paddingBottom: 4,
              paddingLeft: 8,
              paddingRight: 10,
              borderRadius: 999,
              background: `${color}1F`,
              color,
              border: `1px solid ${color}44`,
              fontFamily: 'Inter, system-ui, sans-serif',
              fontSize: 11,
              fontWeight: 600,
              letterSpacing: 0.2,
            }}
          >
            <Ionicons name="time-outline" size={12} color={color} />
            <span>{item.dueLabel}</span>
          </div>
          <div style={{ ...t.bodyText, marginTop: 8 }}>Callback promised at {item.promiseTime}</div>
        </div>

        <div style={t.detailSection}>
          <div style={t.sectionLabel}>Context</div>
          <div style={t.bodyText}>{item.context}</div>
        </div>

        <div style={t.actionRow}>
          <ActionButton icon="call-outline" label="Call now" tint="#22C55E" />
          <ActionButton icon="calendar-outline" label="Reschedule" tint="#F59E0B" />
          <ActionButton icon="checkmark-done-outline" label="Mark complete" tint="#3B82F6" />
        </div>
      </div>
    </div>
  );
}

const styles = StyleSheet.create({ fill: { flex: 1 } });

const bucketHeader: React.CSSProperties = {
  boxSizing: 'border-box',
  width: '100%',
  display: 'flex',
  alignItems: 'center',
  gap: 8,
  paddingTop: 8,
  paddingBottom: 8,
  paddingLeft: 8,
  paddingRight: 8,
  borderRadius: 8,
  background: 'transparent',
  border: 'none',
  outline: 'none',
  cursor: 'pointer',
  textAlign: 'left',
  transition: 'background 0.12s ease',
};
const bucketTitle: React.CSSProperties = {
  fontFamily: 'Inter, system-ui, sans-serif',
  fontSize: 12,
  fontWeight: 600,
  color: 'rgba(255,255,255,0.85)',
  letterSpacing: 0.2,
  textTransform: 'uppercase',
};
const bucketCount: React.CSSProperties = {
  fontFamily: 'Inter, system-ui, sans-serif',
  fontSize: 11,
  color: 'rgba(255,255,255,0.45)',
  background: 'rgba(255,255,255,0.06)',
  borderRadius: 999,
  paddingTop: 1,
  paddingBottom: 1,
  paddingLeft: 6,
  paddingRight: 6,
};
