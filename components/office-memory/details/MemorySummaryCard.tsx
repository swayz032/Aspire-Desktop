/**
 * MemorySummaryCard (Pass 15) — re-exports the existing summary card so
 * detail components import from a uniform `details/` namespace.
 *
 * The actual visual implementation lives in `../MemorySummaryCard.tsx`. This
 * file is purely a barrel for future Pass 15 components that may want to
 * extend the summary card (e.g. inline edit affordances) without disrupting
 * existing call sites.
 */

export {
  MemorySummaryCard,
  type MemorySummaryCardProps,
} from '../MemorySummaryCard';
export { default } from '../MemorySummaryCard';
