/**
 * StickyNoteWidget — Single 3D physical sticky note
 *
 * ONE note per modal. The modal IS the note.
 * - 8 premium vivid colors
 * - Paper gradient + corner fold + paperclip decoration
 * - Dark text on vivid bg (note feel, not glass)
 * - Auto-save via Supabase upsert (800ms debounce)
 * - onNoteColorChange callback → WidgetModal via CanvasWorkspace
 */

import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { supabase } from '@/lib/supabase';
import { playNoteSaveSound, playClickSound } from '@/lib/sounds';

// ---------------------------------------------------------------------------
// Premium color palette
// ---------------------------------------------------------------------------

const PREMIUM_COLORS = [
  { id: 'yellow',   hex: '#FFF9C4', dark: '#7A6B00' }, // pale lemon — default
  { id: 'pink',     hex: '#FFD6E0', dark: '#8B0033' }, // baby pink
  { id: 'blue',     hex: '#BDE0FE', dark: '#003D8F' }, // baby blue
  { id: 'mint',     hex: '#CAFFBF', dark: '#1A6600' }, // soft mint
  { id: 'lavender', hex: '#E2D9F3', dark: '#3D1A80' }, // soft lavender
  { id: 'peach',    hex: '#FFD6A5', dark: '#7A3D00' }, // soft peach
  { id: 'sage',     hex: '#D4EDDA', dark: '#1A5C2A' }, // sage green
  { id: 'lilac',    hex: '#F2C4DE', dark: '#6B0047' }, // soft lilac
] as const;

type ColorId = (typeof PREMIUM_COLORS)[number]['id'];

function colorById(id: ColorId) {
  return PREMIUM_COLORS.find(c => c.id === id) || PREMIUM_COLORS[0];
}

function randomColorId(): ColorId {
  return PREMIUM_COLORS[Math.floor(Math.random() * PREMIUM_COLORS.length)].id;
}

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

interface StickyNoteWidgetProps {
  suiteId: string;
  officeId: string;
  onNoteColorChange?: (hex: string) => void;
}

// ---------------------------------------------------------------------------
// Paperclip SVG
// ---------------------------------------------------------------------------

function Paperclip({ color }: { color: string }) {
  if (Platform.OS !== 'web') return null;
  return (
    <View
      style={{
        position: 'absolute',
        top: -14,
        alignSelf: 'center',
        zIndex: 10,
        ...(Platform.OS === 'web' ? ({ pointerEvents: 'none' }) : {}),
      }}
      pointerEvents="none"
    >
      {/* Simple SVG-like paperclip using Views */}
      <View style={pc.clip}>
        <View style={[pc.outer, { borderColor: color }]}>
          <View style={[pc.inner, { borderColor: color }]} />
        </View>
      </View>
    </View>
  );
}

