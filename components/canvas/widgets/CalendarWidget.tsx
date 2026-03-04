import React, { useEffect, useState, useCallback, useMemo } from 'react';
import { View, Text, Pressable, ScrollView, StyleSheet, Platform } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { supabase } from '@/lib/supabase';
import { playClickSound } from '@/lib/sounds';

interface CalendarEvent {
  id: string;
  title: string;
  start_time: string;
  end_time: string;
  agent_id?: string;
  location?: string | null;
}

interface CalendarWidgetProps {
  suiteId: string;
  officeId: string;
  date?: Date;
  onEventClick?: (eventId: string) => void;
  onAddEventClick?: () => void;
}

const WEEK_DAYS = ['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'];

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

function formatTime(iso: string): string {
  const d = new Date(iso);
  const h = d.getHours();
  const m = d.getMinutes();
  const ampm = h >= 12 ? 'pm' : 'am';
  return `${h % 12 || 12}${m > 0 ? `:${String(m).padStart(2, '0')}` : ''}${ampm}`;
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

const MONTH_NAMES = ['January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December'];

const DEMO_EVENTS: CalendarEvent[] = [
  { id: '1', title: 'Board Meeting', start_time: new Date().toISOString(), end_time: new Date(Date.now() + 3600000).toISOString() },
  { id: '2', title: 'Product Review', start_time: new Date(Date.now() + 86400000).toISOString(), end_time: new Date(Date.now() + 90000000).toISOString() },
  { id: '3', title: 'Investor Call', start_time: new Date(Date.now() + 2 * 86400000).toISOString(), end_time: new Date(Date.now() + 2 * 86400000 + 3600000).toISOString() },
];

export function CalendarWidget({ suiteId, officeId }: CalendarWidgetProps) {
  const today = useMemo(() => new Date(), []);
  const [currentMonth, setCurrentMonth] = useState(new Date(today.getFullYear(), today.getMonth(), 1));
  const [events, setEvents] = useState<CalendarEvent[]>([]);
  const [selectedDate, setSelectedDate] = useState<Date>(today);
  const [loading, setLoading] = useState(true);

  const fetchEvents = useCallback(async () => {
    try {
      setLoading(true);
      const start = new Date(currentMonth.getFullYear(), currentMonth.getMonth(), 1).toISOString();
      const end = new Date(currentMonth.getFullYear(), currentMonth.getMonth() + 1, 0, 23, 59, 59).toISOString();
      const { data, error } = await supabase
        .from('calendar_events')
        .select('*')
        .eq('suite_id', suiteId)
        .eq('office_id', officeId)
        .gte('start_time', start)
        .lte('start_time', end);
      if (error) throw error;
      setEvents(data && data.length > 0 ? data : DEMO_EVENTS);
    } catch {
      setEvents(DEMO_EVENTS);
    } finally {
      setLoading(false);
    }
  }, [suiteId, officeId, currentMonth]);

  useEffect(() => { fetchEvents(); }, [fetchEvents]);

  const days = useMemo(() =>
    getDaysInMonth(currentMonth.getFullYear(), currentMonth.getMonth()),
    [currentMonth]
  );

  const eventsOnDay = useCallback((day: Date) =>
    events.filter(e => sameDay(new Date(e.start_time), day)),
    [events]
  );

  const selectedEvents = useMemo(() =>
    events.filter(e => sameDay(new Date(e.start_time), selectedDate)),
    [events, selectedDate]
  );

  const prevMonth = () => {
    setCurrentMonth(d => new Date(d.getFullYear(), d.getMonth() - 1, 1));
  };

  const nextMonth = () => {
    setCurrentMonth(d => new Date(d.getFullYear(), d.getMonth() + 1, 1));
  };

  const isCurrentMonth = (day: Date) =>
    day.getMonth() === currentMonth.getMonth();

  return (
    <View style={s.root}>
      {/* Month nav */}
      <View style={s.navRow}>
        <Pressable 
          style={({ pressed }) => [s.navBtn, pressed && { backgroundColor: 'rgba(255,255,255,0.1)' }]} 
          onPress={prevMonth}
        >
          <Ionicons name="chevron-back" size={20} color="rgba(255,255,255,0.6)" />
        </Pressable>
        <Text style={s.monthLabel}>
          {MONTH_NAMES[currentMonth.getMonth()]} {currentMonth.getFullYear()}
        </Text>
        <Pressable 
          style={({ pressed }) => [s.navBtn, pressed && { backgroundColor: 'rgba(255,255,255,0.1)' }]} 
          onPress={nextMonth}
        >
          <Ionicons name="chevron-forward" size={20} color="rgba(255,255,255,0.6)" />
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
                    <View
                      key={e.id}
                      style={[s.eventDot, { backgroundColor: colorFromId(e.id) }]}
                    />
                  ))}
                </View>
              )}
            </Pressable>
          );
        })}
      </View>

      {/* Divider */}
      <View style={s.divider} />

      {/* Selected day events */}
      <ScrollView style={s.eventList} showsVerticalScrollIndicator={false}>
        <Text style={s.eventListTitle}>
          {sameDay(selectedDate, today) ? "Today's Events" : selectedDate.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })}
        </Text>
        {selectedEvents.length === 0 ? (
          <View style={s.noEventsContainer}>
            <View style={s.noEvents}>
              <Text style={s.noEventsText}>No events</Text>
            </View>
          </View>
        ) : (
          selectedEvents.map(event => {
            const color = colorFromId(event.id);
            return (
              <View key={event.id} style={s.eventCard}>
                <View style={[s.eventBar, { backgroundColor: color }]} />
                <View style={s.eventInfo}>
                  <Text style={s.eventTitle} numberOfLines={1}>{event.title}</Text>
                  <View style={s.eventTimeRow}>
                    <Ionicons name="time-outline" size={11} color="rgba(255,255,255,0.35)" style={{ marginRight: 4 }} />
                    <Text style={s.eventTime}>
                      {formatTime(event.start_time)} – {formatTime(event.end_time)}
                    </Text>
                  </View>
                  {event.location ? (
                    <Text style={s.eventLocation} numberOfLines={1}>{event.location}</Text>
                  ) : null}
                </View>
              </View>
            );
          })
        )}
      </ScrollView>
    </View>
  );
}

