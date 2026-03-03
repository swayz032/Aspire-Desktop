import React, { useEffect, useState, useCallback, useMemo } from 'react';
import { View, Text, Pressable, ScrollView, StyleSheet, Platform } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { supabase } from '@/lib/supabase';
import { playTaskCompleteSound, playClickSound } from '@/lib/sounds';

type Priority = 'high' | 'medium' | 'low';
type FilterMode = 'All' | 'Today' | 'Upcoming';
type ViewState = 'list' | 'detail';

interface Task {
  id: string;
  title: string;
  description?: string;
  priority: Priority;
  timeEstimate: string;
  completed: boolean;
  due_date?: string;
}

interface TodaysPlanWidgetProps {
  suiteId: string;
  officeId: string;
}

function formatTimeEstimate(hours: number): string {
  if (hours < 1) return `${Math.round(hours * 60)}m`;
  const h = Math.floor(hours);
  const m = Math.round((hours - h) * 60);
  return m > 0 ? `${h}h ${m}m` : `${h}h`;
}

const PRIORITY: Record<Priority, { bg: string; label: string }> = {
  high:   { bg: '#3B82F6', label: 'HIGH' },
  medium: { bg: '#F59E0B', label: 'MED' },
  low:    { bg: 'rgba(255,255,255,0.15)', label: 'LOW' },
};

const DEMO_TASKS: Task[] = [
  { id: '1', title: 'Review Q4 financials', description: 'Prepare board deck', priority: 'high', timeEstimate: '2h', completed: false, due_date: new Date().toISOString() },
  { id: '2', title: 'Send investor update', description: 'Monthly newsletter', priority: 'medium', timeEstimate: '1h', completed: true },
  { id: '3', title: 'Update CRM contacts', description: 'Q4 pipeline entries', priority: 'low', timeEstimate: '30m', completed: false },
  { id: '4', title: 'Approve vendor invoice', description: 'Office supplies order', priority: 'medium', timeEstimate: '15m', completed: false },
];

