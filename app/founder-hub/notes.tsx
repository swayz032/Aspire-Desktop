import React, { useState, useEffect, useCallback } from 'react';
import { View, Text, StyleSheet, Pressable, TextInput, Alert } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { HubPageShell } from '@/components/founder-hub/HubPageShell';
import { supabase } from '@/lib/supabase';
import { useTenant } from '@/providers';

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

interface Note {
  id: string;
  title: string;
  content: string;
  pinned: boolean;
  tags: string[];
  created_at: string;
  updated_at: string;
}

export default function NotesScreen() {
  const { tenant, isLoading: tenantLoading } = useTenant();
  const [hoveredItem, setHoveredItem] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'all' | 'pinned'>('all');
  const [notes, setNotes] = useState<Note[]>([]);
  const [loading, setLoading] = useState(true);
  const [editingNote, setEditingNote] = useState<Note | null>(null);
  const [editTitle, setEditTitle] = useState('');
  const [editContent, setEditContent] = useState('');
  const [saving, setSaving] = useState(false);

  const fetchNotes = useCallback(async () => {
    try {
      const { data, error } = await supabase
        .from('founder_hub_notes')
        .select('*')
        .order('pinned', { ascending: false })
        .order('updated_at', { ascending: false });

      if (error) {
        console.error('Failed to fetch notes:', error);
        return;
      }
      setNotes(data ?? []);
    } catch (err) {
      console.error('Failed to load notes:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchNotes();
  }, [fetchNotes]);

  // Emit receipt for note CRUD — Law #2
  const emitNoteReceipt = async (action: string, noteId: string, riskTier: string = 'green') => {
    if (!tenant?.suiteId) return;
    try {
      await supabase.from('receipts').insert({
        id: `rcpt-note-${action}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
        suite_id: tenant.suiteId,
        action_type: `founder_hub.note.${action}`,
        risk_tier: riskTier,
        actor: 'user',
        outcome: 'success',
        correlation_id: `corr-note-${Date.now()}`,
        metadata: { note_id: noteId, action },
      });
    } catch (err) {
      console.warn(`Note ${action} receipt failed:`, err);
    }
  };

  const handleCreateNote = async () => {
    if (!tenant?.suiteId) return;
    setSaving(true);
    try {
      const { data, error } = await supabase
        .from('founder_hub_notes')
        .insert({ suite_id: tenant.suiteId, title: '', content: '' })
        .select()
        .single();

      if (error) {
        console.error('Failed to create note:', error);
        return;
      }
      if (data) {
        setNotes((prev) => [data, ...prev]);
        setEditingNote(data);
        setEditTitle('');
        setEditContent('');
        emitNoteReceipt('create', data.id);
      }
    } finally {
      setSaving(false);
    }
  };

  const handleSaveNote = async () => {
    if (!editingNote) return;
    setSaving(true);
    try {
      const { error } = await supabase
        .from('founder_hub_notes')
        .update({ title: editTitle, content: editContent, updated_at: new Date().toISOString() })
        .eq('id', editingNote.id)
        .eq('suite_id', tenant!.suiteId); // Defense-in-depth: explicit tenant filter over RLS-only

      if (error) {
        console.error('Failed to save note:', error);
        return;
      }
      setNotes((prev) =>
        prev.map((n) =>
          n.id === editingNote.id
            ? { ...n, title: editTitle, content: editContent, updated_at: new Date().toISOString() }
            : n
        )
      );
      emitNoteReceipt('update', editingNote.id);
      setEditingNote(null);
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteNote = async (noteId: string) => {
    const confirmed = typeof window !== 'undefined'
      ? window.confirm('Delete this note? This cannot be undone.')
      : true;
    if (!confirmed) return;

    try {
      const { error } = await supabase
        .from('founder_hub_notes')
        .delete()
        .eq('id', noteId)
        .eq('suite_id', tenant!.suiteId); // Defense-in-depth: explicit tenant filter over RLS-only

      if (error) {
        console.error('Failed to delete note:', error);
        return;
      }
      setNotes((prev) => prev.filter((n) => n.id !== noteId));
      if (editingNote?.id === noteId) {
        setEditingNote(null);
      }
      emitNoteReceipt('delete', noteId, 'yellow'); // Delete is YELLOW — irreversible
    } catch (err) {
      console.error('Failed to delete note:', err);
    }
  };

  const handleTogglePin = async (note: Note) => {
    try {
      const { error } = await supabase
        .from('founder_hub_notes')
        .update({ pinned: !note.pinned })
        .eq('id', note.id)
        .eq('suite_id', tenant!.suiteId); // Defense-in-depth: explicit tenant filter over RLS-only

      if (error) {
        console.error('Failed to toggle pin:', error);
        return;
      }
      setNotes((prev) =>
        prev.map((n) => (n.id === note.id ? { ...n, pinned: !n.pinned } : n))
      );
      emitNoteReceipt('pin_toggle', note.id);
    } catch (err) {
      console.error('Failed to toggle pin:', err);
    }
  };

  const openNoteForEditing = (note: Note) => {
    setEditingNote(note);
    setEditTitle(note.title);
    setEditContent(note.content);
  };

  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr);
    const today = new Date();
    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);

    if (date.toDateString() === today.toDateString()) return 'Today';
    if (date.toDateString() === yesterday.toDateString()) return 'Yesterday';
    return date.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });
  };

  const formatTime = (dateStr: string) => {
    return new Date(dateStr).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });
  };

  const filteredNotes = activeTab === 'pinned' ? notes.filter((n) => n.pinned) : notes;

  const pinnedCount = notes.filter((n) => n.pinned).length;

  const rightRail = (
    <View style={styles.railContent}>
      <View style={styles.statsCard}>
        <Text style={styles.statsTitle}>Your Notes</Text>
        <View style={styles.statsGrid}>
          <View style={styles.statItem}>
            <Text style={styles.statValue}>{notes.length}</Text>
            <Text style={styles.statLabel}>Total</Text>
          </View>
          <View style={styles.statItem}>
            <Text style={styles.statValue}>{pinnedCount}</Text>
            <Text style={styles.statLabel}>Pinned</Text>
          </View>
        </View>
      </View>

      <View style={styles.railDivider} />

      <Text style={styles.railTitle}>Quick Actions</Text>
      <Pressable
        style={[styles.quickAction, hoveredItem === 'rail-new' && styles.quickActionHover]}
        onHoverIn={() => setHoveredItem('rail-new')}
        onHoverOut={() => setHoveredItem(null)}
        onPress={handleCreateNote}
      >
        <Ionicons name="add-circle-outline" size={16} color={THEME.accent} />
        <Text style={styles.quickActionText}>New note</Text>
      </Pressable>
    </View>
  );

  if (loading || tenantLoading) {
    return (
      <HubPageShell rightRail={<View />}>
        <View style={styles.header}>
          <View style={styles.skeletonTitle} />
          <View style={styles.skeletonSubtitle} />
        </View>
        <View style={styles.skeletonVoice} />
        <View style={styles.skeletonEntries}>
          {[1, 2, 3].map((i) => (
            <View key={i} style={styles.skeletonEntry} />
          ))}
        </View>
      </HubPageShell>
    );
  }

  if (!tenant?.onboardingCompleted) {
    return (
      <HubPageShell rightRail={<View />}>
        <View style={styles.header}>
          <Text style={styles.pageTitle}>Notes & Journal</Text>
          <Text style={styles.pageSubtitle}>Your business diary powered by Ava</Text>
        </View>
        <View style={styles.emptyStateContainer}>
          <Ionicons name="person-circle-outline" size={48} color={THEME.text.muted} />
          <Text style={styles.emptyStateTitle}>Complete your profile to unlock Notes</Text>
          <Text style={styles.emptyStateDesc}>
            Once you finish onboarding, you can capture thoughts, ideas, and journal entries here.
          </Text>
        </View>
      </HubPageShell>
    );
  }

  // Edit view
  if (editingNote) {
    return (
      <HubPageShell rightRail={rightRail}>
        <View style={styles.header}>
          <View style={styles.editHeader}>
            <Pressable
              style={styles.backBtn}
              onPress={() => setEditingNote(null)}
              accessibilityLabel="Back to notes list"
              accessibilityRole="button"
            >
              <Ionicons name="arrow-back" size={20} color={THEME.text.secondary} />
              <Text style={styles.backBtnText}>Back</Text>
            </Pressable>
            <View style={styles.editActions}>
              <Pressable
                style={[styles.deleteBtn, hoveredItem === 'delete' && styles.deleteBtnHover]}
                onHoverIn={() => setHoveredItem('delete')}
                onHoverOut={() => setHoveredItem(null)}
                onPress={() => handleDeleteNote(editingNote.id)}
                accessibilityLabel="Delete note"
                accessibilityRole="button"
              >
                <Ionicons name="trash-outline" size={16} color="#f87171" />
                <Text style={styles.deleteBtnText}>Delete</Text>
              </Pressable>
              <Pressable
                style={[styles.saveBtn, hoveredItem === 'save' && styles.saveBtnHover]}
                onHoverIn={() => setHoveredItem('save')}
                onHoverOut={() => setHoveredItem(null)}
                onPress={handleSaveNote}
                accessibilityLabel="Save note"
                accessibilityRole="button"
              >
                <Ionicons name="checkmark" size={16} color="#FFFFFF" />
                <Text style={styles.saveBtnText}>{saving ? 'Saving...' : 'Save'}</Text>
              </Pressable>
            </View>
          </View>
        </View>

        <View style={styles.editForm}>
          <TextInput
            style={styles.editTitleInput}
            value={editTitle}
            onChangeText={setEditTitle}
            placeholder="Note title..."
            placeholderTextColor={THEME.text.muted}
            accessibilityLabel="Note title"
          />
          <TextInput
            style={styles.editContentInput}
            value={editContent}
            onChangeText={setEditContent}
            placeholder="Start writing..."
            placeholderTextColor={THEME.text.muted}
            multiline
            textAlignVertical="top"
            accessibilityLabel="Note content"
          />
        </View>
      </HubPageShell>
    );
  }

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
              accessibilityLabel="Start voice recording"
              accessibilityRole="button"
            >
              <Ionicons name="mic-outline" size={18} color="#FFFFFF" />
              <Text style={styles.voiceBtnText}>Start Recording</Text>
            </Pressable>
          </View>
        </LinearGradient>
      </View>

      <View style={styles.section}>
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>Journal Entries</Text>
          <View style={styles.headerActions}>
            <View style={styles.tabsRow}>
              <Pressable
                style={[styles.tab, activeTab === 'all' && styles.tabActive]}
                onPress={() => setActiveTab('all')}
                accessibilityLabel="Show all notes"
                accessibilityRole="button"
              >
                <Text style={[styles.tabText, activeTab === 'all' && styles.tabTextActive]}>All</Text>
              </Pressable>
              <Pressable
                style={[styles.tab, activeTab === 'pinned' && styles.tabActive]}
                onPress={() => setActiveTab('pinned')}
                accessibilityLabel="Show pinned notes"
                accessibilityRole="button"
              >
                <Ionicons
                  name={activeTab === 'pinned' ? 'star' : 'star-outline'}
                  size={14}
                  color={activeTab === 'pinned' ? '#000' : THEME.text.muted}
                />
                <Text style={[styles.tabText, activeTab === 'pinned' && styles.tabTextActive]}>Pinned</Text>
              </Pressable>
            </View>
            <Pressable
              style={[styles.newNoteBtn, hoveredItem === 'new' && styles.newNoteBtnHover]}
              onHoverIn={() => setHoveredItem('new')}
              onHoverOut={() => setHoveredItem(null)}
              onPress={handleCreateNote}
              accessibilityLabel="Create new note"
              accessibilityRole="button"
            >
              <Ionicons name="add" size={16} color="#FFFFFF" />
              <Text style={styles.newNoteBtnText}>New Note</Text>
            </Pressable>
          </View>
        </View>

        {filteredNotes.length === 0 && (
          <View style={styles.emptyStateContainer}>
            <Ionicons name="pencil-outline" size={48} color={THEME.text.muted} />
            <Text style={styles.emptyStateTitle}>
              {activeTab === 'pinned' ? 'No pinned notes' : 'Start your first note'}
            </Text>
            <Text style={styles.emptyStateDesc}>
              {activeTab === 'pinned'
                ? 'Pin important notes to find them quickly.'
                : 'Capture thoughts, ideas, and journal entries. Ava can help you organize them.'}
            </Text>
            {activeTab === 'all' && (
              <Pressable
                style={[styles.newNoteBtn, { marginTop: 8 }]}
                onPress={handleCreateNote}
                accessibilityLabel="Create first note"
                accessibilityRole="button"
              >
                <Ionicons name="add" size={16} color="#FFFFFF" />
                <Text style={styles.newNoteBtnText}>New Note</Text>
              </Pressable>
            )}
          </View>
        )}

        <View style={styles.entriesList}>
          {filteredNotes.map((note) => (
            <Pressable
              key={note.id}
              style={[
                styles.entryCard,
                hoveredItem === `entry-${note.id}` && styles.entryCardHover,
              ]}
              onHoverIn={() => setHoveredItem(`entry-${note.id}`)}
              onHoverOut={() => setHoveredItem(null)}
              onPress={() => openNoteForEditing(note)}
              accessibilityLabel={`Edit note: ${note.title || 'Untitled'}`}
              accessibilityRole="button"
            >
              <View style={styles.entryHeader}>
                <View style={styles.entryMeta}>
                  <Text style={styles.entryDate}>{formatDate(note.updated_at)}</Text>
                  <Text style={styles.entryDot}>-</Text>
                  <Text style={styles.entryTime}>{formatTime(note.updated_at)}</Text>
                </View>
                <View style={styles.entryActions}>
                  <Pressable
                    style={styles.entryAction}
                    onPress={(e) => {
                      e.stopPropagation?.();
                      handleTogglePin(note);
                    }}
                    accessibilityLabel={note.pinned ? 'Unpin note' : 'Pin note'}
                    accessibilityRole="button"
                  >
                    <Ionicons
                      name={note.pinned ? 'star' : 'star-outline'}
                      size={16}
                      color={note.pinned ? '#fbbf24' : THEME.text.muted}
                    />
                  </Pressable>
                  <Pressable
                    style={styles.entryAction}
                    onPress={(e) => {
                      e.stopPropagation?.();
                      handleDeleteNote(note.id);
                    }}
                    accessibilityLabel="Delete note"
                    accessibilityRole="button"
                  >
                    <Ionicons name="trash-outline" size={16} color={THEME.text.muted} />
                  </Pressable>
                </View>
              </View>
              <Text style={styles.entryTitle}>{note.title || 'Untitled note'}</Text>
              <Text style={styles.entryPreview} numberOfLines={2}>
                {note.content || 'No content yet...'}
              </Text>
              {note.tags && note.tags.length > 0 && (
                <View style={styles.entryTags}>
                  {note.tags.map((tag, idx) => (
                    <View key={idx} style={styles.entryTag}>
                      <Text style={styles.entryTagText}>{tag}</Text>
                    </View>
                  ))}
                </View>
              )}
            </Pressable>
          ))}
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
  section: {
    marginBottom: 32,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 16,
    flexWrap: 'wrap',
    gap: 12,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: THEME.text.primary,
  },
  headerActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
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
  newNoteBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: THEME.accent,
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 8,
  },
  newNoteBtnHover: {
    opacity: 0.9,
    transform: [{ scale: 1.02 }],
  },
  newNoteBtnText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#FFFFFF',
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
  entryActions: {
    flexDirection: 'row',
    gap: 8,
  },
  entryAction: {
    padding: 4,
    minWidth: 44,
    minHeight: 44,
    alignItems: 'center',
    justifyContent: 'center',
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
  // Edit view
  editHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  backBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingVertical: 8,
    paddingRight: 16,
    minHeight: 44,
  },
  backBtnText: {
    fontSize: 14,
    color: THEME.text.secondary,
    fontWeight: '500',
  },
  editActions: {
    flexDirection: 'row',
    gap: 12,
  },
  deleteBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: 'rgba(248, 113, 113, 0.3)',
    minHeight: 44,
  },
  deleteBtnHover: {
    backgroundColor: 'rgba(248, 113, 113, 0.1)',
  },
  deleteBtnText: {
    fontSize: 13,
    fontWeight: '500',
    color: '#f87171',
  },
  saveBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: THEME.accent,
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 8,
    minHeight: 44,
  },
  saveBtnHover: {
    opacity: 0.9,
    transform: [{ scale: 1.02 }],
  },
  saveBtnText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  editForm: {
    gap: 16,
  },
  editTitleInput: {
    fontSize: 24,
    fontWeight: '700',
    color: THEME.text.primary,
    backgroundColor: THEME.surface,
    borderRadius: 12,
    padding: 16,
    borderWidth: 1,
    borderColor: THEME.border,
  },
  editContentInput: {
    fontSize: 15,
    color: THEME.text.secondary,
    backgroundColor: THEME.surface,
    borderRadius: 12,
    padding: 16,
    borderWidth: 1,
    borderColor: THEME.border,
    minHeight: 300,
    lineHeight: 22,
  },
  // Right rail
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
    justifyContent: 'space-around',
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
  railDivider: {
    height: 1,
    backgroundColor: THEME.border,
  },
  quickAction: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 8,
    backgroundColor: THEME.surface,
  },
  quickActionHover: {
    backgroundColor: THEME.surfaceHover,
  },
  quickActionText: {
    fontSize: 13,
    color: THEME.accent,
    fontWeight: '500',
  },
  // Skeleton loading
  skeletonTitle: {
    width: 220,
    height: 28,
    borderRadius: 6,
    backgroundColor: 'rgba(255,255,255,0.06)',
    marginBottom: 8,
  },
  skeletonSubtitle: {
    width: 300,
    height: 16,
    borderRadius: 4,
    backgroundColor: 'rgba(255,255,255,0.04)',
  },
  skeletonVoice: {
    width: '100%',
    height: 100,
    borderRadius: 16,
    backgroundColor: 'rgba(255,255,255,0.04)',
    marginBottom: 32,
  },
  skeletonEntries: {
    gap: 12,
  },
  skeletonEntry: {
    width: '100%',
    height: 100,
    borderRadius: 12,
    backgroundColor: 'rgba(255,255,255,0.04)',
  },
  // Empty state
  emptyStateContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 64,
    gap: 16,
  },
  emptyStateTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: THEME.text.secondary,
    textAlign: 'center',
  },
  emptyStateDesc: {
    fontSize: 14,
    color: THEME.text.muted,
    textAlign: 'center',
    maxWidth: 400,
    lineHeight: 20,
  },
});
