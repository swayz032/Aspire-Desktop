/**
 * CalendarWidget — Premium month-view calendar for the homepage right column.
 *
 * Design: Aspire 2-tone gray via Card variant="elevated" (matches TodayPlanTabs).
 * Only calendar grid + "Open Calendar" button. No event list.
 * Nav arrows are Aspire blue. Today circle is Aspire blue.
 * Fills available height via flex:1 so bottom aligns with Today's Plan.
 */
import React, { useEffect, useState, useCallback, useMemo } from 'react';
import { View, Text, Pressable, StyleSheet, Platform } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { supabase } from '@/lib/supabase';
import { useSupabase } from '@/providers';
import { playClickSound } from '@/lib/sounds';
import { PageErrorBoundary } from '@/components/PageErrorBoundary';
import { Card } from '@/components/ui/Card';
import { Colors } from '@/constants/tokens';

interface CalendarEvent {
  id: string;
  title: string;
  start_time: string;
  end_time: string;
}

interface CalendarWidgetProps {
  suiteId: string;
  officeId: string;
}

const WEEK_DAYS = ['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'];
const MONTH_NAMES = ['January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December'];
const EVENT_COLORS = ['#3B82F6', '#8B5CF6', '#F59E0B', '#EF4444', '#0EA5E9', '#10B981'];

function colorFromId(id: string): string {
  const hash = id.split('').reduce((a, c) => a + c.charCodeAt(0), 0);
  return EVENT_COLORS[hash % EVENT_COLORS.length];
}

function sameDay(a: Date, b: Date): boolean {
  return a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate();
}

function getDaysInMonth(year: number, month: number): Date[] {
  const days: Date[] = [];
  const first = new Date(year, month, 1);
  const startDay = first.getDay();
  for (let i = 0; i < startDay; i++) {
    days.push(new Date(year, month, -startDay + i + 1));
  }
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  for (let i = 1; i <= daysInMonth; i++) {
    days.push(new Date(year, month, i));
  }
  while (days.length % 7 !== 0) {
    days.push(new Date(year, month + 1, days.length - startDay - daysInMonth + 1));
  }
  return days;
}

