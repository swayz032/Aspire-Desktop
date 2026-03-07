/**
 * TemplateCard -- Card for template browser grid.
 * Shows template thumbnail, risk tier badge, Preview + Draft with Finn buttons.
 * "Coming Soon" overlay for templates without a PandaDoc UUID.
 */
import React, { useCallback, useState } from 'react';
import { View, Text, Image, StyleSheet, Pressable, Platform } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Colors } from '@/constants/tokens';
import { CARD_BG, CARD_BORDER, CARD_BORDER_HOVER } from '@/constants/cardPatterns';

// Inject keyframes for card shimmer animation (web only, idempotent)
if (Platform.OS === 'web' && typeof document !== 'undefined') {
  const styleId = 'template-card-keyframes';
  if (!document.getElementById(styleId)) {
    const el = document.createElement('style');
    el.id = styleId;
    el.textContent = `
      @keyframes templateCardShimmer {
        0% { background-position: -200% 0; }
        100% { background-position: 200% 0; }
      }
    `;
    document.head.appendChild(el);
  }
}

export type RiskTier = 'green' | 'yellow' | 'red';

export const RISK_COLORS: Record<RiskTier, { color: string; bg: string; label: string }> = {
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
  preview_image_url?: string | null;
}

interface TemplateCardProps {
  template: TemplateData;
  index?: number;
  onUseTemplate?: (key: string) => void;
  onPreview?: (template: TemplateData) => void;
}

