/**
 * TimRailContextTab — Tim rail Context tab container.
 *
 * Swaps in when the rail's tab switcher = "Context". Hosts the
 * PropertySummaryCard plus an error banner if the property fetch failed.
 *
 * Aspire Law #7: pure render. Data flows down from useState in the parent
 * (Visuals tab page), never fetched here.
 */
import React from 'react';
import { View, Text, ScrollView, StyleSheet, Pressable, Platform } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { usePathname } from 'expo-router';
import { PropertySummaryCard } from './PropertySummaryCard';
import { MaterialsRouteContextCard } from './MaterialsRouteContextCard';
import { PlansPhotosContextPayload } from './PlansPhotosContextPayload';
import { ScopeContextPayload } from './ScopeContextPayload';
import { TakeoffContextPayload } from './TakeoffContextPayload';
import { ServiceBriefCard } from '@/components/service-hub/ServiceBriefCard';
import { useTenant } from '@/providers';
import { useBlueprintUploadSnapshot } from '@/lib/blueprintUploadStore';
import type { PropertyData } from '@/services/serviceHub/propertyDataApi';

// Inject a one-shot stylesheet on web that hides the scrollbar inside
// the rail's scroll container (showsVerticalScrollIndicator={false} is
// React-Native-only and doesn't bind to the underlying browser overflow
// scrollbar on web).
if (Platform.OS === 'web' && typeof document !== 'undefined') {
  const STYLE_ID = 'tim-rail-context-scrollbar-hide';
  if (!document.getElementById(STYLE_ID)) {
    const styleEl = document.createElement('style');
    styleEl.id = STYLE_ID;
    styleEl.textContent = `
      [data-tim-rail-context="1"] { scrollbar-width: none; -ms-overflow-style: none; }
      [data-tim-rail-context="1"]::-webkit-scrollbar { width: 0; height: 0; display: none; }
    `;
    document.head.appendChild(styleEl);
  }
}

interface Props {
  data?: PropertyData;
  loading: boolean;
  error?: string;
  onRetry?: () => void;
}

