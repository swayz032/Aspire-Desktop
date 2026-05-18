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
  const lastIdx = sections.length - 1;
  return (
    <View style={styles.payload} testID={testID ?? 'context-tab-payload'}>
      {sections.map((section, idx) => (
        <View
          key={section.key}
          style={[styles.section, idx !== lastIdx && styles.sectionDivider]}
          testID={`context-section-${section.key}`}
        >
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

// Premium punch list (LOCKED 2026-05-18):
//   - Hairline section dividers (1px, 8% white) between blocks — never solid
//   - Tighter vertical rhythm: section gap 24 / subsection 12 / label-value 4
//   - Section header label = uppercase, 1.6 tracking, amber dot accent
//   - Subtitle = ui-monospace telemetry feel (tight, low-emphasis)
const styles = StyleSheet.create({
  payload: {
    // 24px between major blocks — section divider hairline gives the visual
    // separation. Gap controls spacing AROUND the hairline.
    gap: 0,
  },
  section: {
    gap: 12, // subsection rhythm
    paddingTop: 12,
    paddingBottom: 12,
  },
  sectionDivider: {
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: 'rgba(255,255,255,0.08)',
  },
  headerRow: {
    gap: 4, // label-to-value rhythm
    paddingHorizontal: 4,
  },
  sectionTitle: {
    fontSize: 10,
    fontWeight: '700',
    color: 'rgba(255,255,255,0.72)',
    letterSpacing: 1.6,
    textTransform: 'uppercase',
  },
  sectionSubtitle: {
    fontSize: 10.5,
    color: 'rgba(255,255,255,0.42)',
    letterSpacing: 0.2,
    // Telemetry monospace gives the rail its premium "live console" feel.
    // RN-Web maps fontFamily strings to CSS — falls back gracefully on iOS.
    fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace',
  },
  body: {
    gap: 8,
  },
});
