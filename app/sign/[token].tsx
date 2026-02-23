/**
 * External Signing Page — Public, NO auth required.
 *
 * External signers receive a link like /sign/{token} and land on this page
 * to review and sign a PandaDoc document. After signing, they see an
 * acquisition popup introducing Aspire.
 *
 * Design: Aspire dark premium "signing chamber" — dark canvas with white
 * document iframe, minimal branding, device-optimized (mobile-first).
 */
import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Image,
  Pressable,
  ActivityIndicator,
  Animated,
  Platform,
  useWindowDimensions,
  ViewStyle,
} from 'react-native';
import { useLocalSearchParams } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { Colors, Typography, Spacing, BorderRadius, Shadows } from '@/constants/tokens';

// ── Types ────────────────────────────────────────────────────────────────────

interface SigningSession {
  status: 'pending' | 'completed';
  document_name: string;
  signer_name?: string;
  pandadoc_session_id?: string;
  expires_at?: string;
  completed_at?: string;
}

type PageState = 'loading' | 'active' | 'completed' | 'expired' | 'error';

// ── Constants ────────────────────────────────────────────────────────────────

const API_BASE = process.env.EXPO_PUBLIC_API_URL || '';
const PANDADOC_SESSION_BASE = 'https://app.pandadoc.com/s/';
const COMPLETION_POLL_INTERVAL = 5000;
const ACQUISITION_POPUP_DELAY = 1500;
const MOBILE_BREAKPOINT = 768;

// ── Aspirational Color Palette (signing-specific refinements) ────────────────

const SignColors = {
  canvas: '#060608',
  sidebar: '#0c0c0e',
  sidebarBorder: '#1a1a1e',
  documentGlow: 'rgba(59, 130, 246, 0.06)',
  documentBorder: '#1e1e22',
  documentBorderHover: 'rgba(59, 130, 246, 0.15)',
  badgeBg: 'rgba(59, 130, 246, 0.08)',
  badgeBorder: 'rgba(59, 130, 246, 0.18)',
  overlayBg: 'rgba(0, 0, 0, 0.82)',
  modalBg: '#111114',
  modalBorder: '#222228',
  successGlow: 'rgba(52, 199, 89, 0.12)',
  successBorder: 'rgba(52, 199, 89, 0.25)',
} as const;

// ── Main Component ───────────────────────────────────────────────────────────

