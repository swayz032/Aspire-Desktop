import React, { useState, useEffect, useRef } from 'react';
import { View, Text, StyleSheet, Pressable, Platform, ScrollView, Animated } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Colors, Typography, Spacing, BorderRadius, Animation } from '@/constants/tokens';
import SourceBadge from './SourceBadge';
import TimelineRow from './TimelineRow';

interface ExplainDrawerProps {
  visible: boolean;
  onClose: () => void;
  metricId: string;
  suiteId?: string;
  officeId?: string;
}

interface ExplainData {
  metricId: string;
  name: string;
  definition: string;
  formula: string;
  sources: Array<{
    provider: 'plaid' | 'stripe' | 'qbo' | 'gusto' | 'computed';
    lastSyncAt: string | null;
    confidence: 'high' | 'medium' | 'low' | 'none';
  }>;
  exclusions: string[];
  relatedEvents: Array<{
    eventId: string;
    provider: string;
    eventType: string;
    occurredAt: string;
    amount: number | null;
    currency: string;
    status: string;
    entityRefs: any;
    metadata?: any;
    receiptId?: string;
  }>;
}

const FALLBACK_DATA: ExplainData = {
  metricId: '',
  name: 'Metric',
  definition: 'No definition available.',
  formula: '—',
  sources: [],
  exclusions: [],
  relatedEvents: [],
};

export default function ExplainDrawer({ visible, onClose, metricId, suiteId, officeId }: ExplainDrawerProps) {
  const [data, setData] = useState<ExplainData | null>(null);
  const [loading, setLoading] = useState(false);
  const [expandedEvent, setExpandedEvent] = useState<string | null>(null);
  const slideAnim = useRef(new Animated.Value(380)).current;

  useEffect(() => {
    if (visible) {
      Animated.timing(slideAnim, {
        toValue: 0,
        duration: Animation.normal,
        useNativeDriver: Platform.OS !== 'web',
      }).start();
    } else {
      Animated.timing(slideAnim, {
        toValue: 380,
        duration: Animation.fast,
        useNativeDriver: Platform.OS !== 'web',
      }).start();
    }
  }, [visible]);

  useEffect(() => {
    if (!visible || !metricId) return;
    setLoading(true);
    const params = new URLSearchParams({ metricId });
    if (suiteId) params.set('suiteId', suiteId);
    if (officeId) params.set('officeId', officeId);

    fetch(`/api/finance/explain?${params.toString()}`)
      .then((res) => {
        if (!res.ok) throw new Error('Failed to fetch');
        return res.json();
      })
      .then((json) => setData(json))
      .catch(() => setData({ ...FALLBACK_DATA, metricId }))
      .finally(() => setLoading(false));
  }, [metricId, visible, suiteId, officeId]);

  if (Platform.OS !== 'web') {
    return null;
  }

  if (!visible) return null;

  const info = data || { ...FALLBACK_DATA, metricId };

  return (
    <div
      style={{
        position: 'fixed',
        top: 0,
        right: 0,
        bottom: 0,
        width: 380,
        backgroundColor: Colors.background.secondary,
        borderLeft: `1px solid ${Colors.surface.cardBorder}`,
        zIndex: 1000,
        display: 'flex',
        flexDirection: 'column',
        transition: `transform ${Animation.normal}ms ease`,
        transform: visible ? 'translateX(0)' : 'translateX(100%)',
        boxShadow: '-8px 0 32px rgba(0,0,0,0.4)',
      }}
    >
      <View style={styles.header}>
        <Text style={styles.drawerTitle}>Explain</Text>
        <Pressable onPress={onClose} style={styles.closeButton}>
          <Ionicons name="close" size={18} color={Colors.text.secondary} />
        </Pressable>
      </View>

      <ScrollView style={styles.scrollView} contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        {loading ? (
          <Text style={styles.loadingText}>Loading…</Text>
        ) : (
          <>
            <Text style={styles.metricName}>{info.name}</Text>

            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Definition</Text>
              <Text style={styles.sectionBody}>{info.definition}</Text>
            </View>

            <View style={styles.section}>
              <Text style={styles.sectionTitle}>How it's computed</Text>
              <View style={styles.codeBlock}>
                <Text style={styles.codeText}>{info.formula}</Text>
              </View>
            </View>

            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Sources</Text>
              {info.sources.length > 0 ? (
                <View style={styles.sourcesRow}>
                  {info.sources.map((src, i) => (
                    <SourceBadge
                      key={i}
                      source={src.provider}
                      lastSyncAt={src.lastSyncAt}
                      confidence={src.confidence}
                    />
                  ))}
                </View>
              ) : (
                <Text style={styles.emptyText}>No sources linked</Text>
              )}
            </View>

            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Exclusions</Text>
              {info.exclusions.length > 0 ? (
                info.exclusions.map((ex, i) => (
                  <View key={i} style={styles.exclusionRow}>
                    <Ionicons name="remove-circle-outline" size={14} color={Colors.text.muted} />
                    <Text style={styles.exclusionText}>{ex}</Text>
                  </View>
                ))
              ) : (
                <Text style={styles.emptyText}>No exclusions</Text>
              )}
            </View>

            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Related Events</Text>
              {info.relatedEvents.length > 0 ? (
                info.relatedEvents.map((ev) => (
                  <TimelineRow
                    key={ev.eventId}
                    event={ev}
                    expanded={expandedEvent === ev.eventId}
                    onPress={() =>
                      setExpandedEvent(expandedEvent === ev.eventId ? null : ev.eventId)
                    }
                  />
                ))
              ) : (
                <Text style={styles.emptyText}>No related events</Text>
              )}
            </View>
          </>
        )}
      </ScrollView>
    </div>
  );
}

const styles = StyleSheet.create({
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: Spacing.xl,
    paddingVertical: Spacing.lg,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border.subtle,
  },
  drawerTitle: {
    ...Typography.headline,
    color: Colors.text.primary,
  },
  closeButton: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: Colors.background.elevated,
    alignItems: 'center',
    justifyContent: 'center',
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    padding: Spacing.xl,
    paddingBottom: 48,
  },
  loadingText: {
    ...Typography.body,
    color: Colors.text.muted,
    textAlign: 'center',
    marginTop: 40,
  },
  metricName: {
    ...Typography.title,
    color: Colors.text.primary,
    marginBottom: Spacing.xl,
  },
  section: {
    marginBottom: Spacing.xxl,
  },
  sectionTitle: {
    ...Typography.headline,
    color: Colors.text.tertiary,
    marginBottom: Spacing.sm,
  },
  sectionBody: {
    ...Typography.body,
    color: Colors.text.secondary,
    lineHeight: 22,
  },
  codeBlock: {
    backgroundColor: Colors.background.elevated,
    borderRadius: BorderRadius.md,
    padding: Spacing.md,
  },
  codeText: {
    ...Typography.caption,
    color: Colors.text.secondary,
    fontFamily: Platform.OS === 'web' ? 'monospace' : 'Courier',
  },
  sourcesRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.sm,
  },
  exclusionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    marginBottom: Spacing.xs,
  },
  exclusionText: {
    ...Typography.caption,
    color: Colors.text.secondary,
  },
  emptyText: {
    ...Typography.caption,
    color: Colors.text.disabled,
    fontStyle: 'italic',
  },
});
