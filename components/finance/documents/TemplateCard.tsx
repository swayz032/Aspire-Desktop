/**
 * TemplateCard -- Card for template browser grid.
 * Shows template name, description, risk tier badge, and "Coming Soon" overlay
 * for templates that lack a PandaDoc UUID.
 */
import React, { useCallback } from 'react';
import { View, Text, StyleSheet, Pressable, Platform } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Colors } from '@/constants/tokens';
import { CARD_BG, CARD_BORDER } from '@/constants/cardPatterns';

type RiskTier = 'green' | 'yellow' | 'red';

const RISK_COLORS: Record<RiskTier, { color: string; bg: string; label: string }> = {
  green: { color: '#34c759', bg: 'rgba(52,199,89,0.12)', label: 'Green' },
  yellow: { color: '#f59e0b', bg: 'rgba(245,158,11,0.12)', label: 'Yellow' },
  red: { color: '#ff3b30', bg: 'rgba(255,59,48,0.12)', label: 'Red' },
};

export interface TemplateData {
  key: string;
  lane: string;
  description: string;
  risk_tier: RiskTier;
  jurisdiction_required: boolean;
  pandadoc_template_uuid: string;
  /** Live PandaDoc data — populated when fetched from API */
  tokens_count?: number;
  fields_count?: number;
  roles?: string[];
  has_pricing?: boolean;
  date_modified?: string;
}

interface TemplateCardProps {
  template: TemplateData;
  index?: number;
  onUseTemplate?: (key: string) => void;
}

function TemplateCardInner({ template, index = 0, onUseTemplate }: TemplateCardProps) {
  const isAvailable = Boolean(template.pandadoc_template_uuid);
  const risk = RISK_COLORS[template.risk_tier] ?? RISK_COLORS.yellow;

  const handlePress = useCallback(() => {
    if (onUseTemplate && isAvailable) {
      onUseTemplate(template.key);
    }
  }, [onUseTemplate, template.key, isAvailable]);

  // Derive a readable name from the template key
  const displayName = template.key
    .replace(/^(trades_|acct_|landlord_|general_)/, '')
    .split('_')
    .map(w => w.charAt(0).toUpperCase() + w.slice(1))
    .join(' ');

  const webAnimationStyle = Platform.OS === 'web' ? {
    animationName: 'fadeInUp',
    animationDuration: '0.35s',
    animationTimingFunction: 'cubic-bezier(0.16, 1, 0.3, 1)',
    animationFillMode: 'both',
    animationDelay: `${index * 40}ms`,
    transition: 'transform 0.2s ease, border-color 0.2s ease',
    cursor: isAvailable ? 'pointer' : 'default',
  } as any : {};

  return (
    <Pressable
      onPress={handlePress}
      disabled={!isAvailable}
      accessibilityRole="button"
      accessibilityLabel={`Template: ${displayName}${!isAvailable ? ', Coming Soon' : ''}`}
      style={({ hovered }: any) => [
        styles.card,
        webAnimationStyle,
        !isAvailable && styles.cardDisabled,
        hovered && isAvailable && styles.cardHovered,
        hovered && isAvailable && Platform.OS === 'web' ? {
          transform: [{ translateY: -2 }],
          borderColor: 'rgba(255,255,255,0.10)',
        } as any : {},
      ]}
    >
      {/* Coming Soon overlay */}
      {!isAvailable && (
        <View style={styles.comingSoonOverlay}>
          <View style={styles.comingSoonBadge}>
            <Text style={styles.comingSoonText}>Coming Soon</Text>
          </View>
        </View>
      )}

      {/* Risk tier badge */}
      <View style={[styles.riskBadge, { backgroundColor: risk.bg }]}>
        <View style={[styles.riskDot, { backgroundColor: risk.color }]} />
        <Text style={[styles.riskLabel, { color: risk.color }]}>{risk.label}</Text>
      </View>

      {/* Name */}
      <Text style={[styles.name, !isAvailable && styles.nameDisabled]} numberOfLines={2}>
        {displayName}
      </Text>

      {/* Description */}
      <Text style={[styles.description, !isAvailable && styles.descriptionDisabled]} numberOfLines={3}>
        {template.description}
      </Text>

      {/* Stats row — show live PandaDoc data when available */}
      {isAvailable && (template.tokens_count || template.fields_count || template.roles?.length) ? (
        <View style={styles.statsRow}>
          {Boolean(template.tokens_count) && (
            <View style={styles.statPill}>
              <Ionicons name="code-slash-outline" size={10} color={Colors.text.muted} />
              <Text style={styles.statLabel}>{template.tokens_count} tokens</Text>
            </View>
          )}
          {Boolean(template.fields_count) && (
            <View style={styles.statPill}>
              <Ionicons name="create-outline" size={10} color={Colors.text.muted} />
              <Text style={styles.statLabel}>{template.fields_count} fields</Text>
            </View>
          )}
          {Boolean(template.roles?.length) && (
            <View style={styles.statPill}>
              <Ionicons name="people-outline" size={10} color={Colors.text.muted} />
              <Text style={styles.statLabel}>{template.roles!.join(', ')}</Text>
            </View>
          )}
        </View>
      ) : null}

      {/* Footer */}
      <View style={styles.footer}>
        {template.jurisdiction_required && (
          <View style={styles.jurisdictionPill}>
            <Ionicons name="location-outline" size={10} color={Colors.text.muted} />
            <Text style={styles.jurisdictionLabel}>Jurisdiction</Text>
          </View>
        )}
        {isAvailable && (
          <View style={styles.useBtn}>
            <Ionicons name="arrow-forward" size={14} color={Colors.accent.cyan} />
          </View>
        )}
      </View>
    </Pressable>
  );
}