export default function SigningPage() {
  const { token } = useLocalSearchParams<{ token: string }>();
  const { width } = useWindowDimensions();
  const isMobile = width < MOBILE_BREAKPOINT;

  const [pageState, setPageState] = useState<PageState>('loading');
  const [session, setSession] = useState<SigningSession | null>(null);
  const [errorMessage, setErrorMessage] = useState<string>('');
  const [showAcquisition, setShowAcquisition] = useState(false);

  // Animation values
  const fadeIn = useRef(new Animated.Value(0)).current;
  const slideUp = useRef(new Animated.Value(20)).current;
  const modalScale = useRef(new Animated.Value(0.92)).current;
  const modalOpacity = useRef(new Animated.Value(0)).current;
  const overlayOpacity = useRef(new Animated.Value(0)).current;
  const successScale = useRef(new Animated.Value(0.8)).current;
  const successOpacity = useRef(new Animated.Value(0)).current;
  const checkmarkRotate = useRef(new Animated.Value(0)).current;

  // Polling ref
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // ── Data Fetching ──────────────────────────────────────────────────────────

  const fetchSession = useCallback(async () => {
    if (!token) {
      setErrorMessage('No signing token provided.');
      setPageState('error');
      return;
    }

    try {
      const res = await fetch(`${API_BASE}/api/signing/${token}`);

      if (res.status === 410) {
        setPageState('expired');
        return;
      }

      if (res.status === 404) {
        setErrorMessage('This signing session could not be found.');
        setPageState('error');
        return;
      }

      if (!res.ok) {
        setErrorMessage('Something went wrong loading this document.');
        setPageState('error');
        return;
      }

      const data: SigningSession = await res.json();
      setSession(data);

      if (data.status === 'completed') {
        setPageState('completed');
      } else {
        setPageState('active');
      }
    } catch (_e) {
      setErrorMessage('Unable to connect. Please check your internet connection and try again.');
      setPageState('error');
    }
  }, [token]);

  // Initial fetch
  useEffect(() => {
    fetchSession();
  }, [fetchSession]);

  // ── Entrance Animation ─────────────────────────────────────────────────────

  useEffect(() => {
    if (pageState !== 'loading') {
      Animated.parallel([
        Animated.timing(fadeIn, {
          toValue: 1,
          duration: 600,
          useNativeDriver: true,
        }),
        Animated.timing(slideUp, {
          toValue: 0,
          duration: 600,
          useNativeDriver: true,
        }),
      ]).start();
    }
  }, [pageState, fadeIn, slideUp]);

  // ── Completion Polling ─────────────────────────────────────────────────────

  useEffect(() => {
    if (pageState !== 'active' || !token) return;

    pollRef.current = setInterval(async () => {
      try {
        const res = await fetch(`${API_BASE}/api/signing/${token}`);
        if (!res.ok) return;
        const data: SigningSession = await res.json();
        if (data.status === 'completed') {
          handleCompletion();
        }
      } catch (_e) {
        // Silent — poll failure is not critical
      }
    }, COMPLETION_POLL_INTERVAL);

    return () => {
      if (pollRef.current) clearInterval(pollRef.current);
    };
  }, [pageState, token]);

  // ── PandaDoc PostMessage Listener (Web) ────────────────────────────────────

  useEffect(() => {
    if (Platform.OS !== 'web' || pageState !== 'active') return;

    const handler = (event: MessageEvent) => {
      // PandaDoc sends postMessage events on completion
      if (
        event.data &&
        typeof event.data === 'object' &&
        (event.data.event === 'session_view.document.completed' ||
         event.data.type === 'session_view.document.completed')
      ) {
        handleCompletion();
      }
    };

    window.addEventListener('message', handler);
    return () => window.removeEventListener('message', handler);
  }, [pageState]);

  // ── Completion Handler ─────────────────────────────────────────────────────

  const handleCompletion = useCallback(() => {
    if (pollRef.current) clearInterval(pollRef.current);
    setPageState('completed');

    // Animate success state in
    Animated.parallel([
      Animated.spring(successScale, {
        toValue: 1,
        damping: 12,
        stiffness: 180,
        useNativeDriver: true,
      }),
      Animated.timing(successOpacity, {
        toValue: 1,
        duration: 400,
        useNativeDriver: true,
      }),
      Animated.timing(checkmarkRotate, {
        toValue: 1,
        duration: 600,
        useNativeDriver: true,
      }),
    ]).start();

    // Show acquisition popup after delay
    setTimeout(() => {
      setShowAcquisition(true);
    }, ACQUISITION_POPUP_DELAY);
  }, [successScale, successOpacity, checkmarkRotate]);

  // ── Acquisition Popup Animation ────────────────────────────────────────────

  useEffect(() => {
    if (!showAcquisition) return;

    Animated.parallel([
      Animated.timing(overlayOpacity, {
        toValue: 1,
        duration: 300,
        useNativeDriver: true,
      }),
      Animated.spring(modalScale, {
        toValue: 1,
        damping: 16,
        stiffness: 200,
        useNativeDriver: true,
      }),
      Animated.timing(modalOpacity, {
        toValue: 1,
        duration: 350,
        useNativeDriver: true,
      }),
    ]).start();
  }, [showAcquisition, overlayOpacity, modalScale, modalOpacity]);

  const dismissAcquisition = useCallback(() => {
    Animated.parallel([
      Animated.timing(overlayOpacity, {
        toValue: 0,
        duration: 200,
        useNativeDriver: true,
      }),
      Animated.timing(modalOpacity, {
        toValue: 0,
        duration: 200,
        useNativeDriver: true,
      }),
    ]).start(() => {
      setShowAcquisition(false);
    });
  }, [overlayOpacity, modalOpacity]);

  // ── Render ─────────────────────────────────────────────────────────────────

  if (pageState === 'loading') {
    return <LoadingState />;
  }

  if (pageState === 'expired') {
    return (
      <Animated.View style={[styles.fullScreen, { opacity: fadeIn, transform: [{ translateY: slideUp }] }]}>
        <StatusScreen
          icon="time-outline"
          iconColor={Colors.semantic.warning}
          title="This signing link has expired"
          body="The document is no longer available for signing. Please contact the sender to request a new link."
          isMobile={isMobile}
        />
      </Animated.View>
    );
  }

  if (pageState === 'error') {
    return (
      <Animated.View style={[styles.fullScreen, { opacity: fadeIn, transform: [{ translateY: slideUp }] }]}>
        <StatusScreen
          icon="alert-circle-outline"
          iconColor={Colors.semantic.error}
          title="Something went wrong"
          body={errorMessage}
          actionLabel="Try Again"
          onAction={() => {
            setPageState('loading');
            fetchSession();
          }}
          isMobile={isMobile}
        />
      </Animated.View>
    );
  }

  if (pageState === 'completed' && !showAcquisition) {
    const rotateInterpolate = checkmarkRotate.interpolate({
      inputRange: [0, 1],
      outputRange: ['-90deg', '0deg'],
    });

    return (
      <View style={styles.fullScreen}>
        <Animated.View
          style={[
            styles.successContainer,
            {
              opacity: successOpacity,
              transform: [{ scale: successScale }],
            },
          ]}
        >
          <View style={styles.successIconRing}>
            <Animated.View style={{ transform: [{ rotate: rotateInterpolate }] }}>
              <Ionicons name="checkmark" size={44} color={Colors.semantic.success} />
            </Animated.View>
          </View>
          <AspireLogo size="small" />
          <Text style={styles.successTitle}>Document Signed</Text>
          <Text style={styles.successBody}>
            {session?.document_name ? `"${session.document_name}" has been signed successfully.` : 'Your document has been signed successfully.'}
            {'\n'}You may close this window.
          </Text>
          <View style={styles.successBadge}>
            <Text style={styles.successBadgeText}>SECURED BY ASPIRE</Text>
          </View>
        </Animated.View>
      </View>
    );
  }

  // ── Active Signing State ───────────────────────────────────────────────────

  const pandadocUrl = session?.pandadoc_session_id
    ? `${PANDADOC_SESSION_BASE}${session.pandadoc_session_id}`
    : null;

  return (
    <Animated.View
      style={[
        styles.fullScreen,
        { opacity: fadeIn, transform: [{ translateY: slideUp }] },
      ]}
    >
      {isMobile ? (
        <MobileLayout
          session={session}
          pandadocUrl={pandadocUrl}
        />
      ) : (
        <DesktopLayout
          session={session}
          pandadocUrl={pandadocUrl}
        />
      )}

      {/* Acquisition Popup Overlay */}
      {showAcquisition && (
        <AcquisitionPopup
          isMobile={isMobile}
          modalScale={modalScale}
          modalOpacity={modalOpacity}
          overlayOpacity={overlayOpacity}
          onDismiss={dismissAcquisition}
          documentName={session?.document_name}
        />
      )}
    </Animated.View>
  );
}

