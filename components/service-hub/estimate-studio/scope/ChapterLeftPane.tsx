/**
 * ChapterLeftPane — Story Mode v2 narrative side of the canvas.
 *
 * Renders the chapter header (ordinal + confidence), serif headline, and up
 * to 5 stacked rookie-clarity zones, followed by a bottom "DREW READ" source
 * strip. The pane scrolls vertically with an invisible scrollbar on web.
 *
 * Zones are rendered conditionally — an empty zone is hidden entirely (no
 * empty frame, no placeholder copy). This keeps the narrative tight when
 * Drew has nothing to say in a category. Specifically:
 *   - what_this_is hidden when string is empty/whitespace
 *   - in_scope hidden when BOTH in_scope and not_in_scope are empty
 *   - tasks / buy_list / open_questions hidden when their arrays are empty
 *
 * Law #7 compliance: this is a render layer only. Hover state is dispatched
 * up via `onHoverBullet`; no decisions, no orchestrator calls, no
 * autonomous behavior. Discipline tag styling is a pure visual mapping.
 */
import React from 'react';
import {
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
  type ViewStyle,
} from 'react-native';
import type {
  BlueprintChapter,
  ChapterDiscipline,
  ChapterMaterial,
  ChapterTask,
  OpenQuestion,
  ScopeItem,
} from '@/lib/api/blueprintsApi';

interface Props {
  chapter: BlueprintChapter;
  hoverBulletKey: string | null;
  onHoverBullet: (key: string | null) => void;
}

const AMBER = '#fbbf24';
const RED = '#ef4444';
const WHITE_92 = 'rgba(255,255,255,0.92)';
const WHITE_85 = 'rgba(255,255,255,0.85)';
const WHITE_78 = 'rgba(255,255,255,0.78)';
const WHITE_60 = 'rgba(255,255,255,0.6)';
const WHITE_45 = 'rgba(255,255,255,0.45)';
const BORDER_SUBTLE = 'rgba(255,255,255,0.08)';
const BORDER_AMBER = 'rgba(251,191,36,0.45)';

const SERIF_FAMILY = Platform.OS === 'web' ? 'ui-serif, Georgia, serif' : 'Georgia';

const INVISIBLE_SCROLLBAR_WEB: ViewStyle =
  Platform.OS === 'web'
    ? (({ scrollbarWidth: 'none', msOverflowStyle: 'none' } as unknown) as ViewStyle)
    : {};

// 2026-05-23 — Belt-and-suspenders for the invisible scrollbar on web.
// `scrollbarWidth: 'none'` in the inline style sometimes doesn't bind to
// RN-Web's underlying scroll element (the inline style is hoisted onto the
// content container, not the overflow:auto wrapper). This stylesheet
// targets the data-attribute we hang on the ScrollView so the underlying
// browser scrollbar disappears for both webkit and firefox. Same pattern
// the Tim Rail Context tab uses.
if (Platform.OS === 'web' && typeof document !== 'undefined') {
  const STYLE_ID = 'chapter-left-pane-scrollbar-hide';
  if (!document.getElementById(STYLE_ID)) {
    const styleEl = document.createElement('style');
    styleEl.id = STYLE_ID;
    styleEl.textContent = `
      [data-chapter-left-pane="1"] { scrollbar-width: none; -ms-overflow-style: none; }
      [data-chapter-left-pane="1"]::-webkit-scrollbar { width: 0; height: 0; display: none; }
    `;
    document.head.appendChild(styleEl);
  }
}

const DISCIPLINE_STYLE: Record<ChapterDiscipline, { bg: string; fg: string; label: string }> = {
  demo:   { bg: 'rgba(239,68,68,0.12)',  fg: '#ef4444', label: 'DEMO' },
  frame:  { bg: 'rgba(255,255,255,0.06)', fg: 'rgba(255,255,255,0.78)', label: 'FRAME' },
  plumb:  { bg: 'rgba(251,191,36,0.18)', fg: '#fbbf24', label: 'PLUMB' },
  mech:   { bg: 'rgba(251,191,36,0.18)', fg: '#fbbf24', label: 'MECH' },
  elec:   { bg: 'rgba(251,191,36,0.18)', fg: '#fbbf24', label: 'ELEC' },
  finish: { bg: 'rgba(255,255,255,0.06)', fg: 'rgba(255,255,255,0.78)', label: 'FINISH' },
  fp:     { bg: 'rgba(239,68,68,0.12)',  fg: '#ef4444', label: 'FP' },
  other:  { bg: 'rgba(255,255,255,0.05)', fg: 'rgba(255,255,255,0.65)', label: 'OTHER' },
};

