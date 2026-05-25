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
import React, { useState } from 'react';
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
import { SmartText } from './SmartText';
import { archetypeFor } from '@/lib/scope/archetype';
import { storyForSheet, type PerSheetStory } from '@/lib/scope/per-sheet-content';
import { sheetDisplayName } from '@/lib/scope/sheet-naming';

interface Props {
  chapter: BlueprintChapter;
  hoverBulletKey: string | null;
  onHoverBullet: (key: string | null) => void;
  /** Optional. Fired when the user taps an inline sheet-code chip in any
   *  zone body (e.g. "see A-101"). Wires through SmartText. Parent (StoryPanelV2)
   *  routes this to its activeSheetCode setter. No-op if omitted. */
  onSheetJump?: (sheetCode: string) => void;
  /** Total chapter count in the story — used to render "CHAPTER N of M" in
   *  the header. When omitted, falls back to "CHAPTER N of —". */
  totalChapters?: number;
  /** View mode: 'chapter' shows the chapter-level zones; 'sheet' shows
   *  per-sheet story content for the active sheet. Default 'chapter'. */
  viewMode?: 'chapter' | 'sheet';
  /** Required when viewMode='sheet'. The sheet whose story the left pane
   *  should render. When viewMode='chapter' this is ignored. */
  activeSheet?: { sheet_code: string; sheet_title: string } | null;
  /** Fired when the user toggles the chapter/sheet view via the header
   *  switch. Lifted to StoryPanelV2 so external state (sheet tab clicks)
   *  can stay in sync. No-op if omitted. */
  onViewModeChange?: (mode: 'chapter' | 'sheet') => void;
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
  defaultExpanded?: boolean;
  children: React.ReactNode;
}

/**
 * ZoneFrame — collapsible chapter zone. Header is a Pressable that toggles
 * the body. Caret indicator on the right shows current state. `defaultExpanded`
 * sets the initial state; callers pass true for the first 2 zones so a rookie
 * sees what they need immediately, then can drill into the rest on demand.
 */
function ZoneFrame({ testID, icon, title, accent, count, defaultExpanded = false, children }: ZoneFrameProps) {
  const [expanded, setExpanded] = useState<boolean>(defaultExpanded);
  return (
    <View testID={testID} style={[styles.zone, expanded && styles.zoneExpanded]}>
      <Pressable
        onPress={() => setExpanded((v) => !v)}
        accessibilityRole="button"
        accessibilityLabel={`${title}, ${expanded ? 'collapse' : 'expand'}`}
        accessibilityState={{ expanded }}
        style={({ hovered }: { hovered?: boolean }) => [
          styles.zoneHeader,
          expanded && styles.zoneHeaderActive,
          hovered && styles.zoneHeaderHover,
        ]}
        testID={`${testID}-toggle`}
      >
        {/* Title leads; icon (when present) appears AFTER the title so it
            reads naturally — "WHAT THIS IS ?" instead of "? WHAT THIS IS".
            Count pill goes between icon and the right-aligned caret. */}
        <Text style={[styles.zoneTitle, { color: accent }]}>{title}</Text>
        {icon ? <Text style={[styles.zoneIcon, { color: accent }]}>{icon}</Text> : null}
        {typeof count === 'number' ? (
          <View style={[styles.zoneCountPill, { borderColor: accent }]}>
            <Text style={[styles.zoneCountPillText, { color: accent }]}>{count}</Text>
          </View>
        ) : null}
        <View style={styles.zoneSpacer} />
        <Text style={[styles.zoneCaret, { color: accent }]}>
          {expanded ? '▾' : '▸'}
        </Text>
      </Pressable>
      {expanded ? <View style={styles.zoneBody}>{children}</View> : null}
    </View>
  );
}

/**
 * SheetView — per-sheet story renderer used when the left pane is in
 * sheet mode. Derives content from the sheet's archetype (Plan / Schedule /
 * Detail / etc.) + the chapter's discipline + the sheet's title.
 *
 * Renders three zones at most (WHAT THIS SHEET SHOWS / WHAT'S ON IT /
 * WHEN TO USE IT / WATCH OUT FOR), all using the SmartText decorator so
 * sheet-code references and glossary terms stay interactive.
 */
