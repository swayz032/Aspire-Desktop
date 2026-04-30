/**
 * AspireNumberPickerSheet — Pass 16 UI (plan §16.H)
 *
 * Modal sheet for searching and purchasing an Aspire (Twilio) phone number.
 * Opens from PublicNumberSection's "Find an Aspire number" button.
 *
 * Flow:
 *   1. User enters area code (3-digit) + optional vanity (e.g. "PAINT")
 *   2. Click Search → POST /v1/twilio/available-numbers
 *   3. Results render as cards (phone number, region, monthly cost, capabilities)
 *   4. User picks one → "Reserve & buy" CTA
 *   5. Yellow-tier confirm dialog ("This will purchase $X/mo for (NUMBER). Proceed?")
 *   6. Confirm → POST /v1/twilio/purchase-number
 *   7. On success, sheet closes + parent updates with active number
 *
 * Per §12.1 Framer-style:
 *   - Glassmorphism on the sheet (expo-blur intensity 30 over backdrop)
 *   - Layered depth: backdrop + glass surface + content
 *   - Premium controls — focus rings on every input
 *   - Skeleton shimmer during loading
 *   - Personality on empty: "No matches. Try a different area code."
 *
 * Pass 17 will swap fetch() URLs for `lib/api/frontDesk.ts`. Until then we
 * call the endpoints directly with a sane default error fallback.
 */

import React, { useEffect, useState, useCallback } from 'react';
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
}

// ---------------------------------------------------------------------------
// Pass-17-ready API wrapper (will be swapped for lib/api/frontDesk.ts)
// ---------------------------------------------------------------------------

async function searchAvailableNumbers(params: {
  areaCode: string;
  contains?: string;
}): Promise<TwilioAvailableNumber[]> {
  try {
    const res = await fetch('/v1/twilio/available-numbers', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        area_code: params.areaCode,
        contains: params.contains || undefined,
        limit: 12,
      }),
    });
    if (!res.ok) throw new Error(`Search failed (${res.status})`);
    const data = await res.json();
    return (data.numbers ?? data.results ?? []) as TwilioAvailableNumber[];
  } catch (err) {
    throw err instanceof Error ? err : new Error('Search failed');
  }
}