export const TemplateCard = React.memo(TemplateCardInner);

const styles = StyleSheet.create({
  card: {
    backgroundColor: CARD_BG,
    borderWidth: 1,
    borderColor: CARD_BORDER,
    borderRadius: 14,
    padding: 18,
    minHeight: 180,
    justifyContent: 'space-between',
    position: 'relative',
    overflow: 'hidden',
  },
  cardDisabled: {
    opacity: 0.55,
  },
  cardHovered: {
    backgroundColor: '#222224',
  },
  comingSoonOverlay: {
    position: 'absolute',
    top: 12,
    right: 12,
    zIndex: 2,
  },
  comingSoonBadge: {
    backgroundColor: 'rgba(255,255,255,0.08)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.12)',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
  },
  comingSoonText: {
    fontSize: 10,
    fontWeight: '700',
    color: Colors.text.tertiary,
    letterSpacing: 0.5,
    textTransform: 'uppercase',
  },
  riskBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 10,
    gap: 5,
    marginBottom: 12,
  },
  riskDot: {
    width: 5,
    height: 5,
    borderRadius: 2.5,
  },
  riskLabel: {
    fontSize: 10,
    fontWeight: '600',
    letterSpacing: 0.3,
  },
  name: {
    fontSize: 15,
    fontWeight: '600',
    color: Colors.text.primary,
    lineHeight: 20,
    marginBottom: 6,
  },
  nameDisabled: {
    color: Colors.text.tertiary,
  },
  description: {
    fontSize: 12,
    color: Colors.text.tertiary,
    lineHeight: 17,
    marginBottom: 14,
  },
  descriptionDisabled: {
    color: Colors.text.muted,
  },
  footer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  jurisdictionPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 6,
    paddingVertical: 2,
    backgroundColor: 'rgba(255,255,255,0.04)',
    borderRadius: 8,
  },
  jurisdictionLabel: {
    fontSize: 10,
    color: Colors.text.muted,
    fontWeight: '500',
  },
  statsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
    marginBottom: 10,
  },
  statPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    paddingHorizontal: 6,
    paddingVertical: 2,
    backgroundColor: 'rgba(59,130,246,0.08)',
    borderRadius: 8,
  },
  statLabel: {
    fontSize: 10,
    color: Colors.text.tertiary,
    fontWeight: '500',
  },
  useBtn: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: 'rgba(59,130,246,0.12)',
    alignItems: 'center',
    justifyContent: 'center',
  },
});
