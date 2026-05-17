/**
 * ContextTabPayload — Wave 6A shared shell.
 *
 * Generic per-tab payload host that extends the Tim Rail Context tab. The
 * Context tab itself stays a single column; per-tab content is injected
 * via this component as a list of titled sections.
 *
 * Used by:
 *   - Wave 6A: PlansPhotosTab payload (pipeline status, discipline counts,
 *     last upload, revision activity).
 *   - Wave 7+: Scope, Takeoff, Estimate tabs each pass their own sections.
 *
 * Law #7: pure render — no fetch, no decision.
 */
import React from 'react';
import { StyleSheet, Text, View } from 'react-native';

export interface ContextSection {
  /** Stable key for React. */
  key: string;
  /** Section title (small caps tracking, like the rest of the rail). */
  title: string;
  /** Optional one-line subtitle under the title. */
  subtitle?: string;
  /** Section body — anything React-rendered. */
  render: () => React.ReactNode;
}

interface Props {
  sections: ContextSection[];
  testID?: string;
}

export function ContextTabPayload({ sections, testID }: Props): React.ReactElement {
  return (
    <View style={styles.payload} testID={testID ?? 'context-tab-payload'}>
      {sections.map((section) => (
        <View key={section.key} style={styles.section} testID={`context-section-${section.key}`}>
          <View style={styles.headerRow}>
            <Text style={styles.sectionTitle}>{section.title}</Text>
            {section.subtitle ? (
              <Text style={styles.sectionSubtitle}>{section.subtitle}</Text>
            ) : null}
          </View>
          <View style={styles.body}>{section.render()}</View>
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  payload: {
    gap: 16,
  },
  section: {
    gap: 8,
  },
  headerRow: {
    gap: 2,
    paddingHorizontal: 4,
  },
  sectionTitle: {
    fontSize: 9.5,
    fontWeight: '700',
    color: 'rgba(255,255,255,0.62)',
    letterSpacing: 1.4,
    textTransform: 'uppercase',
  },
  sectionSubtitle: {
    fontSize: 11,
    color: 'rgba(255,255,255,0.48)',
    letterSpacing: -0.05,
  },
  body: {
    gap: 6,
  },
});