async function purchaseNumber(params: {
  phoneNumber: string;
  capabilityToken?: string;
  idempotencyKey: string;
}): Promise<PurchasedNumberResult> {
  const res = await fetch('/v1/twilio/purchase-number', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Idempotency-Key': params.idempotencyKey,
      ...(params.capabilityToken
        ? { 'X-Capability-Token': params.capabilityToken }
        : {}),
    },
    body: JSON.stringify({
      phone_number: params.phoneNumber,
      idempotency_key: params.idempotencyKey,
    }),
  });
  if (!res.ok) throw new Error(`Purchase failed (${res.status})`);
  const data = await res.json();
  return {
    phoneNumber: data.phone_number ?? params.phoneNumber,
    friendlyName: data.friendly_name ?? formatNumber(params.phoneNumber),
    region: data.region,
    sid: data.sid,
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
    .fds-sheet-btn { transition: transform 160ms ease-out, background-color 160ms ease-out, box-shadow 160ms ease-out; }
    .fds-sheet-btn:hover { transform: translateY(-1px); }
    .fds-sheet-btn:active { transform: translateY(0); }
    .fds-sheet-btn:focus-visible { outline: 2px solid rgba(59,130,246,0.7); outline-offset: 2px; }
    @media (prefers-reduced-motion: reduce) {
      .fds-sheet-backdrop, .fds-sheet-card, .fds-skeleton, .fds-result-card, .fds-sheet-btn { animation: none; transition: none; }
    }
  `;
  document.head.appendChild(style);
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function formatNumber(raw: string): string {
  // Strip + and country code, format as (XXX) XXX-XXXX
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

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function AspireNumberPickerSheet({
  visible,
  onClose,
  onPurchased,
  initialAreaCode = '',
  initialContains = '',
}: AspireNumberPickerSheetProps) {
  injectSheetCss();

  const [areaCode, setAreaCode] = useState(initialAreaCode);
  const [contains, setContains] = useState(initialContains);
  const [results, setResults] = useState<TwilioAvailableNumber[] | null>(null);
  const [isSearching, setIsSearching] = useState(false);
  const [searchError, setSearchError] = useState<string | null>(null);
  const [selectedPhone, setSelectedPhone] = useState<string | null>(null);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [isPurchasing, setIsPurchasing] = useState(false);
  const [purchaseError, setPurchaseError] = useState<string | null>(null);

  // Reset transient state whenever the sheet opens
  useEffect(() => {
    if (visible) {
      setAreaCode(initialAreaCode);
      setContains(initialContains);
      setResults(null);
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

  const handleSearch = useCallback(async () => {
    if (areaCode.length !== 3) {
      setSearchError('Enter a 3-digit area code.');
      return;
    }
    setIsSearching(true);
    setSearchError(null);
    setResults(null);
    setSelectedPhone(null);
    try {
      const numbers = await searchAvailableNumbers({
        areaCode,
        contains: contains.trim() || undefined,
      });
      setResults(numbers);
    } catch (err) {
      setSearchError(err instanceof Error ? err.message : 'Search failed.');
      setResults([]);
    } finally {
      setIsSearching(false);
    }
  }, [areaCode, contains]);

  const handleConfirmPurchase = useCallback(async () => {
    if (!selectedPhone) return;
    setIsPurchasing(true);
    setPurchaseError(null);
    try {
      const result = await purchaseNumber({
        phoneNumber: selectedPhone,
        idempotencyKey: genIdempotencyKey(),
      });
      onPurchased(result);
      onClose();
    } catch (err) {
      setPurchaseError(err instanceof Error ? err.message : 'Purchase failed.');
    } finally {
      setIsPurchasing(false);
    }
  }, [selectedPhone, onPurchased, onClose]);

  const selectedDetail = results?.find((n) => n.phoneNumber === selectedPhone) ?? null;

  if (!visible) return null;

  // ----- Web overlay -----
  if (Platform.OS === 'web') {
    return (
      <View
        style={styles.backdrop}
        accessibilityViewIsModal
        accessibilityLabel="Find an Aspire number"
        {...({ className: 'fds-sheet-backdrop' } as any)}
      >
        <Pressable
          onPress={onClose}
          style={StyleSheet.absoluteFill as ViewStyle}
          accessibilityLabel="Close picker"
        />
        <BlurView
          intensity={30}
          tint="dark"
          style={[StyleSheet.absoluteFill as ViewStyle, styles.backdropTint]}
          pointerEvents="none"
        />
        <View
          style={styles.sheetCard}
          {...({ className: 'fds-sheet-card' } as any)}
        >
          <SheetContent
            areaCode={areaCode}
            setAreaCode={setAreaCode}
            contains={contains}
            setContains={setContains}
            isSearching={isSearching}
            searchError={searchError}
            results={results}
            selectedPhone={selectedPhone}
            setSelectedPhone={setSelectedPhone}
            onSearch={handleSearch}
            onClose={onClose}
            onPurchase={() => setConfirmOpen(true)}
          />
        </View>

        {confirmOpen && selectedDetail ? (
          <ConfirmDialog
            number={selectedDetail}
            isPurchasing={isPurchasing}
            error={purchaseError}
            onCancel={() => setConfirmOpen(false)}
            onConfirm={handleConfirmPurchase}
          />
        ) : null}
      </View>
    );
  }

  // ----- Native modal -----
  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onClose}
    >
      <View style={styles.backdrop}>
        <Pressable onPress={onClose} style={StyleSheet.absoluteFill as ViewStyle} />
        <View style={[styles.sheetCard, styles.sheetCardNative]}>
          <SheetContent
            areaCode={areaCode}
            setAreaCode={setAreaCode}
            contains={contains}
            setContains={setContains}
            isSearching={isSearching}
            searchError={searchError}
            results={results}
            selectedPhone={selectedPhone}
            setSelectedPhone={setSelectedPhone}
            onSearch={handleSearch}
            onClose={onClose}
            onPurchase={() => setConfirmOpen(true)}
          />
        </View>

        {confirmOpen && selectedDetail ? (
          <ConfirmDialog
            number={selectedDetail}
            isPurchasing={isPurchasing}
            error={purchaseError}
            onCancel={() => setConfirmOpen(false)}
            onConfirm={handleConfirmPurchase}
          />
        ) : null}
      </View>
    </Modal>
  );
}

// ---------------------------------------------------------------------------
// SheetContent — extracted to share between web overlay and native modal
// ---------------------------------------------------------------------------

interface SheetContentProps {
  areaCode: string;
  setAreaCode: (v: string) => void;
  contains: string;
  setContains: (v: string) => void;
  isSearching: boolean;
  searchError: string | null;
  results: TwilioAvailableNumber[] | null;
  selectedPhone: string | null;
  setSelectedPhone: (phone: string | null) => void;
  onSearch: () => void;
  onClose: () => void;
  onPurchase: () => void;
}

function SheetContent({
  areaCode,
  setAreaCode,
  contains,
  setContains,
  isSearching,
  searchError,
  results,
  selectedPhone,
  setSelectedPhone,
  onSearch,
  onClose,
  onPurchase,
}: SheetContentProps) {
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
            Search by area code, optionally filtered by a vanity word.
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

      {/* Search row */}
      <View style={styles.searchRow}>
        <View style={[styles.fieldCol, styles.fieldColAreaCode]}>
          <Text style={styles.fieldLabel}>Area code</Text>
          <TextInput
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
          <InitialPrompt />
        ) : results.length === 0 ? (
          <EmptyState />
        ) : (
          <ResultsGrid
            results={results}
            selectedPhone={selectedPhone}
            onSelect={setSelectedPhone}
          />
        )}
      </ScrollView>

      {/* Footer — only visible when a number is selected */}
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
            accessibilityLabel="Reserve and buy this number"
            style={styles.purchaseBtn}
            {...(Platform.OS === 'web' ? ({ className: 'fds-sheet-btn' } as any) : {})}
          >
            <Ionicons name="lock-closed" size={14} color="#ffffff" />
            <Text style={styles.purchaseBtnText}>Reserve & buy</Text>
            <Ionicons name="chevron-forward" size={14} color="rgba(255,255,255,0.85)" />
          </Pressable>
        </View>
      ) : null}
    </>
  );
}

// ---------------------------------------------------------------------------
// ResultsGrid — selectable cards
// ---------------------------------------------------------------------------

function ResultsGrid({
  results,
  selectedPhone,
  onSelect,
}: {
  results: TwilioAvailableNumber[];
  selectedPhone: string | null;
  onSelect: (phone: string) => void;
}) {
  return (
    <View style={styles.grid}>
      {results.map((num) => (
        <NumberResultCard
          key={num.phoneNumber}
          number={num}
          selected={selectedPhone === num.phoneNumber}
          onSelect={() => onSelect(num.phoneNumber)}
        />
      ))}
    </View>
  );
}

function NumberResultCard({
  number,
  selected,
  onSelect,
}: {
  number: TwilioAvailableNumber;
  selected: boolean;
  onSelect: () => void;
}) {
  const cost = number.monthlyCostUsd ?? 1.15;
  const region = number.region ?? number.isoCountry ?? 'United States';
  const display = number.friendlyName ?? formatNumber(number.phoneNumber);

  return (
    <Pressable
      onPress={onSelect}
      accessibilityRole="radio"
      accessibilityState={{ checked: selected }}
      accessibilityLabel={`Phone number ${display}, ${region}, ${cost.toFixed(2)} dollars per month`}
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
        <Text style={styles.resultCost}>${cost.toFixed(2)}/mo</Text>
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
// SkeletonGrid — loading state
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
// EmptyState — search returned 0 results
// ---------------------------------------------------------------------------

function EmptyState() {
  return (
    <View style={styles.stateBox}>
      <View style={styles.stateIcon}>
        <Ionicons name="telescope-outline" size={28} color={Colors.text.tertiary} />
      </View>
      <Text style={styles.stateTitle} accessibilityRole="header">
        No numbers matched
      </Text>
      <Text style={styles.stateBody}>
        Try a different area code or remove the vanity filter.
      </Text>
    </View>
  );
}

// ---------------------------------------------------------------------------
// InitialPrompt — pre-search hint
// ---------------------------------------------------------------------------

function InitialPrompt() {
  return (
    <View style={styles.stateBox}>
      <View style={styles.stateIcon}>
        <Ionicons name="search-outline" size={28} color={Colors.accent.cyan} />
      </View>
      <Text style={styles.stateTitle} accessibilityRole="header">
        Pick a region to start
      </Text>
      <Text style={styles.stateBody}>
        Enter a 3-digit area code above. Add a vanity word like "PAINT" to narrow results.
      </Text>
    </View>
  );
}

// ---------------------------------------------------------------------------
// ErrorState
// ---------------------------------------------------------------------------

function ErrorState({ message, onRetry }: { message: string; onRetry: () => void }) {
  return (
    <View
      style={styles.stateBox}
      accessibilityRole="alert"
      accessibilityLabel={`Search error: ${message}`}
    >
      <View style={[styles.stateIcon, styles.stateIconError]}>
        <Ionicons name="alert-circle" size={28} color={Colors.semantic.error} />
      </View>
      <Text style={styles.stateTitle} accessibilityRole="header">
        Search hit a snag
      </Text>
      <Text style={styles.stateBody}>{message}</Text>
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
    </View>
  );
}

// ---------------------------------------------------------------------------
// ConfirmDialog — Yellow-tier purchase confirmation
// ---------------------------------------------------------------------------

interface ConfirmDialogProps {
  number: TwilioAvailableNumber;
  isPurchasing: boolean;
  error: string | null;
  onCancel: () => void;
  onConfirm: () => void;
}

function ConfirmDialog({
  number,
  isPurchasing,
  error,
  onCancel,
  onConfirm,
}: ConfirmDialogProps) {
  const cost = number.monthlyCostUsd ?? 1.15;
  const display = number.friendlyName ?? formatNumber(number.phoneNumber);

  return (
    <View
      style={[styles.confirmBackdrop]}
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
          Confirm purchase
        </Text>
        <Text style={styles.confirmBody}>
          This will purchase{' '}
          <Text style={styles.confirmStrong}>{display}</Text> for{' '}
          <Text style={styles.confirmStrong}>${cost.toFixed(2)}/month</Text>. Charges are
          governed by your active billing setup.
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
const SHEET_MAX_HEIGHT = 720;

const styles = StyleSheet.create({
  // ----- Backdrop ------------------------------------------------------
  backdrop: {
    ...StyleSheet.absoluteFillObject,
    position: Platform.OS === 'web' ? ('fixed' as any) : 'absolute',
    backgroundColor: 'rgba(4,6,10,0.62)',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
    zIndex: 1000,
  } as any,
  backdropTint: {
    backgroundColor: 'rgba(8,10,16,0.30)',
  },

  // ----- Sheet card ----------------------------------------------------
  sheetCard: {
    width: '100%',
    maxWidth: SHEET_MAX_WIDTH,
    maxHeight: SHEET_MAX_HEIGHT,
    backgroundColor: 'rgba(16,16,20,0.92)',
    borderRadius: BorderRadius.xl,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
    overflow: 'hidden',
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
  sheetCardNative: {
    backgroundColor: '#101014',
  },

  // ----- Header --------------------------------------------------------
  header: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: 16,
    paddingHorizontal: 24,
    paddingTop: 22,
    paddingBottom: 16,
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

  // ----- Search row ----------------------------------------------------
  searchRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: 12,
    paddingHorizontal: 24,
    paddingTop: 16,
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

  // ----- Result card --------------------------------------------------
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

  // ----- Skeleton card ------------------------------------------------
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

  // ----- State boxes (empty / initial / error) ------------------------
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
    ...StyleSheet.absoluteFillObject,
    position: Platform.OS === 'web' ? ('fixed' as any) : 'absolute',
    backgroundColor: 'rgba(4,6,10,0.78)',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
    zIndex: 1100,
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
