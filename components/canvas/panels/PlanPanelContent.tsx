import React, { useState, useEffect, useCallback, memo } from 'react';
import { View, Text, Pressable, StyleSheet, ScrollView, Platform } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useAuthFetch } from '@/lib/authenticatedFetch';
import type { PanelContentProps } from './types';
import { timeAgo } from './utils';

const BLUE    = '#0ea5e9';
const SURFACE = 'rgba(6,6,10,0.98)';
const GLASS   = 'rgba(255,255,255,0.06)';
const BORDER  = 'rgba(255,255,255,0.11)';
const TP      = '#FFFFFF';
const TS      = 'rgba(255,255,255,0.45)';
const TT      = 'rgba(255,255,255,0.25)';
const C_GREEN = 'rgba(34,197,94,0.9)';
const C_RED   = 'rgba(239,68,68,0.9)';
const C_AMBER = 'rgba(245,158,11,0.9)';

interface Job {
  id: string;
  title?: string;
  description?: string;
  status?: string;
  priority?: string;
  agent?: string;
  created_at?: string;
}
interface AtRiskItem { id: string; title: string; risk_tier?: string }

function priorityChipStyle(p: string | undefined): { bg: string; bd: string; col: string; label: string } {
  const v = (p || '').toUpperCase();
  if (v === 'HIGH')   return { bg: 'rgba(239,68,68,0.15)',  bd: 'rgba(239,68,68,0.5)',  col: C_RED,   label: 'HIGH' };
  if (v === 'MEDIUM') return { bg: 'rgba(245,158,11,0.15)', bd: 'rgba(245,158,11,0.5)', col: C_AMBER, label: 'MED'  };
  return                     { bg: 'rgba(34,197,94,0.15)',  bd: 'rgba(34,197,94,0.5)',  col: C_GREEN, label: 'LOW'  };
}

function statusCircleColor(status: string | undefined): string {
  const s = (status || '').toLowerCase();
  if (s === 'completed' || s === 'done') return C_GREEN;
  if (s === 'failed' || s === 'error')   return C_RED;
  if (s === 'running' || s === 'active') return BLUE;
  return 'rgba(255,255,255,0.2)';
}

interface JobCardProps {
  job: Job;
  isOpen: boolean;
  onToggle: (id: string) => void;
}

const JobCard = memo(function JobCard({ job, isOpen, onToggle }: JobCardProps) {
  const pc = priorityChipStyle(job.priority);
  const isDone = job.status === 'completed' || job.status === 'done';
  return (
    <Pressable onPress={() => onToggle(job.id)} style={s.card}>
      <View style={s.cardTop}>
        <View style={[s.priorityChip, { backgroundColor: pc.bg, borderColor: pc.bd }]}>
          <Text style={[s.priorityChipText, { color: pc.col }]}>{pc.label}</Text>
        </View>
        <View style={[s.checkCircle, isDone ? s.checkCircleDone : null]}>
          {isDone ? <Ionicons name="checkmark" size={12} color="#FFF" /> : null}
        </View>
      </View>
      <Text style={s.cardTitle} numberOfLines={isOpen ? 6 : 2}>{job.title || 'Untitled task'}</Text>
      {job.description && isOpen ? (
        <Text style={s.cardDesc} numberOfLines={4}>{job.description}</Text>
      ) : null}
      <View style={s.cardBottom}>
        {job.created_at ? <Text style={s.cardTime}>{timeAgo(job.created_at)}</Text> : null}
        {job.agent ? <Text style={s.cardAgent} numberOfLines={1}>{job.agent}</Text> : null}
      </View>
      {isOpen ? (
        <View style={s.actionRow}>
          {(['Defer', 'Delegate', 'Review'] as const).map(action => (
            <Pressable key={action} style={s.ghostBtn}>
              <Text style={s.ghostBtnText}>{action}</Text>
            </Pressable>
          ))}
        </View>
      ) : null}
    </Pressable>
  );
});

