import React, { useState } from 'react';
import { View, Text, StyleSheet, SafeAreaView, ScrollView, Pressable, TextInput } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { Colors, Spacing, Typography, BorderRadius } from '@/constants/tokens';
import { getDefaultSession, bookmarkTranscript, createActionItem } from '@/data/session';
import { TranscriptEntry } from '@/types/session';
import { Toast } from '@/components/session/Toast';

function formatTime(date: Date): string {
  return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
}

export default function TranscriptScreen() {
  const router = useRouter();
  const session = getDefaultSession();
  const [searchQuery, setSearchQuery] = useState('');
  const [speakerFilter, setSpeakerFilter] = useState<string | null>(null);
  const [toastMessage, setToastMessage] = useState('');
  const [toastVisible, setToastVisible] = useState(false);

  const speakers = [...new Set(session.transcript.map(t => t.speaker))];
  
  const filteredTranscript = session.transcript.filter(entry => {
    const matchesSearch = searchQuery === '' || 
      entry.text.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesSpeaker = speakerFilter === null || entry.speaker === speakerFilter;
    return matchesSearch && matchesSpeaker;
  });

  const handleBookmark = (entryId: string) => {
    bookmarkTranscript(entryId);
    setToastMessage('Moment marked');
    setToastVisible(true);
  };

  const handleCreateActionItem = (text: string) => {
    createActionItem(text);
    setToastMessage('Action item created');
    setToastVisible(true);
  };

  return (
    <SafeAreaView style={styles.container}>
      <Toast 
        visible={toastVisible} 
        message={toastMessage} 
        type="success"
        onHide={() => setToastVisible(false)} 
      />
      
      <View style={styles.header}>
        <Pressable onPress={() => router.back()} style={styles.backButton}>
          <Ionicons name="chevron-back" size={24} color={Colors.text.secondary} />
        </Pressable>
        <View style={styles.headerCenter}>
          <Text style={styles.headerTitle}>Full Transcript</Text>
          <Text style={styles.headerSubtitle}>{session.transcript.length} entries</Text>
        </View>
        <Pressable style={styles.exportButton}>
          <Ionicons name="share-outline" size={20} color={Colors.accent.cyan} />
        </Pressable>
      </View>

      <View style={styles.searchContainer}>
        <View style={styles.searchInputContainer}>
          <Ionicons name="search" size={18} color={Colors.text.muted} />
          <TextInput
            style={styles.searchInput}
            placeholder="Search transcript..."
            placeholderTextColor={Colors.text.muted}
            value={searchQuery}
            onChangeText={setSearchQuery}
          />
          {searchQuery.length > 0 && (
            <Pressable onPress={() => setSearchQuery('')}>
              <Ionicons name="close-circle" size={18} color={Colors.text.muted} />
            </Pressable>
          )}
        </View>
      </View>

      <View style={styles.filterContainer}>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.filterScroll}>
          <Pressable
            style={[styles.filterChip, speakerFilter === null && styles.filterChipActive]}
            onPress={() => setSpeakerFilter(null)}
          >
            <Text style={[styles.filterChipText, speakerFilter === null && styles.filterChipTextActive]}>
              All
            </Text>
          </Pressable>
          {speakers.map((speaker) => (
            <Pressable
              key={speaker}
              style={[styles.filterChip, speakerFilter === speaker && styles.filterChipActive]}
              onPress={() => setSpeakerFilter(speaker)}
            >
              <Text style={[styles.filterChipText, speakerFilter === speaker && styles.filterChipTextActive]}>
                {speaker}
              </Text>
            </Pressable>
          ))}
        </ScrollView>
      </View>

      <ScrollView 
        style={styles.transcriptList}
        contentContainerStyle={styles.transcriptContent}
        showsVerticalScrollIndicator={false}
      >
        {filteredTranscript.map((entry) => (
          <TranscriptEntryCard 
            key={entry.id} 
            entry={entry}
            onBookmark={() => handleBookmark(entry.id)}
            onCreateAction={() => handleCreateActionItem(entry.text)}
          />
        ))}
      </ScrollView>
    </SafeAreaView>
  );
}