export function TodaysPlanWidget({ suiteId, officeId }: TodaysPlanWidgetProps) {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [loading, setLoading] = useState(true);
  const [filterMode, setFilterMode] = useState<FilterMode>('All');
  const [viewState, setViewState] = useState<ViewState>('list');
  const [selectedTask, setSelectedTask] = useState<Task | null>(null);

  const fetchTasks = useCallback(async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('tasks')
        .select('id, title, description, priority, time_estimate_hours, is_completed, due_at')
        .eq('suite_id', suiteId)
        .eq('office_id', officeId)
        .order('priority', { ascending: true })
        .limit(20);
      if (error) throw error;
      setTasks((data ?? []).map((row: any) => ({
        id: row.id,
        title: row.title,
        description: row.description,
        priority: row.priority as Priority,
        timeEstimate: formatTimeEstimate(row.time_estimate_hours),
        completed: row.is_completed,
        due_date: row.due_at,
      })));
    } catch {
      setTasks(DEMO_TASKS);
    } finally {
      setLoading(false);
    }
  }, [suiteId, officeId]);

  useEffect(() => { fetchTasks(); }, [fetchTasks]);

  const toggleTask = useCallback(async (task: Task) => {
    const newCompleted = !task.completed;
    setTasks(prev => prev.map(t => t.id === task.id ? { ...t, completed: newCompleted } : t));
    if (newCompleted) {
      playTaskCompleteSound();
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
    }
    try {
      await supabase.from('tasks').update({ is_completed: newCompleted }).eq('id', task.id);
    } catch {}
  }, []);

  const filtered = useMemo(() => {
    if (filterMode === 'All') return tasks;
    if (filterMode === 'Today') return tasks.filter(t => !t.completed);
    return tasks.filter(t => !t.completed);
  }, [tasks, filterMode]);

  const incompleteTasks = tasks.filter(t => !t.completed);
  const today = new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' });

  if (viewState === 'detail' && selectedTask) {
    const p = PRIORITY[selectedTask.priority];
    return (
      <View style={s.root}>
        <View style={s.detailHeader}>
          <Pressable onPress={() => { setViewState('list'); setSelectedTask(null); }} style={s.backBtn}>
            <Ionicons name="arrow-back" size={20} color="#FFF" />
          </Pressable>
          <Text style={s.detailHeaderTitle}>Task Details</Text>
        </View>

        <ScrollView style={s.detailScroll} contentContainerStyle={s.detailContent}>
          <View style={[s.detailPriorityBadge, { backgroundColor: p.bg }]}>
            <Text style={s.detailPriorityText}>{p.label}</Text>
          </View>
          <Text style={s.detailTitle}>{selectedTask.title}</Text>
          {selectedTask.description ? (
            <Text style={s.detailDesc}>{selectedTask.description}</Text>
          ) : null}
          {selectedTask.due_date ? (
            <View style={s.metaRow}>
              <Ionicons name="calendar-outline" size={15} color="rgba(255,255,255,0.35)" />
              <Text style={s.metaText}>Due {new Date(selectedTask.due_date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}</Text>
            </View>
          ) : null}
          <View style={s.metaRow}>
            <Ionicons name="time-outline" size={15} color="rgba(255,255,255,0.35)" />
            <Text style={s.metaText}>Est. {selectedTask.timeEstimate}</Text>
          </View>
        </ScrollView>

        <View style={s.detailActions}>
          <Pressable
            onPress={() => { toggleTask(selectedTask); setViewState('list'); setSelectedTask(null); }}
            style={[s.detailCompleteBtn, { backgroundColor: selectedTask.completed ? 'rgba(255,255,255,0.08)' : '#3B82F6' }]}
          >
            <Text style={s.detailCompleteBtnText}>
              {selectedTask.completed ? 'Mark Incomplete' : 'Mark Complete'}
            </Text>
          </Pressable>
        </View>
      </View>
    );
  }

  return (
    <View style={s.root}>
      {/* Hero */}
      <View style={s.hero}>
        <View style={s.heroLeft}>
          <Text style={s.heroSub}>You've got</Text>
          <Text style={s.heroCount}>{incompleteTasks.length} tasks</Text>
          <Text style={s.heroCrush}>to crush today</Text>
        </View>
        <Text style={s.heroDate}>{today}</Text>
      </View>

      {/* Filters */}
      <View style={s.filters}>
        {(['All', 'Today', 'Upcoming'] as FilterMode[]).map(f => (
          <Pressable
            key={f}
            onPress={() => { playClickSound(); setFilterMode(f); }}
            style={[s.filterPill, filterMode === f && s.filterPillActive]}
          >
            <Text style={[s.filterText, filterMode === f && s.filterTextActive]}>{f}</Text>
          </Pressable>
        ))}
      </View>

      {/* List */}
      <ScrollView style={s.list} showsVerticalScrollIndicator={false}>
        {loading ? (
          <View style={s.centerPad}>
            <Text style={s.mutedText}>Loading…</Text>
          </View>
        ) : filtered.length === 0 ? (
          <View style={s.centerPad}>
            <Ionicons name="checkmark-circle" size={40} color="rgba(255,255,255,0.1)" />
            <Text style={s.mutedText}>All clear!</Text>
          </View>
        ) : (
          filtered.map(task => (
            <Pressable
              key={task.id}
              style={s.taskRow}
              onPress={() => { playClickSound(); setSelectedTask(task); setViewState('detail'); }}
            >
              <View style={s.taskLeft}>
                <View style={[s.badge, { backgroundColor: PRIORITY[task.priority].bg }]}>
                  <Text style={s.badgeText}>{PRIORITY[task.priority].label}</Text>
                </View>
                <Text style={[s.taskTitle, task.completed && s.taskDone]} numberOfLines={1}>
                  {task.title}
                </Text>
                {task.description ? (
                  <Text style={s.taskDesc} numberOfLines={1}>{task.description}</Text>
                ) : null}
              </View>
              <View style={s.taskRight}>
                <Text style={s.taskTime}>{task.timeEstimate}</Text>
                <Pressable
                  onPress={e => { (e as any).stopPropagation?.(); toggleTask(task); }}
                  style={[s.checkbox, task.completed && s.checkboxDone]}
                  hitSlop={8}
                >
                  {task.completed && <Ionicons name="checkmark" size={14} color="#FFF" />}
                </Pressable>
              </View>
            </Pressable>
          ))
        )}

        <Pressable style={s.addRow} onPress={() => playClickSound()}>
          <Ionicons name="add" size={18} color="rgba(255,255,255,0.3)" />
          <Text style={s.addText}>Add task</Text>
        </Pressable>
      </ScrollView>
    </View>
  );
}