function RingHero({ pct, completed, total }: { pct: number; completed: number; total: number }) {
  const size = 130;
  const stroke = 10;
  const r = (size - stroke) / 2;
  const circ = 2 * Math.PI * r;
  const offset = circ * (1 - pct / 100);

  return (
    <View style={s.heroZone}>
      <View style={s.orbBehind} pointerEvents="none" />
      <View style={[s.ring, { width: size, height: size }]}>
        <View style={s.ringTrack} />
        <View
          style={[
            s.ringCenter,
            { width: size - stroke * 2, height: size - stroke * 2, borderRadius: (size - stroke * 2) / 2 },
          ]}
        >
          <Text style={s.ringPct}>{pct}%</Text>
          <Text style={s.ringLabel}>Complete</Text>
        </View>
        {Platform.OS === 'web' ? (
          <svg
            width={size}
            height={size}
            style={{ position: 'absolute', top: 0, left: 0 }}
          >
            <circle
              cx={size / 2}
              cy={size / 2}
              r={r}
              fill="none"
              stroke="rgba(255,255,255,0.08)"
              strokeWidth={stroke}
            />
            <circle
              cx={size / 2}
              cy={size / 2}
              r={r}
              fill="none"
              stroke={BLUE}
              strokeWidth={stroke}
              strokeDasharray={circ}
              strokeDashoffset={offset}
              strokeLinecap="round"
              transform={`rotate(-90 ${size / 2} ${size / 2})`}
            />
          </svg>
        ) : (
          <View
            style={[
              s.ringFill,
              {
                borderTopColor: pct >= 25 ? BLUE : 'transparent',
                borderRightColor: pct >= 50 ? BLUE : 'transparent',
                borderBottomColor: pct >= 75 ? BLUE : 'transparent',
                borderLeftColor: pct >= 99 ? BLUE : 'transparent',
              },
            ]}
          />
        )}
      </View>
      <Text style={s.heroSub}>{completed} of {total} tasks done</Text>
    </View>
  );
}

export default function PlanPanelContent(_props: PanelContentProps) {
  const { authenticatedFetch: authFetch } = useAuthFetch();
  const [jobs, setJobs]         = useState<Job[]>([]);
  const [atRisk, setAtRisk]     = useState<AtRiskItem[]>([]);
  const [loading, setLoading]   = useState(true);
  const [expanded, setExpanded] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const [jobsRes, authRes] = await Promise.allSettled([
        authFetch('/api/orchestrator/jobs?status=pending&limit=20'),
        authFetch('/api/authority-queue'),
      ]);
      if (jobsRes.status === 'fulfilled') {
        const d = await jobsRes.value.json();
        setJobs(d.jobs || d || []);
      }
      if (authRes.status === 'fulfilled') {
        const d = await authRes.value.json();
        const all = d.items || d || [];
        setAtRisk(all.filter((i: any) => i.risk_tier === 'red' || i.risk_tier === 'yellow'));
      }
    } catch {
    } finally {
      setLoading(false);
    }
  }, [authFetch]);

  useEffect(() => { load(); }, [load]);

  const handleToggle = useCallback((id: string) => {
    setExpanded(prev => (prev === id ? null : id));
  }, []);

  const total     = jobs.length;
  const completed = jobs.filter(j => j.status === 'completed' || j.status === 'done').length;
  const pct       = total > 0 ? Math.round((completed / total) * 100) : 0;

  return (
    <View style={s.root}>
      <RingHero pct={pct} completed={completed} total={total} />

      {atRisk.length > 0 ? (
        <View style={s.atRiskCard}>
          <View style={s.atRiskHeader}>
            <Ionicons name="warning" size={15} color={C_AMBER} />
            <Text style={s.atRiskTitle}>{atRisk.length} item{atRisk.length !== 1 ? 's' : ''} need attention</Text>
          </View>
          {atRisk.slice(0, 2).map(item => (
            <Text key={item.id} style={s.atRiskItem} numberOfLines={1}>· {item.title}</Text>
          ))}
          <Pressable style={s.atRiskBtn}>
            <Text style={s.atRiskBtnText}>Review Now</Text>
          </Pressable>
        </View>
      ) : null}

      <Text style={s.sectionLabel}>TODAY'S TASKS</Text>

      <ScrollView style={s.list} showsVerticalScrollIndicator={false}>
        {loading ? <Text style={s.emptyText}>Loading tasks…</Text> : null}
        {!loading && jobs.length === 0 ? (
          <View style={s.emptyState}>
            <Ionicons name="checkmark-circle" size={40} color={BLUE} />
            <Text style={s.emptyStateTitle}>All clear</Text>
            <Text style={s.emptyStateSub}>No tasks scheduled for today</Text>
          </View>
        ) : null}
        {jobs.map(job => (
          <JobCard key={job.id} job={job} isOpen={expanded === job.id} onToggle={handleToggle} />
        ))}
        <View style={s.bottomSpacer} />
      </ScrollView>
    </View>
  );
}

