/**
 * DV wave test fixtures — chapters with tier/routing/disqualifier_codes.
 * Imported by Pass 2-5 test files to assert tier surface, receipt drawer,
 * and material story rendering.
 *
 * 2026-05-25 — Phase 1.3 Drew Visibility schema fixtures. Covers all four
 * canonical tier-rendering scenarios: all-green, mixed, all-red, and the
 * tierless legacy chapter (pre-DV pipeline).
 */
import type {
  BlueprintChapter,
  ChapterSource,
} from '@/lib/api/blueprintsStoryV2';

// ---------------------------------------------------------------------------
// Shared minimal zone payload — keeps fixtures readable. Mirrors the canonical
// `baseChapter` shape used by ChapterLeftPane.test.tsx so downstream assertions
// land on familiar content.
// ---------------------------------------------------------------------------
const minimalZones: BlueprintChapter['zones'] = {
  what_this_is: 'Fixture chapter for DV tier rendering tests.',
  in_scope: [{ text_md: 'item in scope' }],
  not_in_scope: [{ text_md: 'item not in scope' }],
  tasks: [
    { text_md: 'demo task', discipline: 'demo', evidence_sheets: ['A-101'] },
  ],
  buy_list: [{ quantity_display: '1×', name: 'fixture material' }],
  open_questions: [
    { question_id: 'q1', title: 'open question', body_md: 'placeholder' },
  ],
};

// ---------------------------------------------------------------------------
// Fixture 1: greenChapter — 4 GREEN/AUTO_POPULATE + 1 YELLOW/REVIEW_PENDING.
// ---------------------------------------------------------------------------
const greenSheets: ChapterSource[] = [
  {
    sheet_code: 'A-101',
    sheet_title: 'Floor Plan',
    page_number: 1,
    render_url: null,
    tier: 'GREEN' as const,
    routing_action: 'AUTO_POPULATE' as const,
    receipt_id: 'rcpt_a1b2c3d4',
  },
  {
    sheet_code: 'A-102',
    sheet_title: 'Floor Plan Level 2',
    page_number: 2,
    render_url: null,
    tier: 'GREEN' as const,
    routing_action: 'AUTO_POPULATE' as const,
    receipt_id: 'rcpt_e5f6a7b8',
  },
  {
    sheet_code: 'A-201',
    sheet_title: 'Elevations',
    page_number: 3,
    render_url: null,
    tier: 'GREEN' as const,
    routing_action: 'AUTO_POPULATE' as const,
    receipt_id: 'rcpt_c9d0e1f2',
  },
  {
    sheet_code: 'A-301',
    sheet_title: 'Sections',
    page_number: 4,
    render_url: null,
    tier: 'GREEN' as const,
    routing_action: 'AUTO_POPULATE' as const,
    receipt_id: 'rcpt_3a4b5c6d',
  },
  {
    sheet_code: 'A-401',
    sheet_title: 'Wall Types',
    page_number: 5,
    render_url: null,
    tier: 'YELLOW' as const,
    routing_action: 'REVIEW_PENDING' as const,
    receipt_id: 'rcpt_7e8f9a0b',
    disqualifier_codes: [],
  },
];

export const greenChapter: BlueprintChapter = {
  key: 'green-chapter',
  ordinal: 1,
  title: 'All-Green Confidence Chapter',
  confidence: 0.96,
  source_pages: [1, 2, 3, 4, 5],
  source_sheets: greenSheets,
  thumbnail_url: null,
  zones: minimalZones,
  confidence_tier: 'GREEN' as const,
  routing_summary: { auto: 4, review: 1, open: 0 },
};

// ---------------------------------------------------------------------------
// Fixture 2: mixedChapter — 1 GREEN + 3 YELLOW + 2 RED. Worst-of-constituents
// rule (contract §1.3) pins chapter tier to YELLOW (RED disqualified by
// routing_summary.open > 0 + RED sheet flags only triggers RED chapter when
// ALL constituents are RED — see Subagent C contract walkthrough).
// ---------------------------------------------------------------------------
const mixedSheets: ChapterSource[] = [
  {
    sheet_code: 'M-101',
    sheet_title: 'HVAC Plan',
    page_number: 10,
    render_url: null,
    tier: 'GREEN' as const,
    routing_action: 'AUTO_POPULATE' as const,
    receipt_id: 'rcpt_mix_green_01',
  },
  {
    sheet_code: 'M-201',
    sheet_title: 'HVAC Details',
    page_number: 11,
    render_url: null,
    tier: 'YELLOW' as const,
    routing_action: 'REVIEW_PENDING' as const,
    receipt_id: 'rcpt_mix_yellow_01',
    disqualifier_codes: [],
  },
  {
    sheet_code: 'M-202',
    sheet_title: 'HVAC Schedule',
    page_number: 12,
    render_url: null,
    tier: 'YELLOW' as const,
    routing_action: 'REVIEW_PENDING' as const,
    receipt_id: 'rcpt_mix_yellow_02',
    disqualifier_codes: [],
  },
  {
    sheet_code: 'M-301',
    sheet_title: 'Diffuser Plan',
    page_number: 13,
    render_url: null,
    tier: 'YELLOW' as const,
    routing_action: 'REVIEW_PENDING' as const,
    receipt_id: 'rcpt_mix_yellow_03',
    disqualifier_codes: [],
  },
  {
    sheet_code: 'E-101',
    sheet_title: 'Electrical Plan',
    page_number: 14,
    render_url: null,
    tier: 'RED' as const,
    routing_action: 'OPEN_QUESTION' as const,
    receipt_id: 'rcpt_mix_red_01',
    disqualifier_codes: ['NO_SHEET_ID'],
  },
  {
    sheet_code: 'E-201',
    sheet_title: 'Power Plan',
    page_number: 15,
    render_url: null,
    tier: 'RED' as const,
    routing_action: 'OPEN_QUESTION' as const,
    receipt_id: 'rcpt_mix_red_02',
    disqualifier_codes: ['BORDER_ABLATION_FAILED', 'TRAJECTORY_NULL_COLLAPSE'],
  },
];

