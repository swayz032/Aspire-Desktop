/**
 * Ava Presents -- Card system barrel exports.
 */

export { ResearchModal } from './ResearchModal';
export type { ResearchModalProps } from './ResearchModal';

export { BaseCard } from './BaseCard';
export type { BaseCardProps } from './BaseCard';

export { SafetyBadge, deriveTier, tierToGlowColor } from './SafetyBadge';
export type { SafetyTier, SafetyBadgeProps } from './SafetyBadge';

export { resolveCard, registerCard, registeredTypes } from './CardRegistry';
export type { CardProps } from './CardRegistry';

// Wave 1 content cards
export { HotelCard } from './HotelCard';
export { ProductCard } from './ProductCard';
export { BusinessCard } from './BusinessCard';