// ── Loading State ────────────────────────────────────────────────────────────

function LoadingState() {
  const pulse = useRef(new Animated.Value(0.4)).current;

  useEffect(() => {
    const anim = Animated.loop(
      Animated.sequence([
        Animated.timing(pulse, { toValue: 1, duration: 1200, useNativeDriver: true }),
        Animated.timing(pulse, { toValue: 0.4, duration: 1200, useNativeDriver: true }),
      ])
    );
    anim.start();
    return () => anim.stop();
  }, [pulse]);

  return (
    <View style={styles.loadingContainer}>
      <Animated.View style={{ opacity: pulse }}>
        <AspireLogo size="large" />
      </Animated.View>
      <View style={styles.loadingDots}>
        <ActivityIndicator size="small" color={Colors.accent.cyan} />
      </View>
      <Text style={styles.loadingText}>Preparing your document</Text>
    </View>
  );
}

// ── Status Screen (Expired / Error) ──────────────────────────────────────────

interface StatusScreenProps {
  icon: string;
  iconColor: string;
  title: string;
  body: string;
  actionLabel?: string;
  onAction?: () => void;
  isMobile: boolean;
}

function StatusScreen({ icon, iconColor, title, body, actionLabel, onAction, isMobile }: StatusScreenProps) {
  return (
    <View style={styles.statusContainer}>
      <View style={styles.statusContent}>
        <AspireLogo size="small" />
        <View style={[styles.statusIconRing, { borderColor: iconColor }]}>
          <Ionicons name={icon as any} size={32} color={iconColor} />
        </View>
        <Text style={[styles.statusTitle, isMobile && styles.statusTitleMobile]}>{title}</Text>
        <Text style={[styles.statusBody, isMobile && styles.statusBodyMobile]}>{body}</Text>
        {actionLabel && onAction && (
          <Pressable
            style={({ pressed }) => [styles.retryButton, pressed && styles.retryButtonPressed]}
            onPress={onAction}
            accessibilityRole="button"
            accessibilityLabel={actionLabel}
          >
            <Ionicons name="refresh-outline" size={16} color={Colors.accent.cyan} style={{ marginRight: 6 }} />
            <Text style={styles.retryButtonText}>{actionLabel}</Text>
          </Pressable>
        )}
      </View>
      <PoweredByBadge />
    </View>
  );
}

// ── Desktop Layout ───────────────────────────────────────────────────────────

interface LayoutProps {
  session: SigningSession | null;
  pandadocUrl: string | null;
}

function DesktopLayout({ session, pandadocUrl }: LayoutProps) {
  return (
    <View style={styles.desktopContainer}>
      {/* Left Info Sidebar */}
      <View style={styles.desktopSidebar}>
        <View style={styles.sidebarInner}>
          <AspireLogo size="medium" />

          <View style={styles.sidebarDivider} />

          {/* Document Info */}
          <View style={styles.sidebarSection}>
            <Text style={styles.sidebarLabel}>DOCUMENT</Text>
            <Text style={styles.sidebarDocName}>{session?.document_name || 'Document'}</Text>
          </View>

          {session?.signer_name ? (
            <View style={styles.sidebarSection}>
              <Text style={styles.sidebarLabel}>PREPARED FOR</Text>
              <Text style={styles.sidebarSignerName}>{session.signer_name}</Text>
            </View>
          ) : null}

          {session?.expires_at ? (
            <View style={styles.sidebarSection}>
              <Text style={styles.sidebarLabel}>EXPIRES</Text>
              <Text style={styles.sidebarExpiry}>{formatExpiry(session.expires_at)}</Text>
            </View>
          ) : null}

          <View style={styles.sidebarSpacer} />

          {/* Sent via Aspire badge */}
          <View style={styles.sentViaBadge}>
            <Ionicons name="shield-checkmark-outline" size={14} color={Colors.accent.cyan} />
            <Text style={styles.sentViaText}>Sent via Aspire</Text>
          </View>
        </View>
      </View>

      {/* Main Document Area */}
      <View style={styles.desktopMain}>
        <View style={styles.documentFrame}>
          {pandadocUrl ? (
            <DocumentIframe url={pandadocUrl} />
          ) : (
            <DocumentPlaceholder documentName={session?.document_name} />
          )}
        </View>
      </View>
    </View>
  );
}

