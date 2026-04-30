/**
 * Pass 15 details barrel — single import surface for the type-router.
 *
 * `[memoryId].tsx` imports detail components from this barrel; the type-router
 * map `TYPE_TO_COMPONENT` is the only place that needs to change when a new
 * memory_type lands. Lane-B detail components (Meeting/Call/Invoice/Quote/
 * Contract/SMS) will be added here once they ship.
 */

export { MemoryDetailHeader, type MemoryDetailHeaderProps } from './MemoryDetailHeader';
export { MemoryDetailRightRail, type MemoryDetailRightRailProps } from './MemoryDetailRightRail';
export { MemorySummaryCard } from './MemorySummaryCard';
export { MemoryBody, MemoryBodyInlineLink, type MemoryBodyProps } from './MemoryBody';

export { MemoryDetailNote, type MemoryDetailNoteProps } from './MemoryDetailNote';
export { MemoryDetailDocument, type MemoryDetailDocumentProps } from './MemoryDetailDocument';
export { MemoryDetailStrategy, type MemoryDetailStrategyProps } from './MemoryDetailStrategy';
export { MemoryDetailResearch, type MemoryDetailResearchProps } from './MemoryDetailResearch';
export { MemoryDetailTask, type MemoryDetailTaskProps } from './MemoryDetailTask';
export { MemoryDetailSummary, type MemoryDetailSummaryProps } from './MemoryDetailSummary';
export { MemoryDetailTranscript, type MemoryDetailTranscriptProps } from './MemoryDetailTranscript';
export { MemoryDetailSession, type MemoryDetailSessionProps } from './MemoryDetailSession';

// Lane-B detail components — shipped Pass 15.
export { MemoryDetailMeeting, type MemoryDetailMeetingProps } from './MemoryDetailMeeting';
export { MemoryDetailZoom, type MemoryDetailZoomProps } from './MemoryDetailZoom';
export { MemoryDetailCall, type MemoryDetailCallProps } from './MemoryDetailCall';
export { MemoryDetailInvoice, type MemoryDetailInvoiceProps } from './MemoryDetailInvoice';
export { MemoryDetailQuote, type MemoryDetailQuoteProps } from './MemoryDetailQuote';
export { MemoryDetailSMS, type MemoryDetailSMSProps } from './MemoryDetailSMS';
