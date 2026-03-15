import React, { useState, useEffect, useCallback, useRef } from 'react';
import { View, Text, Pressable, StyleSheet, TextInput, ScrollView, Platform } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { supabase } from '@/lib/supabase';
import type { PanelContentProps } from './types';

const SURFACE = 'rgba(6,6,10,0.98)';
const BORDER  = 'rgba(255,255,255,0.11)';
const TP      = '#FFFFFF';
const TS      = 'rgba(255,255,255,0.55)';
const TT      = 'rgba(255,255,255,0.25)';

const DEEP_COLORS = [
  { id: 'navy',     surface: '#0f172a', accent: '#3b82f6' },
  { id: 'forest',   surface: '#0f2a1c', accent: '#22c55e' },
  { id: 'plum',     surface: '#1e0a3c', accent: '#a855f7' },
  { id: 'crimson',  surface: '#2d0c10', accent: '#f43f5e' },
  { id: 'teal',     surface: '#042f2e', accent: '#14b8a6' },
  { id: 'graphite', surface: '#1c1917', accent: '#a8a29e' },
];

interface Note {
  id: string;
  title?: string;
  body?: string;
  color_id?: string;
  updated_at?: string;
}

function getRuledLines(height: number, spacing = 28): string {
  if (height <= 0) return '';
  const lines: string[] = [];
  for (let y = spacing; y < height; y += spacing) {
    lines.push(`<line x1="0" y1="${y}" x2="2000" y2="${y}" stroke="rgba(255,255,255,0.06)" stroke-width="1"/>`);
  }
  return lines.join('');
}

