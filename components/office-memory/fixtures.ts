/**
 * Office Memory fixtures — used by demo pages and placeholder hooks until the
 * Memory Service backend lands (Pass 4 + Pass 5).
 *
 * Nine memories cover every MemoryType variant so the results grid demo
 * exercises every badge color and card state.
 */

import type { ActivityFile, KeyDecision, LinkedFact, MemoryDetail, MemorySummary } from './types';

export const MOCK_MEMORIES_9: MemorySummary[] = [
  {
    id: 'mem_001',
    type: 'meeting',
    title: 'Client call with Acme Builders',
    summary:
      'Discussed change order for lobby finishes and timeline impact. Client approved updated scope and budget.',
    entity: { id: 'ent_acme', name: 'Acme Builders' },
    project: { id: 'prj_a', name: 'Project A' },
    date: '2026-04-18T10:35:00Z',
    tags: ['Acme Builders', 'Project A', 'Planning'],
    bookmarked: false,
  },
  {
    id: 'mem_002',
    type: 'strategy',
    title: 'Q2 pricing strategy',
    summary:
      'Reviewed market conditions and competitor pricing. Agreed on 3–5% adjustment for key trade packages.',
    entity: { id: 'ent_summit', name: 'Summit Construction' },
    date: '2026-04-17T14:20:00Z',
    tags: ['Pricing', 'Q2', 'Strategy'],
  },
  {
    id: 'mem_003',
    type: 'note',
    title: 'Permit status update',
    summary:
      'City approved structural plans. MEP permit in review. Expect final approval by end of week.',
    entity: { id: 'ent_riverside', name: 'Riverside Tower' },
    date: '2026-04-16T09:12:00Z',
    tags: ['Permit', 'Riverside Tower'],
  },
  {
    id: 'mem_004',
    type: 'contract',
    title: 'Invoice follow-up for Horizon',
    summary:
      'Horizon requested updated invoice with revised materials list. Sent updated invoice and confirmed receipt.',
    entity: { id: 'ent_horizon', name: 'Horizon Properties' },
    date: '2026-04-15T16:48:00Z',
    tags: ['Horizon', 'Invoice'],
    bookmarked: true,
  },
  {
    id: 'mem_005',
    type: 'research',
    title: 'Material cost spike note',
    summary:
      'Steel and copper prices increased 8–12%. Recommended locking in prices for June delivery.',
    entity: { id: 'ent_riverside', name: 'Riverside Tower' },
    date: '2026-04-14T11:05:00Z',
    tags: ['Materials', 'Cost', 'Riverside Tower'],
  },
  {
    id: 'mem_006',
    type: 'meeting',
    title: 'Weekly team sync',
    summary:
      'Reviewed project milestones, safety incidents, and upcoming inspections. All teams aligned on next steps.',
    entity: { id: 'ent_summit', name: 'Summit Construction' },
    date: '2026-04-13T13:30:00Z',
    tags: ['Team', 'Sync', 'Summit'],
  },
  {
    id: 'mem_007',
    type: 'invoice',
    title: 'May invoice batch sent',
    summary:
      'Generated and sent 12 invoices totaling $487K across active projects. Confirmation receipts logged.',
    entity: { id: 'ent_acme', name: 'Acme Builders' },
    date: '2026-04-12T09:00:00Z',
    tags: ['Invoice', 'Billing', 'May'],
  },
  {
    id: 'mem_008',
    type: 'call',
    title: 'Subcontractor scheduling call',
    summary:
      'Coordinated electrical and plumbing crews for week-of-21st site work. Confirmed lead times and safety briefing.',
    entity: { id: 'ent_riverside', name: 'Riverside Tower' },
    date: '2026-04-11T15:18:00Z',
    tags: ['Subcontractor', 'Scheduling'],
  },
  {
    id: 'mem_009',
    type: 'document',
    title: 'Updated safety protocols',
    summary:
      'Revised site safety plan to include new OSHA fall-protection requirements. Distributed to all foremen.',
    entity: { id: 'ent_summit', name: 'Summit Construction' },
    date: '2026-04-10T08:42:00Z',
    tags: ['Safety', 'Compliance', 'Documentation'],
  },
];