function SheetView({
  sheet,
  chapterKey,
  onSheetJump,
}: {
  sheet: { sheet_code: string; sheet_title: string };
  chapterKey: string;
  onSheetJump?: (sheetCode: string) => void;
}): React.ReactElement {
  const arch = archetypeFor(sheet.sheet_code, sheet.sheet_title);
  const story: PerSheetStory = storyForSheet(arch.archetype, chapterKey, sheet.sheet_code, sheet.sheet_title);

  return (
    <View testID="sheet-view">
      {/* Archetype chip pinned at top of sheet view */}
      <View style={styles.sheetArchetypeRow}>
        <Text style={styles.sheetArchetypeChip}>{arch.label.toUpperCase()}</Text>
      </View>

      {/* WHAT THIS SHEET SHOWS — primary content; amber accent so the
          title reads at the same visual weight as IN SCOPE / WHAT TO BUY
          (was greyed-out at WHITE_60 which made it look secondary). */}
      <ZoneFrame testID="zone-sheet-shows" icon="?" title="WHAT THIS SHEET SHOWS" accent={AMBER} defaultExpanded>
        <SmartText style={styles.bodyText} onSheetJump={onSheetJump}>{story.whatThisSheetShows}</SmartText>
      </ZoneFrame>

      {/* WHAT'S ON IT */}
      <ZoneFrame testID="zone-sheet-whats-on-it" icon="●" title="WHAT'S ON IT" accent={AMBER} defaultExpanded count={story.whatsOnIt.length}>
        {story.whatsOnIt.map((item, i) => (
          <View key={`on-${i}`} style={styles.inScopeRow}>
            <Text style={styles.amberDot}>·</Text>
            <SmartText style={styles.bodyText} onSheetJump={onSheetJump}>{item}</SmartText>
          </View>
        ))}
      </ZoneFrame>

      {/* WHEN TO USE IT */}
      <ZoneFrame testID="zone-sheet-when" icon="⏱" title="WHEN TO USE THIS SHEET" accent={AMBER}>
        <SmartText style={styles.bodyText} onSheetJump={onSheetJump}>{story.whenToUseIt}</SmartText>
      </ZoneFrame>

      {/* WHAT TO BUY FOR THIS SHEET — purpose-specific procurement list.
          Critical for a rookie: every sheet that drives field work has
          materials you have to order. Empty-state copy renders when the
          archetype doesn't drive procurement (cover/index/legend). */}
      <ZoneFrame
        testID="zone-sheet-buy"
        icon="$"
        title="WHAT TO BUY FOR THIS SHEET"
        accent={AMBER}
        count={story.whatToBuy.length > 0 ? story.whatToBuy.length : undefined}
      >
        {story.whatToBuy.length > 0 ? (
          story.whatToBuy.map((item, i) => (
            <View key={`sheetbuy-${i}`} style={styles.inScopeRow}>
              <Text style={styles.amberDot}>·</Text>
              <SmartText style={styles.bodyText} onSheetJump={onSheetJump}>{item}</SmartText>
            </View>
          ))
        ) : (
          <Text style={styles.emptyHint}>This sheet doesn&apos;t drive procurement on its own — the buy-list lives on the schedule or plan sheets in this chapter.</Text>
        )}
      </ZoneFrame>

      {/* WATCH OUT FOR (this sheet) */}
      <ZoneFrame testID="zone-sheet-watchouts" icon="⚠" title="WATCH OUT FOR (this sheet)" accent={RED} count={story.watchOutFor.length}>
        {story.watchOutFor.map((m, i) => (
          <View key={`watch-${i}`} style={styles.mistakeRow}>
            <Text style={styles.mistakeIcon}>⚠</Text>
            <SmartText style={styles.bodyText} onSheetJump={onSheetJump}>{m}</SmartText>
          </View>
        ))}
      </ZoneFrame>
    </View>
  );
}

