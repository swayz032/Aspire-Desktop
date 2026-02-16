import React, { useState } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity } from 'react-native';
import { Colors, Spacing, Typography, BorderRadius } from '@/constants/tokens';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { Card } from '@/components/ui/Card';
import { useRouter } from 'expo-router';
import { Image } from 'expo-image';

const BRIGHT_BG = '#0a0a0c';

const mockLearningTracks = [
  { id: 'money', name: 'Money', icon: 'cash', color: '#34d399' },
  { id: 'sales', name: 'Sales & Marketing', icon: 'megaphone', color: '#f472b6' },
  { id: 'operations', name: 'Operations', icon: 'construct', color: '#a78bfa' },
  { id: 'growth', name: 'Growth', icon: 'rocket', color: '#fbbf24' },
];

const mockPickedForYou = [
  { id: '1', title: 'Reserves vs Burn', subtitle: 'Clear rules on cash cushion', icon: 'cash', color: '#34d399' },
  { id: '2', title: 'Getting Paid Faster', subtitle: 'Reduce AR delay', icon: 'wallet', color: '#3B82F6' },
  { id: '3', title: 'Forecast Cash Flow', subtitle: 'Easy way to see cash needs', icon: 'analytics', color: '#fbbf24' },
];

const mockSavedApplied = [
  { id: '1', title: 'Quarterly Review Checklist', type: 'Applied', date: 'Jan 15' },
  { id: '2', title: 'Invoice Template', type: 'Saved', date: 'Jan 12' },
];

export default function EducationScreen() {
  const router = useRouter();
  const [activeTrack, setActiveTrack] = useState('money');

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
          >
            <Ionicons name="chevron-back" size={24} color={Colors.text.primary} />
          </TouchableOpacity>
          <View style={styles.headerTextSection}>
            <Text style={styles.headerTitle}>Education</Text>
            <Text style={styles.headerSubtitle}>Learn and grow your business</Text>
          </View>
          <View style={styles.headerActions}>
            <TouchableOpacity style={styles.headerActionButton}>
              <Ionicons name="bookmark-outline" size={22} color={Colors.text.secondary} />
            </TouchableOpacity>
            <TouchableOpacity style={styles.headerActionButton}>
              <Ionicons name="ellipsis-vertical" size={22} color={Colors.text.secondary} />
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
          <Text style={styles.sectionSubtitle}>Briefings tailored to your business.</Text>
          
          <View style={styles.contextBadge}>
            <View style={styles.contextDot} />
            <Text style={styles.contextText}>Using your business context</Text>
          </View>

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
                  <Text style={styles.heroTitle}>Get paid faster without awkward follow-ups</Text>
                  <View style={styles.heroBullets}>
                    <View style={styles.bulletRow}>
                      <View style={styles.bulletDot} />
                      <Text style={styles.bulletText}>Prompt responses cut late payments sharply</Text>
                    </View>
                    <View style={styles.bulletRow}>
                      <View style={styles.bulletDot} />
                      <Text style={styles.bulletText}>A gentle 2-step cadence gets invoices paid quicker</Text>
                    </View>
                    <View style={styles.bulletRow}>
                      <View style={styles.bulletDot} />
                      <Text style={styles.bulletText}>Consistent invoicing wins repeat customers</Text>
                    </View>
                  </View>
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
                    <Text style={styles.heroForLabel}>For your business:</Text>
                    This can improve your AR based on last 30 days
                  </Text>
                </View>
                
                <View style={styles.heroActions}>
                  <View style={styles.preparedBadge}>
                    <Ionicons name="sparkles" size={12} color="#3B82F6" />
                    <Text style={styles.preparedBadgeText}>Prepared by Aspire</Text>
                  </View>
                  <TouchableOpacity style={styles.createButtonPremium}>
                    <Text style={styles.createButtonText}>Create checklist</Text>
                    <Ionicons name="pencil" size={14} color="#3B82F6" />
                  </TouchableOpacity>
                </View>
              </View>
            </LinearGradient>
          </View>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Learning Tracks</Text>
          
          <ScrollView 
            horizontal 
            showsHorizontalScrollIndicator={false}
            style={styles.tracksScroll}
          >
            {mockLearningTracks.map((track) => (
              <TouchableOpacity 
                key={track.id}
                style={[
                  styles.trackChip,
                  activeTrack === track.id && styles.trackChipActive,
                  activeTrack === track.id && { borderColor: track.color }
                ]}
                onPress={() => setActiveTrack(track.id)}
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
          
          <Card variant="elevated" style={styles.lessonsCard}>
            {mockPickedForYou.map((lesson, index) => (
              <TouchableOpacity 
                key={lesson.id} 
                style={[
                  styles.lessonRow,
                  index < mockPickedForYou.length - 1 && styles.lessonRowBorder
                ]}
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
          
          <TouchableOpacity style={styles.viewMoreButton}>
            <Text style={styles.viewMoreText}>View more lessons</Text>
            <Ionicons name="chevron-forward" size={14} color={Colors.accent.cyan} />
          </TouchableOpacity>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Saved & Applied</Text>
          
          <Card variant="elevated" style={styles.savedCard}>
            {mockSavedApplied.map((item, index) => (
              <TouchableOpacity 
                key={item.id}
                style={[
                  styles.savedRow,
                  index < mockSavedApplied.length - 1 && styles.savedRowBorder
                ]}
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
                  <Text style={styles.savedMeta}>{item.type} • {item.date}</Text>
                </View>
                <TouchableOpacity style={styles.reviewButton}>
                  <Text style={styles.reviewButtonText}>Review</Text>
                </TouchableOpacity>
              </TouchableOpacity>
            ))}
          </Card>
        </View>

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
    width: 40,
    height: 40,
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
    width: 36,
    height: 36,
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
  heroGradient: {
    padding: Spacing.lg,
  },
  heroContent: {
    flexDirection: 'row',
    gap: Spacing.md,
    marginBottom: Spacing.lg,
  },
  heroTextSection: {
    flex: 1,
  },
  heroTextContent: {
    flex: 1,
  },
  heroTitle: {
    fontSize: Typography.headline.fontSize,
    fontWeight: '700',
    color: Colors.text.primary,
    marginBottom: Spacing.md,
    lineHeight: 26,
  },
  heroBullets: {
    gap: Spacing.sm,
  },
  bulletRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: Spacing.sm,
  },
  bulletDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: Colors.text.muted,
    marginTop: 6,
  },
  bulletText: {
    flex: 1,
    fontSize: Typography.small.fontSize,
    color: Colors.text.secondary,
    lineHeight: 20,
  },
  heroImagePlaceholder: {
    width: 80,
    height: 80,
    borderRadius: BorderRadius.md,
    backgroundColor: 'rgba(79, 172, 254, 0.1)',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: 'rgba(79, 172, 254, 0.2)',
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
  createButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: 'rgba(79, 172, 254, 0.25)',
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    borderRadius: BorderRadius.md,
    borderWidth: 1,
    borderColor: 'rgba(79, 172, 254, 0.45)',
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
  },
  trackChipActive: {
    backgroundColor: '#242426',
  },
  trackChipIcon: {
    width: 24,
    height: 24,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
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
  },
  lessonRowBorder: {
    borderBottomWidth: 1,
    borderBottomColor: Colors.border.subtle,
  },
  lessonIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
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
  },
  reviewButtonText: {
    fontSize: Typography.small.fontSize,
    fontWeight: '500',
    color: Colors.text.secondary,
  },
});
