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

// Content cards
export { HotelCard } from './HotelCard';
export { ProductCard } from './ProductCard';
export { BusinessCard } from './BusinessCard';
export { PropertyCard } from './PropertyCard';
export { GenericCard } from './GenericCard';

// Shared helpers
export { ActionButton } from './ActionButton';
export type { ActionButtonVariant } from './ActionButton';
export { AnimatedDot } from './AnimatedDot';
export { ImageSkeleton } from './ImageSkeleton';
export { renderStars, fmtCount, domainOf, fmtPrice, fmtDollar, fmtSqft, fmtPercent } from './helpers';
