import React, { useState, useEffect, useMemo } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity } from 'react-native';
import { Colors, Spacing, Typography, BorderRadius } from '@/constants/tokens';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { Card } from '@/components/ui/Card';
import { useRouter } from 'expo-router';
import { supabase } from '@/lib/supabase';
import { useTenant } from '@/providers';

const BRIGHT_BG = '#0a0a0c';

const DEFAULT_LEARNING_TRACKS = [
  { id: 'money', name: 'Money', icon: 'cash', color: '#34d399' },
  { id: 'sales', name: 'Sales & Marketing', icon: 'megaphone', color: '#f472b6' },
  { id: 'operations', name: 'Operations', icon: 'construct', color: '#a78bfa' },
  { id: 'growth', name: 'Growth', icon: 'rocket', color: '#fbbf24' },
];

const SERVICE_TRACK_MAP: Record<string, { icon: string; color: string }> = {
  invoicing: { icon: 'receipt', color: '#3B82F6' },
  bookkeeping: { icon: 'calculator', color: '#34d399' },
  contracts: { icon: 'document-text', color: '#a78bfa' },
  email: { icon: 'mail', color: '#f472b6' },
  scheduling: { icon: 'calendar', color: '#fbbf24' },
  payments: { icon: 'card', color: '#60a5fa' },
  payroll: { icon: 'people', color: '#f87171' },
  filings: { icon: 'folder', color: '#34d399' },
  proposals: { icon: 'create', color: '#a78bfa' },
  contacts: { icon: 'person', color: '#fbbf24' },
};

interface EducationItem {
  id: string;
  title: string;
  subtitle: string;
  icon: string;
  color: string;
}

interface SavedItem {
  id: string;
  title: string;
  type: string;
  date: string;
}

