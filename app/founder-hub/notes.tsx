import React, { useState } from 'react';
import { View, Text, StyleSheet, Pressable, ScrollView } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { HubPageShell } from '@/components/founder-hub/HubPageShell';

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

const journalEntries = [
  {
    id: '1',
    date: '2026-01-22',
    time: '9:15 AM',
    title: 'Morning reflection on Q1 goals',
    preview: 'Discussed with Ava about focusing on Grade B expansion. She helped me see that our repair margins are actually our strongest differentiator...',
    duration: '12 min',
    tags: ['Strategy', 'Goals'],
  },
  {
    id: '2',
    date: '2026-01-21',
    time: '4:30 PM',
    title: 'ABC Logistics follow-up strategy',
    preview: 'Ava suggested a softer approach for the overdue payment. Instead of a formal collections notice, she recommended a check-in call mentioning their upcoming order...',
    duration: '8 min',
    tags: ['Sales', 'Collections'],
  },
  {
    id: '3',
    date: '2026-01-20',
    time: '10:00 AM',
    title: 'Competitor pricing analysis',
    preview: 'Brainstormed with Ava about the 8% price drop from competitors on Grade B. She pointed out that our quality documentation and faster turnaround justify premium pricing...',
    duration: '15 min',
    tags: ['Pricing', 'Competition'],
  },
  {
    id: '4',
    date: '2026-01-19',
    time: '2:45 PM',
    title: 'New warehouse prospect ideas',
    preview: 'Ava helped me identify 5 warehouses within 25 miles that might need pallet services. She drafted personalized outreach messages for each based on their industry...',
    duration: '20 min',
    tags: ['Sales', 'Outreach'],
  },
];

const todayPrompts = [
  "What's the one thing you want to accomplish this week?",
  "What customer interaction stood out yesterday?",
  "What's a risk you should be thinking about?",
];

const monthlyStats = {
  totalEntries: 24,
  totalMinutes: 186,
  topTags: ['Strategy', 'Sales', 'Operations'],
  streak: 12,
};