function TemplateCardInner({ template, index = 0, onUseTemplate, onPreview }: TemplateCardProps) {
  const isAvailable = Boolean(template.pandadoc_template_uuid);
  const risk = RISK_COLORS[template.risk_tier] ?? RISK_COLORS.yellow;
  const [imageLoaded, setImageLoaded] = useState(false);

  const handleDraft = useCallback(() => {
    if (onUseTemplate && isAvailable) {
      onUseTemplate(template.key);
    }
  }, [onUseTemplate, template.key, isAvailable]);

  const handlePreview = useCallback(() => {
    if (onPreview && isAvailable) {
      onPreview(template);
    }
  }, [onPreview, template, isAvailable]);

  // Use description (PandaDoc template name) when available; fall back to key-based parsing
  const displayName = template.description || template.key
    .replace(/^(trades_|acct_|landlord_|general_|pandadoc_)/, '')
    .split('_')
    .map(w => w.charAt(0).toUpperCase() + w.slice(1))
    .join(' ');

  const webAnimationStyle = Platform.OS === 'web' ? {
    animationName: 'fadeInUp',
    animationDuration: '0.35s',
    animationTimingFunction: 'cubic-bezier(0.16, 1, 0.3, 1)',
    animationFillMode: 'both',
    animationDelay: `${index * 40}ms`,
    transition: 'transform 0.2s ease, border-color 0.2s ease, box-shadow 0.2s ease',
  } as any : {};

  // Web hover lift + border glow (matching ContractCard pattern)
  const webHoverStyle = Platform.OS === 'web' ? {
    transform: [{ translateY: -2 }],
    boxShadow: '0 8px 24px rgba(0,0,0,0.3)',
    borderColor: CARD_BORDER_HOVER,
  } as any : {};

  // Shimmer gradient for thumbnail loading state (web only)
  const shimmerStyle = Platform.OS === 'web' ? {
    background: `linear-gradient(90deg, #161618 25%, #222224 50%, #161618 75%)`,
    backgroundSize: '200% 100%',
    animationName: 'templateCardShimmer',
    animationDuration: '1.8s',
    animationTimingFunction: 'ease-in-out',
    animationIterationCount: 'infinite',
  } as any : {};

  return (
    <Pressable
      onPress={isAvailable ? handlePreview : undefined}
      disabled={!isAvailable}
      accessibilityRole="button"
      accessibilityLabel={
        isAvailable
          ? `${displayName} template, ${risk.label} risk tier. Tap to preview.`
          : `${displayName} template, coming soon.`
      }
      accessibilityState={{ disabled: !isAvailable }}
      style={({ hovered, pressed }: any) => [
        styles.card,
        webAnimationStyle,
        !isAvailable && styles.cardDisabled,
        isAvailable && hovered && styles.cardHovered,
        isAvailable && hovered && webHoverStyle,
        isAvailable && pressed && styles.cardPressed,
        Platform.OS === 'web' ? { cursor: isAvailable ? 'pointer' : 'default' } as any : {},
      ]}
    >
      {/* Template preview image — 180px for visual impact */}
      {template.preview_image_url ? (
        <View style={styles.previewImageWrap}>
          {/* Shimmer loading background — visible while image loads */}
          {!imageLoaded && (
            <View
              style={[styles.shimmerBg, shimmerStyle]}
              accessibilityElementsHidden
              importantForAccessibility="no-hide-descendants"
            />
          )}
          <Image
            source={{ uri: template.preview_image_url }}
            style={[
              styles.previewImage,
              { opacity: imageLoaded ? 1 : 0 },
              Platform.OS === 'web' ? { transition: 'opacity 0.3s ease' } as any : {},
            ]}
            resizeMode="cover"
            onLoad={() => setImageLoaded(true)}
            accessibilityLabel={`${displayName} template thumbnail`}
          />
          {/* Bottom gradient fade into card body */}
          <View style={[
            styles.previewFade,
            Platform.OS === 'web' ? {
              background: `linear-gradient(transparent, ${CARD_BG})`,
            } as any : {},
          ]} />
        </View>
      ) : (
        <View style={[styles.previewPlaceholder, { backgroundColor: risk.bg }]}>
          <Ionicons name="document-text-outline" size={32} color={risk.color} />
        </View>
      )}

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

      {/* Footer — jurisdiction + action buttons */}
      <View style={styles.footer}>
        {template.jurisdiction_required && (
          <View style={styles.jurisdictionPill}>
            <Ionicons name="location-outline" size={10} color={Colors.text.muted} />
            <Text style={styles.jurisdictionLabel}>Jurisdiction</Text>
          </View>
        )}
      </View>

      {/* Action buttons — stacked, full-width */}
      {isAvailable && (
        <View style={styles.actionButtons}>
          {/* Preview button — glass surface */}
          <Pressable
            onPress={(e: any) => { if (e?.stopPropagation) e.stopPropagation(); handlePreview(); }}
            accessibilityRole="button"
            accessibilityLabel={`Preview ${displayName} template`}
            style={({ hovered, pressed }: any) => [
              styles.previewBtn,
              Platform.OS === 'web' ? { cursor: 'pointer', transition: 'all 0.2s ease', outlineOffset: 2 } as any : {},
              hovered && styles.previewBtnHovered,
              pressed && styles.previewBtnPressed,
            ]}
          >
            <Ionicons name="eye-outline" size={14} color={Colors.text.secondary} />
            <Text style={styles.previewBtnText}>Preview</Text>
          </Pressable>

          {/* Draft with Finn button — cyan accent */}
          <Pressable
            onPress={(e: any) => { if (e?.stopPropagation) e.stopPropagation(); handleDraft(); }}
            accessibilityRole="button"
            accessibilityLabel={`Draft ${displayName} with Finn`}
            style={({ hovered, pressed }: any) => [
              styles.draftBtn,
              Platform.OS === 'web' ? { cursor: 'pointer', transition: 'all 0.2s ease', outlineOffset: 2 } as any : {},
              hovered && styles.draftBtnHovered,
              pressed && styles.draftBtnPressed,
            ]}
          >
            <Ionicons name="videocam" size={14} color={Colors.accent.cyan} />
            <Text style={styles.draftBtnText}>Draft with Finn</Text>
          </Pressable>
        </View>
      )}
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
    paddingHorizontal: 18,
    paddingBottom: 18,
    paddingTop: 0,
    minHeight: 180,
    position: 'relative',
    overflow: 'hidden',
  },
  previewImageWrap: {
    marginHorizontal: -18,
    height: 180,
    overflow: 'hidden',
    borderTopLeftRadius: 13,
    borderTopRightRadius: 13,
    marginBottom: 14,
    backgroundColor: Colors.background.elevated,
    position: 'relative',
  },
  shimmerBg: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: Colors.background.elevated,
  },
  previewImage: {
    width: '100%',
    height: '100%',
  },
  previewFade: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    height: 48,
  },
  previewPlaceholder: {
    marginHorizontal: -18,
    height: 100,
    borderTopLeftRadius: 13,
    borderTopRightRadius: 13,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 14,
  },
  cardHovered: {
    backgroundColor: '#222224',
  },
  cardPressed: {
    backgroundColor: '#1a1a1c',
    opacity: 0.95,
  },
  cardDisabled: {
    opacity: 0.55,
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
    marginBottom: 10,
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
    marginBottom: 4,
  },
  nameDisabled: {
    color: Colors.text.tertiary,
  },
  description: {
    fontSize: 12,
    color: Colors.text.tertiary,
    lineHeight: 17,
    marginBottom: 12,
  },
  descriptionDisabled: {
    color: Colors.text.muted,
  },
  footer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 8,
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
  actionButtons: {
    gap: 8,
    marginTop: 4,
  },
  previewBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 10,
    minHeight: 44,
    borderRadius: 8,
    backgroundColor: 'rgba(255,255,255,0.06)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
  },
  previewBtnHovered: {
    backgroundColor: 'rgba(255,255,255,0.10)',
    borderColor: 'rgba(255,255,255,0.14)',
  },
  previewBtnPressed: {
    backgroundColor: 'rgba(255,255,255,0.04)',
    opacity: 0.9,
  },
  previewBtnText: {
    fontSize: 12,
    fontWeight: '600',
    color: Colors.text.secondary,
  },
  draftBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 10,
    minHeight: 44,
    borderRadius: 8,
    backgroundColor: 'rgba(59,130,246,0.12)',
    borderWidth: 1,
    borderColor: 'rgba(59,130,246,0.20)',
  },
  draftBtnHovered: {
    backgroundColor: 'rgba(59,130,246,0.18)',
    borderColor: 'rgba(59,130,246,0.30)',
  },
  draftBtnPressed: {
    backgroundColor: 'rgba(59,130,246,0.08)',
    opacity: 0.9,
  },
  draftBtnText: {
    fontSize: 12,
    fontWeight: '600',
    color: Colors.accent.cyan,
  },
});
