import React, { useState, useMemo } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, useWindowDimensions } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Colors, Spacing, Typography, BorderRadius } from '@/constants/tokens';
import { PageHeader } from '@/components/PageHeader';
import { Card } from '@/components/ui/Card';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { mockCalendarEvents } from '@/data/mockData';
import { useDesktop } from '@/lib/useDesktop';
import { DesktopPageWrapper } from '@/components/desktop/DesktopPageWrapper';

type ViewMode = 'day' | 'week' | 'month';

interface CalendarEvent {
  id: string;
  date: string;
  time: string;
  title: string;
  type: 'meeting' | 'task' | 'reminder' | 'call' | 'deadline';
  duration?: string;
  location?: string;
  participants?: string[];
  isAllDay?: boolean;
}

const WEEKDAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

export default function CalendarScreen() {
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const isWideScreen = width > 768;
  const isDesktop = useDesktop();
  
  const [viewMode, setViewMode] = useState<ViewMode>('month');
  const [currentDate, setCurrentDate] = useState(new Date());
  const [selectedDate, setSelectedDate] = useState(new Date());
  
  const today = new Date();

  const eventsByDate = useMemo(() => {
    const map: Record<string, CalendarEvent[]> = {};
    (mockCalendarEvents as CalendarEvent[]).forEach(event => {
      if (!map[event.date]) map[event.date] = [];
      map[event.date].push(event);
    });
    return map;
  }, []);

  const calendarDays = useMemo(() => {
    const year = currentDate.getFullYear();
    const month = currentDate.getMonth();
    
    const firstDay = new Date(year, month, 1);
    const lastDay = new Date(year, month + 1, 0);
    const startDayOfWeek = firstDay.getDay();
    const daysInMonth = lastDay.getDate();
    
    const prevMonthLastDay = new Date(year, month, 0).getDate();
    
    const days: { date: number; month: 'prev' | 'current' | 'next'; fullDate: Date }[] = [];
    
    for (let i = startDayOfWeek - 1; i >= 0; i--) {
      const date = prevMonthLastDay - i;
      days.push({ date, month: 'prev', fullDate: new Date(year, month - 1, date) });
    }
    
    for (let i = 1; i <= daysInMonth; i++) {
      days.push({ date: i, month: 'current', fullDate: new Date(year, month, i) });
    }
    
    const remainingDays = 42 - days.length;
    for (let i = 1; i <= remainingDays; i++) {
      days.push({ date: i, month: 'next', fullDate: new Date(year, month + 1, i) });
    }
    
    return days;
  }, [currentDate]);

  const navigateMonth = (direction: 'prev' | 'next') => {
    const newDate = new Date(currentDate);
    newDate.setMonth(currentDate.getMonth() + (direction === 'next' ? 1 : -1));
    setCurrentDate(newDate);
  };

  const goToToday = () => {
    setCurrentDate(new Date());
    setSelectedDate(new Date());
  };

  const getDateKey = (date: Date) => {
    return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
  };

  const isToday = (date: Date) => {
    return date.getDate() === today.getDate() && 
           date.getMonth() === today.getMonth() && 
           date.getFullYear() === today.getFullYear();
  };

  const isSelected = (date: Date) => {
    return date.getDate() === selectedDate.getDate() && 
           date.getMonth() === selectedDate.getMonth() && 
           date.getFullYear() === selectedDate.getFullYear();
  };

  const getEventDots = (date: Date) => {
    const dateKey = getDateKey(date);
    const dayEvents = eventsByDate[dateKey] || [];
    if (dayEvents.length === 0) return [];
    return [...new Set(dayEvents.map(e => getEventColor(e.type)))].slice(0, 3);
  };

  const selectedDateKey = getDateKey(selectedDate);
  const selectedEvents = eventsByDate[selectedDateKey] || [];

  const getEventIcon = (type: string): keyof typeof Ionicons.glyphMap => {
    switch (type) {
      case 'meeting': return 'people';
      case 'task': return 'checkbox';
      case 'reminder': return 'notifications';
      case 'call': return 'call';
      case 'deadline': return 'flag';
      default: return 'calendar';
    }
  };

  const getEventColor = (type: string) => {
    switch (type) {
      case 'meeting': return Colors.accent.cyan;
      case 'task': return Colors.semantic.success;
      case 'reminder': return Colors.semantic.warning;
      case 'call': return '#af52de';
      case 'deadline': return Colors.semantic.error;
      default: return Colors.text.tertiary;
    }
  };

  const currentMonthYear = currentDate.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
  const selectedDateFormatted = selectedDate.toLocaleDateString('en-US', { 
    weekday: 'long', 
    month: 'long', 
    day: 'numeric' 
  });

  const renderMonthView = () => (
    <View style={styles.monthGrid}>
      <View style={styles.weekdayRow}>
        {WEEKDAYS.map(day => (
          <View key={day} style={styles.weekdayCell}>
            <Text style={styles.weekdayText}>{day}</Text>
          </View>
        ))}
      </View>

      <View style={styles.daysGrid}>
        {calendarDays.map((day, index) => {
          const eventDots = getEventDots(day.fullDate);
          const isTodayDate = isToday(day.fullDate);
          const isSelectedDate = isSelected(day.fullDate);
          const isCurrentMonth = day.month === 'current';

          return (
            <TouchableOpacity
              key={index}
              style={[
                styles.dayCell,
                isSelectedDate && styles.selectedDayCell,
              ]}
              onPress={() => setSelectedDate(day.fullDate)}
              activeOpacity={0.7}
            >
              <View style={[
                styles.dayNumberContainer,
                isTodayDate && styles.todayContainer,
                isSelectedDate && styles.selectedContainer,
              ]}>
                <Text style={[
                  styles.dayText,
                  !isCurrentMonth && styles.otherMonthText,
                  isTodayDate && styles.todayText,
                  isSelectedDate && styles.selectedText,
                ]}>
                  {day.date}
                </Text>
              </View>
              {eventDots.length > 0 && (
                <View style={styles.eventDotsRow}>
                  {eventDots.map((color, i) => (
                    <View key={i} style={[styles.eventDot, { backgroundColor: color }]} />
                  ))}
                </View>
              )}
            </TouchableOpacity>
          );
        })}
      </View>
    </View>
  );

  const renderWeekView = () => {
    const weekStart = new Date(selectedDate);
    weekStart.setDate(selectedDate.getDate() - selectedDate.getDay());
    
    const weekDays = [];
    for (let i = 0; i < 7; i++) {
      const date = new Date(weekStart);
      date.setDate(weekStart.getDate() + i);
      weekDays.push(date);
    }

    return (
      <View style={styles.weekView}>
        <View style={styles.weekDaysRow}>
          {weekDays.map((date, index) => {
            const dateKey = getDateKey(date);
            const dayEvents = eventsByDate[dateKey] || [];
            const isTodayDate = isToday(date);
            const isSelectedDate = isSelected(date);

            return (
              <TouchableOpacity
                key={index}
                style={[styles.weekDayItem, isSelectedDate && styles.weekDayItemSelected]}
                onPress={() => setSelectedDate(date)}
              >
                <Text style={styles.weekDayName}>{WEEKDAYS[index]}</Text>
                <View style={[
                  styles.weekDayNumber,
                  isTodayDate && styles.weekDayNumberToday,
                  isSelectedDate && styles.weekDayNumberSelected,
                ]}>
                  <Text style={[
                    styles.weekDayNumberText,
                    isTodayDate && styles.weekDayNumberTextToday,
                    isSelectedDate && styles.weekDayNumberTextSelected,
                  ]}>
                    {date.getDate()}
                  </Text>
                </View>
                <Text style={styles.weekEventCount}>
                  {dayEvents.length > 0 ? `${dayEvents.length} events` : '-'}
                </Text>
              </TouchableOpacity>
            );
          })}
        </View>
      </View>
    );
  };

  const renderDayView = () => (
    <View style={styles.dayView}>
      <Text style={styles.dayViewTitle}>{selectedDateFormatted}</Text>
      <Text style={styles.dayViewSubtitle}>
        {selectedEvents.length} event{selectedEvents.length !== 1 ? 's' : ''} scheduled
      </Text>
    </View>
  );

  const content = (
    <View style={[styles.container, { paddingTop: isDesktop ? 0 : insets.top }]}>
      {!isDesktop && <PageHeader title="Calendar" showBackButton />}
      
      <ScrollView 
        style={styles.scrollView}
        contentContainerStyle={[
          styles.scrollContent,
          isWideScreen && styles.scrollContentWide
        ]}
        showsVerticalScrollIndicator={false}
      >
        <View style={[styles.mainContent, isWideScreen && styles.mainContentWide]}>
          <View style={[styles.calendarSection, isWideScreen && styles.calendarSectionWide]}>
            <Card variant="elevated" style={styles.calendarCard}>
              <LinearGradient
                colors={['#1a2a3a', '#0d1a26']}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
                style={styles.calendarGradient}
              >
                <View style={styles.calendarHeader}>
                  <View style={styles.monthNav}>
                    <TouchableOpacity 
                      style={styles.navButton}
                      onPress={() => navigateMonth('prev')}
                    >
                      <Ionicons name="chevron-back" size={20} color={Colors.text.secondary} />
                    </TouchableOpacity>
                    <Text style={styles.monthTitle}>{currentMonthYear}</Text>
                    <TouchableOpacity 
                      style={styles.navButton}
                      onPress={() => navigateMonth('next')}
                    >
                      <Ionicons name="chevron-forward" size={20} color={Colors.text.secondary} />
                    </TouchableOpacity>
                  </View>
                  
                  <TouchableOpacity style={styles.todayButton} onPress={goToToday}>
                    <Text style={styles.todayButtonText}>Today</Text>
                  </TouchableOpacity>
                </View>

                <View style={styles.viewToggle}>
                  {(['day', 'week', 'month'] as ViewMode[]).map((mode) => (
                    <TouchableOpacity
                      key={mode}
                      style={[styles.viewToggleItem, viewMode === mode && styles.viewToggleItemActive]}
                      onPress={() => setViewMode(mode)}
                    >
                      <Text style={[styles.viewToggleText, viewMode === mode && styles.viewToggleTextActive]}>
                        {mode.charAt(0).toUpperCase() + mode.slice(1)}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>

                {viewMode === 'month' && renderMonthView()}
                {viewMode === 'week' && renderWeekView()}
                {viewMode === 'day' && renderDayView()}
              </LinearGradient>
            </Card>
          </View>

          <View style={[styles.agendaSection, isWideScreen && styles.agendaSectionWide]}>
            <View style={styles.agendaHeader}>
              <Text style={styles.agendaTitle}>{selectedDateFormatted}</Text>
              <View style={styles.eventCountBadge}>
                <Text style={styles.eventCountText}>{selectedEvents.length} events</Text>
              </View>
            </View>

            {selectedEvents.length === 0 ? (
              <Card variant="default" style={styles.emptyAgenda}>
                <Ionicons name="calendar-outline" size={32} color={Colors.text.muted} />
                <Text style={styles.emptyText}>No events scheduled</Text>
                <Text style={styles.emptySubtext}>Select a date to view events</Text>
              </Card>
            ) : (
              <Card variant="elevated" style={styles.eventsCard}>
                {selectedEvents.map((event, index) => {
                  const eventColor = getEventColor(event.type);
                  return (
                    <TouchableOpacity 
                      key={event.id} 
                      style={[styles.eventItem, index > 0 && styles.eventItemBorder]}
                    >
                      <View style={[styles.eventIndicator, { backgroundColor: eventColor }]} />
                      <View style={styles.eventContent}>
                        <View style={styles.eventHeader}>
                          <Text style={styles.eventTime}>
                            {event.isAllDay ? 'All Day' : event.time}
                          </Text>
                          {event.duration && (
                            <Text style={styles.eventDuration}>{event.duration}</Text>
                          )}
                        </View>
                        <Text style={styles.eventTitle}>{event.title}</Text>
                        {event.location && (
                          <View style={styles.eventMeta}>
                            <Ionicons name="location-outline" size={12} color={Colors.text.muted} />
                            <Text style={styles.eventMetaText}>{event.location}</Text>
                          </View>
                        )}
                        {event.participants && event.participants.length > 0 && (
                          <View style={styles.eventMeta}>
                            <Ionicons name="people-outline" size={12} color={Colors.text.muted} />
                            <Text style={styles.eventMetaText}>
                              {event.participants.slice(0, 3).join(', ')}
                              {event.participants.length > 3 && ` +${event.participants.length - 3}`}
                            </Text>
                          </View>
                        )}
                      </View>
                      <View style={[styles.eventTypeBadge, { backgroundColor: `${eventColor}20` }]}>
                        <Ionicons name={getEventIcon(event.type)} size={14} color={eventColor} />
                      </View>
                    </TouchableOpacity>
                  );
                })}
              </Card>
            )}

            <View style={styles.statsRow}>
              <View style={[styles.statItem, { borderLeftColor: Colors.accent.cyan }]}>
                <Text style={styles.statValue}>
                  {(mockCalendarEvents as CalendarEvent[]).filter(e => e.type === 'meeting').length}
                </Text>
                <Text style={styles.statLabel}>Meetings</Text>
              </View>
              <View style={[styles.statItem, { borderLeftColor: Colors.semantic.success }]}>
                <Text style={styles.statValue}>
                  {(mockCalendarEvents as CalendarEvent[]).filter(e => e.type === 'task').length}
                </Text>
                <Text style={styles.statLabel}>Tasks</Text>
              </View>
              <View style={[styles.statItem, { borderLeftColor: Colors.semantic.error }]}>
                <Text style={styles.statValue}>
                  {(mockCalendarEvents as CalendarEvent[]).filter(e => e.type === 'deadline').length}
                </Text>
                <Text style={styles.statLabel}>Deadlines</Text>
              </View>
              <View style={[styles.statItem, { borderLeftColor: '#af52de' }]}>
                <Text style={styles.statValue}>
                  {(mockCalendarEvents as CalendarEvent[]).filter(e => e.type === 'call').length}
                </Text>
                <Text style={styles.statLabel}>Calls</Text>
              </View>
            </View>

            <Card variant="elevated" style={styles.connectCard}>
              <View style={styles.connectIcon}>
                <Ionicons name="logo-google" size={24} color="#4285F4" />
              </View>
              <View style={styles.connectContent}>
                <Text style={styles.connectTitle}>Connect Google Calendar</Text>
                <Text style={styles.connectDescription}>
                  Sync your events automatically
                </Text>
              </View>
              <TouchableOpacity style={styles.connectButton}>
                <Text style={styles.connectButtonText}>Connect</Text>
              </TouchableOpacity>
            </Card>
          </View>
        </View>
      </ScrollView>
    </View>
  );

  if (isDesktop) {
    return (
      <DesktopPageWrapper scrollable={false}>
        {content}
      </DesktopPageWrapper>
    );
  }

  return content;
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background.primary,
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: Spacing.lg,
    paddingTop: 60 + Spacing.lg,
    paddingBottom: 120,
  },
  scrollContentWide: {
    paddingHorizontal: Spacing.xl * 2,
  },
  mainContent: {
    gap: Spacing.lg,
  },
  mainContentWide: {
    flexDirection: 'row',
    gap: Spacing.xl,
  },
  calendarSection: {
    flex: 1,
  },
  calendarSectionWide: {
    flex: 3,
  },
  agendaSection: {
    flex: 1,
    gap: Spacing.md,
  },
  agendaSectionWide: {
    flex: 2,
  },
  calendarCard: {
    padding: 0,
    overflow: 'hidden',
  },
  calendarGradient: {
    padding: Spacing.lg,
  },
  calendarHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: Spacing.md,
  },
  monthNav: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.md,
  },
  navButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: 'rgba(255,255,255,0.1)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  monthTitle: {
    fontSize: Typography.title.fontSize,
    fontWeight: '700',
    color: Colors.text.primary,
    minWidth: 180,
    textAlign: 'center',
  },
  todayButton: {
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    backgroundColor: Colors.accent.cyan,
    borderRadius: BorderRadius.sm,
  },
  todayButtonText: {
    fontSize: Typography.small.fontSize,
    fontWeight: '600',
    color: '#fff',
  },
  viewToggle: {
    flexDirection: 'row',
    backgroundColor: 'rgba(255,255,255,0.1)',
    borderRadius: BorderRadius.sm,
    padding: 4,
    marginBottom: Spacing.lg,
  },
  viewToggleItem: {
    flex: 1,
    paddingVertical: Spacing.sm,
    alignItems: 'center',
    borderRadius: BorderRadius.xs,
  },
  viewToggleItemActive: {
    backgroundColor: Colors.background.secondary,
  },
  viewToggleText: {
    fontSize: Typography.small.fontSize,
    fontWeight: '500',
    color: Colors.text.muted,
  },
  viewToggleTextActive: {
    color: Colors.text.primary,
  },
  monthGrid: {},
  weekdayRow: {
    flexDirection: 'row',
    marginBottom: Spacing.sm,
  },
  weekdayCell: {
    flex: 1,
    alignItems: 'center',
  },
  weekdayText: {
    fontSize: 11,
    fontWeight: '600',
    color: Colors.text.muted,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  daysGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
  },
  dayCell: {
    width: '14.28%',
    aspectRatio: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 2,
  },
  selectedDayCell: {
    backgroundColor: 'rgba(79, 172, 254, 0.1)',
    borderRadius: BorderRadius.sm,
  },
  dayNumberContainer: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  todayContainer: {
    backgroundColor: 'rgba(79, 172, 254, 0.2)',
  },
  selectedContainer: {
    backgroundColor: Colors.accent.cyan,
  },
  dayText: {
    fontSize: 14,
    fontWeight: '500',
    color: Colors.text.primary,
  },
  otherMonthText: {
    color: Colors.text.muted,
    opacity: 0.4,
  },
  todayText: {
    color: Colors.accent.cyan,
    fontWeight: '700',
  },
  selectedText: {
    color: '#fff',
    fontWeight: '700',
  },
  eventDotsRow: {
    flexDirection: 'row',
    gap: 3,
    marginTop: 2,
  },
  eventDot: {
    width: 5,
    height: 5,
    borderRadius: 2.5,
  },
  weekView: {},
  weekDaysRow: {
    flexDirection: 'row',
    gap: Spacing.xs,
  },
  weekDayItem: {
    flex: 1,
    alignItems: 'center',
    padding: Spacing.md,
    backgroundColor: 'rgba(255,255,255,0.05)',
    borderRadius: BorderRadius.sm,
  },
  weekDayItemSelected: {
    backgroundColor: 'rgba(79, 172, 254, 0.15)',
  },
  weekDayName: {
    fontSize: Typography.micro.fontSize,
    fontWeight: '600',
    color: Colors.text.muted,
    textTransform: 'uppercase',
    marginBottom: Spacing.xs,
  },
  weekDayNumber: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: Spacing.xs,
  },
  weekDayNumberToday: {
    backgroundColor: 'rgba(79, 172, 254, 0.2)',
  },
  weekDayNumberSelected: {
    backgroundColor: Colors.accent.cyan,
  },
  weekDayNumberText: {
    fontSize: Typography.bodyMedium.fontSize,
    fontWeight: '600',
    color: Colors.text.secondary,
  },
  weekDayNumberTextToday: {
    color: Colors.accent.cyan,
  },
  weekDayNumberTextSelected: {
    color: '#fff',
  },
  weekEventCount: {
    fontSize: Typography.micro.fontSize,
    color: Colors.text.muted,
  },
  dayView: {
    alignItems: 'center',
    paddingVertical: Spacing.xl,
  },
  dayViewTitle: {
    fontSize: Typography.title.fontSize,
    fontWeight: '700',
    color: Colors.text.primary,
    marginBottom: Spacing.xs,
  },
  dayViewSubtitle: {
    fontSize: Typography.caption.fontSize,
    color: Colors.text.tertiary,
  },
  agendaHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  agendaTitle: {
    fontSize: Typography.bodyMedium.fontSize,
    fontWeight: '600',
    color: Colors.text.primary,
  },
  eventCountBadge: {
    backgroundColor: 'rgba(79, 172, 254, 0.1)',
    paddingHorizontal: Spacing.sm,
    paddingVertical: 4,
    borderRadius: BorderRadius.full,
  },
  eventCountText: {
    fontSize: Typography.micro.fontSize,
    fontWeight: '600',
    color: Colors.accent.cyan,
  },
  emptyAgenda: {
    alignItems: 'center',
    paddingVertical: Spacing.xl * 2,
    gap: Spacing.sm,
  },
  emptyText: {
    fontSize: Typography.bodyMedium.fontSize,
    fontWeight: '600',
    color: Colors.text.secondary,
  },
  emptySubtext: {
    fontSize: Typography.small.fontSize,
    color: Colors.text.muted,
  },
  eventsCard: {
    padding: 0,
    overflow: 'hidden',
  },
  eventItem: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    padding: Spacing.md,
  },
  eventItemBorder: {
    borderTopWidth: 1,
    borderTopColor: Colors.border.subtle,
  },
  eventIndicator: {
    width: 4,
    height: '100%',
    minHeight: 50,
    borderRadius: 2,
    marginRight: Spacing.md,
  },
  eventContent: {
    flex: 1,
  },
  eventHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    marginBottom: 4,
  },
  eventTime: {
    fontSize: Typography.small.fontSize,
    fontWeight: '600',
    color: Colors.accent.cyan,
  },
  eventDuration: {
    fontSize: Typography.micro.fontSize,
    color: Colors.text.muted,
  },
  eventTitle: {
    fontSize: Typography.caption.fontSize,
    fontWeight: '600',
    color: Colors.text.primary,
    marginBottom: 4,
  },
  eventMeta: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginTop: 2,
  },
  eventMetaText: {
    fontSize: Typography.micro.fontSize,
    color: Colors.text.muted,
    flex: 1,
  },
  eventTypeBadge: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    marginLeft: Spacing.sm,
  },
  statsRow: {
    flexDirection: 'row',
    gap: Spacing.sm,
  },
  statItem: {
    flex: 1,
    backgroundColor: Colors.background.secondary,
    borderRadius: BorderRadius.sm,
    padding: Spacing.md,
    borderLeftWidth: 3,
  },
  statValue: {
    fontSize: Typography.headline.fontSize,
    fontWeight: '700',
    color: Colors.text.primary,
  },
  statLabel: {
    fontSize: Typography.micro.fontSize,
    color: Colors.text.muted,
    marginTop: 2,
  },
  connectCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.md,
  },
  connectIcon: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: Colors.background.tertiary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  connectContent: {
    flex: 1,
  },
  connectTitle: {
    fontSize: Typography.caption.fontSize,
    fontWeight: '600',
    color: Colors.text.primary,
    marginBottom: 2,
  },
  connectDescription: {
    fontSize: Typography.micro.fontSize,
    color: Colors.text.muted,
  },
  connectButton: {
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    backgroundColor: Colors.accent.cyan,
    borderRadius: BorderRadius.sm,
  },
  connectButtonText: {
    fontSize: Typography.small.fontSize,
    fontWeight: '600',
    color: '#fff',
  },
});