const MOCK_KEY_DECISIONS: KeyDecision[] = [
  { id: 'kd_001', label: 'Approve revised layout', checked: true },
  { id: 'kd_002', label: 'Increase budget cap to $1.2M', checked: true },
  { id: 'kd_003', label: 'Update finish package options', checked: true },
  { id: 'kd_004', label: 'Target start date: May 12', checked: true },
];

const MOCK_LINKED_FACTS: LinkedFact[] = [
  { id: 'lf_001', kind: 'proposal', label: 'Proposal v2', date: '2026-04-18' },
  { id: 'lf_002', kind: 'project_update', label: 'Project Update', date: '2026-04-16' },
  { id: 'lf_003', kind: 'site_walk', label: 'Site Walk with Acme', date: '2026-04-12' },
  { id: 'lf_004', kind: 'add_link', label: 'Add Link' },
];

const MOCK_ACTIVITY_FILES: ActivityFile[] = [
  { id: 'af_001', kind: 'audio', label: 'Call Recording', meta: 'MP4 · 19 MB' },
  { id: 'af_002', kind: 'doc', label: 'Meeting Notes', meta: 'DOCX · 34 KB' },
  { id: 'af_003', kind: 'pdf', label: 'Layout v2', meta: 'PDF · 1.2 MB' },
  { id: 'af_004', kind: 'zip', label: 'Finish Samples', meta: 'ZIP · 18 MB' },
];

export const MOCK_MEMORY_DETAIL: MemoryDetail = {
  ...MOCK_MEMORIES_9[0],
  duration: '45 min',
  participants: ['Tony Scott', 'Jane Doe (Acme)'],
  location: 'Zoom Call',
  createdBy: 'Tony Scott',
  keyDecisions: MOCK_KEY_DECISIONS,
  linkedFacts: MOCK_LINKED_FACTS,
  activityFiles: MOCK_ACTIVITY_FILES,
};

// ---------------------------------------------------------------------------
// Pass 15 — per-type fixtures for the rich detail components.
// Each fixture exercises every code path of its detail component so demo
// pages and the type-router cycle correctly. Backed by MemoryDetail's
// optional augmentations (recording, transcript, lineItems, totals,
// statusTimeline, messages, contact). Pass 17 replaces these with live data.
// ---------------------------------------------------------------------------

const SAMPLE_TRANSCRIPT_TURNS = [
  { t: 12,  speaker: 'Tony Scott',       text: 'Thanks for joining on short notice. I want to walk through the change order before we lose the window.' },
  { t: 28,  speaker: 'Jane Doe (Acme)',  text: 'Of course. The lobby finishes were the main concern — the marble is on a 9-week lead.' },
  { t: 47,  speaker: 'Tony Scott',       text: 'Right. If we lock the order today we get under the wire. The architect signed off this morning.' },
  { t: 73,  speaker: 'Jane Doe (Acme)',  text: 'I’m comfortable with the new scope. Budget cap up to one-point-two is fine.' },
  { t: 95,  speaker: 'Tony Scott',       text: 'Perfect. I’ll send the revised invoice and proposal v2 today.' },
  { t: 112, speaker: 'Jane Doe (Acme)',  text: 'Sounds good. Target start May twelfth still works for us.' },
];

const SAMPLE_ACTION_ITEMS = [
  { id: 'ai_001', label: 'Send revised invoice to Acme Builders',     assignee: 'Maya', dueDate: '2026-04-22', completed: false },
  { id: 'ai_002', label: 'File MEP permit revision with city',        assignee: 'Tony', dueDate: '2026-04-19', completed: true  },
  { id: 'ai_003', label: 'Schedule site walk for finish samples',     assignee: 'Tony', dueDate: '2026-04-25', completed: false },
];

// ─── Meeting (Zoom-flavored) ────────────────────────────────────────────────

