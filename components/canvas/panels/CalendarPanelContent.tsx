import React, { useState, useEffect, useCallback, useMemo, memo } from 'react';
import { View, Text, Pressable, StyleSheet, ScrollView, Platform } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useAuthFetch } from '@/lib/authenticatedFetch';
import type { PanelContentProps } from './types';

const BLUE    = '#0ea5e9';
const SURFACE = 'rgba(6,6,10,0.98)';
const GLASS   = 'rgba(255,255,255,0.06)';
const BORDER  = 'rgba(255,255,255,0.11)';
const TP      = '#FFFFFF';
const TS      = 'rgba(255,255,255,0.45)';
const TT      = 'rgba(255,255,255,0.25)';
const C_GREEN = '#22c55e';

const GLASS_WEB: any = Platform.OS === 'web'
  ? { backdropFilter: 'blur(20px)', boxShadow: '0 4px 24px rgba(0,0,0,0.3)' }
  : {};

const MONTH_NAMES = ['January','February','March','April','May','June','July','August','September','October','November','December'];
const DAY_NAMES   = ['Su','Mo','Tu','We','Th','Fr','Sa'];

interface CalEvent {
  id: string;
  title?: string;
  start_time?: string;
  end_time?: string;
  description?: string;
  calendar_type?: string;
}

function fmtTime(iso: string): string {
  try {
    return new Date(iso).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true });
  } catch { return iso; }
}

function isoDateStr(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
}

interface AgendaRowProps { event: CalEvent; onPress: (e: CalEvent) => void }
const AgendaRow = memo(function AgendaRow({ event, onPress }: AgendaRowProps) {
  return (
    <Pressable onPress={() => onPress(event)} style={s.agendaCard}>
      <View style={s.timeBlock}>
        {event.start_time ? <Text style={s.timeText}>{fmtTime(event.start_time)}</Text> : null}
      </View>
      <View style={s.agendaBarLine} />
      <View style={s.agendaBody}>
        <Text style={s.agendaTitle} numberOfLines={2}>{event.title || 'Event'}</Text>
        {event.description ? <Text style={s.agendaDesc} numberOfLines={1}>{event.description}</Text> : null}
      </View>
      {event.calendar_type ? (
        <View style={s.agendaType}>
          <Text style={s.agendaTypeText}>{event.calendar_type}</Text>
        </View>
      ) : null}
    </Pressable>
  );
});

export default function CalendarPanelContent(_props: PanelContentProps) {
  const { authenticatedFetch } = useAuthFetch();
  const today                   = useMemo(() => new Date(), []);
  const [viewDate, setViewDate] = useState(new Date(today.getFullYear(), today.getMonth(), 1));
  const [selected, setSelected] = useState(today);
  const [events, setEvents]     = useState<CalEvent[]>([]);
  const [loading, setLoading]   = useState(true);

  const year  = viewDate.getFullYear();
  const month = viewDate.getMonth();

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const start = new Date(year, month, 1).toISOString();
      const end   = new Date(year, month + 1, 0).toISOString();
      const res   = await authenticatedFetch(`/api/calendar/events?start=${start}&end=${end}`);
      const d     = await res.json();
      setEvents(d.events || d || []);
    } catch { /* ignore */ } finally {
      setLoading(false);
    }
  }, [authenticatedFetch, year, month]);

  useEffect(() => { load(); }, [load]);

  const prevMonth = useCallback(() => setViewDate(d => new Date(d.getFullYear(), d.getMonth() - 1, 1)), []);
  const nextMonth = useCallback(() => setViewDate(d => new Date(d.getFullYear(), d.getMonth() + 1, 1)), []);

  const calDays = useMemo(() => {
    const firstDow = new Date(year, month, 1).getDay();
    const daysIn   = new Date(year, month + 1, 0).getDate();
    const cells: (number | null)[] = [];
    for (let i = 0; i < firstDow; i++) cells.push(null);
    for (let d = 1; d <= daysIn; d++) cells.push(d);
    while (cells.length % 7 !== 0) cells.push(null);
    return cells;
  }, [year, month]);

  const eventDays = useMemo(() => {
    const days = new Set<number>();
    events.forEach(e => {
      if (!e.start_time) return;
      const d = new Date(e.start_time);
      if (d.getFullYear() === year && d.getMonth() === month) days.add(d.getDate());
    });
    return days;
  }, [events, year, month]);

  const selectedEvents = useMemo(() => {
    const selStr = isoDateStr(selected);
    return events.filter(e => {
      if (!e.start_time) return false;
      return isoDateStr(new Date(e.start_time)) === selStr;
    });
  }, [events, selected]);

  const todayStr = isoDateStr(today);
  const selStr   = isoDateStr(selected);

  return (
    <View style={s.root}>
      <View style={s.heroZone}>
        <View style={s.orbBehind} pointerEvents="none" />
        <View style={s.monthNav}>
          <Pressable onPress={prevMonth} style={s.navBtn}>
            <Ionicons name="chevron-back" size={20} color={TS} />
          </Pressable>
          <View style={s.monthTitle}>
            <Text style={s.monthName}>{MONTH_NAMES[month]}</Text>
            <Text style={s.monthYear}>{year}</Text>
          </View>
          <Pressable onPress={nextMonth} style={s.navBtn}>
            <Ionicons name="chevron-forward" size={20} color={TS} />
          </Pressable>
        </View>

        <View style={s.dayRow}>
          {DAY_NAMES.map(d => (
            <Text key={d} style={s.dayName}>{d}</Text>
          ))}
        </View>

        <View style={s.grid}>
          {calDays.map((day, idx) => {
            if (day === null) return <View key={idx} style={s.gridCell} />;
            const thisDate = new Date(year, month, day);
            const dateStr  = isoDateStr(thisDate);
            const isToday  = dateStr === todayStr;
            const isSel    = dateStr === selStr;
            const hasEvent = eventDays.has(day);
            return (
              <Pressable
                key={idx}
                onPress={() => setSelected(thisDate)}
                style={s.gridCell}
              >
                <View style={[
                  s.dayCircle,
                  isToday && s.dayCircleToday,
                  isSel && !isToday && s.dayCircleSelected,
                ]}>
                  <Text style={[
                    s.dayNum,
                    isToday && s.dayNumToday,
                    isSel && !isToday && s.dayNumSelected,
                  ]}>{day}</Text>
                </View>
                {hasEvent && <View style={[s.eventDot, isToday && { backgroundColor: '#FFF' }]} />}
              </Pressable>
            );
          })}
        </View>
      </View>

      <View style={s.agendaHeader}>
        <Text style={s.sectionLabel}>
          {selStr === todayStr ? "TODAY'S AGENDA" : selected.toLocaleDateString('en-US', { weekday:'short', month:'short', day:'numeric' }).toUpperCase()}
        </Text>
        {loading && <Ionicons name="refresh" size={14} color={TT} />}
      </View>

      <ScrollView style={s.list} showsVerticalScrollIndicator={false}>
        {!loading && selectedEvents.length === 0 && (
          <View style={s.emptyState}>
            <Ionicons name="calendar-outline" size={36} color={TT} />
            <Text style={s.emptyStateSub}>No events this day</Text>
          </View>
        )}
        {selectedEvents.map(ev => (
          <AgendaRow key={ev.id} event={ev} onPress={() => {}} />
        ))}
        <View style={s.bottomSpacer} />
      </ScrollView>
    </View>
  );
}