const s = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: 'transparent',
  },
  navRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingTop: 16,
    paddingBottom: 8,
  },
  navBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: 'rgba(255,255,255,0.06)',
    justifyContent: 'center',
    alignItems: 'center',
    ...(Platform.OS === 'web' ? ({ cursor: 'pointer' } as any) : {}),
  },
  monthLabel: {
    fontSize: 17,
    fontWeight: '700',
    color: '#FFF',
    letterSpacing: -0.3,
  } as any,
  weekRow: {
    flexDirection: 'row',
    paddingHorizontal: 8,
    paddingBottom: 4,
  },
  weekDay: {
    flex: 1,
    textAlign: 'center',
    fontSize: 10,
    fontWeight: '700',
    color: 'rgba(255,255,255,0.3)',
    letterSpacing: 0.5,
  } as any,
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    paddingHorizontal: 8,
  },
  dayCell: {
    width: `${100 / 7}%` as any,
    alignItems: 'center',
    paddingVertical: 3,
    ...(Platform.OS === 'web' ? ({ cursor: 'pointer' } as any) : {}),
  },
  dayInner: {
    width: 30,
    height: 30,
    borderRadius: 15,
    justifyContent: 'center',
    alignItems: 'center',
  },
  dayToday: {
    backgroundColor: '#3B82F6',
  },
  daySelected: {
    borderWidth: 1.5,
    borderColor: '#3B82F6',
  },
  dayNum: {
    fontSize: 13,
    color: 'rgba(255,255,255,0.75)',
    fontWeight: '500',
  } as any,
  dayNumOther: {
    color: 'rgba(255,255,255,0.2)',
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
  divider: {
    height: 1,
    backgroundColor: 'rgba(255,255,255,0.07)',
    marginTop: 8,
  },
  eventList: {
    flex: 1,
    paddingHorizontal: 16,
    paddingTop: 12,
  },
  eventListTitle: {
    fontSize: 12,
    fontWeight: '700',
    color: 'rgba(255,255,255,0.5)',
    marginBottom: 10,
    letterSpacing: 0.3,
  } as any,
  noEventsContainer: {
    borderRadius: 12,
    backgroundColor: 'rgba(255,255,255,0.02)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.06)',
    marginTop: 4,
  },
  noEvents: {
    paddingVertical: 32,
    alignItems: 'center',
  },
  noEventsText: {
    fontSize: 13,
    color: 'rgba(255,255,255,0.4)',
  },
  eventCard: {
    flexDirection: 'row',
    alignItems: 'stretch',
    backgroundColor: 'rgba(255,255,255,0.04)',
    borderRadius: 10,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.06)',
    padding: 12,
    marginBottom: 8,
    gap: 10,
  },
  eventBar: {
    width: 3,
    borderRadius: 2,
    minHeight: 36,
  },
  eventInfo: { flex: 1 },
  eventTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#FFF',
  } as any,
  eventTimeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 4,
  },
  eventTime: {
    fontSize: 12,
    color: 'rgba(255,255,255,0.4)',
  },
  eventLocation: {
    fontSize: 11,
    color: 'rgba(255,255,255,0.3)',
    marginTop: 4,
  },
});