export const MOCK_MEMORY_MEETING: MemoryDetail = {
  ...MOCK_MEMORIES_9[0],
  duration: '32 min',
  participants: ['Tony Scott', 'Jane Doe (Acme)', 'Maya Chen', 'James Park', 'Sofia Rivers'],
  location: 'Zoom · 871-2034-5567',
  createdBy: 'Tony Scott',
  keyDecisions: MOCK_KEY_DECISIONS,
  linkedFacts: MOCK_LINKED_FACTS,
  activityFiles: MOCK_ACTIVITY_FILES,
  recording: {
    src: 'https://media.aspireos.app/demo/meeting-recording.mp4',
    kind: 'video',
    durationSec: 1942,
  },
  transcript: SAMPLE_TRANSCRIPT_TURNS,
  // actionItems lives on the demo fixture as an attached field — picked up
  // by MemoryDetailMeeting via its (memory as any).actionItems escape hatch.
  ...({ actionItems: SAMPLE_ACTION_ITEMS } as object),
};

// ─── Zoom (variant of meeting; same fixture works) ──────────────────────────

export const MOCK_MEMORY_ZOOM: MemoryDetail = {
  ...MOCK_MEMORY_MEETING,
  id: 'mem_zoom_001',
  title: 'Zoom · Weekly leadership sync · 871-2034-5567',
  participants: ['Tony Scott', 'Maya Chen', 'James Park', 'Sofia Rivers', 'Diego Marin', 'Aisha Rahman'],
  location: 'Zoom Cloud',
};

// ─── Call (Twilio voice with message_taken outcome) ─────────────────────────

export const MOCK_MEMORY_CALL: MemoryDetail = {
  ...MOCK_MEMORIES_9[7], // mem_008 — call type
  duration: '4 min 12 sec',
  participants: ['Sarah (Front Desk)', 'Diego Marin'],
  createdBy: 'Sarah (Front Desk)',
  keyDecisions: [],
  linkedFacts: [
    { id: 'lf_call_001', kind: 'meeting',  label: 'Site walk with Riverside', date: '2026-04-11' },
    { id: 'lf_call_002', kind: 'project_update', label: 'Riverside Tower update', date: '2026-04-10' },
  ],
  activityFiles: [
    { id: 'af_call_001', kind: 'audio', label: 'Call Recording', meta: 'WAV · 4.8 MB' },
  ],
  contact: { name: 'Diego Marin', phone: '+1 (404) 555-0144' },
  recording: {
    src: 'https://media.aspireos.app/demo/call-recording.mp3',
    kind: 'audio',
    durationSec: 252,
  },
  transcript: [
    { t: 2,   speaker: 'Sarah',  text: 'Hello, you’ve reached Aspire — this is Sarah, the AI front desk assistant. How can I help?' },
    { t: 9,   speaker: 'Diego',  text: 'Hi Sarah, I’m calling about the Riverside electrical schedule. Tony asked me to confirm timing.' },
    { t: 22,  speaker: 'Sarah',  text: 'Tony is unavailable this afternoon — would you like to leave a message, or is there a callback window that works?' },
    { t: 35,  speaker: 'Diego',  text: 'Yes, please. The crew can be on-site Monday at 7am. Tony can call me back any time after 3pm today.' },
    { t: 51,  speaker: 'Sarah',  text: 'Got it — let me read that back. Diego Marin, callback 404-555-0144, available after 3pm today, regarding Riverside electrical schedule starting Monday 7am. Correct?' },
    { t: 73,  speaker: 'Diego',  text: 'That’s correct. Thanks Sarah.' },
    { t: 79,  speaker: 'Sarah',  text: 'You’re welcome. I’ll pass this along right away. Have a good one.' },
  ],
  task: {
    statusLabel: 'message_taken',
    description:
      'Diego Marin called regarding Riverside electrical schedule. The subcontractor crew can be on-site Monday at 7am. Tony can call back any time after 3pm today.',
    dueDate: 'Today after 3:00 PM',
    assignee: 'Tony Scott',
  },
  linkedReceipts: [
    { id: 'rcpt_call_001', label: 'Message captured · rcpt_3f2a' },
    { id: 'rcpt_call_002', label: 'Personalization resolved · rcpt_a18c' },
  ],
};

