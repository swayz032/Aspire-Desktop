/**
 * QuoteWidget — Bloomberg Terminal quality quote display for Canvas Mode
 *
 * $10,000 UI/UX MANDATE:
 * - Real Supabase data with RLS scoping
 * - Premium line item cards with quantity × unit price breakdown
 * - Total row with visual hierarchy
 * - Send button with blue accent
 * - Smooth animations, clean typography
 */

import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  ScrollView,
  Pressable,
  StyleSheet,
  Platform,
  ActivityIndicator,
  type ViewStyle,
} from 'react-native';
import { supabase } from '@/lib/supabase';
import { SendIcon } from '@/components/icons/ui/SendIcon';
import { CanvasTokens } from '@/constants/canvas.tokens';
import { Colors } from '@/constants/tokens';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface LineItem {
  name: string;
  description: string;
  quantity: number;
  unit_price: number;
  total: number;
}

interface Quote {
  id: string;
  quote_number: string;
  client_name: string;
  line_items: LineItem[];
  total_amount: number;
  status: string;
  created_at: string;
}

interface QuoteWidgetProps {
  suiteId: string;
  officeId: string;
  quoteId?: string; // If null, show recent quotes
  onSendClick?: (quoteId: string) => void;
}

// ---------------------------------------------------------------------------
// Helper Functions
// ---------------------------------------------------------------------------

