/**
 * TemplatePreviewModal -- Full-screen live template preview.
 *
 * Shows the real template via embedded PandaDoc editing session (all pages, scrollable).
 * Falls back to full-size thumbnail if the session fails.
 * Zero third-party branding — everything is Aspire-native.
 */
import React, { useState, useEffect, useCallback, useRef } from 'react';
import type { PressableState } from '@/types/common';
import {
  View,
  Text,
  Image,
  StyleSheet,
  Pressable,
  Platform,
  ActivityIndicator,
  ScrollView,
  Modal,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Colors } from '@/constants/tokens';
import { CARD_BG, CARD_BORDER } from '@/constants/cardPatterns';
import { RISK_COLORS } from './TemplateCard';
import type { TemplateData } from './TemplateCard';

const PANDADOC_SESSION_BASE = 'https://app.pandadoc.com/s/';

// Inject modal animation keyframes (web only, idempotent)
if (Platform.OS === 'web' && typeof document !== 'undefined') {
  const styleId = 'template-preview-keyframes';
  if (!document.getElementById(styleId)) {
    const el = document.createElement('style');
    el.id = styleId;
    el.textContent = `
      @keyframes modalEntrance {
        0% { transform: scale(0.96); opacity: 0; }
        100% { transform: scale(1); opacity: 1; }
      }
      @keyframes modalShimmer {
        0% { background-position: -200% 0; }
        100% { background-position: 200% 0; }
      }
    `;
    document.head.appendChild(el);
  }
}

interface TemplatePreviewModalProps {
  visible: boolean;
  onClose: () => void;
  template: TemplateData | null;
  onDraftWithFinn?: (template: TemplateData) => void;
}

type PreviewState = 'loading' | 'embedded' | 'fallback';