function TranscriptEntryCard({ 
  entry, 
  onBookmark, 
  onCreateAction 
}: { 
  entry: TranscriptEntry;
  onBookmark: () => void;
  onCreateAction: () => void;
}) {
  const [expanded, setExpanded] = useState(false);

  return (
    <Pressable 
      style={[styles.entryCard, entry.isBookmarked && styles.entryCardBookmarked]}
      onPress={() => setExpanded(!expanded)}
    >
      <View style={styles.entryHeader}>
        <View style={styles.entryMeta}>
          <Text style={[styles.entrySpeaker, { color: entry.speakerColor }]}>{entry.speaker}</Text>
          <Text style={styles.entryTime}>{formatTime(entry.timestamp)}</Text>
        </View>
        {entry.isBookmarked && (
          <Ionicons name="bookmark" size={16} color={Colors.semantic.warning} />
        )}
      </View>
      <Text style={styles.entryText}>{entry.text}</Text>
      
      {expanded && (
        <View style={styles.entryActions}>
          <Pressable style={styles.entryActionButton} onPress={onBookmark}>
            <Ionicons name="bookmark-outline" size={16} color={Colors.accent.cyan} />
            <Text style={styles.entryActionText}>Mark Moment</Text>
          </Pressable>
          <Pressable style={styles.entryActionButton} onPress={onCreateAction}>
            <Ionicons name="list" size={16} color={Colors.accent.cyan} />
            <Text style={styles.entryActionText}>Action Item</Text>
          </Pressable>
        </View>
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background.primary,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border.subtle,
  },
  backButton: {
    padding: Spacing.sm,
  },
  headerCenter: {
    flex: 1,
    alignItems: 'center',
  },
  headerTitle: {
    ...Typography.headline,
    color: Colors.text.primary,
  },
  headerSubtitle: {
    ...Typography.small,
    color: Colors.text.muted,
  },
  exportButton: {
    padding: Spacing.sm,
  },
  searchContainer: {
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.md,
  },
  searchInputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.background.secondary,
    borderRadius: BorderRadius.md,
    paddingHorizontal: Spacing.md,
    borderWidth: 1,
    borderColor: Colors.border.default,
  },
  searchInput: {
    flex: 1,
    paddingVertical: Spacing.md,
    paddingLeft: Spacing.sm,
    color: Colors.text.primary,
    ...Typography.body,
  },
  filterContainer: {
    paddingBottom: Spacing.md,
  },
  filterScroll: {
    paddingHorizontal: Spacing.lg,
    gap: Spacing.sm,
  },
  filterChip: {
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.xs,
    backgroundColor: Colors.background.secondary,
    borderRadius: BorderRadius.sm,
    borderWidth: 1,
    borderColor: Colors.border.default,
  },
  filterChipActive: {
    backgroundColor: Colors.accent.cyanDark,
    borderColor: Colors.accent.cyan,
  },
  filterChipText: {
    ...Typography.small,
    color: Colors.text.muted,
  },
  filterChipTextActive: {
    color: Colors.accent.cyan,
  },
  transcriptList: {
    flex: 1,
  },
  transcriptContent: {
    padding: Spacing.lg,
    gap: Spacing.md,
  },
  entryCard: {
    backgroundColor: Colors.background.secondary,
    borderRadius: BorderRadius.lg,
    padding: Spacing.lg,
    borderWidth: 1,
    borderColor: Colors.border.default,
  },
  entryCardBookmarked: {
    borderColor: Colors.semantic.warning,
    borderLeftWidth: 3,
  },
  entryHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: Spacing.sm,
  },
  entryMeta: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.md,
  },
  entrySpeaker: {
    ...Typography.small,
    fontWeight: '600',
  },
  entryTime: {
    ...Typography.micro,
    color: Colors.text.muted,
  },
  entryText: {
    ...Typography.body,
    color: Colors.text.secondary,
    lineHeight: 22,
  },
  entryActions: {
    flexDirection: 'row',
    gap: Spacing.md,
    marginTop: Spacing.md,
    paddingTop: Spacing.md,
    borderTopWidth: 1,
    borderTopColor: Colors.border.subtle,
  },
  entryActionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.xs,
    backgroundColor: Colors.accent.cyanDark,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    borderRadius: BorderRadius.sm,
  },
  entryActionText: {
    ...Typography.small,
    color: Colors.accent.cyan,
    fontWeight: '500',
  },
});