function PaperBackground({ height, accentColor }: { height: number; accentColor: string }) {
  if (Platform.OS !== 'web' || height <= 0) return null;
  const lines = getRuledLines(height);
  const svgContent = `<svg xmlns="http://www.w3.org/2000/svg" width="100%" height="${height}" preserveAspectRatio="none">${lines}</svg>`;
  const dataUri = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svgContent)}`;
  return (
    <View style={[StyleSheet.absoluteFill, { pointerEvents: 'none' }]}>
      <img src={dataUri} style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%', opacity: 1 }} />
      <View style={[StyleSheet.absoluteFill, { alignItems: 'center', justifyContent: 'center', opacity: 0.04, pointerEvents: 'none' }]}>
        <Ionicons name="create" size={180} color={accentColor} />
      </View>
    </View>
  );
}

export default function NotesPanelContent(_props: PanelContentProps) {
  const [notes, setNotes]           = useState<Note[]>([]);
  const [activeNote, setActiveNote] = useState<Note | null>(null);
  const [colorId, setColorId]       = useState('navy');
  const [title, setTitle]           = useState('');
  const [body, setBody]             = useState('');
  const [saved, setSaved]           = useState(false);
  const [recording, setRecording]   = useState(false);
  const [paperH, setPaperH]         = useState(0);
  const saveTimer = useRef<any>(null);

  const currentColor = DEEP_COLORS.find(c => c.id === colorId) || DEEP_COLORS[0];

  const loadNotes = useCallback(async () => {
    try {
      const { data } = await supabase
        .from('founder_hub_notes')
        .select('id, title, body, color_id, updated_at')
        .order('updated_at', { ascending: false })
        .limit(10);
      if (data && data.length > 0) {
        setNotes(data);
        if (!activeNote) {
          const n = data[0];
          setActiveNote(n);
          setTitle(n.title || '');
          setBody(n.body || '');
          setColorId(n.color_id || 'navy');
        }
      }
    } catch { /* ignore */ }
  }, []);

  useEffect(() => { loadNotes(); }, [loadNotes]);

  const doSave = useCallback(async (t: string, b: string, cid: string, noteId?: string) => {
    try {
      if (noteId) {
        await supabase.from('founder_hub_notes').update({ title: t, body: b, color_id: cid, updated_at: new Date().toISOString() }).eq('id', noteId);
        setNotes(prev => prev.map(n => n.id === noteId ? { ...n, title: t, body: b, color_id: cid } : n));
      } else {
        const { data } = await supabase.from('founder_hub_notes').insert({ title: t, body: b, color_id: cid, updated_at: new Date().toISOString() }).select().single();
        if (data) {
          setActiveNote(data);
          setNotes(prev => [data, ...prev.slice(0, 9)]);
        }
      }
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
    } catch { /* ignore */ }
  }, []);

  const scheduleAutoSave = useCallback((t: string, b: string, cid: string) => {
    if (saveTimer.current) clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(() => doSave(t, b, cid, activeNote?.id), 800);
  }, [activeNote?.id, doSave]);

  const handleTitle = useCallback((v: string) => { setTitle(v); scheduleAutoSave(v, body, colorId); }, [body, colorId, scheduleAutoSave]);
  const handleBody  = useCallback((v: string) => { setBody(v);  scheduleAutoSave(title, v, colorId); }, [title, colorId, scheduleAutoSave]);

  const handleColorChange = useCallback((cid: string) => {
    setColorId(cid);
    scheduleAutoSave(title, body, cid);
  }, [title, body, scheduleAutoSave]);

  const handleNewNote = useCallback(() => {
    setActiveNote(null);
    setTitle('');
    setBody('');
    setColorId('navy');
  }, []);

  const handleOpenNote = useCallback((note: Note) => {
    setActiveNote(note);
    setTitle(note.title || '');
    setBody(note.body || '');
    setColorId(note.color_id || 'navy');
  }, []);

  const handleVoiceToNote = useCallback(async () => {
    setRecording(r => !r);
  }, []);

  return (
    <View style={s.root}>
      <View
        style={[s.paper, { backgroundColor: currentColor.surface }]}
        onLayout={e => setPaperH(e.nativeEvent.layout.height)}
      >
        <PaperBackground height={paperH} accentColor={currentColor.accent} />

        <View style={s.noteHeader}>
          <View style={s.swatchRow}>
            {DEEP_COLORS.map(c => (
              <Pressable
                key={c.id}
                onPress={() => handleColorChange(c.id)}
                style={[
                  s.swatch,
                  { backgroundColor: c.surface, borderColor: colorId === c.id ? '#FFF' : 'rgba(255,255,255,0.35)' },
                  colorId === c.id && s.swatchActive,
                ]}
              />
            ))}
            <View style={s.headerRight}>
              <Pressable style={s.voiceBtn} onPress={handleVoiceToNote}>
                <Ionicons name={recording ? 'stop-circle' : 'mic'} size={14} color={recording ? '#f43f5e' : 'rgba(255,255,255,0.8)'} />
                <Text style={s.voiceBtnText}>{recording ? 'Stop' : 'Voice'}</Text>
              </Pressable>
              <Pressable style={s.newBtn} onPress={handleNewNote}>
                <Ionicons name="add" size={14} color="rgba(255,255,255,0.8)" />
              </Pressable>
            </View>
          </View>
          <View style={s.metaRow}>
            <Text style={s.metaDate}>
              {activeNote?.updated_at
                ? new Date(activeNote.updated_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
                : 'New note'}
            </Text>
            {saved && (
              <Text style={[s.metaSaved, { color: currentColor.accent }]}>Saved ✓</Text>
            )}
          </View>
        </View>

        <TextInput
          style={s.titleInput}
          value={title}
          onChangeText={handleTitle}
          placeholder="Title"
          placeholderTextColor="rgba(255,255,255,0.3)"
          multiline={false}
          returnKeyType="next"
        />
        <TextInput
          style={s.bodyInput}
          value={body}
          onChangeText={handleBody}
          placeholder="Start writing…"
          placeholderTextColor="rgba(255,255,255,0.25)"
          multiline
          textAlignVertical="top"
        />
      </View>

      {notes.length > 0 && (
        <View style={s.thumbBar}>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={s.thumbContent}>
            {notes.map(note => {
              const col = DEEP_COLORS.find(c => c.id === (note.color_id || 'navy')) || DEEP_COLORS[0];
              const isActive = activeNote?.id === note.id;
              return (
                <Pressable
                  key={note.id}
                  onPress={() => handleOpenNote(note)}
                  style={[
                    s.thumb,
                    { backgroundColor: col.surface },
                    isActive && { borderColor: col.accent, borderWidth: 2 },
                  ]}
                >
                  <Text style={s.thumbText} numberOfLines={2}>
                    {note.title || note.body || 'Untitled'}
                  </Text>
                </Pressable>
              );
            })}
          </ScrollView>
        </View>
      )}
    </View>
  );
}

const s = StyleSheet.create({
  root:       { flex: 1, backgroundColor: SURFACE },
  paper:      { flex: 1, position: 'relative', overflow: 'hidden' },
  noteHeader: { paddingTop: 12, paddingHorizontal: 16, paddingBottom: 8 },
  swatchRow:  { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 8 },
  swatch:     { width: 22, height: 22, borderRadius: 11, borderWidth: 1.5 },
  swatchActive: { transform: [{ scale: 1.2 }], borderWidth: 2, borderColor: '#FFF' },
  headerRight:{ flexDirection: 'row', alignItems: 'center', gap: 8, marginLeft: 'auto' },
  voiceBtn:   { flexDirection: 'row', alignItems: 'center', gap: 5, paddingHorizontal: 10, paddingVertical: 6, borderRadius: 8, backgroundColor: 'rgba(255,255,255,0.12)' },
  voiceBtnText: { fontSize: 12, fontWeight: '600', color: 'rgba(255,255,255,0.8)' },
  newBtn:     { width: 28, height: 28, borderRadius: 8, backgroundColor: 'rgba(255,255,255,0.12)', alignItems: 'center', justifyContent: 'center' },
  metaRow:    { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  metaDate:   { fontSize: 11, color: 'rgba(255,255,255,0.4)' },
  metaSaved:  { fontSize: 11, fontWeight: '600' },
  titleInput: {
    marginHorizontal: 16, marginTop: 8, marginBottom: 4,
    fontSize: 26, fontWeight: '800', color: TP,
    backgroundColor: 'transparent',
    ...(Platform.OS === 'web' ? ({ outline: 'none' }) : {}),
  },
  bodyInput:  {
    flex: 1, marginHorizontal: 16, marginBottom: 8,
    fontSize: 15, color: TP, lineHeight: 28,
    backgroundColor: 'transparent',
    ...(Platform.OS === 'web' ? ({ outline: 'none', resize: 'none' }) : {}),
  },
  thumbBar:     { height: 80, borderTopWidth: 1, borderTopColor: 'rgba(255,255,255,0.07)', backgroundColor: 'rgba(0,0,0,0.4)' },
  thumbContent: { paddingHorizontal: 12, paddingVertical: 8, gap: 8, alignItems: 'center' },
  thumb:        { width: 80, height: 60, borderRadius: 8, padding: 8, borderWidth: 1, borderColor: 'rgba(255,255,255,0.12)' },
  thumbText:    { fontSize: 10, color: 'rgba(255,255,255,0.7)', lineHeight: 14 },
});
