import React, { useState } from 'react';
import { View, Text, StyleSheet, Pressable, Image } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { HubPageShell } from '@/components/founder-hub/HubPageShell';
import { masterminds } from '@/data/founderHub/palletMock';

const THEME = {
  bg: '#000000',
  surface: '#0a0a0a',
  surfaceHover: '#111111',
  border: 'rgba(255,255,255,0.06)',
  accent: '#3B82F6',
  accentMuted: 'rgba(59, 130, 246, 0.12)',
  text: {
    primary: '#ffffff',
    secondary: 'rgba(255,255,255,0.70)',
    muted: 'rgba(255,255,255,0.45)',
  },
};

const upcomingSessions = [
  {
    id: '1',
    title: 'Pallet Founder Mastermind — Weekly Ops & Sales',
    date: '2026-01-24',
    time: '10:00 AM EST',
    attendees: 8,
    host: 'Mike Chen',
  },
  {
    id: '2',
    title: 'Q1 Growth Strategies Workshop',
    date: '2026-01-28',
    time: '2:00 PM EST',
    attendees: 12,
    host: 'Sarah Williams',
  },
];

const pastSessions = [
  {
    id: '1',
    title: 'Weekly Ops & Sales Mastermind',
    date: '2026-01-17',
    recording: true,
    notes: true,
  },
  {
    id: '2',
    title: 'Pricing Deep Dive',
    date: '2026-01-10',
    recording: true,
    notes: true,
  },
  {
    id: '3',
    title: 'Customer Retention Strategies',
    date: '2026-01-03',
    recording: false,
    notes: true,
  },
];

const myCommitments = [
  { id: '1', text: 'Follow up with 3 cold leads this week', status: 'in_progress', due: 'Jan 24' },
  { id: '2', text: 'Review Grade B pricing vs competitors', status: 'completed', due: 'Jan 22' },
  { id: '3', text: 'Document repair process for new hire training', status: 'pending', due: 'Jan 28' },
];

const prepPrompts = [
  "What's your biggest win since last session?",
  "What's one challenge you're facing right now?",
  "What do you need help with from the group?",
];