// ─── Invoice (Stripe-fidelity) ──────────────────────────────────────────────

export const MOCK_MEMORY_INVOICE: MemoryDetail = {
  ...MOCK_MEMORIES_9[6], // mem_007 — invoice
  title: 'Invoice INV-1024 · Lobby finish package',
  duration: undefined,
  participants: ['Acme Builders', 'Tony Scott'],
  location: undefined,
  createdBy: 'Tony Scott',
  keyDecisions: [],
  linkedFacts: [],
  activityFiles: [
    { id: 'af_inv_001', kind: 'pdf', label: 'INV-1024.pdf', meta: 'PDF · 184 KB' },
  ],
  status: 'pending_approval',
  file: {
    src: 'https://files.aspireos.app/demo/invoices/INV-1024.pdf',
    mime: 'application/pdf',
    sizeLabel: '184 KB',
    uploadedBy: 'Tony Scott',
    version: 'v1',
  },
  lineItems: [
    { description: 'Italian marble — Carrara Bianco (per sq ft, supply only)', qty: 240,  unitPriceCents:  4200, totalCents: 1008000 },
    { description: 'Custom millwork — front desk + reception bench',            qty:   1,  unitPriceCents: 184000, totalCents:  184000 },
    { description: 'Lighting design + fixture supply',                          qty:   1,  unitPriceCents:  86000, totalCents:   86000 },
    { description: 'Site management fee (8% of subtotal)',                      qty:   1,  unitPriceCents: 102240, totalCents:  102240 },
  ],
  totals: {
    subtotalCents: 1380240,
    taxCents:        96617, // 7% sample
    totalCents:    1476857,
    currency: 'USD',
  },
  statusTimeline: [
    { label: 'Draft',    icon: 'document-outline',     datetime: '2026-04-09T11:00:00Z', actor: 'Tony Scott',       completed: true },
    { label: 'Sent',     icon: 'paper-plane-outline',  datetime: '2026-04-10T08:30:00Z', actor: 'Tony Scott',       completed: true },
    { label: 'Viewed',   icon: 'eye-outline',          datetime: '2026-04-10T16:12:00Z', actor: 'Acme Builders',    completed: true },
    { label: 'Paid',     icon: 'checkmark-circle',     datetime: '2026-04-12T09:14:00Z', actor: 'Acme Builders',    completed: true,  current: true  },
  ],
  task: {
    statusLabel: 'paid',
    description: 'Lobby finish package invoice for Project A.',
    dueDate: '2026-04-24',
  },
  linkedReceipts: [
    { id: 'rcpt_inv_001', label: 'Payment captured · $14,768.57' },
    { id: 'rcpt_inv_002', label: 'Stripe charge · ch_3qx9…' },
  ],
};

// ─── Quote (PandaDoc-fidelity, with versions + expiration warning) ──────────