export function TemplatePreviewModal({
  visible,
  onClose,
  template,
  onDraftWithFinn,
}: TemplatePreviewModalProps) {
  const [previewState, setPreviewState] = useState<PreviewState>('loading');
  const [sessionUrl, setSessionUrl] = useState<string | null>(null);
  const [iframeReady, setIframeReady] = useState(false);
  const abortRef = useRef<AbortController | null>(null);

  // Fetch preview session when modal opens
  useEffect(() => {
    if (!visible || !template) {
      setPreviewState('loading');
      setSessionUrl(null);
      setIframeReady(false);
      return;
    }

    const controller = new AbortController();
    abortRef.current = controller;

    async function fetchPreviewSession() {
      try {
        setPreviewState('loading');
        const resp = await fetch(
          `/api/contracts/templates/${template!.pandadoc_template_uuid}/preview-session`,
          {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            signal: controller.signal,
          }
        );

        if (!resp.ok) throw new Error('Session failed');
        const data = await resp.json();
        if (controller.signal.aborted) return;

        if (data.token) {
          setSessionUrl(`${PANDADOC_SESSION_BASE}${data.token}`);
          setPreviewState('embedded');
        } else {
          setPreviewState('fallback');
        }
      } catch {
        if (!controller.signal.aborted) {
          setPreviewState('fallback');
        }
      }
    }

    fetchPreviewSession();
    return () => { controller.abort(); };
  }, [visible, template]);

  // Close on Escape key (web only)
  useEffect(() => {
    if (!visible || Platform.OS !== 'web') return;
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose();
    }
    document.addEventListener('keydown', handleKeyDown);
    return () => { document.removeEventListener('keydown', handleKeyDown); };
  }, [visible, onClose]);

  const handleDraft = useCallback(() => {
    if (template && onDraftWithFinn) {
      onClose();
      onDraftWithFinn(template);
    }
  }, [template, onDraftWithFinn, onClose]);

  if (!template) return null;

  const risk = RISK_COLORS[template.risk_tier] ?? RISK_COLORS.yellow;

  // Derive display name
  const displayName = template.description || template.key
    .replace(/^(trades_|acct_|landlord_|general_|pandadoc_)/, '')
    .split('_')
    .map((w: string) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(' ');

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onClose}
    >
      <Pressable
        style={styles.backdrop}
        onPress={onClose}
        accessibilityRole="button"
        accessibilityLabel="Close preview backdrop"
      >
        <Pressable
          style={styles.modalContainer}
          onPress={(e) => { e.stopPropagation(); }}
        >
          {/* ── Header ── */}
          <View style={styles.header}>
            <View style={styles.headerLeft}>
              <Ionicons name="document-text" size={20} color={Colors.accent.cyan} />
              <View style={styles.headerTitles}>
                <Text style={styles.headerTitle} numberOfLines={1}>{displayName}</Text>
                <Text style={styles.headerSubtitle}>{template.lane || 'Template'}</Text>
              </View>
            </View>
            <View style={styles.headerRight}>
              <View style={[styles.riskBadge, { backgroundColor: risk.bg }]}>
                <View style={[styles.riskDot, { backgroundColor: risk.color }]} />
                <Text style={[styles.riskLabel, { color: risk.color }]}>{risk.label}</Text>
              </View>
              <Pressable
                onPress={onClose}
                accessibilityRole="button"
                accessibilityLabel="Close preview"
                style={({ hovered, pressed }: PressableState) => [
                  styles.closeBtn,
                  Platform.OS === 'web' ? { cursor: 'pointer', transition: 'all 0.2s ease' } as any : {},
                  hovered && styles.closeBtnHovered,
                  pressed && styles.closeBtnPressed,
                ]}
              >
                <Ionicons name="close" size={20} color={Colors.text.secondary} />
              </Pressable>
            </View>
          </View>

          {/* ── Body ── */}
          <View style={styles.body}>
            {/* Loading: Show thumbnail + shimmer overlay */}
            {previewState === 'loading' && (
              <View
                style={styles.loadingContainer}
                accessibilityRole="progressbar"
                accessibilityLabel="Loading template preview"
              >
                {template.preview_image_url ? (
                  <Image
                    source={{ uri: template.preview_image_url }}
                    style={styles.fallbackImage}
                    resizeMode="contain"
                    accessibilityLabel={`${displayName} template thumbnail`}
                  />
                ) : null}
                <View style={styles.shimmerOverlay}>
                  {/* Animated shimmer sweep — visible behind spinner on web */}
                  {Platform.OS === 'web' && (
                    <View
                      style={[styles.shimmerSweep, {
                        background: 'linear-gradient(90deg, transparent 25%, rgba(59,130,246,0.06) 50%, transparent 75%)',
                        backgroundSize: '200% 100%',
                        animationName: 'modalShimmer',
                        animationDuration: '2s',
                        animationTimingFunction: 'ease-in-out',
                        animationIterationCount: 'infinite',
                      } as any]}
                      accessibilityElementsHidden
                      importantForAccessibility="no-hide-descendants"
                    />
                  )}
                  <ActivityIndicator
                    size="large"
                    color={Colors.accent.cyan}
                    accessibilityLabel="Loading"
                  />
                  <Text style={styles.loadingText}>Loading live preview...</Text>
                </View>
              </View>
            )}

            {/* Embedded: Show iframe with real template */}
            {previewState === 'embedded' && sessionUrl && (
              <View style={styles.iframeContainer}>
                {/* Thumbnail placeholder -- fades out while iframe fades in */}
                {template.preview_image_url && (
                  <View style={[
                    styles.iframePlaceholder,
                    Platform.OS === 'web' ? {
                      opacity: iframeReady ? 0 : 1,
                      transition: 'opacity 0.3s ease',
                      pointerEvents: iframeReady ? 'none' : 'auto',
                    } as any : {},
                    iframeReady && Platform.OS !== 'web' ? { display: 'none' } as any : {},
                  ]}>
                    <Image
                      source={{ uri: template.preview_image_url }}
                      style={styles.fallbackImage}
                      resizeMode="contain"
                    />
                    <View style={styles.shimmerOverlay}>
                      <ActivityIndicator
                        size="large"
                        color={Colors.accent.cyan}
                        accessibilityLabel="Loading template preview"
                      />
                    </View>
                  </View>
                )}
                {Platform.OS === 'web' ? (
                  <iframe
                    src={sessionUrl}
                    style={{
                      width: '100%',
                      height: 'calc(95vh - 180px)',
                      border: 'none',
                      borderRadius: 8,
                      backgroundColor: '#ffffff',
                      opacity: iframeReady ? 1 : 0,
                      transition: 'opacity 0.3s ease',
                    }}
                    title={`Preview: ${displayName}`}
                    sandbox="allow-scripts allow-same-origin allow-forms allow-popups"
                    onLoad={() => setIframeReady(true)}
                  />
                ) : (
                  <FallbackView template={template} />
                )}
              </View>
            )}

            {/* Fallback: Show full-size thumbnail */}
            {previewState === 'fallback' && (
              <ScrollView
                style={styles.fallbackScroll}
                contentContainerStyle={styles.fallbackScrollContent}
                showsVerticalScrollIndicator
                accessibilityRole="scrollbar"
              >
                {template.preview_image_url ? (
                  <Image
                    source={{ uri: template.preview_image_url }}
                    style={styles.fallbackImageLarge}
                    resizeMode="contain"
                    accessibilityLabel={`${displayName} template preview`}
                  />
                ) : (
                  <View style={styles.noPreview}>
                    <Ionicons name="document-text-outline" size={64} color={Colors.text.disabled} />
                    <Text style={styles.noPreviewText}>Preview not available</Text>
                  </View>
                )}
                <View style={styles.fallbackHint}>
                  <Ionicons name="information-circle-outline" size={14} color={Colors.text.muted} />
                  <Text style={styles.fallbackHintText}>Live preview unavailable — showing template thumbnail</Text>
                </View>
              </ScrollView>
            )}
          </View>

          {/* ── Footer ── */}
          <View style={styles.footer}>
            {/* Template metadata */}
            <View style={styles.footerMeta}>
              {Boolean(template.tokens_count) && (
                <View style={styles.metaPill}>
                  <Ionicons name="code-slash-outline" size={11} color={Colors.text.muted} />
                  <Text style={styles.metaLabel}>{template.tokens_count} tokens</Text>
                </View>
              )}
              {Boolean(template.fields_count) && (
                <View style={styles.metaPill}>
                  <Ionicons name="create-outline" size={11} color={Colors.text.muted} />
                  <Text style={styles.metaLabel}>{template.fields_count} fields</Text>
                </View>
              )}
              {Boolean(template.roles?.length) && (
                <View style={styles.metaPill}>
                  <Ionicons name="people-outline" size={11} color={Colors.text.muted} />
                  <Text style={styles.metaLabel}>{template.roles!.join(', ')}</Text>
                </View>
              )}
              <View style={[styles.metaPill, { backgroundColor: risk.bg }]}>
                <Ionicons name="shield-checkmark-outline" size={11} color={risk.color} />
                <Text style={[styles.metaLabel, { color: risk.color }]}>{risk.label} tier</Text>
              </View>
            </View>

            {/* Draft with Finn CTA */}
            <Pressable
              onPress={handleDraft}
              accessibilityRole="button"
              accessibilityLabel={`Draft ${displayName} with Finn`}
              style={({ hovered, pressed }: PressableState) => [
                styles.draftCta,
                Platform.OS === 'web' ? { cursor: 'pointer', transition: 'all 0.2s ease' } as any : {},
                hovered && styles.draftCtaHovered,
                pressed && styles.draftCtaPressed,
              ]}
            >
              <Ionicons name="videocam" size={16} color={Colors.text.primary} />
              <Text style={styles.draftCtaText}>Draft with Finn</Text>
            </Pressable>

            {/* Security footer */}
            <View style={styles.securedRow}>
              <Ionicons name="shield-checkmark" size={12} color={Colors.text.disabled} />
              <Text style={styles.securedText}>Secured by Aspire</Text>
            </View>
          </View>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

