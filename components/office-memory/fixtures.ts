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