export const MOCK_MEMORY_QUOTE: MemoryDetail = {
  id: 'mem_quote_001',
  type: 'quote',
  title: 'Quote QUO-2103 · Riverside MEP package',
  summary:
    'Mechanical, electrical and plumbing scope for Riverside Tower floors 12–18. Pricing valid through April 30, 2026.',
  entity: { id: 'ent_riverside', name: 'Riverside Tower LLC' },
  project: { id: 'prj_riverside', name: 'Riverside Tower' },
  date: '2026-04-15T15:00:00Z',
  tags: ['Riverside Tower', 'MEP', 'Q2'],
  bookmarked: false,
  duration: undefined,
  participants: ['Riverside Tower LLC', 'Tony Scott'],
  createdBy: 'Tony Scott',
  keyDecisions: [],
  linkedFacts: [],
  activityFiles: [
    { id: 'af_quo_001', kind: 'pdf', label: 'QUO-2103.pdf', meta: 'PDF · 1.2 MB' },
  ],
  file: {
    src: 'https://files.aspireos.app/demo/quotes/QUO-2103.pdf',
    mime: 'application/pdf',
    sizeLabel: '1.2 MB',
    uploadedBy: 'Tony Scott',
    version: 'v3',
  },
  lineItems: [
    { description: 'Mechanical scope — VRF system supply & install (floors 12–18)', qty: 7,  unitPriceCents:  4200000, totalCents: 29400000 },
    { description: 'Electrical scope — feeder upgrades + panel install',              qty: 1,  unitPriceCents: 18400000, totalCents: 18400000 },
    { description: 'Plumbing scope — riser replacement + DCV install',                qty: 1,  unitPriceCents:  9600000, totalCents:  9600000 },
    { description: 'Project management & coordination',                                qty: 1,  unitPriceCents:  4200000, totalCents:  4200000 },
  ],
  totals: {
    subtotalCents: 61600000,
    taxCents:       4312000,
    totalCents:    65912000,
    currency: 'USD',
  },
  statusTimeline: [
    { label: 'Draft',    icon: 'document-outline',    datetime: '2026-04-08T10:00:00Z', actor: 'Tony Scott',          completed: true },
    { label: 'Sent',     icon: 'paper-plane-outline', datetime: '2026-04-15T15:00:00Z', actor: 'Tony Scott',          completed: true },
    { label: 'Viewed',   icon: 'eye-outline',         datetime: '2026-04-16T09:48:00Z', actor: 'Riverside Tower',     completed: true, current: true },
    { label: 'Accepted', icon: 'checkmark-circle',    datetime: '',                       actor: '',                    completed: false },
  ],
  task: {
    statusLabel: 'sent',
    description: 'Riverside MEP scope, valid through April 30 2026.',
    dueDate: '2026-04-30',
  },
  versionHistory: [
    { version: 'v1', date: '2026-04-08', actor: 'Tony Scott' },
    { version: 'v2', date: '2026-04-11', actor: 'Tony Scott' },
    { version: 'v3', date: '2026-04-15', actor: 'Tony Scott' },
  ],
};

// ─── SMS thread (Twilio with MMS) ───────────────────────────────────────────

export const MOCK_MEMORY_SMS: MemoryDetail = {
  id: 'mem_sms_001',
  type: 'sms_thread',
  title: 'SMS thread · Diego Marin',
  summary:
    'Coordinated electrical crew arrival window and shared safety briefing PDF. Confirmed Monday 7am.',
  entity: { id: 'ent_riverside', name: 'Riverside Tower' },
  project: { id: 'prj_riverside', name: 'Riverside Tower' },
  date: '2026-04-29T17:42:00Z',
  tags: ['Riverside Tower', 'Subcontractor'],
  bookmarked: false,
  duration: undefined,
  participants: ['Diego Marin', 'Tony Scott'],
  createdBy: 'Tony Scott',
  keyDecisions: [],
  linkedFacts: [],
  activityFiles: [],
  contact: { name: 'Diego Marin', phone: '+1 (404) 555-0144' },
  messages: [
    { id: 'sms_001', direction: 'inbound',  body: 'Hey Tony — confirming Monday 7am for the Riverside electrical crew.', ts: '2026-04-29T16:18:00Z', status: 'delivered' },
    { id: 'sms_002', direction: 'outbound', body: 'Confirmed. Gate code is 4187. Bring proof of insurance for the office.', ts: '2026-04-29T16:21:00Z', status: 'read' },
    { id: 'sms_003', direction: 'inbound',  body: 'Got it. Sending the COI in a sec.', ts: '2026-04-29T16:23:00Z', status: 'delivered' },
    { id: 'sms_004', direction: 'inbound',  body: 'Here it is.', ts: '2026-04-29T16:24:00Z', status: 'delivered',
      mediaUrls: ['https://files.aspireos.app/demo/sms/coi-sample.jpg'] },
    { id: 'sms_005', direction: 'outbound', body: 'Got it — I’ll forward to the office. See you Monday.', ts: '2026-04-29T16:38:00Z', status: 'read' },
    { id: 'sms_006', direction: 'inbound',  body: 'One more thing — can the crew use the freight elevator?', ts: '2026-04-29T17:42:00Z', status: 'delivered' },
  ],
};