// ── Mobile Layout ────────────────────────────────────────────────────────────

function MobileLayout({ session, pandadocUrl }: LayoutProps) {
  return (
    <View style={styles.mobileContainer}>
      {/* Top Header */}
      <View style={styles.mobileHeader}>
        <AspireLogo size="small" />
        <View style={styles.mobileHeaderInfo}>
          <Text style={styles.mobileDocName} numberOfLines={1}>
            {session?.document_name || 'Document'}
          </Text>
          {session?.signer_name ? (
            <Text style={styles.mobileSignerName} numberOfLines={1}>
              for {session.signer_name}
            </Text>
          ) : null}
        </View>
        <View style={styles.mobileShieldBadge}>
          <Ionicons name="shield-checkmark-outline" size={16} color={Colors.accent.cyan} />
        </View>
      </View>

      {/* Document Area */}
      <View style={styles.mobileDocumentArea}>
        {pandadocUrl ? (
          <DocumentIframe url={pandadocUrl} />
        ) : (
          <DocumentPlaceholder documentName={session?.document_name} />
        )}
      </View>

      {/* Bottom Bar */}
      <View style={styles.mobileBottomBar}>
        <PoweredByBadge />
      </View>
    </View>
  );
}

// ── Document Iframe (Web) / Placeholder ──────────────────────────────────────

function DocumentIframe({ url }: { url: string }) {
  if (Platform.OS !== 'web') {
    // On native, use WebView
    const WebView = require('react-native-webview').default;
    return (
      <WebView
        source={{ uri: url }}
        style={styles.webview}
        startInLoadingState
        renderLoading={() => (
          <View style={styles.iframeLoading}>
            <ActivityIndicator size="large" color={Colors.accent.cyan} />
          </View>
        )}
        javaScriptEnabled
        domStorageEnabled
        allowsInlineMediaPlayback
        accessibilityLabel="Document signing view"
      />
    );
  }

  // Web: render as iframe
  return (
    <View style={styles.iframeContainer}>
      <iframe
        src={url}
        style={{
          width: '100%',
          height: '100%',
          border: 'none',
          borderRadius: 4,
          backgroundColor: '#ffffff',
        }}
        title="Sign Document"
        allow="camera; microphone"
        sandbox="allow-scripts allow-same-origin allow-forms allow-popups allow-popups-to-escape-sandbox"
      />
    </View>
  );
}

function DocumentPlaceholder({ documentName }: { documentName?: string }) {
  return (
    <View style={styles.placeholderContainer}>
      <View style={styles.placeholderInner}>
        <Ionicons name="document-text-outline" size={48} color={Colors.text.muted} />
        <Text style={styles.placeholderTitle}>{documentName || 'Document'}</Text>
        <Text style={styles.placeholderBody}>
          The signing session is being prepared. The document will appear here momentarily.
        </Text>
        <ActivityIndicator size="small" color={Colors.accent.cyan} style={{ marginTop: Spacing.lg }} />
      </View>
    </View>
  );
}

// ── Acquisition Popup ────────────────────────────────────────────────────────

interface AcquisitionPopupProps {
  isMobile: boolean;
  modalScale: Animated.Value;
  modalOpacity: Animated.Value;
  overlayOpacity: Animated.Value;
  onDismiss: () => void;
  documentName?: string;
}