/** Format currency with thousand separators */
function formatAmount(amount: number): string {
  return amount.toLocaleString('en-US', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

// ---------------------------------------------------------------------------
// Line Item Component
// ---------------------------------------------------------------------------

function LineItemCard({ item }: { item: LineItem }) {
  return (
    <View style={styles.lineItemCard}>
      <View style={styles.itemHeader}>
        <Text style={styles.itemName} numberOfLines={1}>
          {item.name}
        </Text>
        <Text style={styles.lineTotal}>${formatAmount(item.total)}</Text>
      </View>

      <Text style={styles.itemDescription} numberOfLines={1}>
        {item.description}
      </Text>

      <Text style={styles.itemDetails}>
        {item.quantity} × ${formatAmount(item.unit_price)}
      </Text>
    </View>
  );
}

// ---------------------------------------------------------------------------
// Main Component
// ---------------------------------------------------------------------------

export function QuoteWidget({
  suiteId,
  officeId,
  quoteId,
  onSendClick,
}: QuoteWidgetProps) {
  const [quote, setQuote] = useState<Quote | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // ---------------------------------------------------------------------------
  // Data Fetching
  // ---------------------------------------------------------------------------

  useEffect(() => {
    const fetchQuote = async () => {
      try {
        setLoading(true);
        setError(null);

        let query = supabase
          .from('quotes')
          .select(`
            id,
            quote_number,
            client_name,
            line_items,
            total_amount,
            status,
            created_at
          `)
          .eq('suite_id', suiteId)
          .eq('office_id', officeId);

        if (quoteId) {
          query = query.eq('id', quoteId).single();
        } else {
          // Fetch most recent quote if no ID provided
          query = query.order('created_at', { ascending: false }).limit(1).single();
        }

        const { data, error: fetchError } = await query;

        if (fetchError) {
          throw fetchError;
        }

        setQuote(data);
      } catch (err) {
        console.error('Failed to fetch quote:', err);
        setError(err instanceof Error ? err.message : 'Failed to load quote');
      } finally {
        setLoading(false);
      }
    };

    fetchQuote();
  }, [suiteId, officeId, quoteId]);

  // ---------------------------------------------------------------------------
  // Loading State
  // ---------------------------------------------------------------------------

  if (loading) {
    return (
      <View style={styles.centerContainer}>
        <ActivityIndicator size="small" color={Colors.accent.cyan} />
        <Text style={styles.loadingText}>Loading quote...</Text>
      </View>
    );
  }

  // ---------------------------------------------------------------------------
  // Error State
  // ---------------------------------------------------------------------------

  if (error || !quote) {
    return (
      <View style={styles.centerContainer}>
        <Text style={styles.errorText}>
          {error || 'No quote found'}
        </Text>
      </View>
    );
  }

  // ---------------------------------------------------------------------------
  // Render Quote
  // ---------------------------------------------------------------------------

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <View style={styles.headerLeft}>
          <Text style={styles.quoteNumber}>{quote.quote_number}</Text>
          <Text style={styles.clientName}>{quote.client_name}</Text>
        </View>
        <View style={[styles.statusBadge, getStatusBadgeStyle(quote.status)]}>
          <Text style={styles.statusText}>{quote.status.toUpperCase()}</Text>
        </View>
      </View>

      {/* Line Items */}
      <ScrollView
        style={styles.lineItemsContainer}
        showsVerticalScrollIndicator={false}
      >
        {quote.line_items.map((item, index) => (
          <LineItemCard key={index} item={item} />
        ))}
      </ScrollView>

      {/* Total Row */}
      <View style={styles.totalRow}>
        <Text style={styles.totalLabel}>Total</Text>
        <Text style={styles.totalAmount}>${formatAmount(quote.total_amount)}</Text>
      </View>

      {/* Send Button */}
      {onSendClick && quote.status === 'draft' && (
        <Pressable
          style={({ pressed }) => [
            styles.sendButton,
            pressed && styles.sendButtonPressed,
          ]}
          onPress={() => onSendClick(quote.id)}
        >
          <SendIcon size={18} color="#FFFFFF" />
          <Text style={styles.sendButtonText}>Send Quote</Text>
        </Pressable>
      )}
    </View>
  );
}

// ---------------------------------------------------------------------------
// Helper Functions
// ---------------------------------------------------------------------------

function getStatusBadgeStyle(status: string): ViewStyle {
  const statusLower = status.toLowerCase();

  if (statusLower === 'draft') {
    return { backgroundColor: 'rgba(110, 110, 115, 0.2)' };
  }
  if (statusLower === 'sent') {
    return { backgroundColor: 'rgba(59, 130, 246, 0.2)' };
  }
  if (statusLower === 'accepted') {
    return { backgroundColor: 'rgba(52, 199, 89, 0.2)' };
  }
  if (statusLower === 'rejected') {
    return { backgroundColor: 'rgba(255, 59, 48, 0.2)' };
  }

  return { backgroundColor: 'rgba(110, 110, 115, 0.2)' };
}

// ---------------------------------------------------------------------------
// Styles
// ---------------------------------------------------------------------------

const styles = StyleSheet.create({
  container: {
    flex: 1,
    gap: 16,
  },

  centerContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    gap: 12,
  },

  loadingText: {
    color: CanvasTokens.text.secondary,
    fontSize: 13,
    fontWeight: '500',
  },

  errorText: {
    color: Colors.semantic.error,
    fontSize: 13,
    fontWeight: '500',
    textAlign: 'center',
  },

  // Header
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },

  headerLeft: {
    flex: 1,
    gap: 4,
  },

  quoteNumber: {
    color: CanvasTokens.text.primary,
    fontSize: 16,
    fontWeight: '700',
    letterSpacing: 0.3,
  },

  clientName: {
    color: CanvasTokens.text.secondary,
    fontSize: 14,
    fontWeight: '500',
  },

  statusBadge: {
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 6,
  },

  statusText: {
    color: '#FFFFFF',
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 0.8,
  },

  // Line Items
  lineItemsContainer: {
    flex: 1,
  },

  lineItemCard: {
    backgroundColor: CanvasTokens.background.surface,
    borderRadius: 10,
    padding: 14,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: CanvasTokens.border.subtle,
  },

  itemHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 6,
  },

  itemName: {
    flex: 1,
    color: CanvasTokens.text.primary,
    fontSize: 14,
    fontWeight: '600',
    marginRight: 12,
  },

  lineTotal: {
    color: CanvasTokens.text.primary,
    fontSize: 15,
    fontWeight: '700',
    letterSpacing: 0.2,
  },

  itemDescription: {
    color: CanvasTokens.text.secondary,
    fontSize: 12,
    fontWeight: '400',
    marginBottom: 6,
    lineHeight: 16,
  },

  itemDetails: {
    color: CanvasTokens.text.muted,
    fontSize: 11,
    fontWeight: '500',
  },

  // Total Row
  totalRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingTop: 16,
    paddingBottom: 4,
    borderTopWidth: 2,
    borderTopColor: CanvasTokens.border.emphasis,
  },

  totalLabel: {
    color: CanvasTokens.text.primary,
    fontSize: 16,
    fontWeight: '700',
    letterSpacing: 0.4,
  },

  totalAmount: {
    color: Colors.accent.cyan,
    fontSize: 20,
    fontWeight: '800',
    letterSpacing: 0.3,
  },

  // Send Button
  sendButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: Colors.accent.cyan,
    borderRadius: 10,
    paddingVertical: 14,
    paddingHorizontal: 20,
    ...(Platform.OS === 'web'
      ? ({
          cursor: 'pointer',
          transition: 'all 150ms ease',
        } as any)
      : {}),
  },

  sendButtonPressed: {
    opacity: 0.85,
    transform: [{ scale: 0.98 }],
  },

  sendButtonText: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '700',
    letterSpacing: 0.3,
  },
});