function CalendarWidgetInner({ suiteId: propSuiteId }: CalendarWidgetProps) {
  const router = useRouter();
  const { suiteId: authSuiteId } = useSupabase();
  const suiteId = propSuiteId || authSuiteId || '';
  const today = useMemo(() => new Date(), []);
  const [currentMonth, setCurrentMonth] = useState(new Date(today.getFullYear(), today.getMonth(), 1));
  const [events, setEvents] = useState<CalendarEvent[]>([]);
  const [selectedDate, setSelectedDate] = useState<Date>(today);

  const fetchEvents = useCallback(async () => {
    if (!suiteId) return;
    try {
      const start = new Date(currentMonth.getFullYear(), currentMonth.getMonth(), 1).toISOString();
      const end = new Date(currentMonth.getFullYear(), currentMonth.getMonth() + 1, 0, 23, 59, 59).toISOString();
      const { data, error } = await supabase
        .from('calendar_events')
        .select('id, title, start_time, end_time')
        .eq('suite_id', suiteId)
        .gte('start_time', start)
        .lte('start_time', end)
        .order('start_time', { ascending: true });
      if (!error) setEvents(data ?? []);
    } catch (_e) { /* calendar not available */ }
  }, [suiteId, currentMonth]);

  useEffect(() => {
    if (!suiteId) return;
    const channel = supabase
      .channel(`calendar-widget-${suiteId.slice(0, 8)}-${Date.now()}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'calendar_events', filter: `suite_id=eq.${suiteId}` }, () => { fetchEvents(); })
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [suiteId, fetchEvents]);

  useEffect(() => { fetchEvents(); }, [fetchEvents]);

  const days = useMemo(() => getDaysInMonth(currentMonth.getFullYear(), currentMonth.getMonth()), [currentMonth]);
  const eventsOnDay = useCallback((day: Date) => events.filter(e => sameDay(new Date(e.start_time), day)), [events]);
  const isCurrentMonth = (day: Date) => day.getMonth() === currentMonth.getMonth();

  return (
    <Card variant="elevated" padding="none" style={s.root}>
      {/* Month nav — Aspire blue arrows */}
      <View style={s.navRow}>
        <Pressable
          style={({ pressed }) => [s.navBtn, pressed && s.navBtnPressed]}
          onPress={() => setCurrentMonth(d => new Date(d.getFullYear(), d.getMonth() - 1, 1))}
        >
          <Ionicons name="chevron-back" size={18} color="#3B82F6" />
        </Pressable>
        <Text style={s.monthLabel}>
          {MONTH_NAMES[currentMonth.getMonth()]} {currentMonth.getFullYear()}
        </Text>
        <Pressable
          style={({ pressed }) => [s.navBtn, pressed && s.navBtnPressed]}
          onPress={() => setCurrentMonth(d => new Date(d.getFullYear(), d.getMonth() + 1, 1))}
        >
          <Ionicons name="chevron-forward" size={18} color="#3B82F6" />
        </Pressable>
      </View>

      {/* Day headers */}
      <View style={s.weekRow}>
        {WEEK_DAYS.map(d => (
          <Text key={d} style={s.weekDay}>{d}</Text>
        ))}
      </View>

      {/* Grid */}
      <View style={s.grid}>
        {days.map((day, idx) => {
          const dayEvents = eventsOnDay(day);
          const isToday = sameDay(day, today);
          const isSelected = sameDay(day, selectedDate);
          const inMonth = isCurrentMonth(day);
          return (
            <Pressable
              key={idx}
              style={s.dayCell}
              onPress={() => { playClickSound(); setSelectedDate(day); }}
            >
              <View style={[
                s.dayInner,
                isToday && s.dayToday,
                isSelected && !isToday && s.daySelected,
              ]}>
                <Text style={[
                  s.dayNum,
                  !inMonth && s.dayNumOther,
                  isToday && s.dayNumToday,
                  isSelected && !isToday && s.dayNumSelected,
                ]}>
                  {day.getDate()}
                </Text>
              </View>
              {dayEvents.length > 0 && (
                <View style={s.dotRow}>
                  {dayEvents.slice(0, 3).map(e => (
                    <View key={e.id} style={[s.eventDot, { backgroundColor: colorFromId(e.id) }]} />
                  ))}
                </View>
              )}
            </Pressable>
          );
        })}
      </View>

      {/* Spacer pushes button to bottom */}
      <View style={s.spacer} />

      {/* Open Calendar button */}
      <Pressable
        style={({ pressed }) => [s.openButton, pressed && { opacity: 0.8 }]}
        onPress={() => { playClickSound(); router.push('/calendar' as any); }}
      >
        <View style={s.openButtonInner}>
          <Text style={s.openButtonText}>Open Calendar</Text>
          <View style={s.openButtonIcon}>
            <Ionicons name="arrow-forward" size={14} color="rgba(255,255,255,0.7)" />
          </View>
        </View>
      </Pressable>
    </Card>
  );
}

const s = StyleSheet.create({
  root: {
    flex: 1,
    display: 'flex',
    flexDirection: 'column',
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: Colors.surface.cardBorder,  // #2C2C2E — visible lighter border (2-tone)
  },

  // ── Month nav ─────────────────────────────────────────────────────
  navRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingTop: 16,
    paddingBottom: 10,
  },
  navBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: 'rgba(59, 130, 246, 0.08)',
    borderWidth: 1,
    borderColor: 'rgba(59, 130, 246, 0.15)',
    justifyContent: 'center',
    alignItems: 'center',
    ...(Platform.OS === 'web' ? ({ cursor: 'pointer' } as any) : {}),
  },
  navBtnPressed: {
    backgroundColor: 'rgba(59, 130, 246, 0.15)',
  },
  monthLabel: {
    fontSize: 16,
    fontWeight: '700',
    color: '#FFFFFF',
    letterSpacing: -0.3,
  } as any,

  // ── Week day headers ──────────────────────────────────────────────
  weekRow: {
    flexDirection: 'row',
    paddingHorizontal: 10,
    paddingBottom: 6,
  },
  weekDay: {
    flex: 1,
    textAlign: 'center',
    fontSize: 10,
    fontWeight: '700',
    color: 'rgba(255,255,255,0.35)',
    letterSpacing: 0.8,
    textTransform: 'uppercase',
  } as any,

  // ── Day grid ──────────────────────────────────────────────────────
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    paddingHorizontal: 10,
  },
  dayCell: {
    width: `${100 / 7}%` as any,
    alignItems: 'center',
    paddingVertical: 4,
    ...(Platform.OS === 'web' ? ({ cursor: 'pointer' } as any) : {}),
  },
  dayInner: {
    width: 32,
    height: 32,
    borderRadius: 16,
    justifyContent: 'center',
    alignItems: 'center',
  },
  dayToday: {
    backgroundColor: '#3B82F6',
  },
  daySelected: {
    borderWidth: 1.5,
    borderColor: 'rgba(59, 130, 246, 0.5)',
    backgroundColor: 'rgba(59, 130, 246, 0.08)',
  },
  dayNum: {
    fontSize: 13,
    color: 'rgba(255,255,255,0.7)',
    fontWeight: '500',
  } as any,
  dayNumOther: {
    color: 'rgba(255,255,255,0.18)',
  },
  dayNumToday: {
    color: '#FFF',
    fontWeight: '700',
  } as any,
  dayNumSelected: {
    color: '#3B82F6',
    fontWeight: '700',
  } as any,
  dotRow: {
    flexDirection: 'row',
    gap: 2,
    marginTop: 2,
    height: 5,
  },
  eventDot: {
    width: 4,
    height: 4,
    borderRadius: 2,
  },

  // ── Spacer + Button ───────────────────────────────────────────────
  spacer: {
    flex: 1,
    minHeight: 12,
  },
  openButton: {
    marginHorizontal: 16,
    marginBottom: 16,
    borderRadius: 12,
    overflow: 'hidden',
    backgroundColor: 'rgba(59, 130, 246, 0.1)',
    borderWidth: 1,
    borderColor: 'rgba(59, 130, 246, 0.2)',
    ...(Platform.OS === 'web' ? { cursor: 'pointer' } as any : {}),
  },
  openButtonInner: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    paddingHorizontal: 20,
    gap: 8,
  },
  openButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: 'rgba(255, 255, 255, 0.85)',
    letterSpacing: 0.2,
  } as any,
  openButtonIcon: {
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: 'rgba(59, 130, 246, 0.2)',
    alignItems: 'center',
    justifyContent: 'center',
  },
});

export function CalendarWidget(props: any) {
  return (
    <PageErrorBoundary pageName="calendar-widget">
      <CalendarWidgetInner {...props} />
    </PageErrorBoundary>
  );
}