const pc = StyleSheet.create({
  clip: {
    width: 16,
    height: 38,
    alignItems: 'center',
    justifyContent: 'center',
  },
  outer: {
    width: 14,
    height: 36,
    borderRadius: 7,
    borderWidth: 2.5,
    justifyContent: 'flex-start',
    paddingTop: 4,
    alignItems: 'center',
    backgroundColor: 'transparent',
  },
  inner: {
    width: 6,
    height: 18,
    borderRadius: 3,
    borderWidth: 2.5,
    backgroundColor: 'transparent',
  },
});

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function StickyNoteWidget({
  suiteId,
  officeId,
  onNoteColorChange,
}: StickyNoteWidgetProps) {
  const [noteId, setNoteId] = useState<string | null>(null);
  const [text, setText] = useState('');
  const [colorId, setColorId] = useState<ColorId>('yellow');
  const [loading, setLoading] = useState(true);
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const colorConfig = colorById(colorId);

  // ---- Load or create note from Supabase ----
  useEffect(() => {
    async function loadNote() {
      try {
        const { data, error } = await supabase
          .from('sticky_notes')
          .select('id, text, color')
          .eq('suite_id', suiteId)
          .eq('office_id', officeId)
          .order('created_at', { ascending: false })
          .limit(1)
          .single();

        if (error && error.code !== 'PGRST116') {
          // PGRST116 = no rows found — create a new one
          console.warn('[StickyNote] load error:', error.message);
        }

        if (data) {
          setNoteId(data.id);
          setText(data.text || '');
          const cid = (data.color as ColorId) || randomColorId();
          setColorId(cid);
          onNoteColorChange?.(colorById(cid).hex);
        } else {
          // No note yet — assign random color, will save on first keystroke
          const newColor = randomColorId();
          setColorId(newColor);
          onNoteColorChange?.(colorById(newColor).hex);
        }
      } finally {
        setLoading(false);
      }
    }
    loadNote();
  }, [suiteId, officeId]);

  // ---- Auto-save (debounced 800ms) ----
  const saveNote = useCallback(
    async (newText: string, newColorId: ColorId) => {
      const payload = {
        suite_id: suiteId,
        office_id: officeId,
        text: newText,
        color: newColorId,
        updated_at: new Date().toISOString(),
      };
      try {
        if (noteId) {
          await supabase.from('sticky_notes').update(payload).eq('id', noteId);
        } else {
          const { data } = await supabase
            .from('sticky_notes')
            .insert({ ...payload, created_at: new Date().toISOString() })
            .select('id')
            .single();
          if (data?.id) setNoteId(data.id);
        }
        playNoteSaveSound();
      } catch (e) {
        console.warn('[StickyNote] save error:', e);
      }
    },
    [noteId, suiteId, officeId],
  );

  const handleTextChange = useCallback(
    (val: string) => {
      setText(val);
      if (saveTimer.current) clearTimeout(saveTimer.current);
      saveTimer.current = setTimeout(() => saveNote(val, colorId), 800);
    },
    [colorId, saveNote],
  );

  const handleColorChange = useCallback(
    (cid: ColorId) => {
      playClickSound();
      setColorId(cid);
      onNoteColorChange?.(colorById(cid).hex);
      if (saveTimer.current) clearTimeout(saveTimer.current);
      saveTimer.current = setTimeout(() => saveNote(text, cid), 800);
    },
    [text, saveNote, onNoteColorChange],
  );

  useEffect(() => () => { if (saveTimer.current) clearTimeout(saveTimer.current); }, []);

  if (loading) {
    return (
      <View style={[s.root, { backgroundColor: colorConfig.hex, justifyContent: 'center', alignItems: 'center' }]}>
        <Text style={{ color: '#1F2937', opacity: 0.5, fontSize: 13 }}>Loading…</Text>
      </View>
    );
  }

  return (
    <View
      style={[
        s.root,
        { backgroundColor: colorConfig.hex },
        Platform.OS === 'web'
          ? ({
              boxShadow:
                '0 24px 64px rgba(0,0,0,0.55), 0 8px 24px rgba(0,0,0,0.35), 0 2px 8px rgba(0,0,0,0.2), inset 0 1px 0 rgba(255,255,255,0.45)',
            })
          : {
              shadowColor: '#000',
              shadowOffset: { width: 0, height: 12 },
              shadowOpacity: 0.5,
              shadowRadius: 30,
              elevation: 20,
            },
      ]}
    >
      {/* Paperclip decoration */}
      <Paperclip color={colorConfig.dark} />

      {/* Paper surface sheen */}
      <View style={s.sheen} pointerEvents="none" />

      {/* Header row */}
      <View style={s.header}>
        <View style={s.headerLeft}>
          <Ionicons name="pencil" size={13} color={`${colorConfig.dark}BB`} />
          <Text style={[s.noteLabel, { color: `${colorConfig.dark}99` }]}>NOTE</Text>
        </View>

        {/* Color picker */}
        <View style={s.colorPicker}>
          {PREMIUM_COLORS.map((c) => (
            <Pressable
              key={c.id}
              onPress={() => handleColorChange(c.id)}
              style={[
                s.colorDot,
                { backgroundColor: c.hex },
                colorId === c.id
                  ? {
                      borderWidth: 2,
                      borderColor: '#fff',
                      ...(Platform.OS === 'web'
                        ? ({
                            boxShadow: '0 0 0 1px rgba(0,0,0,0.25)',
                          })
                        : {}),
                    }
                  : { borderWidth: 1, borderColor: 'rgba(0,0,0,0.12)' },
              ]}
            />
          ))}
        </View>
      </View>

      {/* Divider line (like ruled paper) */}
      <View style={[s.ruled, { borderColor: `${colorConfig.dark}20` }]} />

      {/* Text body */}
      <TextInput
        style={[s.body, { color: '#1F2937' }]}
        value={text}
        onChangeText={handleTextChange}
        placeholder="Write your note…"
        placeholderTextColor={`${colorConfig.dark}88`}
        multiline
        textAlignVertical="top"
        autoFocus={!text}
        scrollEnabled
      />

      {/* Corner fold */}
      <View
        style={[
          s.cornerFold,
          {
            borderTopColor: `${colorConfig.dark}28`,
            borderLeftColor: `${colorConfig.dark}28`,
          },
        ]}
        pointerEvents="none"
      />
    </View>
  );
}