export default function NotesScreen() {
  const [hoveredItem, setHoveredItem] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState('all');

  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr);
    const today = new Date();
    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);

    if (date.toDateString() === today.toDateString()) return 'Today';
    if (date.toDateString() === yesterday.toDateString()) return 'Yesterday';
    return date.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });
  };

  const rightRail = (
    <View style={styles.railContent}>
      <View style={styles.statsCard}>
        <Text style={styles.statsTitle}>This Month</Text>
        <View style={styles.statsGrid}>
          <View style={styles.statItem}>
            <Text style={styles.statValue}>{monthlyStats.totalEntries}</Text>
            <Text style={styles.statLabel}>Entries</Text>
          </View>
          <View style={styles.statItem}>
            <Text style={styles.statValue}>{monthlyStats.totalMinutes}</Text>
            <Text style={styles.statLabel}>Minutes</Text>
          </View>
          <View style={styles.statItem}>
            <Text style={styles.statValue}>{monthlyStats.streak}</Text>
            <Text style={styles.statLabel}>Day Streak</Text>
          </View>
        </View>
      </View>

      <Text style={styles.railTitle}>Top Topics</Text>
      <View style={styles.tagsList}>
        {monthlyStats.topTags.map((tag, idx) => (
          <View key={idx} style={styles.tagItem}>
            <Text style={styles.tagText}>{tag}</Text>
          </View>
        ))}
      </View>

      <View style={styles.railDivider} />

      <Text style={styles.railTitle}>Journal Calendar</Text>
      <View style={styles.calendarPreview}>
        <Text style={styles.calendarMonth}>January 2026</Text>
        <View style={styles.calendarDays}>
          {[...Array(31)].map((_, idx) => (
            <View
              key={idx}
              style={[
                styles.calendarDay,
                (idx < 22) && styles.calendarDayActive,
              ]}
            >
              <Text style={[
                styles.calendarDayText,
                (idx < 22) && styles.calendarDayTextActive,
              ]}>
                {idx + 1}
              </Text>
            </View>
          ))}
        </View>
      </View>
    </View>
  );

  return (
    <HubPageShell rightRail={rightRail}>
      <View style={styles.header}>
        <Text style={styles.pageTitle}>Notes & Journal</Text>
        <Text style={styles.pageSubtitle}>Your business diary powered by Ava</Text>
      </View>

      <View style={styles.voiceSection}>
        <LinearGradient
          colors={['#0c2d4d', '#0a1f35', '#061525']}
          style={styles.voiceGradient}
        >
          <View style={styles.voiceContent}>
            <View style={styles.voiceLeft}>
              <View style={styles.voiceIcon}>
                <Ionicons name="mic" size={28} color={THEME.accent} />
              </View>
              <View style={styles.voiceText}>
                <Text style={styles.voiceTitle}>Voice to Note</Text>
                <Text style={styles.voiceSubtitle}>
                  Just talk to Ava. She'll capture your thoughts, organize them, and create 
                  searchable journal entries automatically.
                </Text>
              </View>
            </View>
            <Pressable
              style={[styles.voiceBtn, hoveredItem === 'voice' && styles.voiceBtnHover]}
              onHoverIn={() => setHoveredItem('voice')}
              onHoverOut={() => setHoveredItem(null)}
            >
              <Ionicons name="mic-outline" size={18} color="#FFFFFF" />
              <Text style={styles.voiceBtnText}>Start Recording</Text>
            </Pressable>
          </View>

          <View style={styles.promptsSection}>
            <Text style={styles.promptsTitle}>Today's Prompts</Text>
            <View style={styles.promptsList}>
              {todayPrompts.map((prompt, idx) => (
                <Pressable
                  key={idx}
                  style={[
                    styles.promptItem,
                    hoveredItem === `prompt-${idx}` && styles.promptItemHover,
                  ]}
                  onHoverIn={() => setHoveredItem(`prompt-${idx}`)}
                  onHoverOut={() => setHoveredItem(null)}
                >
                  <View style={styles.promptNumber}>
                    <Text style={styles.promptNumberText}>{idx + 1}</Text>
                  </View>
                  <Text style={styles.promptText}>{prompt}</Text>
                  <Ionicons name="arrow-forward" size={14} color={THEME.text.muted} />
                </Pressable>
              ))}
            </View>
          </View>
        </LinearGradient>
      </View>

      <View style={styles.section}>
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>Journal Entries</Text>
          <View style={styles.tabsRow}>
            <Pressable
              style={[styles.tab, activeTab === 'all' && styles.tabActive]}
              onPress={() => setActiveTab('all')}
            >
              <Text style={[styles.tabText, activeTab === 'all' && styles.tabTextActive]}>All</Text>
            </Pressable>
            <Pressable
              style={[styles.tab, activeTab === 'starred' && styles.tabActive]}
              onPress={() => setActiveTab('starred')}
            >
              <Ionicons
                name={activeTab === 'starred' ? 'star' : 'star-outline'}
                size={14}
                color={activeTab === 'starred' ? '#000' : THEME.text.muted}
              />
              <Text style={[styles.tabText, activeTab === 'starred' && styles.tabTextActive]}>Starred</Text>
            </Pressable>
          </View>
        </View>

        <View style={styles.entriesList}>
          {journalEntries.map((entry) => (
            <Pressable
              key={entry.id}
              style={[
                styles.entryCard,
                hoveredItem === `entry-${entry.id}` && styles.entryCardHover,
              ]}
              onHoverIn={() => setHoveredItem(`entry-${entry.id}`)}
              onHoverOut={() => setHoveredItem(null)}
            >
              <View style={styles.entryHeader}>
                <View style={styles.entryMeta}>
                  <Text style={styles.entryDate}>{formatDate(entry.date)}</Text>
                  <Text style={styles.entryDot}>•</Text>
                  <Text style={styles.entryTime}>{entry.time}</Text>
                  <Text style={styles.entryDot}>•</Text>
                  <Text style={styles.entryDuration}>{entry.duration}</Text>
                </View>
                <Pressable style={styles.entryAction}>
                  <Ionicons name="star-outline" size={16} color={THEME.text.muted} />
                </Pressable>
              </View>
              <Text style={styles.entryTitle}>{entry.title}</Text>
              <Text style={styles.entryPreview} numberOfLines={2}>{entry.preview}</Text>
              <View style={styles.entryTags}>
                {entry.tags.map((tag, idx) => (
                  <View key={idx} style={styles.entryTag}>
                    <Text style={styles.entryTagText}>{tag}</Text>
                  </View>
                ))}
              </View>
            </Pressable>
          ))}
        </View>

        <Pressable
          style={[styles.loadMoreBtn, hoveredItem === 'load' && styles.loadMoreBtnHover]}
          onHoverIn={() => setHoveredItem('load')}
          onHoverOut={() => setHoveredItem(null)}
        >
          <Text style={styles.loadMoreText}>View all entries</Text>
          <Ionicons name="chevron-down" size={16} color={THEME.accent} />
        </Pressable>
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
  voiceSection: {
    marginBottom: 32,
    borderRadius: 16,
    overflow: 'hidden',
  },
  voiceGradient: {
    padding: 24,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: 'rgba(59, 130, 246, 0.2)',
  },
  voiceContent: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 24,
  },
  voiceLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
    flex: 1,
  },
  voiceIcon: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: 'rgba(59, 130, 246, 0.15)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  voiceText: {
    flex: 1,
  },
  voiceTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: THEME.text.primary,
    marginBottom: 4,
  },
  voiceSubtitle: {
    fontSize: 13,
    color: THEME.text.secondary,
    lineHeight: 18,
  },
  voiceBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: THEME.accent,
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 10,
  },
  voiceBtnHover: {
    opacity: 0.9,
    transform: [{ scale: 1.02 }],
  },
  voiceBtnText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  promptsSection: {
    borderTopWidth: 1,
    borderTopColor: 'rgba(255,255,255,0.08)',
    paddingTop: 20,
  },
  promptsTitle: {
    fontSize: 12,
    fontWeight: '600',
    color: THEME.text.muted,
    textTransform: 'uppercase',
    letterSpacing: 1,
    marginBottom: 12,
  },
  promptsList: {
    gap: 8,
  },
  promptItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    padding: 12,
    borderRadius: 10,
    backgroundColor: 'rgba(255,255,255,0.04)',
  },
  promptItemHover: {
    backgroundColor: 'rgba(255,255,255,0.08)',
  },
  promptNumber: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: THEME.accentMuted,
    alignItems: 'center',
    justifyContent: 'center',
  },
  promptNumberText: {
    fontSize: 12,
    fontWeight: '600',
    color: THEME.accent,
  },
  promptText: {
    flex: 1,
    fontSize: 14,
    color: THEME.text.secondary,
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
  },
  tabsRow: {
    flexDirection: 'row',
    gap: 8,
  },
  tab: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 8,
    backgroundColor: THEME.surface,
    borderWidth: 1,
    borderColor: THEME.border,
  },
  tabActive: {
    backgroundColor: THEME.accent,
    borderColor: THEME.accent,
  },
  tabText: {
    fontSize: 13,
    color: THEME.text.muted,
    fontWeight: '500',
  },
  tabTextActive: {
    color: '#FFFFFF',
    fontWeight: '600',
  },
  entriesList: {
    gap: 12,
  },
  entryCard: {
    backgroundColor: THEME.surface,
    borderRadius: 12,
    padding: 18,
    borderWidth: 1,
    borderColor: THEME.border,
    gap: 10,
  },
  entryCardHover: {
    backgroundColor: THEME.surfaceHover,
    borderColor: 'rgba(255,255,255,0.1)',
  },
  entryHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  entryMeta: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  entryDate: {
    fontSize: 12,
    fontWeight: '600',
    color: THEME.accent,
  },
  entryDot: {
    fontSize: 12,
    color: THEME.text.muted,
  },
  entryTime: {
    fontSize: 12,
    color: THEME.text.muted,
  },
  entryDuration: {
    fontSize: 12,
    color: THEME.text.muted,
  },
  entryAction: {
    padding: 4,
  },
  entryTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: THEME.text.primary,
  },
  entryPreview: {
    fontSize: 14,
    color: THEME.text.muted,
    lineHeight: 20,
  },
  entryTags: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 4,
  },
  entryTag: {
    backgroundColor: THEME.accentMuted,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 4,
  },
  entryTagText: {
    fontSize: 11,
    fontWeight: '600',
    color: THEME.accent,
  },
  loadMoreBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 14,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: THEME.border,
    marginTop: 16,
  },
  loadMoreBtnHover: {
    backgroundColor: THEME.accentMuted,
    borderColor: 'rgba(59, 130, 246, 0.3)',
  },
  loadMoreText: {
    fontSize: 14,
    color: THEME.accent,
    fontWeight: '500',
  },
  railContent: {
    gap: 24,
  },
  statsCard: {
    backgroundColor: THEME.surface,
    borderRadius: 12,
    padding: 18,
    gap: 16,
  },
  statsTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: THEME.text.primary,
  },
  statsGrid: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  statItem: {
    alignItems: 'center',
    gap: 4,
  },
  statValue: {
    fontSize: 24,
    fontWeight: '700',
    color: THEME.accent,
  },
  statLabel: {
    fontSize: 11,
    color: THEME.text.muted,
  },
  railTitle: {
    fontSize: 12,
    fontWeight: '600',
    color: THEME.text.muted,
    textTransform: 'uppercase',
    letterSpacing: 1,
  },
  tagsList: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  tagItem: {
    backgroundColor: THEME.accentMuted,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 6,
  },
  tagText: {
    fontSize: 12,
    fontWeight: '500',
    color: THEME.accent,
  },
  railDivider: {
    height: 1,
    backgroundColor: THEME.border,
  },
  calendarPreview: {
    backgroundColor: THEME.surface,
    borderRadius: 10,
    padding: 14,
    gap: 12,
  },
  calendarMonth: {
    fontSize: 13,
    fontWeight: '600',
    color: THEME.text.primary,
    textAlign: 'center',
  },
  calendarDays: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 4,
  },
  calendarDay: {
    width: 28,
    height: 28,
    borderRadius: 6,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255,255,255,0.04)',
  },
  calendarDayActive: {
    backgroundColor: THEME.accentMuted,
  },
  calendarDayText: {
    fontSize: 11,
    color: THEME.text.muted,
  },
  calendarDayTextActive: {
    color: THEME.accent,
    fontWeight: '600',
  },
});