// ─── Lane E (Pass 15) — note / document / strategy / research / task /     ──
//                       summary / transcript / session_summary fixtures.   ──

const baseLaneE = (s: MemorySummary): MemoryDetail => ({
  ...s,
  participants: ['Tony Scott', 'Sarah Lin'],
  createdBy: 'Tony Scott',
  keyDecisions: MOCK_KEY_DECISIONS,
  linkedFacts: MOCK_LINKED_FACTS,
  activityFiles: MOCK_ACTIVITY_FILES,
});

export const MOCK_DETAIL_NOTE: MemoryDetail = {
  ...baseLaneE(MOCK_MEMORIES_9[2]),
  body: `## Permit progress\n\nCity approved structural plans this morning. **MEP permit** is now in review at the planning desk.\n\n- Reviewer assigned: Karen Lopez\n- Estimated decision: Friday, end of week\n- Outstanding ask: revised egress diagram\n\n> "Looks clean — barring HVAC routing comments, this should clear by Thursday." — Karen, voicemail`,
  bodyFormat: 'markdown',
  linkedReceipts: [
    { id: 'rcp_801', label: 'Permit submission · #PMT-2218', href: 'https://example.com/permits/2218' },
  ],
};

export const MOCK_DETAIL_DOCUMENT: MemoryDetail = {
  ...baseLaneE(MOCK_MEMORIES_9[8]),
  file: {
    src: 'https://www.w3.org/WAI/ER/tests/xhtml/testfiles/resources/pdf/dummy.pdf',
    mime: 'application/pdf',
    sizeLabel: '482 KB',
    uploadedBy: 'Sarah Lin',
    version: 'v3',
  },
  versionHistory: [
    { version: 'v3 — current', date: 'Apr 10, 2026', actor: 'Sarah Lin' },
    { version: 'v2', date: 'Mar 22, 2026', actor: 'Tony Scott' },
    { version: 'v1', date: 'Feb 18, 2026', actor: 'Tony Scott' },
  ],
};

export const MOCK_DETAIL_STRATEGY: MemoryDetail = {
  ...baseLaneE(MOCK_MEMORIES_9[1]),
  body: `## Pricing posture for Q2\n\nWe're holding the line on labor while passing through ~5% on materials. The thesis: clients tolerate transparent material adjustments, but resist labor pumps.\n\n### Trade-by-trade\n\n- **Concrete:** +4% — driven by fuel + cement spot pricing\n- **Steel:** +6% — locking June at $X/ton\n- **Finishes:** +3% — selective increases on imported tile only\n\n### Why this matters\n\nIf we do nothing, Q2 margin erodes by ~180bps. If we over-correct, we lose two pipeline projects to Lansing. Threading the needle.`,
  bodyFormat: 'markdown',
  decisionTags: ['margin defense', 'pass-through', 'Q2 plan'],
  linkedMemories: [
    { id: 'mem_011', title: 'Materials index — April', type: 'research' },
    { id: 'mem_012', title: 'Project Lansing scoring', type: 'note' },
  ],
};

export const MOCK_DETAIL_RESEARCH: MemoryDetail = {
  ...baseLaneE(MOCK_MEMORIES_9[4]),
  body: `## Materials cost spike — April\n\n**Steel** is up 8% MoM driven by tariff changes and a Pittsburgh mill outage. **Copper** is up 12% on speculative buying ahead of Q3 grid projects.\n\n### Outlook\n\n- Steel: expect 2–3% relief by mid-June if mill reopens on schedule\n- Copper: structurally elevated for at least 90 days\n- Concrete: stable\n\n### Recommendation\n\nLock copper-heavy SKUs at current prices for June delivery. Keep steel orders rolling 30 days at a time.`,
  bodyFormat: 'markdown',
  confidenceScore: 0.78,
  sources: [
    { url: 'https://www.usgs.gov/centers/national-minerals-information-center', title: 'USGS National Minerals Information Center' },
    { url: 'https://www.steel.org/industry-data/', title: 'AISI Steel Industry Data' },
    { url: 'https://comex.example.com/copper-spot' },
  ],
};