export default function MastermindsScreen() {
  const [hoveredItem, setHoveredItem] = useState<string | null>(null);

  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr);
    return date.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });
  };

  const formatShortDate = (dateStr: string) => {
    const date = new Date(dateStr);
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'completed': return '#34d399';
      case 'in_progress': return '#fbbf24';
      default: return THEME.text.muted;
    }
  };

  const rightRail = (
    <View style={styles.railContent}>
      <Text style={styles.railTitle}>My Commitments</Text>
      <View style={styles.commitmentsList}>
        {myCommitments.map((item) => (
          <View key={item.id} style={styles.commitmentItem}>
            <View style={[styles.commitmentDot, { backgroundColor: getStatusColor(item.status) }]} />
            <View style={styles.commitmentContent}>
              <Text style={styles.commitmentText}>{item.text}</Text>
              <Text style={styles.commitmentDue}>Due: {item.due}</Text>
            </View>
          </View>
        ))}
      </View>

      <View style={styles.railDivider} />

      <Text style={styles.railTitle}>Session Prep</Text>
      <View style={styles.prepList}>
        {prepPrompts.map((prompt, idx) => (
          <Pressable
            key={idx}
            style={[styles.prepItem, hoveredItem === `prep-${idx}` && styles.prepItemHover]}
            onHoverIn={() => setHoveredItem(`prep-${idx}`)}
            onHoverOut={() => setHoveredItem(null)}
          >
            <View style={styles.prepNumber}>
              <Text style={styles.prepNumberText}>{idx + 1}</Text>
            </View>
            <Text style={styles.prepText}>{prompt}</Text>
          </Pressable>
        ))}
      </View>

      <Pressable
        style={[styles.prepBtn, hoveredItem === 'prep-btn' && styles.prepBtnHover]}
        onHoverIn={() => setHoveredItem('prep-btn')}
        onHoverOut={() => setHoveredItem(null)}
      >
        <Ionicons name="mic-outline" size={16} color="#FFFFFF" />
        <Text style={styles.prepBtnText}>Prep with Ava</Text>
      </Pressable>
    </View>
  );

  return (
    <HubPageShell rightRail={rightRail}>
      <View style={styles.header}>
        <Text style={styles.pageTitle}>Masterminds</Text>
        <Text style={styles.pageSubtitle}>Peer sessions for growth and accountability</Text>
      </View>

      <View style={styles.nextSessionCard}>
        <LinearGradient
          colors={['#0c2d4d', '#0a1f35', '#061525']}
          style={styles.nextSessionGradient}
        >
          <View style={styles.nextSessionBadge}>
            <Ionicons name="calendar" size={14} color={THEME.accent} />
            <Text style={styles.nextSessionBadgeText}>Next Session</Text>
          </View>
          <Text style={styles.nextSessionTitle}>{upcomingSessions[0].title}</Text>
          <View style={styles.nextSessionMeta}>
            <View style={styles.nextSessionMetaItem}>
              <Ionicons name="time-outline" size={16} color={THEME.text.muted} />
              <Text style={styles.nextSessionMetaText}>
                {formatDate(upcomingSessions[0].date)} at {upcomingSessions[0].time}
              </Text>
            </View>
            <View style={styles.nextSessionMetaItem}>
              <Ionicons name="people-outline" size={16} color={THEME.text.muted} />
              <Text style={styles.nextSessionMetaText}>
                {upcomingSessions[0].attendees} attendees
              </Text>
            </View>
            <View style={styles.nextSessionMetaItem}>
              <Ionicons name="person-outline" size={16} color={THEME.text.muted} />
              <Text style={styles.nextSessionMetaText}>
                Host: {upcomingSessions[0].host}
              </Text>
            </View>
          </View>
          <View style={styles.nextSessionActions}>
            <Pressable
              style={[styles.primaryBtn, hoveredItem === 'join' && styles.primaryBtnHover]}
              onHoverIn={() => setHoveredItem('join')}
              onHoverOut={() => setHoveredItem(null)}
            >
              <Ionicons name="videocam-outline" size={16} color="#FFFFFF" />
              <Text style={styles.primaryBtnText}>Join Session</Text>
            </Pressable>
            <Pressable
              style={[styles.secondaryBtn, hoveredItem === 'agenda' && styles.secondaryBtnHover]}
              onHoverIn={() => setHoveredItem('agenda')}
              onHoverOut={() => setHoveredItem(null)}
            >
              <Text style={styles.secondaryBtnText}>View Agenda</Text>
            </Pressable>
          </View>
        </LinearGradient>
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Upcoming Sessions</Text>
        <View style={styles.sessionsList}>
          {upcomingSessions.slice(1).map((session) => (
            <Pressable
              key={session.id}
              style={[
                styles.sessionCard,
                hoveredItem === `session-${session.id}` && styles.sessionCardHover,
              ]}
              onHoverIn={() => setHoveredItem(`session-${session.id}`)}
              onHoverOut={() => setHoveredItem(null)}
            >
              <View style={styles.sessionDate}>
                <Text style={styles.sessionDateText}>{formatShortDate(session.date)}</Text>
              </View>
              <View style={styles.sessionContent}>
                <Text style={styles.sessionTitle}>{session.title}</Text>
                <View style={styles.sessionMeta}>
                  <Text style={styles.sessionMetaText}>{session.time}</Text>
                  <Text style={styles.sessionDot}>•</Text>
                  <Text style={styles.sessionMetaText}>{session.attendees} attendees</Text>
                </View>
              </View>
              <Ionicons name="chevron-forward" size={18} color={THEME.text.muted} />
            </Pressable>
          ))}
        </View>
      </View>

      <View style={styles.section}>
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>Past Sessions</Text>
          <Pressable>
            <Text style={styles.seeAllLink}>View all</Text>
          </Pressable>
        </View>
        <View style={styles.pastSessionsList}>
          {pastSessions.map((session) => (
            <Pressable
              key={session.id}
              style={[
                styles.pastSessionCard,
                hoveredItem === `past-${session.id}` && styles.pastSessionCardHover,
              ]}
              onHoverIn={() => setHoveredItem(`past-${session.id}`)}
              onHoverOut={() => setHoveredItem(null)}
            >
              <View style={styles.pastSessionMain}>
                <Text style={styles.pastSessionTitle}>{session.title}</Text>
                <Text style={styles.pastSessionDate}>{formatShortDate(session.date)}</Text>
              </View>
              <View style={styles.pastSessionActions}>
                {session.recording && (
                  <Pressable style={styles.pastSessionBtn}>
                    <Ionicons name="play-circle-outline" size={18} color={THEME.accent} />
                    <Text style={styles.pastSessionBtnText}>Recording</Text>
                  </Pressable>
                )}
                {session.notes && (
                  <Pressable style={styles.pastSessionBtn}>
                    <Ionicons name="document-text-outline" size={18} color={THEME.accent} />
                    <Text style={styles.pastSessionBtnText}>Notes</Text>
                  </Pressable>
                )}
              </View>
            </Pressable>
          ))}
        </View>
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Mastermind Benefits</Text>
        <View style={styles.benefitsGrid}>
          <View style={styles.benefitCard}>
            <Ionicons name="people" size={24} color={THEME.accent} />
            <Text style={styles.benefitTitle}>Peer Learning</Text>
            <Text style={styles.benefitDesc}>Learn from other founders facing similar challenges</Text>
          </View>
          <View style={styles.benefitCard}>
            <Ionicons name="checkmark-circle" size={24} color={THEME.accent} />
            <Text style={styles.benefitTitle}>Accountability</Text>
            <Text style={styles.benefitDesc}>Stay on track with weekly check-ins and commitments</Text>
          </View>
          <View style={styles.benefitCard}>
            <Ionicons name="bulb" size={24} color={THEME.accent} />
            <Text style={styles.benefitTitle}>Fresh Perspectives</Text>
            <Text style={styles.benefitDesc}>Get outside viewpoints on your business challenges</Text>
          </View>
        </View>
      </View>
    </HubPageShell>
  );
}