export default function EducationScreen() {
  const router = useRouter();
  const { tenant, isLoading: tenantLoading } = useTenant();
  const [activeTrack, setActiveTrack] = useState('');
  const [pickedForYou, setPickedForYou] = useState<EducationItem[]>([]);
  const [savedApplied, setSavedApplied] = useState<SavedItem[]>([]);
  const [loading, setLoading] = useState(true);

  // Generate learning tracks from servicesNeeded
  const learningTracks = useMemo(() => {
    if (tenant?.servicesNeeded && tenant.servicesNeeded.length > 0) {
      return tenant.servicesNeeded.map((service) => {
        const key = service.toLowerCase().replace(/\s+/g, '_');
        const trackInfo = SERVICE_TRACK_MAP[key] ?? { icon: 'book', color: '#3B82F6' };
        return {
          id: key,
          name: service.charAt(0).toUpperCase() + service.slice(1),
          icon: trackInfo.icon,
          color: trackInfo.color,
        };
      });
    }
    return DEFAULT_LEARNING_TRACKS;
  }, [tenant?.servicesNeeded]);

  useEffect(() => {
    if (learningTracks.length > 0 && !activeTrack) {
      setActiveTrack(learningTracks[0].id);
    }
  }, [learningTracks, activeTrack]);

  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        const { data } = await supabase
          .from('receipts')
          .select('*')
          .like('action_type', 'adam.education%')
          .order('created_at', { ascending: false })
          .limit(10);

        if (!mounted) return;
        if (data && data.length > 0) {
          const items: EducationItem[] = [];
          const saved: SavedItem[] = [];

          data.forEach((r: any, idx: number) => {
            const p = r.payload ?? {};
            if (p.type === 'saved' || p.type === 'applied') {
              saved.push({
                id: r.id ?? `saved-${idx}`,
                title: p.title ?? 'Resource',
                type: p.type === 'applied' ? 'Applied' : 'Saved',
                date: new Date(r.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
              });
            } else {
              const trackInfo = SERVICE_TRACK_MAP[p.track ?? p.category ?? ''] ?? { icon: 'book', color: '#3B82F6' };
              items.push({
                id: r.id ?? `edu-${idx}`,
                title: p.title ?? 'Learning resource',
                subtitle: p.subtitle ?? p.summary ?? p.description ?? '',
                icon: trackInfo.icon,
                color: trackInfo.color,
              });
            }
          });

          setPickedForYou(items);
          setSavedApplied(saved);
        }
      } catch (err) {
        console.error('Failed to load education content:', err);
      } finally {
        if (mounted) setLoading(false);
      }
    })();
    return () => { mounted = false; };
  }, []);

  if (loading || tenantLoading) {
    return (
      <View style={styles.container}>
        <LinearGradient
          colors={['#0a1628', '#0d2847', '#1a4a6e', '#0d3a5c', BRIGHT_BG]}
          locations={[0, 0.15, 0.35, 0.6, 1]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={styles.headerGradient}
        >
          <View style={styles.customHeader}>
            <TouchableOpacity
              style={styles.backButton}
              onPress={() => router.canGoBack() ? router.back() : router.push('/founder-hub')}
              accessibilityLabel="Go back"
              accessibilityRole="button"
            >
              <Ionicons name="chevron-back" size={24} color={Colors.text.primary} />
            </TouchableOpacity>
            <View style={styles.headerTextSection}>
              <View style={styles.skeletonHeaderTitle} />
              <View style={styles.skeletonHeaderSubtitle} />
            </View>
          </View>
        </LinearGradient>
        <ScrollView contentContainerStyle={styles.scrollContent}>
          <View style={styles.skeletonHeroCard} />
          <View style={styles.skeletonChipsRow}>
            {[1, 2, 3].map((i) => (
              <View key={i} style={styles.skeletonChip} />
            ))}
          </View>
          <View style={styles.skeletonLessons}>
            {[1, 2, 3].map((i) => (
              <View key={i} style={styles.skeletonLessonRow} />
            ))}
          </View>
        </ScrollView>
      </View>
    );
  }

  if (!tenant?.onboardingCompleted) {
    return (
      <View style={styles.container}>
        <LinearGradient
          colors={['#0a1628', '#0d2847', '#1a4a6e', '#0d3a5c', BRIGHT_BG]}
          locations={[0, 0.15, 0.35, 0.6, 1]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={styles.headerGradient}
        >
          <View style={styles.customHeader}>
            <TouchableOpacity
              style={styles.backButton}
              onPress={() => router.canGoBack() ? router.back() : router.push('/founder-hub')}
              accessibilityLabel="Go back"
              accessibilityRole="button"
            >
              <Ionicons name="chevron-back" size={24} color={Colors.text.primary} />
            </TouchableOpacity>
            <View style={styles.headerTextSection}>
              <Text style={styles.headerTitle}>Education</Text>
              <Text style={styles.headerSubtitle}>Learn and grow your business</Text>
            </View>
          </View>
        </LinearGradient>
        <ScrollView contentContainerStyle={styles.scrollContent}>
          <View style={styles.emptyStateContainer}>
            <Ionicons name="person-circle-outline" size={48} color={Colors.text.muted} />
            <Text style={styles.emptyStateTitle}>Complete your profile to unlock Education</Text>
            <Text style={styles.emptyStateDesc}>
              Once you finish onboarding, Adam will curate personalized learning resources for your business.
            </Text>
          </View>
        </ScrollView>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <LinearGradient
        colors={['#0a1628', '#0d2847', '#1a4a6e', '#0d3a5c', BRIGHT_BG]}
        locations={[0, 0.15, 0.35, 0.6, 1]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={styles.headerGradient}
      >
        <View style={styles.customHeader}>
          <TouchableOpacity
            style={styles.backButton}
            onPress={() => router.canGoBack() ? router.back() : router.push('/founder-hub')}
            accessibilityLabel="Go back"
            accessibilityRole="button"
          >
            <Ionicons name="chevron-back" size={24} color={Colors.text.primary} />
          </TouchableOpacity>
          <View style={styles.headerTextSection}>
            <Text style={styles.headerTitle}>Education</Text>
            <Text style={styles.headerSubtitle}>
              {tenant?.industry
                ? `Learning resources for your ${tenant.industry} business`
                : 'Learn and grow your business'}
            </Text>
          </View>
          <View style={styles.headerActions}>
            <TouchableOpacity style={styles.headerActionButton} accessibilityLabel="Saved items" accessibilityRole="button">
              <Ionicons name="bookmark-outline" size={22} color={Colors.text.secondary} />
            </TouchableOpacity>
          </View>
        </View>
      </LinearGradient>

      <ScrollView
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Today's Brief</Text>
          <Text style={styles.sectionSubtitle}>
            {tenant?.industry
              ? `Briefings tailored to your ${tenant.industry} business.`
              : 'Briefings tailored to your business.'}
          </Text>

          <View style={styles.contextBadge}>
            <View style={styles.contextDot} />
            <Text style={styles.contextText}>Using your business context</Text>
          </View>

          {pickedForYou.length === 0 ? (
            <Card variant="elevated" style={styles.emptyBriefCard}>
              <Ionicons name="school-outline" size={40} color={Colors.text.muted} />
              <Text style={styles.emptyBriefTitle}>Your personalized learning resources will appear once Adam curates them</Text>
              <Text style={styles.emptyBriefText}>
                Adam is preparing {tenant?.industry ?? 'business'} education content based on your services and goals.
              </Text>
            </Card>
          ) : (
            <View style={styles.heroCardWrapper}>
              <LinearGradient
                colors={['rgba(79, 172, 254, 0.35)', 'rgba(79, 172, 254, 0.18)', 'rgba(79, 172, 254, 0.08)']}
                locations={[0, 0.5, 1]}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
                style={styles.heroCardInner}
              >
                <View style={styles.heroCardGlow} />
                <View style={styles.heroContent}>
                  <View style={styles.heroTextContent}>
                    <Text style={styles.heroTitle}>{pickedForYou[0]?.title ?? 'Learning resource'}</Text>
                    {pickedForYou[0]?.subtitle ? (
                      <Text style={styles.heroSubtitleText}>{pickedForYou[0].subtitle}</Text>
                    ) : null}
                  </View>
                  <View style={styles.heroImageWrapper}>
                    <View style={styles.heroImageGlow} />
                    <View style={styles.heroImageInner}>
                      <Ionicons name="document-text" size={32} color="#3B82F6" />
                    </View>
                  </View>
                </View>

                <View style={styles.heroFooter}>
                  <View style={styles.heroAttribution}>
                    <Text style={styles.heroForText}>
                      <Text style={styles.heroForLabel}>For your business: </Text>
                      {tenant?.industry
                        ? `Curated for your ${tenant.industry} business`
                        : 'Based on your business profile'}
                    </Text>
                  </View>

                  <View style={styles.heroActions}>
                    <View style={styles.preparedBadge}>
                      <Ionicons name="sparkles" size={12} color="#3B82F6" />
                      <Text style={styles.preparedBadgeText}>Prepared by Aspire</Text>
                    </View>
                    <TouchableOpacity style={styles.createButtonPremium} accessibilityLabel="Create checklist" accessibilityRole="button">
                      <Text style={styles.createButtonText}>Create checklist</Text>
                      <Ionicons name="pencil" size={14} color="#3B82F6" />
                    </TouchableOpacity>
                  </View>
                </View>
              </LinearGradient>
            </View>
          )}
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Learning Tracks</Text>

          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            style={styles.tracksScroll}
          >
            {learningTracks.map((track) => (
              <TouchableOpacity
                key={track.id}
                style={[
                  styles.trackChip,
                  activeTrack === track.id && styles.trackChipActive,
                  activeTrack === track.id && { borderColor: track.color }
                ]}
                onPress={() => setActiveTrack(track.id)}
                accessibilityLabel={`${track.name} learning track`}
                accessibilityRole="button"
              >
                <View style={[styles.trackChipIconOuter, { backgroundColor: `${track.color}15` }]}>
                  <View style={[styles.trackChipIconGlow, { borderColor: `${track.color}40` }]} />
                  <View style={[styles.trackChipIconInner, { backgroundColor: `${track.color}35` }]}>
                    <Ionicons name={track.icon as any} size={12} color={track.color} />
                  </View>
                </View>
                <Text style={[
                  styles.trackChipText,
                  activeTrack === track.id && styles.trackChipTextActive
                ]}>
                  {track.name}
                </Text>
              </TouchableOpacity>
            ))}
          </ScrollView>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Picked for you</Text>

          {pickedForYou.length === 0 ? (
            <Card variant="elevated" style={styles.emptyBriefCard}>
              <Ionicons name="book-outline" size={32} color={Colors.text.muted} />
              <Text style={styles.emptyBriefTitle}>Resources coming soon</Text>
              <Text style={styles.emptyBriefText}>
                Adam is curating learning content for your selected services.
              </Text>
            </Card>
          ) : (
            <Card variant="elevated" style={styles.lessonsCard}>
              {pickedForYou.slice(0, 5).map((lesson, index) => (
                <TouchableOpacity
                  key={lesson.id}
                  style={[
                    styles.lessonRow,
                    index < Math.min(pickedForYou.length, 5) - 1 && styles.lessonRowBorder
                  ]}
                  accessibilityLabel={lesson.title}
                  accessibilityRole="button"
                >
                  <View style={[styles.lessonIconOuter, { backgroundColor: `${lesson.color}15` }]}>
                    <View style={[styles.lessonIconGlow, { borderColor: `${lesson.color}40` }]} />
                    <View style={[styles.lessonIconInner, { backgroundColor: `${lesson.color}35` }]}>
                      <Ionicons name={lesson.icon as any} size={16} color={lesson.color} />
                    </View>
                  </View>
                  <View style={styles.lessonContent}>
                    <Text style={styles.lessonTitle}>{lesson.title}</Text>
                    <Text style={styles.lessonSubtitle}>{lesson.subtitle}</Text>
                  </View>
                  <Ionicons name="chevron-forward" size={18} color={Colors.text.muted} />
                </TouchableOpacity>
              ))}
            </Card>
          )}

          {pickedForYou.length > 5 && (
            <TouchableOpacity style={styles.viewMoreButton} accessibilityLabel="View more lessons" accessibilityRole="button">
              <Text style={styles.viewMoreText}>View more lessons</Text>
              <Ionicons name="chevron-forward" size={14} color={Colors.accent.cyan} />
            </TouchableOpacity>
          )}
        </View>

        {savedApplied.length > 0 && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Saved & Applied</Text>

            <Card variant="elevated" style={styles.savedCard}>
              {savedApplied.map((item, index) => (
                <TouchableOpacity
                  key={item.id}
                  style={[
                    styles.savedRow,
                    index < savedApplied.length - 1 && styles.savedRowBorder
                  ]}
                  accessibilityLabel={`${item.title} - ${item.type}`}
                  accessibilityRole="button"
                >
                  <View style={styles.savedIcon}>
                    <Ionicons
                      name={item.type === 'Applied' ? 'checkmark-circle' : 'bookmark'}
                      size={16}
                      color={item.type === 'Applied' ? '#34d399' : '#fbbf24'}
                    />
                  </View>
                  <View style={styles.savedContent}>
                    <Text style={styles.savedTitle}>{item.title}</Text>
                    <Text style={styles.savedMeta}>{item.type} - {item.date}</Text>
                  </View>
                  <TouchableOpacity style={styles.reviewButton} accessibilityLabel="Review" accessibilityRole="button">
                    <Text style={styles.reviewButtonText}>Review</Text>
                  </TouchableOpacity>
                </TouchableOpacity>
              ))}
            </Card>
          </View>
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: BRIGHT_BG,
  },
  headerGradient: {
    paddingBottom: Spacing.md,
  },
  customHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingTop: 50,
    paddingBottom: Spacing.md,
    paddingHorizontal: Spacing.md,
  },
  backButton: {
    width: 44,
    height: 44,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTextSection: {
    flex: 1,
    marginLeft: Spacing.xs,
  },
  headerTitle: {
    fontSize: Typography.headline.fontSize,
    fontWeight: '700',
    color: Colors.text.primary,
  },
  headerSubtitle: {
    fontSize: Typography.small.fontSize,
    color: Colors.text.tertiary,
    marginTop: 2,
  },
  headerActions: {
    flexDirection: 'row',
    gap: Spacing.xs,
  },
  headerActionButton: {
    width: 44,
    height: 44,
    alignItems: 'center',
    justifyContent: 'center',
  },
  scrollContent: {
    paddingTop: Spacing.lg,
    paddingBottom: 40,
    paddingHorizontal: Spacing.lg,
  },
  section: {
    marginBottom: Spacing.xl,
  },
  sectionTitle: {
    fontSize: Typography.title.fontSize,
    fontWeight: '700',
    color: Colors.text.primary,
    marginBottom: 4,
  },
  sectionSubtitle: {
    fontSize: Typography.body.fontSize,
    color: Colors.text.tertiary,
    marginBottom: Spacing.md,
  },
  contextBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.xs,
    marginBottom: Spacing.md,
  },
  contextDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#3B82F6',
  },
  contextText: {
    fontSize: Typography.small.fontSize,
    color: Colors.text.secondary,
  },
  heroCardWrapper: {
    borderRadius: BorderRadius.lg,
    borderWidth: 1,
    borderColor: 'rgba(79, 172, 254, 0.25)',
    overflow: 'hidden',
  },
  heroCardInner: {
    padding: Spacing.lg,
    position: 'relative',
    overflow: 'hidden',
  },
  heroCardGlow: {
    position: 'absolute',
    top: -60,
    right: -60,
    width: 180,
    height: 180,
    borderRadius: 90,
    backgroundColor: 'rgba(79, 172, 254, 0.15)',
  },
  heroImageWrapper: {
    width: 80,
    height: 80,
    borderRadius: BorderRadius.md,
    backgroundColor: 'rgba(79, 172, 254, 0.1)',
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
  },
  heroImageGlow: {
    position: 'absolute',
    width: 80,
    height: 80,
    borderRadius: BorderRadius.md,
    borderWidth: 1,
    borderColor: 'rgba(79, 172, 254, 0.35)',
  },
  heroImageInner: {
    width: 60,
    height: 60,
    borderRadius: BorderRadius.sm,
    backgroundColor: 'rgba(79, 172, 254, 0.25)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  heroContent: {
    flexDirection: 'row',
    gap: Spacing.md,
    marginBottom: Spacing.lg,
  },
  heroTextContent: {
    flex: 1,
  },
  heroTitle: {
    fontSize: Typography.headline.fontSize,
    fontWeight: '700',
    color: Colors.text.primary,
    marginBottom: Spacing.sm,
    lineHeight: 26,
  },
  heroSubtitleText: {
    fontSize: Typography.small.fontSize,
    color: Colors.text.secondary,
    lineHeight: 20,
  },
  heroFooter: {
    borderTopWidth: 1,
    borderTopColor: Colors.border.subtle,
    paddingTop: Spacing.md,
  },
  heroAttribution: {
    marginBottom: Spacing.md,
  },
  heroForText: {
    fontSize: Typography.small.fontSize,
    color: Colors.text.tertiary,
    lineHeight: 18,
  },
  heroForLabel: {
    fontWeight: '600',
    color: Colors.text.secondary,
  },
  heroActions: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  preparedBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  preparedBadgeText: {
    fontSize: Typography.micro.fontSize,
    color: Colors.text.muted,
  },
  createButtonPremium: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: 'rgba(79, 172, 254, 0.15)',
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    borderRadius: BorderRadius.full,
    borderWidth: 1,
    borderColor: 'rgba(79, 172, 254, 0.35)',
    minHeight: 44,
  },
  createButtonText: {
    fontSize: Typography.small.fontSize,
    fontWeight: '600',
    color: '#3B82F6',
  },
  tracksScroll: {
    marginHorizontal: -Spacing.lg,
    paddingHorizontal: Spacing.lg,
  },
  trackChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    borderRadius: BorderRadius.full,
    backgroundColor: '#1C1C1E',
    borderWidth: 1,
    borderColor: '#3C3C3E',
    marginRight: Spacing.sm,
    minHeight: 44,
  },
  trackChipActive: {
    backgroundColor: '#242426',
  },
  trackChipIconOuter: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: 'rgba(79, 172, 254, 0.1)',
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
  },
  trackChipIconGlow: {
    position: 'absolute',
    width: 24,
    height: 24,
    borderRadius: 12,
    borderWidth: 1,
  },
  trackChipIconInner: {
    width: 18,
    height: 18,
    borderRadius: 9,
    alignItems: 'center',
    justifyContent: 'center',
  },
  trackChipText: {
    fontSize: Typography.small.fontSize,
    fontWeight: '500',
    color: Colors.text.secondary,
  },
  trackChipTextActive: {
    color: Colors.text.primary,
    fontWeight: '600',
  },
  lessonsCard: {
    padding: 0,
    overflow: 'hidden',
  },
  lessonRow: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: Spacing.md,
    gap: Spacing.md,
    minHeight: 64,
  },
  lessonRowBorder: {
    borderBottomWidth: 1,
    borderBottomColor: Colors.border.subtle,
  },
  lessonIconOuter: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(79, 172, 254, 0.1)',
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
  },
  lessonIconGlow: {
    position: 'absolute',
    width: 40,
    height: 40,
    borderRadius: 20,
    borderWidth: 1,
  },
  lessonIconInner: {
    width: 28,
    height: 28,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  lessonContent: {
    flex: 1,
  },
  lessonTitle: {
    fontSize: Typography.body.fontSize,
    fontWeight: '600',
    color: Colors.text.primary,
    marginBottom: 2,
  },
  lessonSubtitle: {
    fontSize: Typography.small.fontSize,
    color: Colors.text.tertiary,
  },
  viewMoreButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-end',
    gap: 4,
    marginTop: Spacing.sm,
    minHeight: 44,
  },
  viewMoreText: {
    fontSize: Typography.small.fontSize,
    fontWeight: '600',
    color: Colors.accent.cyan,
  },
  savedCard: {
    padding: 0,
    overflow: 'hidden',
  },
  savedRow: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: Spacing.md,
    gap: Spacing.sm,
    minHeight: 56,
  },
  savedRowBorder: {
    borderBottomWidth: 1,
    borderBottomColor: Colors.border.subtle,
  },
  savedIcon: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: '#1C1C1E',
    alignItems: 'center',
    justifyContent: 'center',
  },
  savedContent: {
    flex: 1,
  },
  savedTitle: {
    fontSize: Typography.body.fontSize,
    fontWeight: '500',
    color: Colors.text.primary,
    marginBottom: 2,
  },
  savedMeta: {
    fontSize: Typography.micro.fontSize,
    color: Colors.text.muted,
  },
  reviewButton: {
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.xs,
    borderRadius: BorderRadius.sm,
    backgroundColor: '#1C1C1E',
    borderWidth: 1,
    borderColor: '#2C2C2E',
    minHeight: 44,
    justifyContent: 'center',
  },
  reviewButtonText: {
    fontSize: Typography.small.fontSize,
    fontWeight: '500',
    color: Colors.text.secondary,
  },
  // Empty states
  emptyBriefCard: {
    padding: Spacing.xxl,
    alignItems: 'center',
    gap: Spacing.sm,
  },
  emptyBriefTitle: {
    fontSize: Typography.body.fontSize,
    fontWeight: '600',
    color: Colors.text.primary,
    textAlign: 'center',
  },
  emptyBriefText: {
    fontSize: Typography.small.fontSize,
    color: Colors.text.tertiary,
    textAlign: 'center',
  },
  emptyStateContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 64,
    gap: 16,
  },
  emptyStateTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: Colors.text.secondary,
    textAlign: 'center',
  },
  emptyStateDesc: {
    fontSize: 14,
    color: Colors.text.muted,
    textAlign: 'center',
    maxWidth: 400,
    lineHeight: 20,
  },
  // Skeleton loading
  skeletonHeaderTitle: {
    width: 140,
    height: 24,
    borderRadius: 6,
    backgroundColor: 'rgba(255,255,255,0.06)',
    marginBottom: 4,
  },
  skeletonHeaderSubtitle: {
    width: 200,
    height: 14,
    borderRadius: 4,
    backgroundColor: 'rgba(255,255,255,0.04)',
  },
  skeletonHeroCard: {
    width: '100%',
    height: 200,
    borderRadius: BorderRadius.lg,
    backgroundColor: 'rgba(255,255,255,0.04)',
    marginBottom: Spacing.xl,
  },
  skeletonChipsRow: {
    flexDirection: 'row',
    gap: Spacing.sm,
    marginBottom: Spacing.xl,
  },
  skeletonChip: {
    width: 100,
    height: 36,
    borderRadius: BorderRadius.full,
    backgroundColor: 'rgba(255,255,255,0.04)',
  },
  skeletonLessons: {
    gap: Spacing.sm,
  },
  skeletonLessonRow: {
    width: '100%',
    height: 64,
    borderRadius: BorderRadius.md,
    backgroundColor: 'rgba(255,255,255,0.04)',
  },
});