/** Fallback view for native (non-web) platforms */
function FallbackView({ template }: { template: TemplateData }) {
  const fallbackName = template.description || template.key;
  return (
    <ScrollView
      style={styles.fallbackScroll}
      contentContainerStyle={styles.fallbackScrollContent}
      showsVerticalScrollIndicator
      accessibilityLabel={`${fallbackName} template preview`}
    >
      {template.preview_image_url ? (
        <Image
          source={{ uri: template.preview_image_url }}
          style={styles.fallbackImageLarge}
          resizeMode="contain"
          accessibilityLabel={`${fallbackName} template thumbnail`}
        />
      ) : (
        <View style={styles.noPreview}>
          <Ionicons name="document-text-outline" size={64} color={Colors.text.disabled} />
          <Text style={styles.noPreviewText}>Preview not available</Text>
        </View>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.75)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
    ...(Platform.OS === 'web' ? {
      backdropFilter: 'blur(8px)',
      WebkitBackdropFilter: 'blur(8px)',
    } as any : {}),
  },
  modalContainer: {
    width: '100%',
    maxWidth: 920,
    maxHeight: '95vh' as any,
    backgroundColor: Colors.background.elevated,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
    overflow: 'hidden',
    ...(Platform.OS === 'web' ? {
      boxShadow: '0 24px 80px rgba(0,0,0,0.5)',
      animationName: 'modalEntrance',
      animationDuration: '0.25s',
      animationTimingFunction: 'cubic-bezier(0.16, 1, 0.3, 1)',
      animationFillMode: 'both',
    } as any : {
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 24 },
      shadowOpacity: 0.5,
      shadowRadius: 40,
      elevation: 24,
    }),
  },

  // ── Header ──
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,255,255,0.06)',
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    flex: 1,
  },
  headerTitles: {
    flex: 1,
  },
  headerTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: Colors.text.primary,
    letterSpacing: -0.2,
  },
  headerSubtitle: {
    fontSize: 12,
    color: Colors.text.muted,
    textTransform: 'capitalize',
    marginTop: 2,
  },
  headerRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  riskBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 10,
    gap: 5,
  },
  riskDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  riskLabel: {
    fontSize: 11,
    fontWeight: '600',
    letterSpacing: 0.3,
  },
  closeBtn: {
    width: 44,
    height: 44,
    borderRadius: 10,
    backgroundColor: 'rgba(255,255,255,0.06)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  closeBtnHovered: {
    backgroundColor: 'rgba(255,255,255,0.12)',
  },
  closeBtnPressed: {
    backgroundColor: 'rgba(255,255,255,0.04)',
    opacity: 0.9,
  },

  // ── Body ──
  body: {
    flex: 1,
    minHeight: 400,
    backgroundColor: Colors.background.primary,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    position: 'relative',
  },
  shimmerOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(10,10,10,0.7)',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 12,
  },
  shimmerSweep: {
    ...StyleSheet.absoluteFillObject,
  },
  loadingText: {
    fontSize: 13,
    color: Colors.text.tertiary,
  },
  iframeContainer: {
    flex: 1,
    /** flex: 1 fills remaining body space naturally — avoids viewport overflow on smaller screens */
    position: 'relative',
  },
  iframePlaceholder: {
    ...StyleSheet.absoluteFillObject,
    zIndex: 1,
  },
  fallbackScroll: {
    flex: 1,
  },
  fallbackScrollContent: {
    padding: 24,
    alignItems: 'center',
  },
  fallbackImage: {
    width: '100%',
    height: '100%',
  },
  fallbackImageLarge: {
    width: '100%',
    aspectRatio: 816 / 900,
    maxWidth: 700,
    borderRadius: 8,
    backgroundColor: '#ffffff',
  },
  fallbackHint: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: 16,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
    backgroundColor: 'rgba(255,255,255,0.04)',
  },
  fallbackHintText: {
    fontSize: 12,
    color: Colors.text.muted,
  },
  noPreview: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 80,
    gap: 12,
  },
  noPreviewText: {
    fontSize: 14,
    color: Colors.text.disabled,
  },

  // ── Footer ──
  footer: {
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderTopWidth: 1,
    borderTopColor: 'rgba(255,255,255,0.06)',
    gap: 12,
  },
  footerMeta: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
  },
  metaPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 8,
    backgroundColor: 'rgba(255,255,255,0.06)',
  },
  metaLabel: {
    fontSize: 11,
    color: Colors.text.muted,
    fontWeight: '500',
  },
  draftCta: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 12,
    minHeight: 48,
    borderRadius: 10,
    backgroundColor: Colors.accent.cyan,
  },
  draftCtaHovered: {
    backgroundColor: Colors.accent.cyanDark,
  },
  draftCtaPressed: {
    backgroundColor: Colors.accent.cyanDark,
    opacity: 0.9,
  },
  draftCtaText: {
    fontSize: 14,
    fontWeight: '700',
    color: Colors.text.primary,
  },
  securedRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 5,
  },
  securedText: {
    fontSize: 11,
    color: Colors.text.disabled,
    fontWeight: '500',
  },
});