function AcquisitionPopup({
  isMobile,
  modalScale,
  modalOpacity,
  overlayOpacity,
  onDismiss,
  documentName,
}: AcquisitionPopupProps) {
  const handleLearnMore = () => {
    if (Platform.OS === 'web') {
      window.open('https://www.aspireos.app/about', '_blank', 'noopener,noreferrer');
    }
    onDismiss();
  };

  // Mobile: bottom sheet style
  if (isMobile) {
    return (
      <View style={styles.overlayContainer}>
        <Animated.View
          style={[styles.overlayBackdrop, { opacity: overlayOpacity }]}
        >
          <Pressable style={styles.overlayTouchable} onPress={onDismiss} accessibilityRole="button" accessibilityLabel="Dismiss" />
        </Animated.View>
        <Animated.View
          style={[
            styles.bottomSheet,
            {
              opacity: modalOpacity,
              transform: [{
                translateY: modalOpacity.interpolate({
                  inputRange: [0, 1],
                  outputRange: [120, 0],
                }),
              }],
            },
          ]}
        >
          <View style={styles.bottomSheetHandle} />
          <AcquisitionContent
            isMobile
            documentName={documentName}
            onLearnMore={handleLearnMore}
            onDismiss={onDismiss}
          />
        </Animated.View>
      </View>
    );
  }

  // Desktop: centered modal
  return (
    <View style={styles.overlayContainer}>
      <Animated.View
        style={[
          styles.overlayBackdrop,
          { opacity: overlayOpacity },
          Platform.OS === 'web' ? ({ backdropFilter: 'blur(12px)', WebkitBackdropFilter: 'blur(12px)' } as ViewStyle) : {},
        ]}
      >
        <Pressable style={styles.overlayTouchable} onPress={onDismiss} accessibilityRole="button" accessibilityLabel="Dismiss" />
      </Animated.View>
      <Animated.View
        style={[
          styles.modalContainer,
          {
            opacity: modalOpacity,
            transform: [{ scale: modalScale }],
          },
        ]}
      >
        <AcquisitionContent
          isMobile={false}
          documentName={documentName}
          onLearnMore={handleLearnMore}
          onDismiss={onDismiss}
        />
      </Animated.View>
    </View>
  );
}

// ── Acquisition Content ──────────────────────────────────────────────────────

interface AcquisitionContentProps {
  isMobile: boolean;
  documentName?: string;
  onLearnMore: () => void;
  onDismiss: () => void;
}

function AcquisitionContent({ isMobile, documentName, onLearnMore, onDismiss }: AcquisitionContentProps) {
  return (
    <View style={[styles.acquisitionInner, isMobile && styles.acquisitionInnerMobile]}>
      {/* Success confirmation */}
      <View style={styles.acquisitionCheckRow}>
        <View style={styles.acquisitionCheckIcon}>
          <Ionicons name="checkmark-circle" size={22} color={Colors.semantic.success} />
        </View>
        <Text style={styles.acquisitionCheckText}>
          {documentName ? `"${documentName}" signed successfully` : 'Document signed successfully'}
        </Text>
      </View>

      <View style={styles.acquisitionDivider} />

      {/* Aspire branding */}
      <AspireLogo size="medium" />

      <Text style={[styles.acquisitionHeadline, isMobile && styles.acquisitionHeadlineMobile]}>
        Meet Aspire
      </Text>
      <Text style={styles.acquisitionSubheadline}>
        Your AI-Powered Virtual Office
      </Text>

      <Text style={[styles.acquisitionBody, isMobile && styles.acquisitionBodyMobile]}>
        The document you just signed was managed by Aspire — an AI-powered virtual office with a specialized AI staff that handles contracts, invoices, scheduling, and more for small businesses.
      </Text>

      {/* Feature pills */}
      <View style={styles.featurePills}>
        {['Contracts', 'Invoicing', 'Scheduling', 'Front Desk'].map((feature) => (
          <View key={feature} style={styles.featurePill}>
            <Text style={styles.featurePillText}>{feature}</Text>
          </View>
        ))}
      </View>

      {/* CTAs */}
      <Pressable
        style={({ pressed }) => [
          styles.ctaPrimary,
          pressed && styles.ctaPrimaryPressed,
          isMobile && styles.ctaPrimaryMobile,
        ]}
        onPress={onLearnMore}
        accessibilityRole="link"
        accessibilityLabel="Learn more about Aspire"
      >
        <Text style={styles.ctaPrimaryText}>Learn More</Text>
        <Ionicons name="arrow-forward" size={16} color="#ffffff" style={{ marginLeft: 6 }} />
      </Pressable>

      <Pressable
        style={({ pressed }) => [
          styles.ctaSecondary,
          pressed && styles.ctaSecondaryPressed,
          isMobile && styles.ctaSecondaryMobile,
        ]}
        onPress={onDismiss}
        accessibilityRole="button"
        accessibilityLabel="No thanks, dismiss"
      >
        <Text style={styles.ctaSecondaryText}>No thanks</Text>
      </Pressable>
    </View>
  );
}

// ── Aspire Logo Component ────────────────────────────────────────────────────

function AspireLogo({ size }: { size: 'small' | 'medium' | 'large' }) {
  const dimensions = {
    small: { width: 28, height: 28 },
    medium: { width: 36, height: 36 },
    large: { width: 52, height: 52 },
  };
  const dim = dimensions[size];

  return (
    <View style={styles.logoContainer}>
      <Image
        source={require('../../assets/images/aspire-icon-new.png')}
        style={[styles.logoImage, { width: dim.width, height: dim.height }]}
        resizeMode="contain"
        accessibilityLabel="Aspire"
      />
      {size !== 'small' && (
        <Text style={[styles.logoText, size === 'large' && styles.logoTextLarge]}>
          Aspire
        </Text>
      )}
    </View>
  );
}

