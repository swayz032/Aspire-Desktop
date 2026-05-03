/**
 * AspireNumberPickerSheet — Pass 19 update (plan §3.3 + §6.1).
 *
 * Modal sheet for searching and purchasing an Aspire (Twilio) phone number.
 * Used by both ASPIRE_NEW_NUMBER (primary number) and FORWARD_EXISTING (SMS
 * companion number, per §3.8) flows.
 *
 * Pass 19 changes:
 *
 *   1. **z-index fix** — wraps in `<Modal presentationStyle="overFullScreen"
 *      transparent>` on every platform. Backdrop is an explicit
 *      `position:absolute,top/left/right/bottom:0` View with `zIndex: 9999`
 *      so it covers the entire viewport (verified in Chrome DevTools — the
 *      sheet sits above all cards including the floating Sarah Status Rail).
 *
 *   2. **Local | Toll-free toggle** — `numberType` state. When TOLL_FREE is
 *      selected, the area-code input hides (toll-free is non-geographic) and
 *      the backend search hits Twilio's TollFree resource. Sheet renders the
 *      monthly cost prominently — toll-free is ~$2/mo vs local ~$1.15/mo.
 *
 *   3. **Empty-state recommendation** — when local search returns 0 (Twilio
 *      doesn't carry inventory in every area code), the empty state pivots
 *      the user to toll-free with a one-tap "Switch to toll-free" CTA, plus
 *      a secondary text-link "Try a different area code" that just refocuses
 *      the input.
 *
 * Per §12.1 Framer-style:
 *   - Glassmorphism on the sheet (expo-blur intensity 30 over backdrop)
 *   - Layered depth: backdrop + glass surface + content
 *   - Premium controls — focus rings on every input
 *   - Skeleton shimmer during loading
 *   - Personality on empty: pivots-to-toll-free instead of generic "no results"
 */