export const mixedChapter: BlueprintChapter = {
  key: 'mixed-chapter',
  ordinal: 2,
  title: 'Mixed Confidence Chapter',
  confidence: 0.72,
  source_pages: [10, 11, 12, 13, 14, 15],
  source_sheets: mixedSheets,
  thumbnail_url: null,
  zones: minimalZones,
  confidence_tier: 'YELLOW' as const,
  routing_summary: { auto: 1, review: 3, open: 2 },
};

// ---------------------------------------------------------------------------
// Fixture 3: redChapter — 1 YELLOW + 3 RED with multi-code disqualifiers.
// ---------------------------------------------------------------------------
const redSheets: ChapterSource[] = [
  {
    sheet_code: 'P-101',
    sheet_title: 'Plumbing Riser',
    page_number: 20,
    render_url: null,
    tier: 'YELLOW' as const,
    routing_action: 'REVIEW_PENDING' as const,
    receipt_id: 'rcpt_red_yellow_01',
    disqualifier_codes: [],
  },
  {
    sheet_code: 'P-201',
    sheet_title: 'Plumbing Plan',
    page_number: 21,
    render_url: null,
    tier: 'RED' as const,
    routing_action: 'OPEN_QUESTION' as const,
    receipt_id: 'rcpt_red_red_01',
    disqualifier_codes: ['NO_SHEET_ID', 'BORDER_ABLATION_FAILED'],
  },
  {
    sheet_code: 'P-202',
    sheet_title: 'Fixture Schedule',
    page_number: 22,
    render_url: null,
    tier: 'RED' as const,
    routing_action: 'OPEN_QUESTION' as const,
    receipt_id: 'rcpt_red_red_02',
    disqualifier_codes: ['TRAJECTORY_NULL_COLLAPSE', 'FAILURE_MODE'],
  },
  {
    sheet_code: 'P-301',
    sheet_title: 'Gas Plan',
    page_number: 23,
    render_url: null,
    tier: 'RED' as const,
    routing_action: 'OPEN_QUESTION' as const,
    receipt_id: 'rcpt_red_red_03',
    disqualifier_codes: [
      'NO_SHEET_ID',
      'BORDER_ABLATION_FAILED',
      'TRAJECTORY_NULL_COLLAPSE',
      'FAILURE_MODE',
    ],
  },
];

export const redChapter: BlueprintChapter = {
  key: 'red-chapter',
  ordinal: 3,
  title: 'All-Red Confidence Chapter',
  confidence: 0.31,
  source_pages: [20, 21, 22, 23],
  source_sheets: redSheets,
  thumbnail_url: null,
  zones: minimalZones,
  confidence_tier: 'RED' as const,
  routing_summary: { auto: 0, review: 1, open: 3 },
};

// ---------------------------------------------------------------------------
// Fixture 4: tierlessChapter — legacy pre-Phase-1.3 chapter. All tier-related
// fields omitted (undefined). Used to assert "no badge when undefined" rule.
// ---------------------------------------------------------------------------
const tierlessSheets: ChapterSource[] = [
  {
    sheet_code: 'L-101',
    sheet_title: 'Legacy Sheet',
    page_number: 30,
    render_url: null,
  },
  {
    sheet_code: 'L-102',
    sheet_title: 'Legacy Sheet 2',
    page_number: 31,
    render_url: null,
  },
];

export const tierlessChapter: BlueprintChapter = {
  key: 'tierless-chapter',
  ordinal: 4,
  title: 'Legacy Chapter Without Tier Metadata',
  confidence: 0.5,
  source_pages: [30, 31],
  source_sheets: tierlessSheets,
  thumbnail_url: null,
  zones: minimalZones,
  // confidence_tier + routing_summary intentionally omitted.
};

// ---------------------------------------------------------------------------
// Convenience export for array-driven test scenarios.
// ---------------------------------------------------------------------------
export const allTieredFixtures: readonly BlueprintChapter[] = [
  greenChapter,
  mixedChapter,
  redChapter,
  tierlessChapter,
];