interface ZoneFrameProps {
  testID: string;
  icon: string;
  title: string;
  accent: string;
  count?: number;
  children: React.ReactNode;
}

function ZoneFrame({ testID, icon, title, accent, count, children }: ZoneFrameProps) {
  return (
    <View testID={testID} style={styles.zone}>
      <View style={styles.zoneHeader}>
        <Text style={[styles.zoneIcon, { color: accent }]}>{icon}</Text>
        <Text style={[styles.zoneTitle, { color: accent }]}>{title}</Text>
        {typeof count === 'number' ? (
          <Text style={[styles.zoneCount, { color: accent }]}>{count}</Text>
        ) : null}
      </View>
      <View style={styles.zoneBody}>{children}</View>
    </View>
  );
}

export function ChapterLeftPane({ chapter, hoverBulletKey, onHoverBullet }: Props) {
  const { zones } = chapter;
  const ordinalStr = String(chapter.ordinal).padStart(2, '0');
  const confidencePct = Math.round(chapter.confidence * 100);

  // 2026-05-23 — Always render all 5 zones (with empty-state copy inside
  // each) so the contractor sees the full design intent on every chapter,
  // even when Drew has only partial output. Empty zones explain what will
  // appear there as the pipeline progresses.
  const hasWhatThisIs = zones.what_this_is.trim() !== '';
  const hasInScope = zones.in_scope.length > 0 || zones.not_in_scope.length > 0;
  const hasTasks = zones.tasks.length > 0;
  const hasBuyList = zones.buy_list.length > 0;
  const hasOpenQuestions = zones.open_questions.length > 0;

  return (
    <ScrollView
      style={[styles.root, INVISIBLE_SCROLLBAR_WEB]}
      contentContainerStyle={styles.content}
      showsVerticalScrollIndicator={false}
      dataSet={Platform.OS === 'web' ? ({ chapterLeftPane: '1' } as Record<string, unknown>) : undefined}
    >
      {/* Header row */}
      <View style={styles.headerRow}>
        <Text testID="chapter-left-ordinal" style={styles.ordinal}>
          {`CHAPTER ${ordinalStr} of —`}
        </Text>
        <View style={styles.spacer} />
        <Text testID="chapter-left-confidence" style={styles.confidence}>
          {`${confidencePct}%`}
        </Text>
      </View>

      {/* Headline */}
      <Text style={styles.headline}>{chapter.title}</Text>

      {/* Zone 1 — WHAT THIS IS (always renders) */}
      <ZoneFrame testID="zone-what-this-is" icon="?" title="WHAT THIS IS" accent={WHITE_60}>
        {hasWhatThisIs ? (
          <Text style={styles.bodyText}>{zones.what_this_is}</Text>
        ) : (
          <Text style={styles.emptyHint}>Drew has not summarized this chapter yet — a plain-English overview will appear here once classification completes.</Text>
        )}
      </ZoneFrame>

      {/* Zone 2 — WHAT'S IN SCOPE (always renders) */}
      <ZoneFrame testID="zone-in-scope" icon="●" title="WHAT'S IN SCOPE" accent={AMBER}>
        {hasInScope ? (
          <>
            {zones.in_scope.map((item: ScopeItem, i: number) => (
              <View key={`in-${i}`} style={styles.inScopeRow}>
                <Text style={styles.amberDot}>·</Text>
                <Text style={styles.bodyText}>{item.text_md}</Text>
              </View>
            ))}
            {zones.not_in_scope.length > 0 ? (
              <View style={styles.notInScopeBlock}>
                {zones.not_in_scope.map((item: ScopeItem, i: number) => (
                  <View key={`out-${i}`} style={styles.notInScopeRow}>
                    <Text style={styles.redX}>✗</Text>
                    <Text style={styles.mutedBody}>{item.text_md}</Text>
                  </View>
                ))}
              </View>
            ) : null}
          </>
        ) : (
          <Text style={styles.emptyHint}>Scope items appear here as Drew identifies them — typically one bullet per fixture group, partition, or major assembly.</Text>
        )}
      </ZoneFrame>

      {/* Zone 3 — WHAT YOU HAVE TO DO (always renders) */}
      <ZoneFrame
        testID="zone-tasks"
        icon="✓"
        title="WHAT YOU HAVE TO DO"
        accent={AMBER}
        count={hasTasks ? zones.tasks.length : undefined}
      >
        {hasTasks ? (
          zones.tasks.map((task: ChapterTask, i: number) => {
            const key = `task-${i}`;
            const hovered = hoverBulletKey === key;
            const tag = DISCIPLINE_STYLE[task.discipline] ?? DISCIPLINE_STYLE.other;
            return (
              <Pressable
                key={key}
                onHoverIn={() => onHoverBullet(key)}
                onHoverOut={() => onHoverBullet(null)}
                accessibilityRole="checkbox"
                accessibilityState={{ checked: false }}
                accessibilityLabel={`${task.text_md}, ${tag.label} task, unchecked`}
                style={[styles.taskRow, hovered && styles.taskRowHovered]}
              >
                <View style={[styles.checkbox, hovered && styles.checkboxHovered]} />
                <View style={styles.taskTextWrap}>
                  <Text style={styles.bodyText}>{task.text_md}</Text>
                  <View style={[styles.disciplineTag, { backgroundColor: tag.bg }]}>
                    <Text style={[styles.disciplineTagText, { color: tag.fg }]}>{tag.label}</Text>
                  </View>
                </View>
              </Pressable>
            );
          })
        ) : (
          <Text style={styles.emptyHint}>Drew is still pulling tasks from the discipline plans. Check back as the pipeline progresses.</Text>
        )}
      </ZoneFrame>

      {/* Zone 4 — WHAT YOU NEED TO BUY (always renders) */}
      <ZoneFrame
        testID="zone-buy-list"
        icon="$"
        title="WHAT YOU NEED TO BUY"
        accent={AMBER}
        count={hasBuyList ? zones.buy_list.length : undefined}
      >
        {hasBuyList ? (
          zones.buy_list.map((mat: ChapterMaterial, i: number) => (
            <View key={`buy-${i}`} style={styles.buyRow}>
              <Text style={styles.buyQty}>{mat.quantity_display}</Text>
              <Text style={[styles.bodyText, styles.buyName]}>{mat.name}</Text>
              <Text style={styles.takeoffHint}>Takeoff</Text>
            </View>
          ))
        ) : (
          <Text style={styles.emptyHint}>Materials for this chapter appear here as Drew identifies them. The master list across all chapters lives in Takeoff → Materials.</Text>
        )}
      </ZoneFrame>

      {/* Zone 5 — WHAT'S STILL UNCLEAR (always renders) */}
      <ZoneFrame
        testID="zone-open-questions"
        icon="?"
        title="WHAT'S STILL UNCLEAR"
        accent={RED}
        count={hasOpenQuestions ? zones.open_questions.length : undefined}
      >
        {hasOpenQuestions ? (
          zones.open_questions.map((q: OpenQuestion) => (
            <View key={q.question_id} style={styles.questionCallout}>
              <Text style={styles.questionWarn}>⚠</Text>
              <View style={styles.questionTextWrap}>
                <Text style={styles.questionTitle}>{q.title}</Text>
                <Text style={styles.questionBody}>{q.body_md}</Text>
              </View>
            </View>
          ))
        ) : (
          <Text style={styles.emptyHint}>0 open questions — Drew flags ambiguities here as it reads. None spotted yet.</Text>
        )}
      </ZoneFrame>

      {/* Sources strip — hidden when no source sheets (matches empty-zone hiding rule). */}
      {chapter.source_sheets.length > 0 ? (
        <View style={styles.sourcesStrip}>
          <Text style={styles.sourcesLabel}>DREW READ</Text>
          <View style={styles.sourcesChipsWrap}>
            {chapter.source_sheets.map((s) => (
              <View
                key={s.sheet_code}
                testID={`source-chip-${s.sheet_code}`}
                style={styles.sourceChip}
              >
                <Text style={styles.sourceChipText}>{s.sheet_code}</Text>
              </View>
            ))}
          </View>
        </View>
      ) : null}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: 'transparent' },
  content: { paddingHorizontal: 28, paddingVertical: 24, paddingBottom: 48 },

  headerRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 10 },
  ordinal: {
    color: AMBER,
    fontSize: 11,
    letterSpacing: 1.4,
    fontWeight: '600',
  },
  spacer: { flex: 1 },
  confidence: {
    color: AMBER,
    fontSize: 12,
    fontWeight: '600',
    fontVariant: ['tabular-nums'],
  },

  headline: {
    color: WHITE_92,
    fontSize: 22,
    lineHeight: 28,
    letterSpacing: -0.4,
    fontFamily: SERIF_FAMILY,
    marginBottom: 22,
  },

  zone: { marginTop: 18 },
  zoneHeader: { flexDirection: 'row', alignItems: 'center', marginBottom: 10 },
  zoneIcon: { fontSize: 11, marginRight: 6, fontWeight: '700' },
  zoneTitle: {
    fontSize: 10,
    letterSpacing: 1.3,
    fontWeight: '700',
  },
  zoneCount: {
    marginLeft: 8,
    fontSize: 10,
    fontWeight: '700',
    fontVariant: ['tabular-nums'],
  },
  zoneBody: { gap: 6 },

  bodyText: { color: WHITE_92, fontSize: 14, lineHeight: 21 },
  mutedBody: { color: WHITE_60, fontSize: 14, lineHeight: 21, flex: 1 },

  inScopeRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 8, paddingVertical: 2 },
  amberDot: { color: AMBER, fontSize: 16, lineHeight: 21, fontWeight: '700' },

  notInScopeBlock: {
    marginTop: 10,
    paddingTop: 10,
    borderTopWidth: 1,
    borderTopColor: BORDER_SUBTLE,
    borderStyle: 'dashed',
    gap: 4,
  },
  notInScopeRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 8 },
  redX: { color: RED, fontSize: 13, lineHeight: 21, fontWeight: '700' },

  taskRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
    paddingVertical: 8,
    paddingHorizontal: 10,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: 'transparent',
  },
  taskRowHovered: { borderColor: BORDER_AMBER, backgroundColor: 'rgba(251,191,36,0.04)' },
  checkbox: {
    width: 13,
    height: 13,
    borderRadius: 3,
    borderWidth: 1,
    borderColor: WHITE_45,
    marginTop: 4,
  },
  checkboxHovered: { borderColor: AMBER },
  taskTextWrap: { flex: 1, flexDirection: 'row', alignItems: 'flex-start', flexWrap: 'wrap', gap: 8 },
  disciplineTag: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 3,
    alignSelf: 'flex-start',
  },
  disciplineTagText: { fontSize: 9, fontWeight: '700', letterSpacing: 0.8 },

  buyRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingVertical: 6,
  },
  buyQty: { color: AMBER, fontSize: 13, fontWeight: '700', fontVariant: ['tabular-nums'], minWidth: 28 },
  buyName: { flex: 1 },
  takeoffHint: { color: WHITE_45, fontSize: 11, letterSpacing: 0.4 },
  // Empty-state copy inside a zone — italic, dim, slightly smaller than body.
  emptyHint: {
    color: WHITE_60,
    fontSize: 12,
    lineHeight: 17,
    fontStyle: 'italic',
  },

  questionCallout: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
    padding: 12,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: 'rgba(251,191,36,0.25)',
    backgroundColor: 'rgba(251,191,36,0.05)',
    marginTop: 4,
  },
  questionWarn: { color: AMBER, fontSize: 14, fontWeight: '700', lineHeight: 20 },
  questionTextWrap: { flex: 1, gap: 4 },
  questionTitle: { color: WHITE_92, fontSize: 14, fontWeight: '700' },
  questionBody: { color: WHITE_85, fontSize: 13, lineHeight: 19 },

  sourcesStrip: {
    marginTop: 28,
    paddingTop: 14,
    borderTopWidth: 1,
    borderTopColor: BORDER_SUBTLE,
    gap: 8,
  },
  sourcesLabel: { color: WHITE_45, fontSize: 10, letterSpacing: 1.4, fontWeight: '700' },
  sourcesChipsWrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  sourceChip: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 4,
    borderWidth: 1,
    borderColor: BORDER_SUBTLE,
    backgroundColor: 'rgba(255,255,255,0.03)',
  },
  sourceChipText: { color: WHITE_78, fontSize: 10, fontWeight: '600', letterSpacing: 0.6 },
});