export function TimRailContextTab({ data, loading, error, onRetry }: Props) {
  const pathname = usePathname() ?? '';
  const isMaterialsTab =
    pathname.endsWith('/materials') || pathname.endsWith('/materials/');
  const isPlansPhotosTab =
    pathname.endsWith('/plans-photos') || pathname.endsWith('/plans-photos/');
  const isScopeTab =
    pathname.endsWith('/scope') || pathname.endsWith('/scope/');
  const isTakeoffTab =
    pathname.endsWith('/takeoff') || pathname.endsWith('/takeoff/');
  // Wave 5.1b: Service Hub routes get a Service Memory brief card. Exclude
  // the Estimate Studio sub-tabs that already render their own per-tab
  // Context payload (Plans & Photos / Scope / Takeoff). Materials carries
  // its own MaterialsRouteContextCard above and is also excluded.
  const isServiceHubRoute = pathname.startsWith('/service-hub');
  const tenant = useTenant() as { officeId?: string };
  const activeOfficeId = tenant.officeId ?? '';

  // FIX 1: On Plans & Photos, the property empty state must not leak into the
  // Context tab when a blueprint project is active OR an upload is in flight.
  // Property facts belong to the property/address surface, not the blueprint
  // surface. If a blueprint is active, the Plans & Photos payload above owns
  // the entire Context tab — show ONLY blueprint context (DrewStageProgress,
  // live counters, pipeline status). When no blueprint is active AND no
  // property is set, we still suppress the property empty state on this tab
  // since address entry happens elsewhere.
  const blueprintSnapshot = useBlueprintUploadSnapshot();
  const blueprintActive =
    blueprintSnapshot.projectId !== null || blueprintSnapshot.phase !== 'idle';
  const suppressPropertySummary =
    isMaterialsTab || (isPlansPhotosTab && blueprintActive);

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.content}
      testID="tim-rail-context-tab"
      showsVerticalScrollIndicator={false}
      showsHorizontalScrollIndicator={false}
      // dataSet → the underlying div gets data-tim-rail-context="1" on web,
      // matched by the injected stylesheet above to hide the scrollbar.
      // RN-Web maps `dataSet` onto data-* attributes.
      dataSet={Platform.OS === 'web' ? { timRailContext: '1' } : undefined as any}
    >
      {error ? (
        <View style={styles.errorBanner} accessibilityRole="alert">
          <Ionicons name="alert-circle-outline" size={14} color="#ff6b6b" />
          <View style={styles.errorBody}>
            <Text style={styles.errorTitle}>Could not load context</Text>
            <Text style={styles.errorMessage} numberOfLines={3}>
              {error}
            </Text>
            {onRetry && (
              <Pressable
                onPress={onRetry}
                accessibilityRole="button"
                accessibilityLabel="Retry property data fetch"
                style={({ hovered, pressed }: any) => [
                  styles.retryButton,
                  hovered && styles.retryButtonHover,
                  pressed && styles.retryButtonPressed,
                ]}
              >
                <Text style={styles.retryText}>Retry</Text>
              </Pressable>
            )}
          </View>
        </View>
      ) : null}

      {/* Materials-tab-only — renders null off-route via context check. */}
      <MaterialsRouteContextCard />

      {/* Plans & Photos payload: pipeline status + discipline counts + last
          upload. Renders null off-route. Property facts carry over below. */}
      {isPlansPhotosTab && <PlansPhotosContextPayload />}

      {/* Scope payload (Wave 7): pipeline + confidence + truth distribution
          + missing inputs + linked destinations + tariff summary. Property
          facts carry over below as on Plans & Photos. */}
      {isScopeTab && <ScopeContextPayload />}

      {/* Takeoff payload (Wave 8): pipeline status + current sheet meta +
          symbol confidence + tariff exposure. Property facts carry over below. */}
      {isTakeoffTab && <TakeoffContextPayload />}

      {/* Service Memory brief (Wave 5.1b): renders on /service-hub/* EXCEPT
          the Estimate Studio sub-tabs that already host their own per-tab
          Context payload (Plans & Photos / Scope / Takeoff) and the
          Materials tab (which has MaterialsRouteContextCard above).
          Property facts continue to render below as usual. */}
      {isServiceHubRoute &&
        !isPlansPhotosTab &&
        !isScopeTab &&
        !isTakeoffTab &&
        !isMaterialsTab &&
        activeOfficeId && <ServiceBriefCard officeId={activeOfficeId} />}

      {/* Property facts hidden on:
          - Materials tab — context is the route + bundle, not the property
            valuation card. Property data is one click away on Visuals /
            Plans / Scope tabs.
          - Plans & Photos tab WHEN a blueprint project is active or upload
            is in flight — the blueprint payload above owns the Context tab
            in that mode. Showing the property empty state alongside the
            cinematic Drew pipeline reads as a leak (FIX 1, 2026-05-18). */}
      {!suppressPropertySummary && <PropertySummaryCard data={data} loading={loading} />}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  content: {
    padding: 4,
    gap: 12,
  },
  errorBanner: {
    flexDirection: 'row',
    gap: 10,
    padding: 12,
    margin: 10,
    borderRadius: 10,
    backgroundColor: 'rgba(255,107,107,0.06)',
    borderWidth: 1,
    borderColor: 'rgba(255,107,107,0.22)',
  },
  errorBody: {
    flex: 1,
    gap: 4,
  },
  errorTitle: {
    fontSize: 12,
    fontWeight: '600',
    color: '#ff6b6b',
    letterSpacing: -0.1,
  },
  errorMessage: {
    fontSize: 11,
    color: 'rgba(255,255,255,0.65)',
    lineHeight: 16,
  },
  retryButton: {
    alignSelf: 'flex-start',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 6,
    backgroundColor: 'rgba(255,255,255,0.04)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.10)',
    marginTop: 4,
  },
  retryButtonHover: {
    backgroundColor: 'rgba(255,255,255,0.08)',
  },
  retryButtonPressed: {
    opacity: 0.85,
  },
  retryText: {
    fontSize: 10,
    fontWeight: '700',
    color: 'rgba(255,255,255,0.85)',
    letterSpacing: 0.2,
    textTransform: 'uppercase',
  },
});
