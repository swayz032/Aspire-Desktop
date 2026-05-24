/**
 * ChapterStrip — horizontally scrolling strip of chapter cards under
 * the Story Mode v2 canvas. Each card = blueprint thumbnail (or amber
 * placeholder) + ordinal label + plain-English title. Active card gets
 * an amber border + subtle amber fill. Cards with open questions get a
 * "N · OPEN" ordinal suffix so the reader can scan for unresolved items.
 *
 * Law #7: render layer only. Selection dispatched up via onSelect.
 */
import React from 'react';
import {
  Image, Pressable, ScrollView, StyleSheet, Text, View,
} from 'react-native';
import type { BlueprintChapter } from '@/lib/api/blueprintsApi';

interface Props {
  chapters: BlueprintChapter[];
  activeKey: string | null;
  onSelect: (key: string) => void;
}

export function ChapterStrip({ chapters, activeKey, onSelect }: Props): React.ReactElement {
  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator
      style={styles.strip}
      contentContainerStyle={styles.stripContent}
      testID="chapter-strip"
    >
      {chapters.map((ch) => {
        const isActive = ch.key === activeKey;
        const hasOpen = ch.zones.open_questions.length > 0;
        const ordinalLabel = `${String(ch.ordinal).padStart(2, '0')}${hasOpen ? ' · OPEN' : ''}`;
        return (
          <Pressable
            key={ch.key}
            testID={`chapter-card-${ch.key}`}
            accessibilityRole="button"
            accessibilityLabel={`Chapter ${ch.ordinal}: ${ch.title}${hasOpen ? ', has open questions' : ''}`}
            accessibilityState={{ selected: isActive }}
            onPress={() => onSelect(ch.key)}
            style={[styles.card, isActive && styles.cardActive]}
          >
            <View style={styles.thumb}>
              {ch.thumbnail_url ? (
                <Image
                  source={{ uri: ch.thumbnail_url }}
                  style={styles.thumbImg}
                  testID={`chapter-card-${ch.key}-thumb`}
                  accessibilityLabel={`Preview of ${ch.title}`}
                />
              ) : (
                <View
                  style={styles.thumbPlaceholder}
                  testID={`chapter-card-${ch.key}-thumb-placeholder`}
                />
              )}
            </View>
            <View style={styles.meta}>
              <Text
                style={[styles.ordinal, isActive && styles.ordinalActive]}
                testID={`chapter-card-${ch.key}-ordinal`}
              >
                {ordinalLabel}
              </Text>
              <Text
                style={[styles.title, isActive && styles.titleActive]}
                numberOfLines={2}
              >
                {ch.title}
              </Text>
            </View>
          </Pressable>
        );
      })}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  // HOTFIX 2026-05-23 — `flexGrow: 0` keeps the strip from inflating to fill
  // its flex parent (StoryPanelV2's card column). Without it, the ScrollView
  // would stretch vertically and pull the cards with it.
  strip: {
    flexGrow: 0,
    flexShrink: 0,
    borderTopWidth: 1,
    borderTopColor: 'rgba(251,191,36,0.10)',
  },
  // HOTFIX 2026-05-23 — `alignItems: 'flex-start'` overrides React Native's
  // default `stretch`, which was making every chapter card inflate to the
  // strip's cross-axis height (~400px tall instead of ~108px). The explicit
  // `card.height` below is belt-and-suspenders against future parent-flex
  // changes. `flexGrow: 1` on the content container lets the cards spread
  // across the available width when there are few chapters (instead of
  // leaving a big right gap), but the strip still scrolls horizontally
  // when the projected card width would drop below min.
  stripContent: { gap: 8, padding: 10, alignItems: 'flex-start', flexGrow: 1 },
  card: {
    flex: 1,
    flexBasis: 140,
    minWidth: 140,
    maxWidth: 240,
    height: 112,
    borderRadius: 7,
    backgroundColor: 'rgba(255,255,255,0.02)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.05)',
    overflow: 'hidden',
  },
  cardActive: {
    backgroundColor: 'rgba(251,191,36,0.10)',
    borderColor: '#fbbf24',
  },
  thumb: { height: 60, backgroundColor: '#fff', overflow: 'hidden' },
  thumbImg: { width: '100%', height: '100%' },
  thumbPlaceholder: {
    flex: 1,
    backgroundColor: 'rgba(251,191,36,0.08)',
  },
  meta: { padding: 7 },
  ordinal: {
    fontSize: 8,
    color: 'rgba(255,255,255,0.45)',
    letterSpacing: 1,
    fontWeight: '700',
  },
  ordinalActive: { color: '#fbbf24' },
  title: {
    color: 'rgba(255,255,255,0.82)',
    fontSize: 10,
    fontWeight: '600',
    lineHeight: 12,
    marginTop: 1,
  },
  titleActive: { color: '#fff', fontWeight: '700' },
});