const s = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: '#070A10',
  },
  hero: {
    paddingHorizontal: 24,
    paddingTop: 32,
    paddingBottom: 20,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,255,255,0.07)',
    flexDirection: 'row',
    alignItems: 'flex-end',
    justifyContent: 'space-between',
  },
  heroLeft: { flex: 1 },
  heroSub: {
    fontSize: 13,
    color: 'rgba(255,255,255,0.4)',
    fontWeight: '500',
  } as any,
  heroCount: {
    fontSize: 40,
    fontWeight: '800',
    color: '#FFFFFF',
    lineHeight: 46,
    letterSpacing: -1.5,
  } as any,
  heroCrush: {
    fontSize: 15,
    color: 'rgba(255,255,255,0.45)',
    fontWeight: '500',
    marginTop: 2,
  } as any,
  heroDate: {
    fontSize: 11,
    color: 'rgba(255,255,255,0.22)',
    textAlign: 'right',
    maxWidth: 90,
    lineHeight: 16,
  } as any,
  filters: {
    flexDirection: 'row',
    paddingHorizontal: 16,
    paddingVertical: 12,
    gap: 8,
  },
  filterPill: {
    paddingHorizontal: 14,
    paddingVertical: 7,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
    ...(Platform.OS === 'web' ? ({ cursor: 'pointer' } as any) : {}),
  },
  filterPillActive: {
    backgroundColor: '#3B82F6',
    borderColor: '#3B82F6',
  },
  filterText: {
    fontSize: 12,
    color: 'rgba(255,255,255,0.4)',
    fontWeight: '600',
  } as any,
  filterTextActive: { color: '#FFF' },
  list: { flex: 1 },
  centerPad: {
    paddingVertical: 60,
    alignItems: 'center',
    gap: 12,
  },
  mutedText: {
    color: 'rgba(255,255,255,0.22)',
    fontSize: 14,
  },
  taskRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 24,
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,255,255,0.06)',
    gap: 12,
    ...(Platform.OS === 'web' ? ({ cursor: 'pointer' } as any) : {}),
  },
  taskLeft: { flex: 1, gap: 4 },
  badge: {
    alignSelf: 'flex-start',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 4,
  },
  badgeText: {
    fontSize: 10,
    fontWeight: '800',
    color: '#FFF',
    letterSpacing: 0.8,
  } as any,
  taskTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: '#FFF',
    lineHeight: 20,
  } as any,
  taskDone: {
    color: 'rgba(255,255,255,0.28)',
    textDecorationLine: 'line-through',
  },
  taskDesc: {
    fontSize: 12,
    color: 'rgba(255,255,255,0.32)',
  },
  taskRight: { alignItems: 'flex-end', gap: 8 },
  taskTime: {
    fontSize: 12,
    color: 'rgba(255,255,255,0.28)',
  },
  checkbox: {
    width: 26,
    height: 26,
    borderRadius: 13,
    borderWidth: 2,
    borderColor: 'rgba(255,255,255,0.18)',
    justifyContent: 'center',
    alignItems: 'center',
    ...(Platform.OS === 'web' ? ({ cursor: 'pointer' } as any) : {}),
  },
  checkboxDone: {
    backgroundColor: '#3B82F6',
    borderColor: '#3B82F6',
  },
  addRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    marginHorizontal: 16,
    marginTop: 8,
    marginBottom: 16,
    paddingVertical: 14,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.07)',
    borderStyle: 'dashed',
    borderRadius: 10,
    ...(Platform.OS === 'web' ? ({ cursor: 'pointer' } as any) : {}),
  },
  addText: {
    fontSize: 13,
    color: 'rgba(255,255,255,0.28)',
    fontWeight: '600',
  } as any,
  detailHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingHorizontal: 16,
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,255,255,0.07)',
  },
  backBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: 'rgba(255,255,255,0.07)',
    justifyContent: 'center',
    alignItems: 'center',
    ...(Platform.OS === 'web' ? ({ cursor: 'pointer' } as any) : {}),
  },
  detailHeaderTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#FFF',
  } as any,
  detailScroll: { flex: 1 },
  detailContent: { padding: 24, gap: 12 },
  detailPriorityBadge: {
    alignSelf: 'flex-start',
    paddingHorizontal: 12,
    paddingVertical: 5,
    borderRadius: 6,
  },
  detailPriorityText: {
    fontSize: 11,
    fontWeight: '800',
    color: '#FFF',
    letterSpacing: 1,
  } as any,
  detailTitle: {
    fontSize: 22,
    fontWeight: '800',
    color: '#FFF',
    lineHeight: 28,
    marginTop: 4,
  } as any,
  detailDesc: {
    fontSize: 15,
    color: 'rgba(255,255,255,0.5)',
    lineHeight: 22,
  },
  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginTop: 4,
  },
  metaText: {
    fontSize: 13,
    color: 'rgba(255,255,255,0.38)',
  },
  detailActions: {
    padding: 20,
    borderTopWidth: 1,
    borderTopColor: 'rgba(255,255,255,0.07)',
  },
  detailCompleteBtn: {
    paddingVertical: 16,
    borderRadius: 12,
    alignItems: 'center',
  },
  detailCompleteBtnText: {
    fontSize: 15,
    fontWeight: '700',
    color: '#FFF',
  } as any,
});