const s = StyleSheet.create({
  root:             { flex: 1, backgroundColor: SURFACE },
  heroZone:         { paddingTop: 16, paddingBottom: 12, paddingHorizontal: 12, position: 'relative', overflow: 'hidden' },
  orbBehind:        {
    position: 'absolute', top: -60, right: -60, width: 220, height: 220,
    borderRadius: 110, backgroundColor: 'rgba(14,165,233,0.10)',
    ...(Platform.OS === 'web' ? { filter: 'blur(60px)' } as any : {}),
  },
  monthNav:         { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 },
  navBtn:           { width: 36, height: 36, borderRadius: 18, backgroundColor: GLASS, borderWidth: 1, borderColor: BORDER, alignItems: 'center', justifyContent: 'center' },
  monthTitle:       { flexDirection: 'row', alignItems: 'baseline', gap: 8 },
  monthName:        { fontSize: 22, fontWeight: '800', color: TP },
  monthYear:        { fontSize: 16, fontWeight: '400', color: TS },
  dayRow:           { flexDirection: 'row', marginBottom: 4 },
  dayName:          { flex: 1, textAlign: 'center', fontSize: 11, color: TT, letterSpacing: 0.5, fontWeight: '600' },
  grid:             { flexDirection: 'row', flexWrap: 'wrap' },
  gridCell:         { width: `${100 / 7}%`, alignItems: 'center', paddingVertical: 4 },
  dayCircle:        { width: 34, height: 34, borderRadius: 17, alignItems: 'center', justifyContent: 'center' },
  dayCircleToday:   { backgroundColor: BLUE },
  dayCircleSelected:{ backgroundColor: '#FFF' },
  dayNum:           { fontSize: 14, fontWeight: '500', color: TS },
  dayNumToday:      { color: '#FFF', fontWeight: '800' },
  dayNumSelected:   { color: '#000', fontWeight: '700' },
  eventDot:         { width: 5, height: 5, borderRadius: 2.5, backgroundColor: BLUE, marginTop: 2 },
  agendaHeader:     { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingRight: 16 },
  sectionLabel:     { fontSize: 11, letterSpacing: 1.5, textTransform: 'uppercase', color: TT, paddingHorizontal: 16, paddingTop: 12, paddingBottom: 8 },
  list:             { flex: 1 },
  emptyState:       { alignItems: 'center', paddingTop: 32, gap: 8 },
  emptyStateSub:    { fontSize: 13, color: TT },
  agendaCard:       { marginHorizontal: 16, marginBottom: 8, backgroundColor: GLASS, borderRadius: 14, borderWidth: 1, borderColor: BORDER, padding: 14, flexDirection: 'row', alignItems: 'center', gap: 12, ...GLASS_WEB },
  timeBlock:        { width: 54, flexShrink: 0 },
  timeText:         { fontSize: 12, fontWeight: '600', color: BLUE, textAlign: 'center' },
  agendaBarLine:    { width: 2, height: '100%', backgroundColor: BLUE, borderRadius: 1, flexShrink: 0 },
  agendaBody:       { flex: 1 },
  agendaTitle:      { fontSize: 14, fontWeight: '700', color: TP },
  agendaDesc:       { fontSize: 12, color: TS, marginTop: 3 },
  agendaType:       { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 6, backgroundColor: 'rgba(14,165,233,0.15)', borderWidth: 1, borderColor: 'rgba(14,165,233,0.4)', flexShrink: 0 },
  agendaTypeText:   { fontSize: 10, color: BLUE, fontWeight: '600' },
  bottomSpacer:     { height: 32 },
});