// ---------------------------------------------------------------------------
// Styles
// ---------------------------------------------------------------------------

const s = StyleSheet.create({
  root: {
    flex: 1,
    borderRadius: 14,
    overflow: 'hidden',
    position: 'relative',
  },

  sheen: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    zIndex: 0,
    pointerEvents: 'none',
    ...(Platform.OS === 'web'
      ? ({
          backgroundImage:
            'url("data:image/svg+xml,%3Csvg viewBox=\'0 0 200 200\' xmlns=\'http://www.w3.org/2000/svg\'%3E%3Cfilter id=\'n\'%3E%3CfeTurbulence type=\'fractalNoise\' baseFrequency=\'0.85\' numOctaves=\'4\' stitchTiles=\'stitch\'/%3E%3C/filter%3E%3Crect width=\'100%25\' height=\'100%25\' filter=\'url(%23n)\' opacity=\'0.04\'/%3E%3C/svg%3E"), linear-gradient(135deg, rgba(255,255,255,0.22) 0%, rgba(255,255,255,0.06) 35%, transparent 65%)',
        })
      : { backgroundColor: 'rgba(255,255,255,0.10)' }),
  },

  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingTop: 20,
    paddingBottom: 10,
    zIndex: 1,
  },

  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
  },

  noteLabel: {
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 1.2,
  },

  colorPicker: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },

  colorDot: {
    width: 18,
    height: 18,
    borderRadius: 9,
    ...(Platform.OS === 'web' ? ({ cursor: 'pointer' }) : {}),
  },

  ruled: {
    marginHorizontal: 0,
    borderBottomWidth: 1,
    zIndex: 1,
  },

  body: {
    flex: 1,
    fontSize: 16,
    lineHeight: 26,
    paddingHorizontal: 18,
    paddingTop: 14,
    paddingBottom: 24,
    zIndex: 1,
    fontFamily: Platform.OS === 'web' ? "'Georgia', serif" : undefined,
    ...(Platform.OS === 'web'
      ? ({ outlineStyle: 'none', resize: 'none' })
      : {}),
  },

  cornerFold: {
    position: 'absolute',
    bottom: 0,
    right: 0,
    width: 0,
    height: 0,
    borderStyle: 'solid',
    borderTopWidth: 24,
    borderLeftWidth: 24,
    borderBottomWidth: 0,
    borderRightWidth: 0,
    zIndex: 10,
  },
});
