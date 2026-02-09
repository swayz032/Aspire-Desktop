import React, { useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { Colors, Spacing, Typography, BorderRadius } from '@/constants/tokens';
import { Ionicons } from '@expo/vector-icons';
import { Card } from './ui/Card';
import { useRouter } from 'expo-router';

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
  color?: string;
}

interface CalendarCardProps {
  events: CalendarEvent[];
}

export function CalendarCard({ events }: CalendarCardProps) {
  const router = useRouter();
  const [selectedDate, setSelectedDate] = useState(new Date());
  const today = new Date();
  
  const getDateString = (date: Date) => {
    return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
  };
  
  const selectedStr = getDateString(selectedDate);
  const selectedEvents = events.filter(e => e.date === selectedStr);

  const getEventColor = (type: CalendarEvent['type']) => {
    switch (type) {
      case 'meeting': return Colors.accent.cyan;
      case 'task': return Colors.semantic.success;
      case 'reminder': return Colors.semantic.warning;
      case 'call': return '#af52de';
      case 'deadline': return Colors.semantic.error;
      default: return Colors.text.tertiary;
    }
  };

  const getCurrentWeekDays = () => {
    const days: Date[] = [];
    const startOfWeek = new Date(today);
    startOfWeek.setDate(today.getDate() - today.getDay());
    
    for (let i = 0; i < 7; i++) {
      const day = new Date(startOfWeek);
      day.setDate(startOfWeek.getDate() + i);
      days.push(day);
    }
    return days;
  };

  const weekDays = getCurrentWeekDays();
  const WEEKDAY_LABELS = ['S', 'M', 'T', 'W', 'T', 'F', 'S'];

  const getEventsForDate = (date: Date) => {
    const dateStr = getDateString(date);
    return events.filter(e => e.date === dateStr);
  };

  const isSameDay = (d1: Date, d2: Date) => {
    return d1.getFullYear() === d2.getFullYear() &&
           d1.getMonth() === d2.getMonth() &&
           d1.getDate() === d2.getDate();
  };

  return (
    <Card variant="elevated" style={styles.container}>
      <View style={styles.calendarContainer}>
        <View style={styles.weekRow}>
          {weekDays.map((day, index) => {
            const dayEvents = getEventsForDate(day);
            const isToday = isSameDay(day, today);
            const isSelected = isSameDay(day, selectedDate);
            
            return (
              <TouchableOpacity 
                key={index} 
                style={styles.weekDayCell}
                onPress={() => setSelectedDate(day)}
              >
                <Text style={styles.weekDayLabel}>{WEEKDAY_LABELS[index]}</Text>
                <View style={[
                  styles.weekDayNumber,
                  isToday && styles.weekDayToday,
                  isSelected && !isToday && styles.weekDaySelected
                ]}>
                  <Text style={[
                    styles.weekDayNumberText,
                    (isToday || isSelected) && styles.weekDayNumberTextActive
                  ]}>
                    {day.getDate()}
                  </Text>
                </View>
                {dayEvents.length > 0 && (
                  <View style={styles.weekDayDots}>
                    {dayEvents.slice(0, 2).map((event, i) => (
                      <View 
                        key={i} 
                        style={[styles.weekEventDot, { backgroundColor: getEventColor(event.type) }]} 
                      />
                    ))}
                  </View>
                )}
              </TouchableOpacity>
            );
          })}
        </View>

        <View style={styles.todayEventsSection}>
          <View style={styles.todayHeader}>
            <Text style={styles.todayTitle}>
              {isSameDay(selectedDate, today) ? 'Today' : selectedDate.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })}
            </Text>
            <View style={styles.eventCountBadge}>
              <Text style={styles.eventCountText}>{selectedEvents.length} events</Text>
            </View>
          </View>
          
          {selectedEvents.slice(0, 3).map((event) => {
            const eventColor = getEventColor(event.type);
            return (
              <View key={event.id} style={styles.miniEventItem}>
                <View style={[styles.miniEventDot, { backgroundColor: eventColor }]} />
                <Text style={styles.miniEventTime}>{event.isAllDay ? 'All Day' : event.time}</Text>
                <Text style={styles.miniEventTitle} numberOfLines={1}>{event.title}</Text>
              </View>
            );
          })}
          {selectedEvents.length === 0 && (
            <Text style={styles.noEventsText}>No events scheduled</Text>
          )}
          {selectedEvents.length > 3 && (
            <Text style={styles.moreEventsText}>+{selectedEvents.length - 3} more</Text>
          )}
        </View>

        <TouchableOpacity 
          style={styles.seeFullButton}
          onPress={() => router.push('/calendar' as any)}
        >
          <Text style={styles.seeFullText}>See full calendar</Text>
          <Ionicons name="chevron-forward" size={16} color={Colors.accent.cyan} />
        </TouchableOpacity>
      </View>
    </Card>
  );
}

const styles = StyleSheet.create({
  container: {
    padding: 0,
    overflow: 'hidden',
    flex: 1,
  },
  calendarContainer: {
    padding: Spacing.md,
    flex: 1,
    display: 'flex',
    flexDirection: 'column',
  },
  weekRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: Spacing.xs,
  },
  weekDayCell: {
    alignItems: 'center',
    flex: 1,
    paddingVertical: Spacing.xs,
  },
  weekDayLabel: {
    fontSize: Typography.micro.fontSize,
    color: Colors.text.muted,
    marginBottom: 4,
  },
  weekDayNumber: {
    width: 28,
    height: 28,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  weekDayToday: {
    backgroundColor: Colors.accent.cyan,
  },
  weekDaySelected: {
    backgroundColor: 'rgba(79, 172, 254, 0.2)',
  },
  weekDayNumberText: {
    fontSize: Typography.caption.fontSize,
    color: Colors.text.secondary,
    fontWeight: '500',
  },
  weekDayNumberTextActive: {
    color: Colors.text.primary,
    fontWeight: '600',
  },
  weekDayDots: {
    flexDirection: 'row',
    gap: 2,
    marginTop: 3,
    height: 6,
  },
  weekEventDot: {
    width: 4,
    height: 4,
    borderRadius: 2,
  },
  todayEventsSection: {
    marginTop: Spacing.md,
    paddingTop: Spacing.md,
    borderTopWidth: 1,
    borderTopColor: Colors.border.subtle,
    flex: 1,
  },
  todayHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: Spacing.sm,
  },
  todayTitle: {
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
  miniEventItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    paddingVertical: 6,
  },
  miniEventDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  miniEventTime: {
    fontSize: Typography.small.fontSize,
    color: Colors.text.muted,
    width: 60,
  },
  miniEventTitle: {
    flex: 1,
    fontSize: Typography.caption.fontSize,
    color: Colors.text.primary,
  },
  moreEventsText: {
    fontSize: Typography.small.fontSize,
    color: Colors.text.muted,
    marginTop: Spacing.xs,
    textAlign: 'center',
  },
  noEventsText: {
    fontSize: Typography.caption.fontSize,
    color: Colors.text.muted,
    textAlign: 'center',
    paddingVertical: Spacing.sm,
  },
  seeFullButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.xs,
    paddingVertical: Spacing.md,
    borderTopWidth: 1,
    borderTopColor: Colors.border.subtle,
    marginTop: 'auto',
  },
  seeFullText: {
    color: Colors.accent.cyan,
    fontSize: Typography.caption.fontSize,
    fontWeight: '500',
  },
});