export const MOCK_DETAIL_TASK: MemoryDetail = {
  ...baseLaneE({
    id: 'mem_task_01',
    type: 'task',
    title: 'Send revised contract to Acme by Tuesday',
    summary: 'Revised contract reflects the change order on lobby finishes and the bumped budget cap. Ready for owner signature once Acme returns it.',
    entity: { id: 'ent_acme', name: 'Acme Builders' },
    project: { id: 'prj_a', name: 'Project A' },
    date: '2026-04-22T09:00:00Z',
    tags: ['Contract', 'Acme', 'Revision'],
  }),
  task: {
    statusLabel: 'In progress',
    description: `Revised contract draft is in PandaDoc — needs a final pass on the **change-order schedule** before sending.\n\nMaya is doing the legal markup tonight; expect comments back Tuesday morning.`,
    dueDate: 'Apr 22, 2026',
    assignee: 'Tony Scott',
    parentMemoryId: 'mem_001',
    subtasks: [
      { id: 'st_1', label: 'Apply change-order rider', assignee: 'Tony', dueDate: '2026-04-21', completed: true },
      { id: 'st_2', label: 'Legal markup pass', assignee: 'Maya', dueDate: '2026-04-22', completed: false },
      { id: 'st_3', label: 'Send via PandaDoc', assignee: 'Tony', dueDate: '2026-04-22', completed: false },
      { id: 'st_4', label: 'Confirm receipt', assignee: 'Tony', dueDate: '2026-04-23', completed: false },
    ],
  },
};

export const MOCK_DETAIL_SUMMARY: MemoryDetail = {
  ...baseLaneE({
    id: 'mem_summary_01',
    type: 'summary',
    title: 'Acme Builders — Week of April 14',
    summary: 'Two client touch points, one change order approved, finishes package locked. Permit work tracking on time. No risk flags.',
    entity: { id: 'ent_acme', name: 'Acme Builders' },
    date: '2026-04-19T17:00:00Z',
    tags: ['Acme', 'Weekly', 'Active'],
  }),
  period: 'Week of April 14, 2026',
  body: `## Highlights\n\n- **Change order** approved for lobby finishes — $52K incremental scope\n- **Finishes package** locked Wednesday after walkthrough with Jane\n- **Permit** tracking — MEP review in progress, decision expected Friday\n\n## What we're watching\n\n- Steel pricing rolling into June order\n- Subcontractor capacity for week-of-21st site work\n\n## Next week\n\nFollow up on signed contract, kick off site walk #2.`,
  bodyFormat: 'markdown',
  linkedMemories: [
    { id: 'mem_001', title: 'Client call with Acme Builders', type: 'meeting' },
    { id: 'mem_007', title: 'May invoice batch sent', type: 'invoice' },
    { id: 'mem_003', title: 'Permit status update', type: 'note' },
  ],
};

export const MOCK_DETAIL_TRANSCRIPT: MemoryDetail = {
  ...baseLaneE({
    id: 'mem_transcript_01',
    type: 'transcript',
    title: 'Transcript — Acme call · Apr 18',
    summary: 'Raw transcript from the 45-minute Zoom with Jane Doe. See refined session_summary for the agent-narrated take.',
    entity: { id: 'ent_acme', name: 'Acme Builders' },
    date: '2026-04-18T10:35:00Z',
    tags: ['Acme', 'Transcript'],
  }),
  duration: '45 min',
  transcript: SAMPLE_TRANSCRIPT_TURNS,
  linkedMemories: [
    { id: 'mem_session_01', title: 'Session summary — Acme call', type: 'session_summary' },
  ],
};