const s = StyleSheet.create({
  root:         { flex: 1, backgroundColor: SURFACE },
  heroZone:     { alignItems: 'center', paddingTop: 28, paddingBottom: 24, position: 'relative' },
  orbBehind:    {
    position: 'absolute', top: -80, right: -60, width: 280, height: 280,
    borderRadius: 140, backgroundColor: 'rgba(14,165,233,0.12)',
    ...(Platform.OS === 'web' ? ({ filter: 'blur(70px)' }) : {}),
  },
  ring:         { alignItems: 'center', justifyContent: 'center', position: 'relative' },
  ringTrack:    {
    position: 'absolute', top: 0, left: 0, right: 0, bottom: 0,
    borderRadius: 65, borderWidth: 10, borderColor: 'rgba(255,255,255,0.08)',
  },
  ringFill:     {
    position: 'absolute', top: 0, left: 0, right: 0, bottom: 0,
    borderRadius: 65, borderWidth: 10,
    borderTopColor: BLUE, borderRightColor: BLUE,
    borderBottomColor: 'transparent', borderLeftColor: 'transparent',
  },
  ringCenter:   { alignItems: 'center', justifyContent: 'center', backgroundColor: SURFACE },
  ringPct:      { fontSize: 34, fontWeight: '800', color: TP, fontVariant: ['tabular-nums' as const] },
  ringLabel:    { fontSize: 10, color: TT, letterSpacing: 1.2, textTransform: 'uppercase', marginTop: 2 },
  heroSub:      { fontSize: 13, color: TS, marginTop: 12, letterSpacing: 0.2 },
  atRiskCard:   {
    marginHorizontal: 16, marginBottom: 12,
    backgroundColor: 'rgba(245,158,11,0.08)', borderRadius: 14,
    borderWidth: 1, borderColor: 'rgba(245,158,11,0.3)',
    borderLeftWidth: 3, borderLeftColor: C_AMBER,
    padding: 14,
  },
  atRiskHeader: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 6 },
  atRiskTitle:  { fontSize: 13, fontWeight: '700', color: C_AMBER },
  atRiskItem:   { fontSize: 12, color: TS, marginBottom: 3, paddingLeft: 4 },
  atRiskBtn:    { marginTop: 10, alignSelf: 'flex-start', paddingHorizontal: 14, paddingVertical: 8, borderRadius: 8, borderWidth: 1, borderColor: BLUE },
  atRiskBtnText:{ fontSize: 12, fontWeight: '600', color: BLUE },
  sectionLabel: { fontSize: 11, letterSpacing: 1.5, textTransform: 'uppercase', color: TT, paddingHorizontal: 16, paddingTop: 4, paddingBottom: 10 },
  list:         { flex: 1 },
  emptyText:    { fontSize: 14, color: TT, textAlign: 'center', paddingTop: 40 },
  emptyState:   { alignItems: 'center', paddingTop: 48, gap: 8 },
  emptyStateTitle: { fontSize: 16, fontWeight: '700', color: TP, marginTop: 4 },
  emptyStateSub:   { fontSize: 13, color: TT },
  card:         {
    marginHorizontal: 16, marginBottom: 10,
    backgroundColor: GLASS, borderRadius: 16,
    borderWidth: 1, borderColor: BORDER,
    padding: 16,
    ...(Platform.OS === 'web' ? ({ backdropFilter: 'blur(20px)', boxShadow: '0 4px 24px rgba(0,0,0,0.3)' }) : {}),
  },
  cardTop:      { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 },
  priorityChip: { paddingHorizontal: 8, paddingVertical: 4, borderRadius: 6, borderWidth: 1 },
  priorityChipText: { fontSize: 10, fontWeight: '700', letterSpacing: 0.8 },
  checkCircle:  { width: 22, height: 22, borderRadius: 11, borderWidth: 1.5, borderColor: 'rgba(255,255,255,0.2)', alignItems: 'center', justifyContent: 'center' },
  checkCircleDone: { backgroundColor: C_GREEN, borderColor: C_GREEN },
  cardTitle:    { fontSize: 15, fontWeight: '700', color: TP, lineHeight: 21, marginBottom: 6 },
  cardDesc:     { fontSize: 13, color: TS, lineHeight: 19, marginBottom: 8 },
  cardBottom:   { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 4 },
  cardTime:     { fontSize: 11, color: TT },
  cardAgent:    { fontSize: 11, color: BLUE, flex: 1, textAlign: 'right' },
  actionRow:    { flexDirection: 'row', gap: 8, marginTop: 14, paddingTop: 12, borderTopWidth: 1, borderTopColor: 'rgba(255,255,255,0.07)' },
  ghostBtn:     { flex: 1, paddingVertical: 10, borderRadius: 10, borderWidth: 1, borderColor: BLUE, alignItems: 'center' },
  ghostBtnText: { fontSize: 12, fontWeight: '600', color: BLUE },
  bottomSpacer: { height: 32 },
});
