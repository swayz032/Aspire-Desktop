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

      {/* Property facts hidden on Materials tab — that tab's context
          is the route + bundle, not the property valuation card. The
          property data is one click away (Visuals / Plans / Scope tabs). */}
      {!isMaterialsTab && <PropertySummaryCard data={data} loading={loading} />}
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
