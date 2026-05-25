/**
 * SmartText — interactive text renderer for Story Mode v2 left-pane bodies.
 *
 * Takes a string and:
 *   - Underlines + tooltips known abbreviations from the glossary
 *     (e.g. EWC → "Electric Water Cooler" on hover)
 *   - Renders sheet codes (A-101, P-101, FP-101, etc.) as Pressable chips
 *     that call `onSheetJump` so a tap navigates to that sheet
 *   - Leaves everything else as plain text, inline with the surrounding flow
 *
 * The parsing lives in `lib/scope/glossary.ts` as a pure function so it's
 * easy to test in isolation. This component is render-only (Law #7).
 *
 * Web touch-up: each glossary <Text> sets the underlying DOM `title`
 * attribute via accessibilityLabel so browser-native hover tooltips show
 * the expansion even without a custom popover.
 */
import React from 'react';
import { Pressable, StyleSheet, Text, type TextStyle } from 'react-native';
import { parseTextWithMatches } from '@/lib/scope/glossary';

interface Props {
  children: string;
  /** Base text style applied to the wrapping <Text>. Glossary + sheet
   *  segments add their own underline/border on top. */
  style?: TextStyle;
  /** Optional. Fired when the user taps a sheet-code chip. Receives the
   *  full code like 'A-101'. No-op if omitted. */
  onSheetJump?: (sheetCode: string) => void;
}

export function SmartText({ children, style, onSheetJump }: Props): React.ReactElement {
  const segments = parseTextWithMatches(children ?? '');
  return (
    <Text style={style}>
      {segments.map((seg, i) => {
        const key = `${seg.kind}-${i}`;
        if (seg.kind === 'plain') {
          return <Text key={key}>{seg.text}</Text>;
        }
        if (seg.kind === 'glossary') {
          // Inline decorated span. Web tooltip via accessibilityLabel
          // (RN-Web maps to `aria-label`; many browsers also show it on
          // hover for native tooltip behavior).
          return (
            <Text
              key={key}
              accessibilityRole="text"
              accessibilityLabel={`${seg.text} — ${seg.meta}`}
              style={styles.glossary}
              testID={`glossary-${seg.text}`}
            >
              {seg.text}
            </Text>
          );
        }
        // sheet
        return (
          <Text
            key={key}
            accessibilityRole="button"
            accessibilityLabel={`Jump to sheet ${seg.text}`}
            style={styles.sheetChip}
            onPress={onSheetJump ? () => onSheetJump(seg.text) : undefined}
            testID={`smart-sheet-jump-${seg.text}`}
          >
            {seg.text}
          </Text>
        );
      })}
    </Text>
  );
}

const styles = StyleSheet.create({
  // Dotted-underline + amber accent for known abbreviations. Hovering on
  // web shows the browser-native tooltip via aria-label.
  glossary: {
    color: '#fbbf24',
    textDecorationLine: 'underline',
    textDecorationStyle: 'dotted',
    textDecorationColor: 'rgba(251,191,36,0.55)',
  },
  // Sheet-code chip. Inline visual — amber border + tiny padding so it
  // reads as a tappable target without breaking text flow.
  sheetChip: {
    color: '#fbbf24',
    fontWeight: '700',
    backgroundColor: 'rgba(251,191,36,0.08)',
    borderWidth: 1,
    borderColor: 'rgba(251,191,36,0.35)',
    borderRadius: 4,
    paddingHorizontal: 4,
    marginHorizontal: 1,
  },
});