const styles = StyleSheet.create({
  header: {
    marginBottom: 24,
  },
  pageTitle: {
    fontSize: 28,
    fontWeight: '700',
    color: THEME.text.primary,
    marginBottom: 8,
  },
  pageSubtitle: {
    fontSize: 15,
    color: THEME.text.muted,
  },
  nextSessionCard: {
    marginBottom: 32,
    borderRadius: 16,
    overflow: 'hidden',
  },
  nextSessionGradient: {
    padding: 28,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: 'rgba(59, 130, 246, 0.2)',
    gap: 16,
  },
  nextSessionBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: 'rgba(59, 130, 246, 0.15)',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
    alignSelf: 'flex-start',
  },
  nextSessionBadgeText: {
    fontSize: 12,
    fontWeight: '600',
    color: THEME.accent,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  nextSessionTitle: {
    fontSize: 22,
    fontWeight: '700',
    color: THEME.text.primary,
    lineHeight: 28,
  },
  nextSessionMeta: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 20,
  },
  nextSessionMetaItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  nextSessionMetaText: {
    fontSize: 14,
    color: THEME.text.secondary,
  },
  nextSessionActions: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 8,
  },
  primaryBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: THEME.accent,
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 8,
  },
  primaryBtnHover: {
    opacity: 0.9,
    transform: [{ scale: 1.02 }],
  },
  primaryBtnText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  secondaryBtn: {
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: 'rgba(59, 130, 246, 0.3)',
  },
  secondaryBtnHover: {
    backgroundColor: 'rgba(59, 130, 246, 0.1)',
  },
  secondaryBtnText: {
    fontSize: 14,
    fontWeight: '500',
    color: THEME.accent,
  },
  section: {
    marginBottom: 32,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 16,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: THEME.text.primary,
    marginBottom: 16,
  },
  seeAllLink: {
    fontSize: 13,
    color: THEME.accent,
    fontWeight: '500',
  },
  sessionsList: {
    gap: 12,
  },
  sessionCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
    backgroundColor: THEME.surface,
    borderRadius: 12,
    padding: 16,
    borderWidth: 1,
    borderColor: THEME.border,
  },
  sessionCardHover: {
    backgroundColor: THEME.surfaceHover,
    borderColor: 'rgba(255,255,255,0.1)',
  },
  sessionDate: {
    backgroundColor: THEME.accentMuted,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
  },
  sessionDateText: {
    fontSize: 12,
    fontWeight: '600',
    color: THEME.accent,
  },
  sessionContent: {
    flex: 1,
    gap: 4,
  },
  sessionTitle: {
    fontSize: 15,
    fontWeight: '600',
    color: THEME.text.primary,
  },
  sessionMeta: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  sessionMetaText: {
    fontSize: 13,
    color: THEME.text.muted,
  },
  sessionDot: {
    fontSize: 13,
    color: THEME.text.muted,
  },
  pastSessionsList: {
    gap: 10,
  },
  pastSessionCard: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: THEME.surface,
    borderRadius: 12,
    padding: 16,
    borderWidth: 1,
    borderColor: THEME.border,
  },
  pastSessionCardHover: {
    backgroundColor: THEME.surfaceHover,
  },
  pastSessionMain: {
    gap: 4,
  },
  pastSessionTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: THEME.text.primary,
  },
  pastSessionDate: {
    fontSize: 12,
    color: THEME.text.muted,
  },
  pastSessionActions: {
    flexDirection: 'row',
    gap: 12,
  },
  pastSessionBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  pastSessionBtnText: {
    fontSize: 12,
    color: THEME.accent,
    fontWeight: '500',
  },
  benefitsGrid: {
    flexDirection: 'row',
    gap: 16,
  },
  benefitCard: {
    flex: 1,
    backgroundColor: THEME.surface,
    borderRadius: 12,
    padding: 20,
    borderWidth: 1,
    borderColor: THEME.border,
    gap: 12,
  },
  benefitTitle: {
    fontSize: 15,
    fontWeight: '600',
    color: THEME.text.primary,
  },
  benefitDesc: {
    fontSize: 13,
    color: THEME.text.muted,
    lineHeight: 18,
  },
  railContent: {
    gap: 24,
  },
  railTitle: {
    fontSize: 12,
    fontWeight: '600',
    color: THEME.text.muted,
    textTransform: 'uppercase',
    letterSpacing: 1,
  },
  commitmentsList: {
    gap: 12,
  },
  commitmentItem: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
  },
  commitmentDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    marginTop: 6,
  },
  commitmentContent: {
    flex: 1,
  },
  commitmentText: {
    fontSize: 13,
    color: THEME.text.secondary,
    lineHeight: 18,
  },
  commitmentDue: {
    fontSize: 11,
    color: THEME.text.muted,
    marginTop: 4,
  },
  railDivider: {
    height: 1,
    backgroundColor: THEME.border,
  },
  prepList: {
    gap: 8,
  },
  prepItem: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
    padding: 10,
    borderRadius: 8,
    backgroundColor: THEME.surface,
  },
  prepItemHover: {
    backgroundColor: THEME.surfaceHover,
  },
  prepNumber: {
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: THEME.accentMuted,
    alignItems: 'center',
    justifyContent: 'center',
  },
  prepNumberText: {
    fontSize: 11,
    fontWeight: '600',
    color: THEME.accent,
  },
  prepText: {
    flex: 1,
    fontSize: 12,
    color: THEME.text.secondary,
    lineHeight: 16,
  },
  prepBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: THEME.accent,
    paddingVertical: 12,
    borderRadius: 8,
  },
  prepBtnHover: {
    opacity: 0.9,
  },
  prepBtnText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#FFFFFF',
  },
});
