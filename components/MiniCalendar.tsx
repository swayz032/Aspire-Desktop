import React, { useState, useMemo } from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { Colors, Spacing, Typography, BorderRadius } from '@/constants/tokens';
import { Ionicons } from '@expo/vector-icons';

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

interface MiniCalendarProps {
  events: CalendarEvent[];
  onDateSelect?: (date: Date) => void;
  onMonthChange?: (date: Date) => void;
  selectedDate?: Date;
  currentMonth?: Date;
  showNavigation?: boolean;
}

const WEEKDAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

export function MiniCalendar({ 
  events, 
  onDateSelect, 
  onMonthChange,
  selectedDate,
  currentMonth: controlledMonth,
  showNavigation = false 
}: MiniCalendarProps) {
  const [internalMonth, setInternalMonth] = useState(new Date());
  const currentMonth = controlledMonth || internalMonth;
  const today = new Date();
  
  const eventsByDate = useMemo(() => {
    const map: Record<string, CalendarEvent[]> = {};
    events.forEach(event => {
      const dateKey = event.date;
      if (!map[dateKey]) map[dateKey] = [];
      map[dateKey].push(event);
    });
    return map;
  }, [events]);

  const calendarDays = useMemo(() => {
    const year = currentMonth.getFullYear();
    const month = currentMonth.getMonth();
    
    const firstDay = new Date(year, month, 1);
    const lastDay = new Date(year, month + 1, 0);
    const startDayOfWeek = firstDay.getDay();
    const daysInMonth = lastDay.getDate();
    
    const prevMonthLastDay = new Date(year, month, 0).getDate();
    
    const days: { date: number; month: 'prev' | 'current' | 'next'; fullDate: Date }[] = [];
    
    for (let i = startDayOfWeek - 1; i >= 0; i--) {
      const date = prevMonthLastDay - i;
      days.push({ 
        date, 
        month: 'prev', 
        fullDate: new Date(year, month - 1, date) 
      });
    }
    
    for (let i = 1; i <= daysInMonth; i++) {
      days.push({ 
        date: i, 
        month: 'current', 
        fullDate: new Date(year, month, i) 
      });
    }
    
    const remainingDays = 42 - days.length;
    for (let i = 1; i <= remainingDays; i++) {
      days.push({ 
        date: i, 
        month: 'next', 
        fullDate: new Date(year, month + 1, i) 
      });
    }
    
    return days;
  }, [currentMonth]);

  const navigateMonth = (direction: 'prev' | 'next') => {
    const newDate = new Date(currentMonth);
    newDate.setMonth(currentMonth.getMonth() + (direction === 'next' ? 1 : -1));
    if (controlledMonth) {
      onMonthChange?.(newDate);
    } else {
      setInternalMonth(newDate);
      onMonthChange?.(newDate);
    }
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
    if (!selectedDate) return false;
    return date.getDate() === selectedDate.getDate() && 
           date.getMonth() === selectedDate.getMonth() && 
           date.getFullYear() === selectedDate.getFullYear();
  };

  const getEventDots = (date: Date) => {
    const dateKey = getDateKey(date);
    const dayEvents = eventsByDate[dateKey] || [];
    if (dayEvents.length === 0) return null;

    const uniqueTypes = [...new Set(dayEvents.map(e => e.type))].slice(0, 3);
    return uniqueTypes.map(type => getEventColor(type));
  };

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

  const monthYear = currentMonth.toLocaleDateString('en-US', { 
    month: 'long', 
    year: 'numeric' 
  });

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        {showNavigation ? (
          <>
            <TouchableOpacity 
              style={styles.navButton}
              onPress={() => navigateMonth('prev')}
            >
              <Ionicons name="chevron-back" size={18} color={Colors.text.secondary} />
            </TouchableOpacity>
            <Text style={styles.monthYear}>{monthYear}</Text>
            <TouchableOpacity 
              style={styles.navButton}
              onPress={() => navigateMonth('next')}
            >
              <Ionicons name="chevron-forward" size={18} color={Colors.text.secondary} />
            </TouchableOpacity>
          </>
        ) : (
          <Text style={styles.monthYear}>{monthYear}</Text>
        )}
      </View>

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
                isTodayDate && styles.todayCell,
                isSelectedDate && styles.selectedCell,
              ]}
              onPress={() => onDateSelect?.(day.fullDate)}
              activeOpacity={0.7}
            >
              <Text style={[
                styles.dayText,
                !isCurrentMonth && styles.otherMonthText,
                isTodayDate && styles.todayText,
                isSelectedDate && styles.selectedText,
              ]}>
                {day.date}
              </Text>
              {eventDots && eventDots.length > 0 && (
                <View style={styles.eventDots}>
                  {eventDots.map((color, i) => (
                    <View 
                      key={i} 
                      style={[styles.eventDot, { backgroundColor: color }]} 
                    />
                  ))}
                </View>
              )}
            </TouchableOpacity>
          );
        })}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: 'transparent',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: Spacing.sm,
    gap: Spacing.md,
  },
  navButton: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: Colors.background.tertiary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  monthYear: {
    fontSize: Typography.bodyMedium.fontSize,
    fontWeight: '600',
    color: Colors.text.primary,
    minWidth: 140,
    textAlign: 'center',
  },
  weekdayRow: {
    flexDirection: 'row',
    marginBottom: Spacing.xs,
  },
  weekdayCell: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: Spacing.xs,
  },
  weekdayText: {
    fontSize: 10,
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
    position: 'relative',
  },
  todayCell: {
    backgroundColor: 'rgba(79, 172, 254, 0.15)',
    borderRadius: BorderRadius.full,
  },
  selectedCell: {
    backgroundColor: Colors.accent.cyan,
    borderRadius: BorderRadius.full,
  },
  dayText: {
    fontSize: 13,
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
    color: Colors.text.primary,
    fontWeight: '700',
  },
  eventDots: {
    flexDirection: 'row',
    position: 'absolute',
    bottom: 2,
    gap: 2,
  },
  eventDot: {
    width: 4,
    height: 4,
    borderRadius: 2,
  },
});
