/**
 * CardRegistry -- Maps artifact_type strings to card components.
 *
 * Law #3 (Fail Closed): Unknown artifact types resolve to GenericCard,
 * never null and never a wrong type. The registry is the single source
 * of truth for which card renders which artifact.
 *
 * Card components are lazy-registered: individual card files call
 * `registerCard()` at import time. This avoids circular imports and
 * lets the registry work before all card types are loaded.
 */

import React from 'react';

// ─── Card Props Contract ─────────────────────────────────────────────────────

export interface CardProps {
  record: Record<string, any>;
  artifactType: string;
  index: number;
  total: number;
  confidence: { status: string; score: number } | null;
  onAction: (action: 'call' | 'visit' | 'book' | 'details' | 'tell_more', record: any) => void;
  isActive: boolean;
  /** Staggered entrance delay in ms. Passed from ResearchModal's renderCard. */
  enterDelay?: number;
}

// ─── Registry ────────────────────────────────────────────────────────────────

const CARD_MAP = new Map<string, React.ComponentType<CardProps>>();

/**
 * Register a card component for a given artifact type.
 * Called by individual card modules at import time.
 */
export function registerCard(artifactType: string, component: React.ComponentType<CardProps>): void {
  CARD_MAP.set(artifactType, component);
}

/**
 * Resolve the card component for a given artifact type.
 * Returns GenericCard if no specific card is registered (fail-closed, never null).
 */
export function resolveCard(artifactType: string): React.ComponentType<CardProps> {
  return CARD_MAP.get(artifactType) ?? GenericCard;
}

/**
 * List all registered artifact types. Useful for testing and debugging.
 */
export function registeredTypes(): string[] {
  return Array.from(CARD_MAP.keys());
}

// ─── Built-in Mappings (placeholder until individual cards are built) ────────

// GenericCard — real fallback that renders record name + type label (Law #3: never null)
import { GenericCard } from './GenericCard';

// Pre-register known artifact types that will be implemented by other agents.
// They all resolve to the placeholder until real card components call registerCard().
const KNOWN_TYPES = [
  'HotelShortlist',
  'PriceComparison',
  'VendorShortlist',
  'ProspectList',
  'FlightShortlist',
  'RestaurantShortlist',
  'ServiceComparison',
  'GenericResearch',
] as const;

KNOWN_TYPES.forEach((type) => {
  if (!CARD_MAP.has(type)) {
    CARD_MAP.set(type, GenericCard);
  }
});

// ─── Wave 1 Card Registrations ──────────────────────────────────────────────
// Lazy imports to avoid circular deps — cards self-register on first import.

// Card registrations — cards implement the CardProps interface above
import { HotelCard } from './HotelCard';
import { ProductCard } from './ProductCard';
import { BusinessCard } from './BusinessCard';
import { PropertyCard } from './PropertyCard';

// Hotels
registerCard('HotelShortlist', HotelCard);

// Products / Pricing
registerCard('PriceComparison', ProductCard);
registerCard('EstimateResearchPack', ProductCard);

// Vendors / Business
registerCard('VendorShortlist', BusinessCard);
registerCard('ProspectList', BusinessCard);
registerCard('CompetitorBrief', BusinessCard);

// Property / Landlord (all ATTOM property data types)
registerCard('LandlordPropertyPack', PropertyCard);
registerCard('PropertyFactPack', PropertyCard);
registerCard('RentCompPack', PropertyCard);
registerCard('PermitContextPack', PropertyCard);
registerCard('NeighborhoodDemandBrief', PropertyCard);
registerCard('ScreeningComplianceBrief', PropertyCard);
registerCard('InvestmentOpportunityPack', PropertyCard);