export const MOCK_DETAIL_SESSION: MemoryDetail = {
  ...baseLaneE({
    id: 'mem_session_01',
    type: 'session_summary',
    title: 'Session — Ava with Tony, "Acme contract status"',
    summary: 'Tony asked Ava to pull together the current state of the Acme contract and surface any open follow-ups before Tuesday\'s send.',
    entity: { id: 'ent_acme', name: 'Acme Builders' },
    date: '2026-04-19T08:12:00Z',
    tags: ['Ava', 'Acme', 'Contract'],
  }),
  duration: '6 min',
  agent: { id: 'ava', name: 'Ava', persona: 'orb' },
  intents: ['contract status', 'open followups', 'Acme'],
  narrative: `Ava reviewed the most recent Acme call transcript and the existing contract draft, then summarized open items.\n\nTwo follow-ups are still open:\n\n1. Maya's legal markup (due Tuesday morning)\n2. Final PandaDoc send (queued behind markup)\n\nNo authority requests; no risk flags. Ava recommended Tony confirm receipt with Jane after sending.`,
  bodyFormat: 'markdown',
  toolCalls: [
    {
      toolName: 'memory.search',
      argsSummary: '{"q":"Acme contract","limit":5}',
      resultSummary: '5 memories returned',
      succeeded: true,
      receiptId: 'rcp_session_001',
      argsJson: { q: 'Acme contract', limit: 5 },
      resultJson: { items: [{ id: 'mem_001' }, { id: 'mem_task_01' }, { id: 'mem_transcript_01' }, { id: 'mem_007' }, { id: 'mem_summary_01' }] },
    },
    {
      toolName: 'pandadoc.get_document',
      argsSummary: '{"document_id":"doc_acme_v3"}',
      resultSummary: 'doc · status=draft',
      succeeded: true,
      receiptId: 'rcp_session_002',
      argsJson: { document_id: 'doc_acme_v3' },
      resultJson: { id: 'doc_acme_v3', status: 'draft', updated_at: '2026-04-19T07:30:00Z' },
    },
    {
      toolName: 'calendar.list_holds',
      argsSummary: '{"window":"next_72h"}',
      resultSummary: '0 holds',
      succeeded: true,
      receiptId: 'rcp_session_003',
    },
  ],
  linkedReceipts: [
    { id: 'rcp_session_001', label: 'memory.search · rcp_session_001' },
    { id: 'rcp_session_002', label: 'pandadoc.get_document · rcp_session_002' },
    { id: 'rcp_session_003', label: 'calendar.list_holds · rcp_session_003' },
  ],
  handoff: { id: 'mem_handoff_01', label: 'Continued in: Tuesday morning followup', href: '/office-memory/mem_handoff_01' },
};

/**
 * Index lookup so the demo page and useMemoryDetail can swap fixtures by id.
 * Combines Lane B (meeting/zoom/call/invoice/quote/sms) and Lane E
 * (note/document/strategy/research/task/summary/transcript/session) sources.
 */
export const MOCK_DETAIL_BY_TYPE: Record<string, MemoryDetail> = {
  meeting: MOCK_MEMORY_MEETING,
  zoom: MOCK_MEMORY_ZOOM,
  call: MOCK_MEMORY_CALL,
  invoice: MOCK_MEMORY_INVOICE,
  quote: MOCK_MEMORY_QUOTE,
  sms_thread: MOCK_MEMORY_SMS,
  note: MOCK_DETAIL_NOTE,
  document: MOCK_DETAIL_DOCUMENT,
  strategy: MOCK_DETAIL_STRATEGY,
  research: MOCK_DETAIL_RESEARCH,
  task: MOCK_DETAIL_TASK,
  summary: MOCK_DETAIL_SUMMARY,
  transcript: MOCK_DETAIL_TRANSCRIPT,
  session_summary: MOCK_DETAIL_SESSION,
};
