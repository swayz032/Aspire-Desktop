import React, { useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { supabase } from '@/lib/supabase';
import { CanvasTokens } from '@/constants/canvas.tokens';
import { Colors } from '@/constants/tokens';

interface CalendarEvent {
  id: string;
  title: string;
  start_time: string;
  end_time: string;
  agent_id: string;
  location?: string | null;
  link?: string | null;
}

interface CalendarWidgetProps {
  suiteId: string;
  officeId: string;
  date?: Date;
  onEventClick?: (eventId: string) => void;
  onAddEventClick?: () => void;
}

const WEEK_DAYS = ['MO', 'TU', 'WE', 'TH', 'FR', 'SA', 'SU'];

const AGENT_COLORS: Record<string, string> = {
  ava: '#A855F7',
  nora: '#3B82F6',
  eli: '#06B6D4',
  finn: '#10B981',
  quinn: '#6366F1',
  sarah: '#9382F6',
  clara: '#F59E0B',
  milo: '#EF4444',
};

function startOfMonth(date: Date): string {
  const d = new Date(date.getFullYear(), date.getMonth(), 1, 0, 0, 0, 0);
  return d.toISOString();
}

function endOfMonth(date: Date): string {
  const d = new Date(date.getFullYear(), date.getMonth() + 1, 0, 23, 59, 59, 999);
  return d.toISOString();
}

function formatTime(isoTime: string): string {
  const date = new Date(isoTime);
  const hours = date.getHours();
  const minutes = date.getMinutes();
  const ampm = hours >= 12 ? 'PM' : 'AM';
  const displayHours = hours % 12 || 12;
  return `${displayHours}:${minutes.toString().padStart(2, '0')} ${ampm}`;
}

function sameDay(a: Date, b: Date): boolean {
  return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
}

function mondayIndex(date: Date): number {
  return (date.getDay() + 6) % 7;
}

function dayKey(date: Date): string {
  return `${date.getFullYear()}-${date.getMonth()}-${date.getDate()}`;
}

export function CalendarWidget({
  suiteId,
  officeId,
  date = new Date(),
  onEventClick,
  onAddEventClick,
}: CalendarWidgetProps) {
  const router = useRouter();
  const [monthCursor, setMonthCursor] = useState(new Date(date.getFullYear(), date.getMonth(), 1));
  const [selectedDate, setSelectedDate] = useState(new Date(date));
  const [events, setEvents] = useState<CalendarEvent[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchEvents = async () => {
      try {
        setLoading(true);
        const { data } = await supabase
          .from('calendar_events')
          .select('id, title, start_time, end_time, agent_id, location, link')
          .eq('suite_id', suiteId)
          .eq('office_id', officeId)
          .gte('start_time', startOfMonth(monthCursor))
          .lte('start_time', endOfMonth(monthCursor))
          .order('start_time', { ascending: true });

        setEvents(data || []);
      } catch {
        const today = new Date();
        setEvents([
          { id: '1', title: 'Team Standup', start_time: new Date(today.getFullYear(), today.getMonth(), today.getDate(), 9, 0).toISOString(), end_time: new Date(today.getFullYear(), today.getMonth(), today.getDate(), 9, 15).toISOString(), agent_id: 'nora', location: 'Zoom' },
          { id: '2', title: 'Client Discovery Call', start_time: new Date(today.getFullYear(), today.getMonth(), today.getDate(), 10, 30).toISOString(), end_time: new Date(today.getFullYear(), today.getMonth(), today.getDate(), 11, 30).toISOString(), agent_id: 'ava', location: 'Google Meet' },
          { id: '3', title: 'Invoice Review', start_time: new Date(today.getFullYear(), today.getMonth(), today.getDate(), 13, 0).toISOString(), end_time: new Date(today.getFullYear(), today.getMonth(), today.getDate(), 13, 30).toISOString(), agent_id: 'finn' },
        ]);
      } finally {
        setLoading(false);
      }
    };

    fetchEvents();

    const channel = supabase
      .channel(`calendar_events:${suiteId}:${officeId}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'calendar_events', filter: `suite_id=eq.${suiteId}` },
        () => fetchEvents()
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [suiteId, officeId, monthCursor]);

  const gridDays = useMemo(() => {
    const first = new Date(monthCursor.getFullYear(), monthCursor.getMonth(), 1);
    const lead = mondayIndex(first);
    const start = new Date(first);
    start.setDate(start.getDate() - lead);

    const cells: Date[] = [];
    for (let i = 0; i < 42; i += 1) {
      const day = new Date(start);
      day.setDate(start.getDate() + i);
      cells.push(day);
    }
    return cells;
  }, [monthCursor]);

  const eventsByDay = useMemo(() => {
    const map = new Map<string, CalendarEvent[]>();
    for (const event of events) {
      const key = dayKey(new Date(event.start_time));
      const prev = map.get(key) || [];
      prev.push(event);
      map.set(key, prev);
    }
    return map;
  }, [events]);

  const selectedEvents = useMemo(() => {
    const key = dayKey(selectedDate);
    return (eventsByDay.get(key) || []).sort((a, b) => +new Date(a.start_time) - +new Date(b.start_time));
  }, [eventsByDay, selectedDate]);

  const selectedPrimary = selectedEvents[0] || null;
  const today = new Date();

  return (
    <View style={styles.container}>
      <View style={styles.monthBar}>
        <Pressable
          accessibilityLabel="Previous month"
          style={styles.arrowBtn}
          onPress={() => setMonthCursor((prev) => new Date(prev.getFullYear(), prev.getMonth() - 1, 1))}
        >
          <Ionicons name="chevron-back" size={14} color="rgba(255,255,255,0.75)" />
        </Pressable>
        <Text style={styles.monthTitle}>
          {monthCursor.toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}
        </Text>
        <Pressable
          accessibilityLabel="Next month"
          style={styles.arrowBtn}
          onPress={() => setMonthCursor((prev) => new Date(prev.getFullYear(), prev.getMonth() + 1, 1))}
        >
          <Ionicons name="chevron-forward" size={14} color="rgba(255,255,255,0.75)" />
        </Pressable>
      </View>

      <View style={styles.calendarCard}>
        <View style={styles.weekRow}>
          {WEEK_DAYS.map((day) => (
            <Text key={day} style={styles.weekLabel}>{day}</Text>
          ))}
        </View>

        {loading ? (
          <View style={styles.centerState}>
            <ActivityIndicator size="small" color={Colors.semantic.success} />
          </View>
        ) : (
          <View style={styles.grid}>
            {gridDays.map((day) => {
              const inMonth = day.getMonth() === monthCursor.getMonth();
              const isToday = sameDay(day, today);
              const isSelected = sameDay(day, selectedDate);
              const dayEvents = eventsByDay.get(dayKey(day)) || [];
              const accentColor = dayEvents[0] ? AGENT_COLORS[dayEvents[0].agent_id.toLowerCase()] || '#22C55E' : '#22C55E';

              return (
                <Pressable key={day.toISOString()} style={styles.dayCell} onPress={() => setSelectedDate(day)}>
                  <View
                    style={[
                      styles.dayCircle,
                      isSelected && styles.dayCircleSelected,
                      isToday && styles.dayCircleToday,
                      !inMonth && styles.dayCircleOut,
                    ]}
                  >
                    <Text style={[styles.dayText, !inMonth && styles.dayTextOut, (isSelected || isToday) && styles.dayTextActive]}>
                      {day.getDate()}
                    </Text>
                  </View>
                  {dayEvents.length > 0 ? (
                    <View style={styles.dotRow}>
                      {dayEvents.slice(0, 2).map((event) => (
                        <View
                          key={event.id}
                          style={[
                            styles.eventDot,
                            { backgroundColor: AGENT_COLORS[event.agent_id.toLowerCase()] || accentColor },
                          ]}
                        />
                      ))}
                    </View>
                  ) : (
                    <View style={styles.dotSpacer} />
                  )}
                </Pressable>
              );
            })}
          </View>
        )}
      </View>

      <View style={styles.detailCard}>
        <View style={styles.detailHeader}>
          <Text style={styles.detailDate}>
            {selectedDate.toLocaleDateString('en-US', { day: 'numeric', month: 'long', year: 'numeric' })}
          </Text>
          <Pressable
            accessibilityLabel="Add event"
            style={styles.addBtn}
            onPress={onAddEventClick || (() => router.push('/calendar'))}
          >
            <Ionicons name="add" size={16} color="#10B981" />
          </Pressable>
        </View>

        {selectedPrimary ? (
          <Pressable
            onPress={() => onEventClick?.(selectedPrimary.id)}
            style={styles.eventDetailRow}
          >
            <View style={[styles.eventDetailDot, { backgroundColor: AGENT_COLORS[selectedPrimary.agent_id.toLowerCase()] || '#10B981' }]} />
            <View style={styles.eventDetailBody}>
              <Text style={styles.eventDetailTitle} numberOfLines={1}>{selectedPrimary.title}</Text>
              <Text style={styles.eventDetailMeta} numberOfLines={1}>
                {formatTime(selectedPrimary.start_time)} - {formatTime(selectedPrimary.end_time)}
                {selectedPrimary.location ? `  •  ${selectedPrimary.location}` : ''}
              </Text>
            </View>
          </Pressable>
        ) : (
          <Text style={styles.emptyText}>No events scheduled for this day.</Text>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    gap: 10,
  },
  monthBar: {
    height: 40,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
    backgroundColor: 'rgba(15,18,22,0.95)',
    paddingHorizontal: 8,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  arrowBtn: {
    width: 26,
    height: 26,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255,255,255,0.04)',
    ...(Platform.OS === 'web' ? ({ cursor: 'pointer' } as any) : {}),
  },
  monthTitle: {
    color: CanvasTokens.text.primary,
    fontSize: 14,
    fontWeight: '700',
  },
  calendarCard: {
    flex: 1,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.07)',
    backgroundColor: 'rgba(15,18,22,0.9)',
    paddingHorizontal: 10,
    paddingTop: 10,
    paddingBottom: 8,
    ...(Platform.OS === 'web'
      ? ({ boxShadow: '0 10px 24px rgba(0,0,0,0.35), inset 0 1px 0 rgba(255,255,255,0.05)' } as any)
      : {}),
  },
  weekRow: {
    flexDirection: 'row',
    marginBottom: 8,
  },
  weekLabel: {
    width: `${100 / 7}%`,
    textAlign: 'center',
    color: 'rgba(255,255,255,0.7)',
    fontSize: 11,
    fontWeight: '600',
  },
  centerState: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  grid: {
    flex: 1,
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignContent: 'flex-start',
  },
  dayCell: {
    width: `${100 / 7}%`,
    alignItems: 'center',
    marginBottom: 4,
  },
  dayCircle: {
    width: 28,
    height: 28,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  dayCircleOut: {
    opacity: 0.45,
  },
  dayCircleSelected: {
    backgroundColor: 'rgba(16,185,129,0.16)',
    borderWidth: 1,
    borderColor: 'rgba(16,185,129,0.45)',
  },
  dayCircleToday: {
    backgroundColor: '#10B981',
  },
  dayText: {
    color: CanvasTokens.text.primary,
    fontSize: 16,
    fontWeight: '500',
  },
  dayTextOut: {
    color: 'rgba(255,255,255,0.38)',
  },
  dayTextActive: {
    color: '#06110D',
    fontWeight: '700',
  },
  dotRow: {
    minHeight: 8,
    marginTop: 2,
    flexDirection: 'row',
    gap: 3,
    alignItems: 'center',
    justifyContent: 'center',
  },
  eventDot: {
    width: 5,
    height: 5,
    borderRadius: 2.5,
  },
  dotSpacer: {
    minHeight: 8,
    marginTop: 2,
  },
  detailCard: {
    borderRadius: 14,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
    backgroundColor: 'rgba(15,18,22,0.92)',
    padding: 12,
    gap: 8,
  },
  detailHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  detailDate: {
    color: '#34D399',
    fontSize: 13,
    fontWeight: '700',
  },
  addBtn: {
    width: 24,
    height: 24,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: 'rgba(16,185,129,0.4)',
    backgroundColor: 'rgba(16,185,129,0.08)',
    alignItems: 'center',
    justifyContent: 'center',
    ...(Platform.OS === 'web' ? ({ cursor: 'pointer' } as any) : {}),
  },
  eventDetailRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 8,
    ...(Platform.OS === 'web' ? ({ cursor: 'pointer' } as any) : {}),
  },
  eventDetailDot: {
    width: 9,
    height: 9,
    borderRadius: 4.5,
    marginTop: 4,
  },
  eventDetailBody: {
    flex: 1,
    gap: 3,
  },
  eventDetailTitle: {
    color: CanvasTokens.text.primary,
    fontSize: 13,
    fontWeight: '600',
  },
  eventDetailMeta: {
    color: CanvasTokens.text.secondary,
    fontSize: 12,
  },
  emptyText: {
    color: CanvasTokens.text.muted,
    fontSize: 12,
  },
});