import React, { useEffect, useState, useCallback, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Pressable,
  TextInput,
  Platform,
  ViewStyle,
  ActivityIndicator,
  ScrollView,
  Modal,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { BlurView } from 'expo-blur';
import { Colors, BorderRadius, Spacing } from '@/constants/tokens';
import { useAuthFetch } from '@/lib/authenticatedFetch';
import { useTenant } from '@/providers/TenantProvider';
import {
  searchAvailableNumbers as apiSearchAvailableNumbers,
  purchaseNumber as apiPurchaseNumber,
  type AvailableNumber,
  type NumberTypeWire,
} from '@/lib/api/frontDesk';

// ---------------------------------------------------------------------------
// Types — server contracts
// ---------------------------------------------------------------------------

export interface TwilioAvailableNumber {
  phoneNumber: string;        // "+12125550198" (E.164)
  friendlyName?: string;      // "(212) 555-0198"
  region?: string;            // "New York, NY"
  isoCountry?: string;        // "US"
  monthlyCostUsd?: number;    // 1.15
  capabilities: {
    voice: boolean;
    sms: boolean;
    mms: boolean;
  };
}

export interface PurchasedNumberResult {
  phoneNumber: string;
  friendlyName: string;
  region?: string;
  sid?: string;
}

export interface AspireNumberPickerSheetProps {
  visible: boolean;
  onClose: () => void;
  /** Called after a successful purchase — parent updates active number. */
  onPurchased: (result: PurchasedNumberResult) => void;
  /** Initial area code (e.g. "212") */
  initialAreaCode?: string;
  /** Initial vanity contains filter (e.g. "PAINT") */
  initialContains?: string;
  /**
   * Active office ID — passed from parent because the React Native Modal
   * on web renders via a portal that's outside the TenantProvider context
   * tree, so reading `useTenant()` inside the sheet returns an empty
   * officeId. Parent already has `tenant.officeId` in scope; thread it down.
   */
  officeId?: string | null;
}

// ---------------------------------------------------------------------------
// Adapter: backend response (snake_case, AvailableNumber) → component shape
// ---------------------------------------------------------------------------

function adaptAvailableNumber(n: AvailableNumber, fallbackCost: number): TwilioAvailableNumber {
  return {
    phoneNumber: n.phone_number,
    friendlyName: formatNumber(n.phone_number),
    region: n.region,
    isoCountry: 'US',
    monthlyCostUsd:
      typeof n.monthly_cost_cents === 'number' ? n.monthly_cost_cents / 100 : fallbackCost,
    capabilities: {
      voice: n.capabilities?.voice ?? true,
      sms: n.capabilities?.sms ?? true,
      mms: n.capabilities?.mms ?? false,
    },
  };
}

// ---------------------------------------------------------------------------
// One-time CSS — sheet entrance + shimmer + focus polish
// ---------------------------------------------------------------------------

let cssInjected = false;
function injectSheetCss() {
  if (cssInjected || Platform.OS !== 'web') return;
  cssInjected = true;
  const style = document.createElement('style');
  style.id = 'fds-number-picker-css';
  style.textContent = `
    @keyframes fds-sheet-pop {
      from { opacity: 0; transform: translateY(8px) scale(0.97); }
      to   { opacity: 1; transform: translateY(0) scale(1); }
    }
    @keyframes fds-sheet-fade {
      from { opacity: 0; }
      to   { opacity: 1; }
    }
    @keyframes fds-shimmer {
      0%   { background-position: -200% 0; }
      100% { background-position: 200% 0; }
    }
    .fds-sheet-backdrop { animation: fds-sheet-fade 200ms ease-out both; }
    .fds-sheet-card { animation: fds-sheet-pop 240ms cubic-bezier(0.16, 1, 0.3, 1) both; }
    .fds-skeleton {
      background: linear-gradient(90deg, #161618 0%, #1f1f24 50%, #161618 100%);
      background-size: 200% 100%;
      animation: fds-shimmer 1.4s ease-in-out infinite;
    }
    .fds-search-input { transition: border-color 140ms ease-out, box-shadow 140ms ease-out; }
    .fds-search-input:hover { border-color: rgba(255,255,255,0.18); }
    .fds-search-input:focus-visible {
      outline: none;
      border-color: rgba(59,130,246,0.55);
      box-shadow: 0 0 0 3px rgba(59,130,246,0.18);
    }
    .fds-result-card { transition: border-color 180ms ease-out, background-color 180ms ease-out, transform 160ms ease-out; }
    .fds-result-card:hover { transform: translateY(-1px); border-color: rgba(255,255,255,0.16); }
    .fds-result-card:focus-visible {
      outline: 2px solid rgba(59,130,246,0.7);
      outline-offset: 3px;
      border-radius: 12px;
    }
    .fds-sheet-btn { transition: transform 160ms ease-out, background-color 160ms ease-out, box-shadow 160ms ease-out, border-color 160ms ease-out; }
    .fds-sheet-btn:hover { transform: translateY(-1px); }
    .fds-sheet-btn:active { transform: translateY(0); }
    .fds-sheet-btn:focus-visible { outline: 2px solid rgba(59,130,246,0.7); outline-offset: 2px; }
    .fds-sheet-toggle { transition: background-color 160ms ease-out, border-color 160ms ease-out, color 160ms ease-out; }
    .fds-sheet-toggle:focus-visible { outline: 2px solid rgba(59,130,246,0.7); outline-offset: 3px; }
    @media (prefers-reduced-motion: reduce) {
      .fds-sheet-backdrop, .fds-sheet-card, .fds-skeleton, .fds-result-card, .fds-sheet-btn, .fds-sheet-toggle { animation: none; transition: none; }
    }
  `;
  document.head.appendChild(style);
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function formatNumber(raw: string): string {
  const digits = raw.replace(/\D/g, '');
  const last10 = digits.slice(-10);
  if (last10.length !== 10) return raw;
  return `(${last10.slice(0, 3)}) ${last10.slice(3, 6)}-${last10.slice(6)}`;
}

function genIdempotencyKey(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return `aspire-num-${crypto.randomUUID()}`;
  }
  return `aspire-num-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}

const LOCAL_FALLBACK_COST = 1.15;
const TOLL_FREE_FALLBACK_COST = 2.0;

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function AspireNumberPickerSheet({
  visible,
  onClose,
  onPurchased,
  initialAreaCode = '',
  initialContains = '',
  officeId: officeIdProp,
}: AspireNumberPickerSheetProps) {
  injectSheetCss();

  const { authenticatedFetch } = useAuthFetch();
  // Prefer the prop (passed from parent in TenantProvider tree). Fall back to
  // useTenant() for any callsite that hasn't migrated yet — but on web Modal
  // renders via a portal outside context, so the prop is required to work.
  const { tenant } = useTenant();
  const officeId = officeIdProp ?? tenant?.officeId ?? null;

  const [numberType, setNumberType] = useState<NumberTypeWire>('LOCAL');
  const [areaCode, setAreaCode] = useState(initialAreaCode);
  const [contains, setContains] = useState(initialContains);
  const [results, setResults] = useState<TwilioAvailableNumber[] | null>(null);
  const [lastSearchedType, setLastSearchedType] = useState<NumberTypeWire>('LOCAL');
  const [lastSearchedAreaCode, setLastSearchedAreaCode] = useState<string>('');
  const [isSearching, setIsSearching] = useState(false);
  const [searchError, setSearchError] = useState<string | null>(null);
  const [selectedPhone, setSelectedPhone] = useState<string | null>(null);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [isPurchasing, setIsPurchasing] = useState(false);
  const [purchaseError, setPurchaseError] = useState<string | null>(null);

  const areaCodeInputRef = useRef<TextInput>(null);

  // Reset transient state whenever the sheet opens
  useEffect(() => {
    if (visible) {
      setNumberType('LOCAL');
      setAreaCode(initialAreaCode);
      setContains(initialContains);
      setResults(null);
      setLastSearchedType('LOCAL');
      setLastSearchedAreaCode('');
      setSearchError(null);
      setSelectedPhone(null);
      setConfirmOpen(false);
      setPurchaseError(null);
      setIsPurchasing(false);
      setIsSearching(false);
    }
  }, [visible, initialAreaCode, initialContains]);

  // Web Escape key dismiss
  useEffect(() => {
    if (!visible || Platform.OS !== 'web') return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        if (confirmOpen) {
          setConfirmOpen(false);
        } else {
          onClose();
        }
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [visible, confirmOpen, onClose]);

  const performSearch = useCallback(
    async (searchType: NumberTypeWire, searchAreaCode: string) => {
      if (searchType === 'LOCAL' && searchAreaCode.length !== 3) {
        setSearchError('Enter a 3-digit area code.');
        return;
      }
      if (!officeId) {
        setSearchError('Your office isn’t set up yet. Complete onboarding (Suite + Office) before purchasing a number.');
        return;
      }
      setIsSearching(true);
      setSearchError(null);
      setResults(null);
      setSelectedPhone(null);
      setLastSearchedType(searchType);
      setLastSearchedAreaCode(searchAreaCode);
      try {
        const numbers = await apiSearchAvailableNumbers(
          { authenticatedFetch, officeId },
          searchAreaCode,
          contains.trim() || undefined,
          12,
          searchType,
        );
        const fallbackCost =
          searchType === 'TOLL_FREE' ? TOLL_FREE_FALLBACK_COST : LOCAL_FALLBACK_COST;
        setResults(numbers.map((n) => adaptAvailableNumber(n, fallbackCost)));
      } catch (err) {
        setSearchError(err instanceof Error ? err.message : 'Search failed.');
        setResults([]);
      } finally {
        setIsSearching(false);
      }
    },
    [officeId, contains, authenticatedFetch],
  );

  const handleSearch = useCallback(() => {
    performSearch(numberType, areaCode);
  }, [performSearch, numberType, areaCode]);

  /**
   * Handles the empty-state "Switch to toll-free" CTA — flips the toggle and
   * immediately re-searches without requiring the user to tap Search again.
   */
  const handleSwitchToTollFree = useCallback(() => {
    setNumberType('TOLL_FREE');
    performSearch('TOLL_FREE', '');
  }, [performSearch]);

  const handleTryDifferentAreaCode = useCallback(() => {
    setResults(null);
    setSearchError(null);
    setLastSearchedAreaCode('');
    // Refocus the area-code input on web.
    if (Platform.OS === 'web') {
      window.setTimeout(() => areaCodeInputRef.current?.focus(), 50);
    }
  }, []);

  const handleConfirmPurchase = useCallback(async () => {
    if (!selectedPhone) return;
    if (!officeId) {
      setPurchaseError('Your office isn’t set up yet. Complete onboarding (Suite + Office) before purchasing a number.');
      return;
    }
    setIsPurchasing(true);
    setPurchaseError(null);
    try {
      const purchased = await apiPurchaseNumber(
        { authenticatedFetch, officeId },
        selectedPhone,
        genIdempotencyKey(),
      );
      const result: PurchasedNumberResult = {
        phoneNumber: purchased.phone_number,
        friendlyName: formatNumber(purchased.phone_number),
        sid: purchased.twilio_sid,
      };
      onPurchased(result);
      onClose();
    } catch (err) {
      setPurchaseError(err instanceof Error ? err.message : 'Purchase failed.');
    } finally {
      setIsPurchasing(false);
    }
  }, [selectedPhone, onPurchased, onClose, authenticatedFetch, officeId]);

  const selectedDetail = results?.find((n) => n.phoneNumber === selectedPhone) ?? null;

  if (!visible) return null;

  // -----------------------------------------------------------------------
  // Render — the modal+overFullScreen wrapper guarantees the backdrop
  // covers the entire viewport on every platform. On web we additionally
  // enforce zIndex: 9999 + position: fixed via inline style.
  // -----------------------------------------------------------------------

  const sheetBody = (
    <>
      {/* Backdrop — full-viewport, click-to-close */}
      <Pressable
        onPress={onClose}
        accessibilityLabel="Close picker"
        style={styles.backdrop}
        {...(Platform.OS === 'web' ? ({ className: 'fds-sheet-backdrop' } as any) : {})}
      />

      {/* Tinted blur layer — purely cosmetic, sits above backdrop, below sheet */}
      <BlurView
        intensity={30}
        tint="dark"
        style={styles.backdropBlur}
        pointerEvents="none"
      />

      {/* Sheet card */}
      <View
        style={styles.sheetWrap}
        pointerEvents="box-none"
        accessibilityViewIsModal
        accessibilityLabel="Find an Aspire number"
      >
        <View
          style={styles.sheetCard}
          {...(Platform.OS === 'web' ? ({ className: 'fds-sheet-card' } as any) : {})}
        >
          <SheetContent
            numberType={numberType}
            onChangeNumberType={(t) => {
              setNumberType(t);
              // Don't auto-search on toggle — user controls timing.
              setResults(null);
              setSelectedPhone(null);
            }}
            areaCode={areaCode}
            setAreaCode={setAreaCode}
            areaCodeInputRef={areaCodeInputRef}
            contains={contains}
            setContains={setContains}
            isSearching={isSearching}
            searchError={searchError}
            results={results}
            lastSearchedType={lastSearchedType}
            lastSearchedAreaCode={lastSearchedAreaCode}
            selectedPhone={selectedPhone}
            setSelectedPhone={setSelectedPhone}
            onSearch={handleSearch}
            onClose={onClose}
            onPurchase={() => setConfirmOpen(true)}
            onSwitchToTollFree={handleSwitchToTollFree}
            onTryDifferentAreaCode={handleTryDifferentAreaCode}
          />
        </View>
      </View>

      {/* Confirm dialog overlays everything */}
      {confirmOpen && selectedDetail ? (
        <ConfirmDialog
          number={selectedDetail}
          numberType={lastSearchedType}
          isPurchasing={isPurchasing}
          error={purchaseError}
          onCancel={() => setConfirmOpen(false)}
          onConfirm={handleConfirmPurchase}
        />
      ) : null}
    </>
  );

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onClose}
      presentationStyle="overFullScreen"
      // On web, RN's Modal renders as a portal; we also enforce stacking via
      // the explicit zIndex on the outer container below.
      statusBarTranslucent
    >
      <View style={styles.modalRoot}>{sheetBody}</View>
    </Modal>
  );
}

// ---------------------------------------------------------------------------
// SheetContent
// ---------------------------------------------------------------------------

interface SheetContentProps {
  numberType: NumberTypeWire;
  onChangeNumberType: (t: NumberTypeWire) => void;
  areaCode: string;
  setAreaCode: (v: string) => void;
  areaCodeInputRef: React.RefObject<TextInput | null>;
  contains: string;
  setContains: (v: string) => void;
  isSearching: boolean;
  searchError: string | null;
  results: TwilioAvailableNumber[] | null;
  lastSearchedType: NumberTypeWire;
  lastSearchedAreaCode: string;
  selectedPhone: string | null;
  setSelectedPhone: (phone: string | null) => void;
  onSearch: () => void;
  onClose: () => void;
  onPurchase: () => void;
  onSwitchToTollFree: () => void;
  onTryDifferentAreaCode: () => void;
}

function SheetContent({
  numberType,
  onChangeNumberType,
  areaCode,
  setAreaCode,
  areaCodeInputRef,
  contains,
  setContains,
  isSearching,
  searchError,
  results,
  lastSearchedType,
  lastSearchedAreaCode,
  selectedPhone,
  setSelectedPhone,
  onSearch,
  onClose,
  onPurchase,
  onSwitchToTollFree,
  onTryDifferentAreaCode,
}: SheetContentProps) {
  // Numbers are included in the user's Aspire subscription — never surface
  // raw Twilio per-number pricing in the UI. The user's plan covers it.
  return (
    <>
      {/* Header */}
      <View style={styles.header}>
        <View style={styles.headerCol}>
          <Text style={styles.headerKicker}>FRONT DESK · NEW NUMBER</Text>
          <Text style={styles.headerTitle} accessibilityRole="header">
            Find an Aspire number
          </Text>
          <Text style={styles.headerSubtitle}>
            Pick a local 10DLC for your area or a toll-free 8XX that works nationwide.
          </Text>
        </View>
        <Pressable
          onPress={onClose}
          accessibilityRole="button"
          accessibilityLabel="Close picker"
          style={styles.closeBtn}
          {...(Platform.OS === 'web' ? ({ className: 'fds-sheet-btn' } as any) : {})}
        >
          <Ionicons name="close" size={20} color={Colors.text.tertiary} />
        </Pressable>
      </View>

      {/* Number-type segmented toggle (Local | Toll-free) + monthly cost hint */}
      <View style={styles.toggleRow}>
        <View style={styles.toggleSegments} accessibilityRole="radiogroup">
          <ToggleSegment
            label="Local"
            sublabel="10DLC · area-code based"
            active={numberType === 'LOCAL'}
            onPress={() => onChangeNumberType('LOCAL')}
          />
          <ToggleSegment
            label="Toll-free"
            sublabel="8XX · nationwide"
            active={numberType === 'TOLL_FREE'}
            onPress={() => onChangeNumberType('TOLL_FREE')}
          />
        </View>
        <View style={styles.costHint}>
          <Ionicons name="checkmark-circle-outline" size={12} color={Colors.text.tertiary} />
          <Text style={styles.costHintText}>Included in your plan</Text>
        </View>
      </View>

      {/* Search row */}
      <View style={styles.searchRow}>
        {numberType === 'LOCAL' ? (
          <View style={[styles.fieldCol, styles.fieldColAreaCode]}>
            <Text style={styles.fieldLabel}>Area code</Text>
            <TextInput
              ref={areaCodeInputRef}
              value={areaCode}
              onChangeText={(t) => setAreaCode(t.replace(/\D/g, '').slice(0, 3))}
              placeholder="212"
              placeholderTextColor={Colors.text.muted}
              keyboardType="number-pad"
              maxLength={3}
              style={styles.input}
              accessibilityLabel="Area code"
              {...(Platform.OS === 'web' ? ({ className: 'fds-search-input' } as any) : {})}
            />
          </View>
        ) : null}
        <View style={[styles.fieldCol, styles.fieldColVanity]}>
          <Text style={styles.fieldLabel}>Contains (optional)</Text>
          <TextInput
            value={contains}
            onChangeText={setContains}
            placeholder="e.g., PAINT"
            placeholderTextColor={Colors.text.muted}
            autoCapitalize="characters"
            style={styles.input}
            accessibilityLabel="Vanity contains filter"
            {...(Platform.OS === 'web' ? ({ className: 'fds-search-input' } as any) : {})}
          />
        </View>
        <Pressable
          onPress={onSearch}
          disabled={isSearching}
          accessibilityRole="button"
          accessibilityLabel="Search numbers"
          accessibilityState={{ busy: isSearching, disabled: isSearching }}
          style={[styles.searchBtn, isSearching && styles.searchBtnDisabled]}
          {...(Platform.OS === 'web' ? ({ className: 'fds-sheet-btn' } as any) : {})}
        >
          {isSearching ? (
            <ActivityIndicator size="small" color="#ffffff" />
          ) : (
            <Ionicons name="search" size={16} color="#ffffff" />
          )}
          <Text style={styles.searchBtnText}>Search</Text>
        </Pressable>
      </View>

      {/* Body */}
      <ScrollView
        style={styles.body}
        contentContainerStyle={styles.bodyContent}
        showsVerticalScrollIndicator={false}
      >
        {isSearching ? (
          <SkeletonGrid />
        ) : searchError ? (
          <ErrorState message={searchError} onRetry={onSearch} />
        ) : results === null ? (
          <InitialPrompt numberType={numberType} />
        ) : results.length === 0 ? (
          lastSearchedType === 'LOCAL' ? (
            <EmptyLocalRecommendation
              areaCode={lastSearchedAreaCode}
              onSwitchToTollFree={onSwitchToTollFree}
              onTryDifferentAreaCode={onTryDifferentAreaCode}
            />
          ) : (
            <EmptyTollFreeState />
          )
        ) : (
          <ResultsGrid
            results={results}
            numberType={lastSearchedType}
            selectedPhone={selectedPhone}
            onSelect={setSelectedPhone}
          />
        )}
      </ScrollView>

      {/* Footer — only when a number is selected */}
      {selectedPhone ? (
        <View style={styles.footer}>
          <Text style={styles.footerHint} numberOfLines={1}>
            Selected:{' '}
            <Text style={styles.footerHintStrong}>
              {formatNumber(selectedPhone)}
            </Text>
          </Text>
          <Pressable
            onPress={onPurchase}
            accessibilityRole="button"
            accessibilityLabel="Claim this number"
            style={styles.purchaseBtn}
            {...(Platform.OS === 'web' ? ({ className: 'fds-sheet-btn' } as any) : {})}
          >
            <Ionicons name="lock-closed" size={14} color="#ffffff" />
            <Text style={styles.purchaseBtnText}>Claim number</Text>
            <Ionicons name="chevron-forward" size={14} color="rgba(255,255,255,0.85)" />
          </Pressable>
        </View>
      ) : null}
    </>
  );
}

// ---------------------------------------------------------------------------
// ToggleSegment — single segment of the Local|Toll-free toggle
// ---------------------------------------------------------------------------

function ToggleSegment({
  label,
  sublabel,
  active,
  onPress,
}: {
  label: string;
  sublabel: string;
  active: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="radio"
      accessibilityState={{ checked: active }}
      accessibilityLabel={`${label} — ${sublabel}`}
      style={[styles.toggleSegment, active && styles.toggleSegmentActive]}
      {...(Platform.OS === 'web' ? ({ className: 'fds-sheet-toggle' } as any) : {})}
    >
      <Text style={[styles.toggleSegmentLabel, active && styles.toggleSegmentLabelActive]}>
        {label}
      </Text>
      <Text style={[styles.toggleSegmentSublabel, active && styles.toggleSegmentSublabelActive]}>
        {sublabel}
      </Text>
    </Pressable>
  );
}

// ---------------------------------------------------------------------------
// ResultsGrid
// ---------------------------------------------------------------------------

function ResultsGrid({
  results,
  numberType,
  selectedPhone,
  onSelect,
}: {
  results: TwilioAvailableNumber[];
  numberType: NumberTypeWire;
  selectedPhone: string | null;
  onSelect: (phone: string) => void;
}) {
  return (
    <View style={styles.grid}>
      {results.map((num) => (
        <NumberResultCard
          key={num.phoneNumber}
          number={num}
          numberType={numberType}
          selected={selectedPhone === num.phoneNumber}
          onSelect={() => onSelect(num.phoneNumber)}
        />
      ))}
    </View>
  );
}

function NumberResultCard({
  number,
  numberType,
  selected,
  onSelect,
}: {
  number: TwilioAvailableNumber;
  numberType: NumberTypeWire;
  selected: boolean;
  onSelect: () => void;
}) {
  // Numbers are included in the user's Aspire subscription — no per-number
  // price is shown in the UI. We keep monthlyCostUsd in the wire shape for
  // future plan-tier comparisons but never render it as a dollar amount.
  const region =
    numberType === 'TOLL_FREE'
      ? 'Nationwide · toll-free'
      : (number.region ?? number.isoCountry ?? 'United States');
  const display = number.friendlyName ?? formatNumber(number.phoneNumber);

  return (
    <Pressable
      onPress={onSelect}
      accessibilityRole="radio"
      accessibilityState={{ checked: selected }}
      accessibilityLabel={`Phone number ${display}, ${region}`}
      style={[styles.resultCard, selected && styles.resultCardSelected]}
      {...(Platform.OS === 'web' ? ({ className: 'fds-result-card' } as any) : {})}
    >
      <View style={styles.resultCardHeader}>
        <View style={[styles.radio, selected && styles.radioSelected]}>
          {selected ? <View style={styles.radioInner} /> : null}
        </View>
        <Text style={[styles.resultNumber, selected && styles.resultNumberSelected]}>
          {display}
        </Text>
      </View>
      <Text style={styles.resultRegion} numberOfLines={1}>
        {region}
      </Text>

      <View style={styles.resultFooter}>
        <View style={styles.capPills}>
          {number.capabilities.voice ? <CapabilityPill label="Voice" /> : null}
          {number.capabilities.sms ? <CapabilityPill label="SMS" /> : null}
          {number.capabilities.mms ? <CapabilityPill label="MMS" /> : null}
        </View>
      </View>
    </Pressable>
  );
}

function CapabilityPill({ label }: { label: string }) {
  return (
    <View style={styles.capPill}>
      <Text style={styles.capPillText}>{label}</Text>
    </View>
  );
}

// ---------------------------------------------------------------------------
// SkeletonGrid
// ---------------------------------------------------------------------------

function SkeletonGrid() {
  const skeletons = Array.from({ length: 6 }, (_, i) => i);
  return (
    <View
      style={styles.grid}
      accessibilityRole="progressbar"
      accessibilityLabel="Searching for available numbers"
    >
      {skeletons.map((i) => (
        <View
          key={i}
          style={styles.skeletonCard}
          {...(Platform.OS === 'web' ? ({ className: 'fds-skeleton' } as any) : {})}
        />
      ))}
    </View>
  );
}

// ---------------------------------------------------------------------------
// EmptyLocalRecommendation — pivots to toll-free when local search returns 0
// ---------------------------------------------------------------------------

function EmptyLocalRecommendation({
  areaCode,
  onSwitchToTollFree,
  onTryDifferentAreaCode,
}: {
  areaCode: string;
  onSwitchToTollFree: () => void;
  onTryDifferentAreaCode: () => void;
}) {
  return (
    <View style={styles.recoBox} accessibilityLabel="Toll-free recommendation">
      <View pointerEvents="none" style={styles.recoAmbient} />
      <View style={styles.recoIconWrap}>
        <Ionicons name="globe-outline" size={26} color={Colors.accent.cyan} />
      </View>
      <Text style={styles.recoKicker}>RECOMMENDED</Text>
      <Text style={styles.recoTitle} accessibilityRole="header">
        Twilio doesn’t have local numbers in {areaCode || 'that area code'} right now
      </Text>
      <Text style={styles.recoBody}>
        Most owners pick a toll-free number — they work nationwide, are easier
        for callers to remember, and clear A2P verification faster than 10DLC.
      </Text>
      <Pressable
        onPress={onSwitchToTollFree}
        accessibilityRole="button"
        accessibilityLabel="Switch to toll-free and search"
        style={styles.recoCtaPrimary}
        {...(Platform.OS === 'web' ? ({ className: 'fds-sheet-btn' } as any) : {})}
      >
        <Ionicons name="swap-horizontal" size={14} color="#ffffff" />
        <Text style={styles.recoCtaPrimaryText}>Switch to toll-free</Text>
      </Pressable>
      <Pressable
        onPress={onTryDifferentAreaCode}
        accessibilityRole="link"
        accessibilityLabel="Try a different area code"
        style={styles.recoCtaSecondary}
      >
        <Text style={styles.recoCtaSecondaryText}>or try a different area code</Text>
      </Pressable>
    </View>
  );
}

function EmptyTollFreeState() {
  return (
    <View style={styles.stateBox}>
      <View style={styles.stateIcon}>
        <Ionicons name="telescope-outline" size={28} color={Colors.text.tertiary} />
      </View>
      <Text style={styles.stateTitle} accessibilityRole="header">
        No toll-free matches
      </Text>
      <Text style={styles.stateBody}>
        Remove the vanity filter or try a different one — Twilio rotates inventory.
      </Text>
    </View>
  );
}

// ---------------------------------------------------------------------------
// InitialPrompt
// ---------------------------------------------------------------------------

function InitialPrompt({ numberType }: { numberType: NumberTypeWire }) {
  return (
    <View style={styles.stateBox}>
      <View style={styles.stateIcon}>
        <Ionicons name="search-outline" size={28} color={Colors.accent.cyan} />
      </View>
      <Text style={styles.stateTitle} accessibilityRole="header">
        {numberType === 'TOLL_FREE'
          ? 'Search toll-free inventory'
          : 'Pick a region to start'}
      </Text>
      <Text style={styles.stateBody}>
        {numberType === 'TOLL_FREE'
          ? 'Optionally add a vanity word like "PAINT" to narrow the toll-free results.'
          : 'Enter a 3-digit area code above. Add a vanity word like "PAINT" to narrow.'}
      </Text>
    </View>
  );
}

// ---------------------------------------------------------------------------
// ErrorState
// ---------------------------------------------------------------------------

/**
 * Classify a raw Twilio/orchestrator error message into a UX-friendly state.
 * Hides infra leaks (e.g. "20008: Test Account Credentials") from the user
 * and routes recoverable errors to the right CTA.
 */
function classifyTwilioError(message: string): {
  title: string;
  body: string;
  flavor: 'config' | 'rate_limit' | 'network' | 'generic';
} {
  const lower = (message || '').toLowerCase();

  // Test/missing credentials — 20008 from Twilio, MISSING_TWILIO_CREDENTIALS from us.
  if (
    lower.includes('20008') ||
    lower.includes('test account credentials') ||
    lower.includes('missing_twilio_credentials') ||
    lower.includes('twilio_account_sid') ||
    lower.includes('authenticate')
  ) {
    return {
      title: 'Twilio not connected yet',
      body:
        "Your Twilio account isn't fully configured for purchasing real numbers. " +
        'An admin needs to upgrade to a Live account and connect production credentials.',
      flavor: 'config',
    };
  }

  // 429 / throttling — common when rapidly searching
  if (lower.includes('20429') || lower.includes('rate limit') || lower.includes('throttle')) {
    return {
      title: 'Slow down a moment',
      body: 'Twilio is rate-limiting us. Wait a few seconds and try again.',
      flavor: 'rate_limit',
    };
  }

  // Network / timeout / 5xx
  if (
    lower.includes('timeout') ||
    lower.includes('econnreset') ||
    lower.includes('network') ||
    lower.includes('502') ||
    lower.includes('503') ||
    lower.includes('504')
  ) {
    return {
      title: 'Connection hiccup',
      body: 'We couldn’t reach the number directory. Check your connection and try again.',
      flavor: 'network',
    };
  }

  return {
    title: 'Search hit a snag',
    body: message || 'Something went wrong. Try again in a moment.',
    flavor: 'generic',
  };
}

function ErrorState({ message, onRetry }: { message: string; onRetry: () => void }) {
  const cls = classifyTwilioError(message);
  // Config errors aren't recoverable by retrying — hide the retry CTA
  // and let the owner know an admin action is required.
  const showRetry = cls.flavor !== 'config';
  return (
    <View
      style={styles.stateBox}
      accessibilityRole="alert"
      accessibilityLabel={`Search error: ${cls.title}`}
    >
      <View style={[styles.stateIcon, styles.stateIconError]}>
        <Ionicons name="alert-circle" size={28} color={Colors.semantic.error} />
      </View>
      <Text style={styles.stateTitle} accessibilityRole="header">
        {cls.title}
      </Text>
      <Text style={styles.stateBody}>{cls.body}</Text>
      {showRetry ? (
        <Pressable
          onPress={onRetry}
          accessibilityRole="button"
          accessibilityLabel="Retry search"
          style={styles.retryBtn}
          {...(Platform.OS === 'web' ? ({ className: 'fds-sheet-btn' } as any) : {})}
        >
          <Ionicons name="refresh" size={14} color={Colors.text.primary} />
          <Text style={styles.retryBtnText}>Try again</Text>
        </Pressable>
      ) : null}
    </View>
  );
}

// ---------------------------------------------------------------------------
// ConfirmDialog — Yellow-tier purchase confirmation
// ---------------------------------------------------------------------------

interface ConfirmDialogProps {
  number: TwilioAvailableNumber;
  numberType: NumberTypeWire;
  isPurchasing: boolean;
  error: string | null;
  onCancel: () => void;
  onConfirm: () => void;
}

function ConfirmDialog({
  number,
  numberType,
  isPurchasing,
  error,
  onCancel,
  onConfirm,
}: ConfirmDialogProps) {
  // Numbers are included in the Aspire subscription — confirm copy
  // reflects "claim", not "purchase / charge".
  const display = number.friendlyName ?? formatNumber(number.phoneNumber);

  return (
    <View
      style={styles.confirmBackdrop}
      accessibilityViewIsModal
      {...(Platform.OS === 'web' ? ({ className: 'fds-sheet-backdrop' } as any) : {})}
    >
      <Pressable
        onPress={onCancel}
        style={StyleSheet.absoluteFill as ViewStyle}
        accessibilityLabel="Cancel"
      />
      <View
        style={styles.confirmCard}
        {...(Platform.OS === 'web' ? ({ className: 'fds-sheet-card' } as any) : {})}
      >
        <View style={styles.confirmIconWrap}>
          <Ionicons name="alert-circle" size={26} color={Colors.semantic.warning} />
        </View>
        <Text style={styles.confirmTitle} accessibilityRole="header">
          Confirm new number
        </Text>
        <Text style={styles.confirmBody}>
          This will assign{' '}
          <Text style={styles.confirmStrong}>{display}</Text>
          {numberType === 'TOLL_FREE' ? ' (toll-free)' : ''} as your office
          number. Included in your Aspire plan — no extra charge.
        </Text>

        {error ? (
          <View style={styles.confirmError} accessibilityRole="alert">
            <Ionicons name="warning" size={14} color={Colors.semantic.error} />
            <Text style={styles.confirmErrorText}>{error}</Text>
          </View>
        ) : null}

        <View style={styles.confirmActions}>
          <Pressable
            onPress={onCancel}
            disabled={isPurchasing}
            accessibilityRole="button"
            accessibilityLabel="Cancel"
            style={styles.confirmCancel}
            {...(Platform.OS === 'web' ? ({ className: 'fds-sheet-btn' } as any) : {})}
          >
            <Text style={styles.confirmCancelText}>Cancel</Text>
          </Pressable>
          <Pressable
            onPress={onConfirm}
            disabled={isPurchasing}
            accessibilityRole="button"
            accessibilityLabel="Confirm purchase"
            accessibilityState={{ busy: isPurchasing }}
            style={[styles.confirmConfirm, isPurchasing && styles.confirmConfirmBusy]}
            {...(Platform.OS === 'web' ? ({ className: 'fds-sheet-btn' } as any) : {})}
          >
            {isPurchasing ? (
              <ActivityIndicator size="small" color="#ffffff" />
            ) : (
              <Ionicons name="checkmark-circle" size={14} color="#ffffff" />
            )}
            <Text style={styles.confirmConfirmText}>
              {isPurchasing ? 'Purchasing…' : 'Confirm'}
            </Text>
          </Pressable>
        </View>
      </View>
    </View>
  );
}

// ---------------------------------------------------------------------------
// Styles
// ---------------------------------------------------------------------------

const SHEET_MAX_WIDTH = 760;
const SHEET_MAX_HEIGHT = 760;

const styles = StyleSheet.create({
  // ----- Modal root — full-viewport container --------------------------
  modalRoot: {
    flex: 1,
    ...(Platform.OS === 'web'
      ? ({
          position: 'fixed' as any,
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          zIndex: 9999,
        } as object)
      : {}),
  } as any,

  // ----- Backdrop ------------------------------------------------------
  // §6.1 z-index fix: explicit position/inset/zIndex so the backdrop
  // covers everything (including the sticky Sarah Status Rail) on web.
  backdrop: {
    position: Platform.OS === 'web' ? ('absolute' as any) : 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0,0,0,0.72)',
    zIndex: 9999,
  } as any,
  backdropBlur: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    zIndex: 9999,
  } as any,
  sheetWrap: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
    zIndex: 10000,
  } as any,

  // ----- Sheet card ----------------------------------------------------
  sheetCard: {
    width: '100%',
    maxWidth: SHEET_MAX_WIDTH,
    maxHeight: SHEET_MAX_HEIGHT,
    backgroundColor: 'rgba(16,16,20,0.94)',
    borderRadius: BorderRadius.xl,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
    overflow: 'hidden',
    zIndex: 10001,
    ...(Platform.OS === 'web'
      ? ({
          boxShadow:
            '0 24px 80px rgba(0,0,0,0.55), 0 4px 16px rgba(0,0,0,0.35), inset 0 1px 0 rgba(255,255,255,0.05)',
          backdropFilter: 'blur(24px) saturate(140%)',
          WebkitBackdropFilter: 'blur(24px) saturate(140%)',
        } as object)
      : {
          shadowColor: '#000',
          shadowOffset: { width: 0, height: 12 },
          shadowOpacity: 0.55,
          shadowRadius: 24,
          elevation: 12,
        }),
  } as any,

  // ----- Header --------------------------------------------------------
  header: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: 16,
    paddingHorizontal: 24,
    paddingTop: 22,
    paddingBottom: 14,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,255,255,0.05)',
  },
  headerCol: {
    flex: 1,
    minWidth: 0,
    gap: 6,
  },
  headerKicker: {
    fontSize: 10,
    fontWeight: '700',
    color: Colors.accent.cyan,
    letterSpacing: 1.4,
    textTransform: 'uppercase',
  },
  headerTitle: {
    fontSize: 22,
    fontWeight: '700',
    color: Colors.text.primary,
    letterSpacing: -0.3,
    lineHeight: 28,
  },
  headerSubtitle: {
    fontSize: 13,
    fontWeight: '400',
    color: Colors.text.tertiary,
    lineHeight: 18,
  },
  closeBtn: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255,255,255,0.04)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
  },

  // ----- Toggle row (Local | Toll-free) -------------------------------
  toggleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 14,
    paddingHorizontal: 24,
    paddingTop: 14,
    paddingBottom: 0,
    flexWrap: 'wrap',
  },
  toggleSegments: {
    flexDirection: 'row',
    padding: 4,
    borderRadius: BorderRadius.lg,
    backgroundColor: 'rgba(0,0,0,0.32)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.06)',
    gap: 4,
  },
  toggleSegment: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: BorderRadius.md,
    minWidth: 130,
    gap: 1,
  },
  toggleSegmentActive: {
    backgroundColor: 'rgba(59,130,246,0.18)',
    borderWidth: 1,
    borderColor: 'rgba(59,130,246,0.45)',
    ...(Platform.OS === 'web'
      ? ({ boxShadow: '0 0 0 1px rgba(59,130,246,0.15), 0 0 14px rgba(59,130,246,0.18)' } as object)
      : {}),
  } as any,
  toggleSegmentLabel: {
    fontSize: 13,
    fontWeight: '600',
    color: Colors.text.tertiary,
    letterSpacing: -0.1,
  },
  toggleSegmentLabelActive: {
    color: '#ffffff',
  },
  toggleSegmentSublabel: {
    fontSize: 10,
    fontWeight: '500',
    color: Colors.text.muted,
    letterSpacing: 0.2,
  },
  toggleSegmentSublabelActive: {
    color: Colors.accent.cyan,
  },

  costHint: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 9,
    paddingVertical: 4,
    borderRadius: BorderRadius.full,
    backgroundColor: 'rgba(255,255,255,0.04)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
  },
  costHintText: {
    fontSize: 11,
    fontWeight: '600',
    color: Colors.text.tertiary,
    letterSpacing: 0.1,
    fontVariant: ['tabular-nums'],
  },

  // ----- Search row ----------------------------------------------------
  searchRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: 12,
    paddingHorizontal: 24,
    paddingTop: 14,
    paddingBottom: 8,
    flexWrap: 'wrap',
  },
  fieldCol: {
    gap: 6,
    minWidth: 0,
  },
  fieldColAreaCode: {
    width: 110,
  },
  fieldColVanity: {
    flex: 1,
    minWidth: 180,
  },
  fieldLabel: {
    fontSize: 11,
    fontWeight: '600',
    color: Colors.text.tertiary,
    letterSpacing: 0.4,
    textTransform: 'uppercase',
  },
  input: {
    height: 44,
    paddingHorizontal: 14,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.10)',
    backgroundColor: '#0d0d10',
    color: Colors.text.primary,
    fontSize: 14,
    fontWeight: '500',
  } as any,
  searchBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    height: 44,
    paddingHorizontal: 18,
    borderRadius: 10,
    backgroundColor: Colors.accent.cyan,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.18)',
    minWidth: 110,
    justifyContent: 'center',
    ...(Platform.OS === 'web'
      ? ({ boxShadow: '0 1px 2px rgba(0,0,0,0.3), 0 6px 16px rgba(59,130,246,0.28)' } as object)
      : {
          shadowColor: Colors.accent.cyan,
          shadowOffset: { width: 0, height: 4 },
          shadowOpacity: 0.4,
          shadowRadius: 10,
        }),
  } as any,
  searchBtnDisabled: {
    opacity: 0.7,
  },
  searchBtnText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#ffffff',
    letterSpacing: 0.1,
  },

  // ----- Body / Results ------------------------------------------------
  body: {
    flex: 1,
  },
  bodyContent: {
    padding: 24,
    paddingTop: 16,
    minHeight: 280,
  },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
  },

  // ----- Result card ---------------------------------------------------
  resultCard: {
    flexBasis: '48%',
    flexGrow: 1,
    minWidth: 220,
    padding: 14,
    borderRadius: BorderRadius.lg,
    backgroundColor: '#161618',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.07)',
    gap: 8,
  } as any,
  resultCardSelected: {
    backgroundColor: 'rgba(59,130,246,0.08)',
    borderColor: 'rgba(59,130,246,0.55)',
    ...(Platform.OS === 'web'
      ? ({ boxShadow: '0 0 0 1px rgba(59,130,246,0.30), 0 0 22px rgba(59,130,246,0.18)' } as object)
      : {
          shadowColor: '#3B82F6',
          shadowOffset: { width: 0, height: 0 },
          shadowOpacity: 0.4,
          shadowRadius: 8,
        }),
  } as any,
  resultCardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  radio: {
    width: 16,
    height: 16,
    borderRadius: 8,
    borderWidth: 1.5,
    borderColor: 'rgba(255,255,255,0.20)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  radioSelected: {
    borderColor: Colors.accent.cyan,
  },
  radioInner: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: Colors.accent.cyan,
  },
  resultNumber: {
    fontSize: 16,
    fontWeight: '600',
    color: Colors.text.primary,
    letterSpacing: 0.1,
    fontVariant: ['tabular-nums'],
    flex: 1,
  },
  resultNumberSelected: {
    color: '#ffffff',
  },
  resultRegion: {
    fontSize: 12,
    fontWeight: '500',
    color: Colors.text.tertiary,
    letterSpacing: 0.1,
  },
  resultFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 4,
    gap: 8,
  },
  capPills: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 5,
    flex: 1,
  },
  capPill: {
    paddingHorizontal: 7,
    paddingVertical: 2,
    borderRadius: BorderRadius.full,
    backgroundColor: 'rgba(255,255,255,0.04)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.07)',
  },
  capPillText: {
    fontSize: 10,
    fontWeight: '600',
    color: Colors.text.tertiary,
    letterSpacing: 0.2,
    textTransform: 'uppercase',
  },
  resultCost: {
    fontSize: 12,
    fontWeight: '600',
    color: Colors.text.primary,
    fontVariant: ['tabular-nums'],
  },

  // ----- Skeleton card -------------------------------------------------
  skeletonCard: {
    flexBasis: '48%',
    flexGrow: 1,
    minWidth: 220,
    height: 110,
    borderRadius: BorderRadius.lg,
    backgroundColor: '#161618',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.05)',
  } as any,

  // ----- Recommendation panel (empty-local pivot) ----------------------
  recoBox: {
    position: 'relative',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 36,
    paddingHorizontal: 24,
    gap: 8,
    overflow: 'hidden',
  },
  recoAmbient: {
    position: 'absolute',
    top: -120,
    left: -120,
    width: 320,
    height: 320,
    borderRadius: 160,
    backgroundColor: 'rgba(59,130,246,0.06)',
    ...(Platform.OS === 'web' ? ({ filter: 'blur(60px)' } as object) : {}),
  } as any,
  recoIconWrap: {
    width: 64,
    height: 64,
    borderRadius: 32,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(59,130,246,0.10)',
    borderWidth: 1,
    borderColor: 'rgba(59,130,246,0.32)',
    marginBottom: 6,
    ...(Platform.OS === 'web'
      ? ({
          boxShadow:
            '0 0 0 6px rgba(59,130,246,0.04), 0 0 28px rgba(59,130,246,0.20), inset 0 1px 0 rgba(255,255,255,0.06)',
        } as object)
      : {}),
  } as any,
  recoKicker: {
    fontSize: 10,
    fontWeight: '700',
    color: Colors.accent.cyan,
    letterSpacing: 1.5,
    textTransform: 'uppercase',
  },
  recoTitle: {
    fontSize: 17,
    fontWeight: '700',
    color: Colors.text.primary,
    letterSpacing: -0.2,
    textAlign: 'center',
    maxWidth: 480,
    lineHeight: 23,
  },
  recoBody: {
    fontSize: 13,
    fontWeight: '400',
    color: Colors.text.tertiary,
    textAlign: 'center',
    lineHeight: 19,
    maxWidth: 460,
  },
  recoCtaPrimary: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 18,
    paddingVertical: 11,
    minHeight: 44,
    marginTop: 12,
    borderRadius: BorderRadius.md,
    backgroundColor: Colors.accent.cyan,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.18)',
    ...(Platform.OS === 'web'
      ? ({ boxShadow: '0 1px 2px rgba(0,0,0,0.3), 0 8px 20px rgba(59,130,246,0.34)' } as object)
      : {
          shadowColor: Colors.accent.cyan,
          shadowOffset: { width: 0, height: 5 },
          shadowOpacity: 0.42,
          shadowRadius: 12,
        }),
  } as any,
  recoCtaPrimaryText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#ffffff',
    letterSpacing: 0.1,
  },
  recoCtaSecondary: {
    paddingVertical: 6,
    paddingHorizontal: 8,
    marginTop: 2,
  },
  recoCtaSecondaryText: {
    fontSize: 12,
    fontWeight: '500',
    color: Colors.text.tertiary,
    textDecorationLine: 'underline',
  },

  // ----- State boxes (initial / error / toll-free empty) -------------
  stateBox: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 40,
    paddingHorizontal: 24,
    gap: 10,
  },
  stateIcon: {
    width: 56,
    height: 56,
    borderRadius: 28,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(59,130,246,0.10)',
    borderWidth: 1,
    borderColor: 'rgba(59,130,246,0.22)',
    marginBottom: 4,
  },
  stateIconError: {
    backgroundColor: 'rgba(239,68,68,0.10)',
    borderColor: 'rgba(239,68,68,0.32)',
  },
  stateTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: Colors.text.primary,
    letterSpacing: -0.2,
  },
  stateBody: {
    fontSize: 13,
    fontWeight: '400',
    color: Colors.text.tertiary,
    lineHeight: 19,
    textAlign: 'center',
    maxWidth: 360,
  },
  retryBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    height: 40,
    paddingHorizontal: 14,
    marginTop: 6,
    borderRadius: BorderRadius.md,
    backgroundColor: 'rgba(255,255,255,0.04)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.10)',
  },
  retryBtnText: {
    fontSize: 13,
    fontWeight: '500',
    color: Colors.text.primary,
  },

  // ----- Footer --------------------------------------------------------
  footer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
    paddingHorizontal: 24,
    paddingVertical: 16,
    borderTopWidth: 1,
    borderTopColor: 'rgba(255,255,255,0.05)',
    backgroundColor: 'rgba(0,0,0,0.20)',
  },
  footerHint: {
    fontSize: 13,
    fontWeight: '500',
    color: Colors.text.tertiary,
    flex: 1,
    minWidth: 0,
  },
  footerHintStrong: {
    color: Colors.text.primary,
    fontWeight: '600',
    fontVariant: ['tabular-nums'],
  },
  purchaseBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 16,
    paddingVertical: 11,
    borderRadius: BorderRadius.md,
    minHeight: 44,
    backgroundColor: Colors.accent.cyan,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.18)',
    ...(Platform.OS === 'web'
      ? ({ boxShadow: '0 1px 2px rgba(0,0,0,0.3), 0 6px 16px rgba(59,130,246,0.28)' } as object)
      : {
          shadowColor: Colors.accent.cyan,
          shadowOffset: { width: 0, height: 4 },
          shadowOpacity: 0.4,
          shadowRadius: 10,
        }),
  } as any,
  purchaseBtnText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#ffffff',
    letterSpacing: 0.1,
  },

  // ----- Confirm dialog -----------------------------------------------
  confirmBackdrop: {
    position: Platform.OS === 'web' ? ('absolute' as any) : 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(4,6,10,0.80)',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
    zIndex: 11000,
  } as any,
  confirmCard: {
    width: '100%',
    maxWidth: 420,
    backgroundColor: '#13131a',
    borderRadius: BorderRadius.xl,
    borderWidth: 1,
    borderColor: 'rgba(245,158,11,0.32)',
    padding: 20,
    gap: 12,
    zIndex: 11001,
    ...(Platform.OS === 'web'
      ? ({
          boxShadow:
            '0 24px 60px rgba(0,0,0,0.6), 0 0 0 1px rgba(245,158,11,0.12), inset 0 1px 0 rgba(255,255,255,0.04)',
        } as object)
      : {
          shadowColor: '#000',
          shadowOffset: { width: 0, height: 14 },
          shadowOpacity: 0.6,
          shadowRadius: 20,
          elevation: 14,
        }),
  } as any,
  confirmIconWrap: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(245,158,11,0.12)',
    borderWidth: 1,
    borderColor: 'rgba(245,158,11,0.32)',
  },
  confirmTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: Colors.text.primary,
    letterSpacing: -0.2,
  },
  confirmBody: {
    fontSize: 14,
    fontWeight: '400',
    color: Colors.text.secondary,
    lineHeight: 20,
  },
  confirmStrong: {
    color: Colors.text.primary,
    fontWeight: '600',
  },
  confirmError: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    padding: 10,
    borderRadius: BorderRadius.md,
    backgroundColor: 'rgba(239,68,68,0.10)',
    borderWidth: 1,
    borderColor: 'rgba(239,68,68,0.30)',
  },
  confirmErrorText: {
    fontSize: 12,
    fontWeight: '500',
    color: Colors.semantic.error,
    flex: 1,
  },
  confirmActions: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: 8,
    marginTop: 4,
  },
  confirmCancel: {
    height: 44,
    paddingHorizontal: 16,
    borderRadius: BorderRadius.md,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255,255,255,0.04)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.10)',
    minWidth: 88,
  },
  confirmCancelText: {
    fontSize: 14,
    fontWeight: '500',
    color: Colors.text.secondary,
  },
  confirmConfirm: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    height: 44,
    paddingHorizontal: 16,
    borderRadius: BorderRadius.md,
    justifyContent: 'center',
    backgroundColor: Colors.accent.cyan,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.18)',
    minWidth: 110,
  },
  confirmConfirmBusy: {
    opacity: 0.85,
  },
  confirmConfirmText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#ffffff',
    letterSpacing: 0.1,
  },
});

// Surface unused-import warnings.
void Spacing;

export default AspireNumberPickerSheet;