export function ChapterLeftPane({
  chapter,
  hoverBulletKey,
  onHoverBullet,
  onSheetJump,
  totalChapters,
  viewMode = 'chapter',
  activeSheet,
  onViewModeChange,
}: Props) {
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
      {/* Sticky header — orientation block stays visible while zones scroll.
          Wrapper has position:sticky on web (`stickyHeaderWeb`); on native
          it's just a regular View. Contains: ordinal/confidence + view
          toggle + headline so the rookie never loses chapter context. */}
      <View style={styles.stickyHeaderWeb}>
        {/* Header row — ordinal + "of N" + confidence */}
        <View style={styles.headerRow}>
          <Text testID="chapter-left-ordinal" style={styles.ordinal}>
            {`CHAPTER ${ordinalStr} of ${typeof totalChapters === 'number' && totalChapters > 0 ? totalChapters : '—'}`}
          </Text>
          <View style={styles.spacer} />
          <Text testID="chapter-left-confidence" style={styles.confidence}>
            {`${confidencePct}%`}
          </Text>
        </View>

        {/* View-mode toggle — [📖 Chapter] [📄 Sheet]. Sheet mode only
            available when an activeSheet is provided. */}
        {activeSheet ? (
          <View style={styles.viewToggle} testID="chapter-left-view-toggle">
            <Pressable
              onPress={() => onViewModeChange?.('chapter')}
              accessibilityRole="tab"
              accessibilityLabel="Show chapter overview"
              accessibilityState={{ selected: viewMode === 'chapter' }}
              style={({ hovered }: { hovered?: boolean }) => [
                styles.viewToggleBtn,
                viewMode === 'chapter' && styles.viewToggleBtnActive,
                viewMode !== 'chapter' && hovered ? styles.viewToggleBtnHover : null,
              ]}
              testID="view-toggle-chapter"
            >
              <Text style={[styles.viewToggleText, viewMode === 'chapter' && styles.viewToggleTextActive]}>
                📖  Chapter
              </Text>
            </Pressable>
            <Pressable
              onPress={() => onViewModeChange?.('sheet')}
              accessibilityRole="tab"
              accessibilityLabel={`Show story for sheet ${activeSheet.sheet_code}`}
              accessibilityState={{ selected: viewMode === 'sheet' }}
              style={({ hovered }: { hovered?: boolean }) => [
                styles.viewToggleBtn,
                viewMode === 'sheet' && styles.viewToggleBtnActive,
                viewMode !== 'sheet' && hovered ? styles.viewToggleBtnHover : null,
              ]}
              testID="view-toggle-sheet"
            >
              <Text style={[styles.viewToggleText, viewMode === 'sheet' && styles.viewToggleTextActive]}>
                {`📄  ${activeSheet.sheet_code}`}
              </Text>
            </Pressable>
          </View>
        ) : null}

        {/* Headline — chapter title in chapter mode; purpose-specific
            sheet name in sheet mode (e.g. "PT-1 · Partition Schedule"
            instead of just "PT-1"). */}
        {viewMode === 'sheet' && activeSheet ? (
          <>
            <Text style={styles.headline}>{activeSheet.sheet_code}</Text>
            <Text style={styles.subHeadline}>
              {sheetDisplayName(activeSheet.sheet_code, activeSheet.sheet_title).secondary}
            </Text>
          </>
        ) : (
          <Text style={styles.headline}>{chapter.title}</Text>
        )}
      </View>

      {/* ─── SHEET VIEW — renders per-sheet story when toggle is in sheet mode ─── */}
      {viewMode === 'sheet' && activeSheet ? (
        <SheetView
          sheet={activeSheet}
          chapterKey={chapter.key}
          onSheetJump={onSheetJump}
        />
      ) : null}

      {/* ─── CHAPTER VIEW — all the existing chapter zones below ─── */}
      {viewMode !== 'chapter' ? null : (
        <>
      {/* TL;DR — 3-bullet skim pinned right under the headline. Renders only
          when the adapter supplied tldr content. Not collapsible — the
          rookie should always see the skim first. */}
      {zones.tldr && zones.tldr.length > 0 ? (
        <View style={styles.tldrBlock} testID="zone-tldr">
          <Text style={styles.tldrLabel}>SKIM IN 5 SECONDS</Text>
          {zones.tldr.map((b, i) => (
            <View key={`tldr-${i}`} style={styles.tldrRow}>
              <Text style={styles.tldrBullet}>·</Text>
              <SmartText style={styles.tldrText} onSheetJump={onSheetJump}>{b}</SmartText>
            </View>
          ))}
        </View>
      ) : null}

      {/* Zone 1 — WHAT THIS IS (always renders).
          Amber accent so the title is full-weight instead of greyed-out
          (was WHITE_60, which made it look secondary even though it's
          the orientation zone every rookie reads first). */}
      <ZoneFrame testID="zone-what-this-is" icon="?" title="WHAT THIS IS" accent={AMBER} defaultExpanded>
        {hasWhatThisIs ? (
          <SmartText style={styles.bodyText} onSheetJump={onSheetJump}>{zones.what_this_is}</SmartText>
        ) : (
          <Text style={styles.emptyHint}>Drew has not summarized this chapter yet — a plain-English overview will appear here once classification completes.</Text>
        )}
      </ZoneFrame>

      {/* Zone 2 — WHAT'S IN SCOPE (always renders) */}
      <ZoneFrame testID="zone-in-scope" icon="●" title="WHAT'S IN SCOPE" accent={AMBER} defaultExpanded>
        {hasInScope ? (
          <>
            {zones.in_scope.map((item: ScopeItem, i: number) => (
              <View key={`in-${i}`} style={styles.inScopeRow}>
                <Text style={styles.amberDot}>·</Text>
                <SmartText style={styles.bodyText} onSheetJump={onSheetJump}>{item.text_md}</SmartText>
              </View>
            ))}
            {zones.not_in_scope.length > 0 ? (
              <View style={styles.notInScopeBlock}>
                {zones.not_in_scope.map((item: ScopeItem, i: number) => (
                  <View key={`out-${i}`} style={styles.notInScopeRow}>
                    <Text style={styles.redX}>✗</Text>
                    <SmartText style={styles.mutedBody} onSheetJump={onSheetJump}>{item.text_md}</SmartText>
                  </View>
                ))}
              </View>
            ) : null}
          </>
        ) : (
          <Text style={styles.emptyHint}>Scope items appear here as Drew identifies them — typically one bullet per fixture group, partition, or major assembly.</Text>
        )}
      </ZoneFrame>

      {/* Zone — ORDER OF OPERATIONS (numbered field-work sequence).
          Renders only when the adapter supplied order_of_ops. Collapsed
          by default; the rookie expands when they need the WHEN. */}
      {zones.order_of_ops && zones.order_of_ops.length > 0 ? (
        <ZoneFrame
          testID="zone-order-of-ops"
          icon="→"
          title="ORDER OF OPERATIONS"
          accent={AMBER}
          count={zones.order_of_ops.length}
        >
          {zones.order_of_ops.map((step, i) => (
            <View key={`oop-${i}`} style={styles.opsRow}>
              <Text style={styles.opsNumber}>{i + 1}</Text>
              <SmartText style={styles.bodyText} onSheetJump={onSheetJump}>{step}</SmartText>
            </View>
          ))}
        </ZoneFrame>
      ) : null}

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
                  <SmartText style={styles.bodyText} onSheetJump={onSheetJump}>{task.text_md}</SmartText>
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

      {/* Zone — WATCH OUT FOR (rookie traps per discipline). Renders only
          when the adapter supplied common_mistakes. Collapsed by default;
          rookie expands when they want the trap-avoidance brief. */}
      {zones.common_mistakes && zones.common_mistakes.length > 0 ? (
        <ZoneFrame
          testID="zone-common-mistakes"
          icon="⚠"
          title="WATCH OUT FOR"
          accent={RED}
          count={zones.common_mistakes.length}
        >
          {zones.common_mistakes.map((mistake, i) => (
            <View key={`miss-${i}`} style={styles.mistakeRow}>
              <Text style={styles.mistakeIcon}>⚠</Text>
              <SmartText style={styles.bodyText} onSheetJump={onSheetJump}>{mistake}</SmartText>
            </View>
          ))}
        </ZoneFrame>
      ) : null}

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
                <SmartText style={styles.questionBody} onSheetJump={onSheetJump}>{q.body_md}</SmartText>
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
        </>
      )}
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
    marginBottom: 18,
  },

  // 2026-05-25 — Sticky chapter header so the ordinal + view toggle +
  // headline never scroll out of view. Web-only; on native, position
  // 'sticky' is silently ignored (it renders as a plain block, which is
  // the correct fallback).
  stickyHeaderWeb:
    Platform.OS === 'web'
      ? (({
          position: 'sticky',
          top: 0,
          zIndex: 5,
          backgroundColor: 'rgba(8,10,14,0.94)',
          paddingTop: 4,
          paddingBottom: 12,
          marginBottom: 4,
          borderBottomWidth: 1,
          borderBottomColor: BORDER_SUBTLE,
        } as unknown) as ViewStyle)
      : { marginBottom: 4 },

  // 2026-05-25 — Premium zone polish.
  //   • Bigger gap between zones (18→22) gives the eye more breathing room
  //   • Expanded zones get a 3px amber left bar (zoneExpanded) so the
  //     reader can see at a glance which sections they've opened
  //   • Header row is taller and feels like a button (zoneHeader)
  //   • Active/expanded header has a subtle dark fill (zoneHeaderActive)
  zone: {
    marginTop: 22,
    paddingLeft: 0,
    borderLeftWidth: 3,
    borderLeftColor: 'transparent',
  },
  zoneExpanded: {
    borderLeftColor: 'rgba(251,191,36,0.55)',
    paddingLeft: 10,
    marginLeft: -10,
  },
  zoneHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
    paddingVertical: 8,
    paddingHorizontal: 10,
    marginHorizontal: -10,
    borderRadius: 6,
  },
  zoneHeaderActive: {
    backgroundColor: 'rgba(255,255,255,0.025)',
  },
  zoneHeaderHover: {
    backgroundColor: 'rgba(251,191,36,0.06)',
  },
  zoneCaret: {
    fontSize: 14,
    marginLeft: 8,
    fontWeight: '700',
  },
  // Icon now sits AFTER the title (rookies read "WHAT THIS IS ?" instead
  // of "? WHAT THIS IS"). Left margin gives it breathing room.
  zoneIcon: { fontSize: 13, marginLeft: 6, fontWeight: '700' },
  zoneTitle: {
    fontSize: 11.5,
    letterSpacing: 1.4,
    fontWeight: '800',
  },
  zoneSpacer: { flex: 1 },
  // Count rendered as a small amber-bordered pill — premium "badge" look
  // instead of the previous bare number that read as a typo.
  zoneCountPill: {
    marginLeft: 10,
    paddingHorizontal: 6,
    paddingVertical: 1,
    borderRadius: 9,
    borderWidth: 1,
    minWidth: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  zoneCountPillText: {
    fontSize: 9.5,
    fontWeight: '800',
    letterSpacing: 0.4,
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
  // ─── View toggle (Chapter / Sheet) ─────────────────────────────────
  // 2026-05-25 — Bigger premium pills. Active pill gets amber fill (not
  // just border) so the toggle reads as a real product affordance instead
  // of a tiny tag.
  viewToggle: {
    flexDirection: 'row',
    gap: 6,
    marginTop: 10,
    marginBottom: 6,
  },
  viewToggleBtn: {
    paddingVertical: 8,
    paddingHorizontal: 14,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: BORDER_SUBTLE,
    backgroundColor: 'rgba(255,255,255,0.03)',
  },
  viewToggleBtnHover: {
    backgroundColor: 'rgba(255,255,255,0.06)',
    borderColor: 'rgba(255,255,255,0.18)',
  },
  viewToggleBtnActive: {
    backgroundColor: 'rgba(251,191,36,0.16)',
    borderColor: AMBER,
  },
  viewToggleText: {
    fontSize: 12,
    fontWeight: '700',
    color: WHITE_60,
    letterSpacing: 0.3,
  },
  viewToggleTextActive: { color: AMBER },
  subHeadline: {
    color: WHITE_78,
    fontSize: 14,
    fontWeight: '500',
    fontFamily: SERIF_FAMILY,
    marginTop: 2,
    marginBottom: 4,
  },
  // ─── Sheet view archetype chip ─────────────────────────────────────
  sheetArchetypeRow: {
    flexDirection: 'row',
    marginTop: 10,
    marginBottom: 6,
  },
  sheetArchetypeChip: {
    backgroundColor: 'rgba(251,191,36,0.08)',
    borderWidth: 1,
    borderColor: BORDER_AMBER,
    color: AMBER,
    fontSize: 9,
    letterSpacing: 1.5,
    fontWeight: '800',
    paddingVertical: 3,
    paddingHorizontal: 8,
    borderRadius: 3,
  },
  // ─── TL;DR header (pinned skim) ────────────────────────────────────
  tldrBlock: {
    backgroundColor: 'rgba(251,191,36,0.05)',
    borderLeftWidth: 2,
    borderLeftColor: 'rgba(251,191,36,0.55)',
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderRadius: 6,
    marginTop: 12,
    marginBottom: 14,
  },
  tldrLabel: {
    fontSize: 9,
    letterSpacing: 2,
    color: AMBER,
    fontWeight: '800',
    marginBottom: 6,
  },
  tldrRow: { flexDirection: 'row', alignItems: 'flex-start', marginBottom: 4 },
  tldrBullet: { color: AMBER, fontSize: 14, lineHeight: 18, marginRight: 8 },
  tldrText: { color: WHITE_85, fontSize: 12.5, lineHeight: 18, flex: 1 },
  // ─── Order of Operations rows ──────────────────────────────────────
  opsRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    paddingVertical: 6,
    borderBottomWidth: 1,
    borderBottomColor: BORDER_SUBTLE,
  },
  opsNumber: {
    color: AMBER,
    fontSize: 13,
    fontWeight: '800',
    lineHeight: 18,
    width: 24,
    fontVariant: ['tabular-nums'],
  },
  // ─── Common mistakes rows ──────────────────────────────────────────
  mistakeRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    paddingVertical: 6,
  },
  mistakeIcon: {
    color: RED,
    fontSize: 13,
    lineHeight: 18,
    width: 24,
  },
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
