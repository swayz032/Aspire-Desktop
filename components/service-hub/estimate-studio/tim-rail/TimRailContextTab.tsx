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
import { View, Text, ScrollView, StyleSheet, Pressable } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { PropertySummaryCard } from './PropertySummaryCard';
import type { PropertyData } from '@/services/serviceHub/propertyDataApi';

interface Props {
  data?: PropertyData;
  loading: boolean;
  error?: string;
  onRetry?: () => void;
}

export function TimRailContextTab({ data, loading, error, onRetry }: Props) {
  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.content}
      testID="tim-rail-context-tab"
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

      <PropertySummaryCard data={data} loading={loading} />
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