// ── Powered By Badge ─────────────────────────────────────────────────────────

function PoweredByBadge() {
  return (
    <View style={styles.poweredBy}>
      <Text style={styles.poweredByText}>Secured by</Text>
      <Image
        source={require('../../assets/images/aspire-icon-new.png')}
        style={styles.poweredByIcon}
        resizeMode="contain"
      />
      <Text style={styles.poweredByBrand}>Aspire</Text>
    </View>
  );
}

// ── Utility ──────────────────────────────────────────────────────────────────

function formatExpiry(isoString: string): string {
  try {
    const date = new Date(isoString);
    const now = new Date();
    const diffMs = date.getTime() - now.getTime();

    if (diffMs < 0) return 'Expired';

    const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
    const diffDays = Math.floor(diffHours / 24);

    if (diffDays > 0) return `${diffDays} day${diffDays > 1 ? 's' : ''} remaining`;
    if (diffHours > 0) return `${diffHours} hour${diffHours > 1 ? 's' : ''} remaining`;

    const diffMinutes = Math.floor(diffMs / (1000 * 60));
    return `${diffMinutes} minute${diffMinutes !== 1 ? 's' : ''} remaining`;
  } catch (_e) {
    return '';
  }
}

// ── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  fullScreen: {
    flex: 1,
    backgroundColor: SignColors.canvas,
  },

  // ── Loading ──
  loadingContainer: {
    flex: 1,
    backgroundColor: SignColors.canvas,
    alignItems: 'center',
    justifyContent: 'center',
  },
  loadingDots: {
    marginTop: Spacing.xl,
  },
  loadingText: {
    marginTop: Spacing.md,
    ...Typography.caption,
    color: Colors.text.muted,
    letterSpacing: 0.5,
  },

  // ── Status Screens (Expired / Error) ──
  statusContainer: {
    flex: 1,
    backgroundColor: SignColors.canvas,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: Spacing.xxl,
  },
  statusContent: {
    alignItems: 'center',
    maxWidth: 420,
  },
  statusIconRing: {
    width: 72,
    height: 72,
    borderRadius: 36,
    borderWidth: 2,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: Spacing.xxxl,
    marginBottom: Spacing.xxl,
  },
  statusTitle: {
    ...Typography.title,
    color: Colors.text.primary,
    textAlign: 'center',
    marginBottom: Spacing.md,
  },
  statusTitleMobile: {
    fontSize: 20,
    lineHeight: 26,
  },
  statusBody: {
    ...Typography.body,
    color: Colors.text.secondary,
    textAlign: 'center',
    lineHeight: 24,
    marginBottom: Spacing.xxl,
  },
  statusBodyMobile: {
    fontSize: 14,
    lineHeight: 21,
  },
  retryButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: Spacing.md,
    paddingHorizontal: Spacing.xl,
    borderRadius: BorderRadius.lg,
    borderWidth: 1,
    borderColor: Colors.accent.cyan,
    backgroundColor: Colors.accent.cyanLight,
    minHeight: 44,
  },
  retryButtonPressed: {
    opacity: 0.7,
  },
  retryButtonText: {
    ...Typography.captionMedium,
    color: Colors.accent.cyan,
  },

  // ── Success ──
  successContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: Spacing.xxl,
  },
  successIconRing: {
    width: 80,
    height: 80,
    borderRadius: 40,
    borderWidth: 2,
    borderColor: SignColors.successBorder,
    backgroundColor: SignColors.successGlow,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: Spacing.xxl,
  },
  successTitle: {
    ...Typography.title,
    color: Colors.text.primary,
    textAlign: 'center',
    marginTop: Spacing.xl,
    marginBottom: Spacing.md,
  },
  successBody: {
    ...Typography.body,
    color: Colors.text.secondary,
    textAlign: 'center',
    lineHeight: 24,
    maxWidth: 380,
  },
  successBadge: {
    marginTop: Spacing.xxxl,
    paddingVertical: Spacing.sm,
    paddingHorizontal: Spacing.lg,
    borderRadius: BorderRadius.full,
    backgroundColor: SignColors.badgeBg,
    borderWidth: 1,
    borderColor: SignColors.badgeBorder,
  },
  successBadgeText: {
    ...Typography.micro,
    color: Colors.accent.cyan,
    letterSpacing: 1.5,
  },

  // ── Desktop Layout ──
  desktopContainer: {
    flex: 1,
    flexDirection: 'row',
  },
  desktopSidebar: {
    width: 280,
    backgroundColor: SignColors.sidebar,
    borderRightWidth: 1,
    borderRightColor: SignColors.sidebarBorder,
  },
  sidebarInner: {
    flex: 1,
    paddingHorizontal: Spacing.xxl,
    paddingTop: 48,
    paddingBottom: Spacing.xxl,
  },
  sidebarDivider: {
    height: 1,
    backgroundColor: SignColors.sidebarBorder,
    marginTop: Spacing.xxl,
    marginBottom: Spacing.xxl,
  },
  sidebarSection: {
    marginBottom: Spacing.xl,
  },
  sidebarLabel: {
    ...Typography.micro,
    color: Colors.text.muted,
    letterSpacing: 1.8,
    marginBottom: Spacing.sm,
  },
  sidebarDocName: {
    ...Typography.headline,
    color: Colors.text.primary,
    lineHeight: 24,
  },
  sidebarSignerName: {
    ...Typography.captionMedium,
    color: Colors.text.secondary,
  },
  sidebarExpiry: {
    ...Typography.caption,
    color: Colors.text.tertiary,
  },
  sidebarSpacer: {
    flex: 1,
  },
  sentViaBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: Spacing.sm,
    paddingHorizontal: Spacing.md,
    borderRadius: BorderRadius.md,
    backgroundColor: SignColors.badgeBg,
    borderWidth: 1,
    borderColor: SignColors.badgeBorder,
    alignSelf: 'flex-start',
  },
  sentViaText: {
    ...Typography.small,
    color: Colors.accent.cyan,
    marginLeft: Spacing.sm,
    letterSpacing: 0.3,
  },

  // ── Desktop Main ──
  desktopMain: {
    flex: 1,
    padding: 32,
    backgroundColor: SignColors.canvas,
  },
  documentFrame: {
    flex: 1,
    borderRadius: BorderRadius.lg,
    borderWidth: 1,
    borderColor: SignColors.documentBorder,
    overflow: 'hidden',
    ...Platform.select({
      web: {
        boxShadow: `0 0 60px ${SignColors.documentGlow}, 0 2px 8px rgba(0,0,0,0.4)`,
      } as ViewStyle,
      default: Shadows.lg,
    }),
  },

  // ── Mobile Layout ──
  mobileContainer: {
    flex: 1,
    backgroundColor: SignColors.canvas,
  },
  mobileHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.md,
    backgroundColor: SignColors.sidebar,
    borderBottomWidth: 1,
    borderBottomColor: SignColors.sidebarBorder,
    minHeight: 56,
  },
  mobileHeaderInfo: {
    flex: 1,
    marginLeft: Spacing.md,
  },
  mobileDocName: {
    ...Typography.captionMedium,
    color: Colors.text.primary,
  },
  mobileSignerName: {
    ...Typography.small,
    color: Colors.text.tertiary,
    marginTop: 2,
  },
  mobileShieldBadge: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: SignColors.badgeBg,
    alignItems: 'center',
    justifyContent: 'center',
  },
  mobileDocumentArea: {
    flex: 1,
  },
  mobileBottomBar: {
    paddingVertical: Spacing.sm,
    paddingHorizontal: Spacing.lg,
    backgroundColor: SignColors.sidebar,
    borderTopWidth: 1,
    borderTopColor: SignColors.sidebarBorder,
    alignItems: 'center',
  },

  // ── Iframe / WebView ──
  iframeContainer: {
    flex: 1,
    backgroundColor: '#ffffff',
  },
  webview: {
    flex: 1,
    backgroundColor: '#ffffff',
  },
  iframeLoading: {
    ...StyleSheet.absoluteFillObject,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#ffffff',
  },

  // ── Placeholder ──
  placeholderContainer: {
    flex: 1,
    backgroundColor: '#fafafa',
    alignItems: 'center',
    justifyContent: 'center',
  },
  placeholderInner: {
    alignItems: 'center',
    padding: Spacing.xxxl,
    maxWidth: 340,
  },
  placeholderTitle: {
    ...Typography.headline,
    color: '#1a1a1a',
    textAlign: 'center',
    marginTop: Spacing.xl,
    marginBottom: Spacing.md,
  },
  placeholderBody: {
    ...Typography.caption,
    color: '#666666',
    textAlign: 'center',
    lineHeight: 20,
  },

  // ── Overlay / Modal ──
  overlayContainer: {
    ...StyleSheet.absoluteFillObject,
    zIndex: 100,
    alignItems: 'center',
    justifyContent: 'center',
  },
  overlayBackdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: SignColors.overlayBg,
  },
  overlayTouchable: {
    flex: 1,
  },

  // ── Desktop Modal ──
  modalContainer: {
    position: 'absolute',
    width: 480,
    maxWidth: '92%' as any,
    backgroundColor: SignColors.modalBg,
    borderRadius: BorderRadius.xl,
    borderWidth: 1,
    borderColor: SignColors.modalBorder,
    overflow: 'hidden',
    ...Platform.select({
      web: {
        boxShadow: '0 24px 80px rgba(0,0,0,0.6), 0 0 1px rgba(255,255,255,0.05)',
      } as ViewStyle,
      default: Shadows.lg,
    }),
  },

  // ── Bottom Sheet (Mobile) ──
  bottomSheet: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: SignColors.modalBg,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    borderWidth: 1,
    borderBottomWidth: 0,
    borderColor: SignColors.modalBorder,
    ...Platform.select({
      web: {
        boxShadow: '0 -8px 40px rgba(0,0,0,0.5)',
      } as ViewStyle,
      default: Shadows.lg,
    }),
  },
  bottomSheetHandle: {
    width: 36,
    height: 4,
    borderRadius: 2,
    backgroundColor: Colors.border.strong,
    alignSelf: 'center',
    marginTop: Spacing.md,
    marginBottom: Spacing.sm,
  },

  // ── Acquisition Content ──
  acquisitionInner: {
    paddingHorizontal: 36,
    paddingTop: 28,
    paddingBottom: 32,
    alignItems: 'center',
  },
  acquisitionInnerMobile: {
    paddingHorizontal: Spacing.xxl,
    paddingTop: Spacing.xl,
    paddingBottom: 36,
  },
  acquisitionCheckRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: Spacing.lg,
  },
  acquisitionCheckIcon: {
    marginRight: Spacing.sm,
  },
  acquisitionCheckText: {
    ...Typography.captionMedium,
    color: Colors.semantic.success,
    flexShrink: 1,
  },
  acquisitionDivider: {
    width: '100%' as any,
    height: 1,
    backgroundColor: SignColors.modalBorder,
    marginBottom: Spacing.xxl,
  },
  acquisitionHeadline: {
    fontSize: 26,
    fontWeight: '700',
    color: Colors.text.primary,
    textAlign: 'center',
    marginTop: Spacing.xl,
    letterSpacing: -0.3,
  },
  acquisitionHeadlineMobile: {
    fontSize: 22,
  },
  acquisitionSubheadline: {
    ...Typography.captionMedium,
    color: Colors.accent.cyan,
    textAlign: 'center',
    marginTop: Spacing.xs,
    letterSpacing: 0.5,
  },
  acquisitionBody: {
    ...Typography.caption,
    color: Colors.text.secondary,
    textAlign: 'center',
    lineHeight: 22,
    marginTop: Spacing.lg,
    maxWidth: 380,
  },
  acquisitionBodyMobile: {
    fontSize: 13,
    lineHeight: 20,
  },

  // ── Feature Pills ──
  featurePills: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'center',
    marginTop: Spacing.xl,
    marginBottom: Spacing.xxl,
    gap: Spacing.sm,
  },
  featurePill: {
    paddingVertical: Spacing.xs,
    paddingHorizontal: Spacing.md,
    borderRadius: BorderRadius.full,
    backgroundColor: SignColors.badgeBg,
    borderWidth: 1,
    borderColor: SignColors.badgeBorder,
  },
  featurePillText: {
    ...Typography.small,
    color: Colors.accent.cyan,
    letterSpacing: 0.2,
  },

  // ── CTAs ──
  ctaPrimary: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 14,
    paddingHorizontal: Spacing.xxl,
    borderRadius: BorderRadius.lg,
    backgroundColor: Colors.accent.cyan,
    minHeight: 48,
    minWidth: 200,
  },
  ctaPrimaryPressed: {
    backgroundColor: Colors.accent.cyanDark,
  },
  ctaPrimaryMobile: {
    alignSelf: 'stretch',
  },
  ctaPrimaryText: {
    ...Typography.bodyMedium,
    color: '#ffffff',
    letterSpacing: 0.2,
  },
  ctaSecondary: {
    paddingVertical: Spacing.md,
    paddingHorizontal: Spacing.xl,
    marginTop: Spacing.md,
    minHeight: 44,
    alignItems: 'center',
    justifyContent: 'center',
  },
  ctaSecondaryPressed: {
    opacity: 0.6,
  },
  ctaSecondaryMobile: {
    alignSelf: 'stretch',
  },
  ctaSecondaryText: {
    ...Typography.captionMedium,
    color: Colors.text.muted,
  },

  // ── Logo ──
  logoContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  logoImage: {
    borderRadius: 6,
  },
  logoText: {
    ...Typography.headline,
    color: Colors.text.primary,
    marginLeft: Spacing.md,
    letterSpacing: -0.3,
  },
  logoTextLarge: {
    fontSize: 24,
    fontWeight: '700',
  },

  // ── Powered By ──
  poweredBy: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: Spacing.xs,
  },
  poweredByText: {
    ...Typography.small,
    color: Colors.text.muted,
    letterSpacing: 0.3,
  },
  poweredByIcon: {
    width: 14,
    height: 14,
    marginLeft: Spacing.sm,
    marginRight: 4,
    borderRadius: 3,
  },
  poweredByBrand: {
    ...Typography.smallMedium,
    color: Colors.text.tertiary,
    letterSpacing: 0.2,
  },
});
