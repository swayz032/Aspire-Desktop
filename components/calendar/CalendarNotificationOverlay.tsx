import React, { useEffect, useRef, useState } from 'react';
import { PageErrorBoundary } from '@/components/PageErrorBoundary';
import {
  Animated,
  ImageBackground,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  View,
  type ViewStyle,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import {
  approveCalendarEvent,
  dismissCalendarNotification,
  getCalendarNotificationState,
  subscribeCalendarNotification,
  type CalendarNotificationState,
} from '@/lib/calendarNotificationStore';

/* ─── Calendar hero image ─── */
// eslint-disable-next-line @typescript-eslint/no-var-requires
const calendarHero = require('@/assets/images/calendar-hero.jpg');

/* ─── Notification Chime (served from public/ via express.static) ─── */
const CHIME_URL = '/audio/calendar-notification.wav';
const CHIME_DURATION_MS = 5_000;
let _chimeAudio: HTMLAudioElement | null = null;
let _chimeUnlocked = false;
let _chimeCtx: AudioContext | null = null;
let _chimeTimeout: ReturnType<typeof setTimeout> | null = null;

/**
 * Safari/WebKit autoplay policy unlock — identical strategy to
 * IncomingVideoCallOverlay. On ANY user gesture, silently unlock both
 * the HTML5 Audio element AND a Web AudioContext.
 */
const UNLOCK_EVENTS = ['click', 'touchstart', 'keydown', 'scroll'] as const;

function unlockChimeAudio(): void {
  if (_chimeUnlocked) return;

  const SILENT_WAV =
    'data:audio/wav;base64,UklGRiQAAABXQVZFZm10IBAAAAABAAEARKwAAIhYAQACABAAZGF0YQAAAAA=';
  const silentAudio = new Audio(SILENT_WAV);

  const htmlUnlock = silentAudio
    .play()
    .then(() => {
      silentAudio.pause();
      if (!_chimeAudio) {
        _chimeAudio = new Audio(CHIME_URL);
        _chimeAudio.loop = false;
        _chimeAudio.preload = 'auto';
        _chimeAudio.volume = 0.6;
      }
      return true;
    })
    .catch(() => false);

  let ctxUnlock = Promise.resolve(false);
  try {
    if (!_chimeCtx) {
      const AC = window.AudioContext || (window as any).webkitAudioContext;
      if (AC) _chimeCtx = new AC();
    }
    if (_chimeCtx?.state === 'suspended') {
      ctxUnlock = _chimeCtx
        .resume()
        .then(() => true)
        .catch(() => false);
    } else if (_chimeCtx?.state === 'running') {
      ctxUnlock = Promise.resolve(true);
    }
  } catch {
    /* AudioContext not available */
  }

  Promise.all([htmlUnlock, ctxUnlock]).then(([html, ctx]) => {
    if (html || ctx) {
      _chimeUnlocked = true;
      for (const evt of UNLOCK_EVENTS) {
        document.removeEventListener(evt, unlockChimeAudio, true);
      }
    }
  });
}

// Self-invoke at module load
if (Platform.OS === 'web' && typeof document !== 'undefined') {
  for (const evt of UNLOCK_EVENTS) {
    document.addEventListener(evt, unlockChimeAudio, {
      capture: true,
      passive: true,
    });
  }
}

function startChime(): void {
  if (Platform.OS !== 'web' || typeof window === 'undefined') return;
  try {
    if (!_chimeAudio) {
      _chimeAudio = new Audio(CHIME_URL);
      _chimeAudio.loop = false;
      _chimeAudio.volume = 0.6;
    }
    _chimeAudio.currentTime = 0;
    _chimeAudio.play().catch(() => {});

    // Stop after CHIME_DURATION_MS
    if (_chimeTimeout) clearTimeout(_chimeTimeout);
    _chimeTimeout = setTimeout(() => {
      stopChime();
    }, CHIME_DURATION_MS);
  } catch {
    /* no-op */
  }
}

function stopChime(): void {
  if (_chimeTimeout) {
    clearTimeout(_chimeTimeout);
    _chimeTimeout = null;
  }
  if (_chimeAudio) {
    _chimeAudio.pause();
    _chimeAudio.currentTime = 0;
  }
}

/* ─── Browser Notification ─── */
let notificationPermissionRequested = false;

function requestNotificationPermission(): void {
  if (
    Platform.OS !== 'web' ||
    typeof Notification === 'undefined' ||
    notificationPermissionRequested
  )
    return;
  notificationPermissionRequested = true;
  if (Notification.permission === 'default') {
    Notification.requestPermission().catch(() => {});
  }
}

function showBrowserNotification(
  title: string,
  mode: 'approval' | 'reminder',
): void {
  if (Platform.OS !== 'web' || typeof document === 'undefined') return;
  if (!document.hidden) return;
  if (
    typeof Notification === 'undefined' ||
    Notification.permission !== 'granted'
  )
    return;

  try {
    const body =
      mode === 'approval'
        ? `Ava wants to add "${title}" to your calendar`
        : `Upcoming: ${title} starts in 30 minutes`;
    new Notification(
      mode === 'approval' ? 'Calendar Event' : 'Upcoming Event',
      {
        body,
        icon: '/favicon.ico',
        requireInteraction: false,
        tag: 'aspire-calendar-notification',
      },
    );
  } catch {
    // no-op
  }
}

/* ─── Detail Row ─── */
function EventDetailRow({
  label,
  value,
  icon,
  isLast,
}: {
  label: string;
  value: string;
  icon: keyof typeof Ionicons.glyphMap;
  isLast: boolean;
}): React.ReactElement {
  return (
    <View style={[styles.detailRow, !isLast && styles.detailRowBorder]}>
      <View style={styles.detailIconWrap}>
        <Ionicons
          name={icon}
          size={14}
          color="rgba(59,130,246,0.6)"
        />
      </View>
      <Text style={styles.detailLabel}>{label}</Text>
      <Text style={styles.detailValue} numberOfLines={1}>
        {value}
      </Text>
    </View>
  );
}

/* ─── Time Formatting ─── */
function formatEventTime(isoString: string): string {
  try {
    const date = new Date(isoString);
    return date.toLocaleTimeString([], {
      hour: '2-digit',
      minute: '2-digit',
    });
  } catch {
    return isoString;
  }
}

function formatEventDate(isoString: string): string {
  try {
    const date = new Date(isoString);
    const today = new Date();
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);

    if (date.toDateString() === today.toDateString()) return 'Today';
    if (date.toDateString() === tomorrow.toDateString()) return 'Tomorrow';

    return date.toLocaleDateString([], {
      weekday: 'short',
      month: 'short',
      day: 'numeric',
    });
  } catch {
    return isoString;
  }
}

/* ─── Component ─── */
function CalendarNotificationOverlayInner(): React.ReactElement | null {
  const [overlayState, setOverlayState] = useState<CalendarNotificationState>(
    getCalendarNotificationState(),
  );

  /* Animation values */
  const cardScale = useRef(new Animated.Value(0.92)).current;
  const cardOpacity = useRef(new Animated.Value(0)).current;
  const backdropOpacity = useRef(new Animated.Value(0)).current;

  /* Request notification permission on first mount */
  useEffect(() => {
    requestNotificationPermission();
  }, []);

  /* Subscribe to store */
  useEffect(() => {
    const unsubscribe = subscribeCalendarNotification(setOverlayState);
    return unsubscribe;
  }, []);

  /* Animations + chime + browser notification */
  useEffect(() => {
    if (!overlayState.visible) {
      Animated.parallel([
        Animated.timing(cardOpacity, {
          toValue: 0,
          duration: 150,
          useNativeDriver: false,
        }),
        Animated.timing(backdropOpacity, {
          toValue: 0,
          duration: 150,
          useNativeDriver: false,
        }),
        Animated.timing(cardScale, {
          toValue: 0.95,
          duration: 150,
          useNativeDriver: false,
        }),
      ]).start();
      return;
    }

    Animated.parallel([
      Animated.timing(backdropOpacity, {
        toValue: 1,
        duration: 200,
        useNativeDriver: false,
      }),
      Animated.spring(cardScale, {
        toValue: 1,
        damping: 16,
        stiffness: 220,
        mass: 0.9,
        useNativeDriver: false,
      }),
      Animated.timing(cardOpacity, {
        toValue: 1,
        duration: 200,
        useNativeDriver: false,
      }),
    ]).start();

    /* Chime — gentle 5-second notification sound */
    startChime();

    /* Browser notification for away users */
    if (overlayState.event && overlayState.mode) {
      showBrowserNotification(overlayState.event.title, overlayState.mode);
    }

    return () => {
      stopChime();
    };
  }, [overlayState.visible]);

  /* ─── Gate ─── */
  if (!overlayState.visible || !overlayState.event || !overlayState.mode)
    return null;

  const { event, mode } = overlayState;
  const isApproval = mode === 'approval';

  const labelText = isApproval ? 'CALENDAR EVENT' : 'UPCOMING EVENT';
  const subtitleText = isApproval
    ? `${formatEventDate(event.startTime)} at ${formatEventTime(event.startTime)}`
    : `Starts in 30 minutes`;

  // Build event details
  const eventDetails: {
    label: string;
    value: string;
    icon: keyof typeof Ionicons.glyphMap;
  }[] = [];
  eventDetails.push({
    label: 'Date',
    value: formatEventDate(event.startTime),
    icon: 'calendar-outline',
  });
  eventDetails.push({
    label: 'Time',
    value: formatEventTime(event.startTime),
    icon: 'time-outline',
  });
  if (event.duration) {
    eventDetails.push({
      label: 'Duration',
      value: event.duration,
      icon: 'hourglass-outline',
    });
  }
  if (event.location) {
    eventDetails.push({
      label: 'Location',
      value: event.location,
      icon: 'location-outline',
    });
  }
  if (event.eventType) {
    eventDetails.push({
      label: 'Type',
      value: event.eventType,
      icon: 'pricetag-outline',
    });
  }

  /* ─── Handlers ─── */
  const handleDismiss = (): void => {
    dismissCalendarNotification();
  };

  const handleApprove = (): void => {
    approveCalendarEvent();
  };

  /* ─── Render ─── */
  return (
    <View
      pointerEvents="box-none"
      style={styles.root}
      accessibilityRole="alert"
      accessibilityLabel={
        isApproval
          ? 'Calendar event approval required'
          : 'Upcoming calendar event reminder'
      }
    >
      {/* Backdrop */}
      <Animated.View style={[styles.backdrop, { opacity: backdropOpacity }]} />

      {/* Card — landscape orientation */}
      <Animated.View
        style={[
          styles.card,
          { opacity: cardOpacity, transform: [{ scale: cardScale }] },
        ]}
      >
        {/* Hero image — taller for landscape */}
        <View style={styles.heroContainer}>
          <ImageBackground
            source={calendarHero}
            style={styles.heroImage}
            resizeMode="cover"
            accessibilityLabel="Calendar event landscape"
          >
            <LinearGradient
              colors={['transparent', 'rgba(30,30,30,0.6)', CARD_BG]}
              locations={[0, 0.5, 1]}
              style={styles.heroGradient}
            />
          </ImageBackground>

          {/* Mode badge on hero */}
          <View style={styles.heroBadge}>
            <Ionicons
              name={isApproval ? 'calendar' : 'notifications'}
              size={14}
              color="#fff"
            />
          </View>
        </View>

        {/* Label */}
        <Text style={styles.label}>{labelText}</Text>

        {/* Event title */}
        <Text style={styles.title} numberOfLines={2}>
          {event.title}
        </Text>

        {/* Subtitle */}
        <Text style={styles.subtitle}>{subtitleText}</Text>

        {/* Accent divider */}
        <View style={styles.divider} />

        {/* Event details card */}
        <View style={styles.detailsCard}>
          {eventDetails.map((detail, index) => (
            <EventDetailRow
              key={detail.label}
              label={detail.label}
              value={detail.value}
              icon={detail.icon}
              isLast={index === eventDetails.length - 1}
            />
          ))}
        </View>

        {/* Action buttons */}
        <View style={styles.actions}>
          <Pressable
            style={({ pressed }: { pressed: boolean }) => [
              styles.actionBtn,
              styles.dismiss,
              pressed && styles.dismissPressed,
            ]}
            onPress={handleDismiss}
            accessibilityRole="button"
            accessibilityLabel={
              isApproval ? 'Dismiss calendar event' : 'Dismiss reminder'
            }
          >
            <Ionicons
              name="close"
              size={18}
              color="rgba(255,255,255,0.7)"
            />
            <Text style={styles.dismissText}>Dismiss</Text>
          </Pressable>

          {isApproval && (
            <Pressable
              style={({ pressed }: { pressed: boolean }) => [
                styles.actionBtn,
                styles.approve,
                pressed && styles.approvePressed,
              ]}
              onPress={handleApprove}
              accessibilityRole="button"
              accessibilityLabel="Approve calendar event"
            >
              <Ionicons name="checkmark" size={18} color="#fff" />
              <Text style={styles.approveText}>Approve</Text>
            </Pressable>
          )}
        </View>
      </Animated.View>
    </View>
  );
}

/* ─── Aspire Enterprise Palette ─── */
const ACCENT = {
  solid: '#3B82F6',
  border: 'rgba(59,130,246,0.15)',
  glow: 'rgba(59,130,246,0.08)',
} as const;

const CARD_BG = '#1E1E1E';

/* ─── Styles ─── */
const styles = StyleSheet.create({
  root: {
    ...StyleSheet.absoluteFillObject,
    zIndex: 9998,
    alignItems: 'center',
    justifyContent: 'center',
  },
  backdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.72)',
    ...(Platform.OS === 'web'
      ? ({
          backdropFilter: 'blur(20px)',
          WebkitBackdropFilter: 'blur(20px)',
        } as unknown as ViewStyle)
      : {}),
  },

  /* Card — landscape: wider than tall */
  card: {
    width: 560,
    maxWidth: '94%',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.06)',
    alignItems: 'center',
    backgroundColor: CARD_BG,
    overflow: 'hidden',
    ...(Platform.OS === 'web'
      ? ({
          boxShadow: [
            '0 16px 48px rgba(0,0,0,0.5)',
            '0 4px 16px rgba(0,0,0,0.4)',
            'inset 0 1px 0 rgba(255,255,255,0.04)',
            '0 0 0 1px rgba(255,255,255,0.06)',
          ].join(', '),
          transform: 'perspective(1200px) rotateX(0.5deg)',
        } as unknown as ViewStyle)
      : {
          elevation: 24,
        }),
  },

  /* Hero image — taller for landscape card */
  heroContainer: {
    width: '100%',
    height: 180,
    position: 'relative',
    alignItems: 'center',
  },
  heroImage: {
    width: '100%',
    height: '100%',
  },
  heroGradient: {
    ...StyleSheet.absoluteFillObject,
  },
  heroBadge: {
    position: 'absolute',
    top: 14,
    right: 14,
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: 'rgba(59,130,246,0.25)',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: 'rgba(59,130,246,0.3)',
    ...(Platform.OS === 'web'
      ? ({
          backdropFilter: 'blur(8px)',
          WebkitBackdropFilter: 'blur(8px)',
        } as unknown as ViewStyle)
      : {}),
  },

  /* Label */
  label: {
    marginTop: 20,
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 1.6,
    textTransform: 'uppercase',
    color: ACCENT.solid,
  },

  /* Event info */
  title: {
    marginTop: 8,
    fontSize: 24,
    fontWeight: '700',
    color: '#fff',
    paddingHorizontal: 28,
    textAlign: 'center',
    ...(Platform.OS === 'web'
      ? ({ lineHeight: '1.2' } as unknown as ViewStyle)
      : { lineHeight: 30 }),
  },
  subtitle: {
    marginTop: 4,
    fontSize: 15,
    fontWeight: '400',
    color: 'rgba(255,255,255,0.45)',
    textAlign: 'center',
    letterSpacing: 0.2,
  },

  /* Accent divider with glow */
  divider: {
    marginTop: 16,
    width: 48,
    height: 1,
    backgroundColor: 'rgba(59,130,246,0.3)',
    ...(Platform.OS === 'web'
      ? ({
          boxShadow: '0 0 8px rgba(59,130,246,0.3)',
        } as unknown as ViewStyle)
      : {}),
  },

  /* Event details card */
  detailsCard: {
    marginTop: 16,
    marginHorizontal: 28,
    alignSelf: 'stretch',
    borderRadius: 10,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.06)',
    backgroundColor: '#242426',
    paddingVertical: 4,
    paddingHorizontal: 16,
    ...(Platform.OS === 'web'
      ? ({
          boxShadow:
            '0 1px 4px rgba(0,0,0,0.2), inset 0 1px 0 rgba(255,255,255,0.03)',
        } as unknown as ViewStyle)
      : {}),
  },
  detailRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 8,
  },
  detailRowBorder: {
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,255,255,0.04)',
  },
  detailIconWrap: {
    width: 24,
    alignItems: 'center',
    marginRight: 8,
  },
  detailLabel: {
    width: 72,
    fontSize: 11,
    fontWeight: '600',
    color: 'rgba(255,255,255,0.4)',
    textTransform: 'uppercase',
    letterSpacing: 0.6,
  },
  detailValue: {
    flex: 1,
    fontSize: 14,
    fontWeight: '600',
    color: 'rgba(255,255,255,0.9)',
  },

  /* Actions */
  actions: {
    marginTop: 20,
    marginBottom: 24,
    flexDirection: 'row',
    gap: 10,
    paddingHorizontal: 28,
    width: '100%',
  },
  actionBtn: {
    flex: 1,
    height: 48,
    borderRadius: 10,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    ...(Platform.OS === 'web'
      ? ({
          transition:
            'background-color 0.15s ease, opacity 0.15s ease, transform 0.1s ease, box-shadow 0.15s ease',
          cursor: 'pointer',
          outlineOffset: 2,
        } as unknown as ViewStyle)
      : {}),
  },

  /* Dismiss — ghost style */
  dismiss: {
    backgroundColor: 'transparent',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
  },
  dismissPressed: {
    backgroundColor: 'rgba(255,255,255,0.06)',
    borderColor: 'rgba(255,255,255,0.15)',
  },
  dismissText: {
    color: 'rgba(255,255,255,0.7)',
    fontSize: 14,
    fontWeight: '600',
  },

  /* Approve — Aspire blue-500 gradient */
  approve: {
    backgroundColor: '#3B82F6',
    ...(Platform.OS === 'web'
      ? ({
          backgroundImage:
            'linear-gradient(135deg, #3B82F6 0%, #2563EB 100%)',
          boxShadow:
            '0 4px 16px rgba(59,130,246,0.3), 0 1px 2px rgba(0,0,0,0.2)',
        } as unknown as ViewStyle)
      : {}),
  },
  approvePressed: {
    backgroundColor: '#2563EB',
    opacity: 0.92,
    ...(Platform.OS === 'web'
      ? ({
          backgroundImage:
            'linear-gradient(135deg, #2563EB 0%, #1D4ED8 100%)',
          boxShadow: '0 2px 8px rgba(59,130,246,0.2)',
          transform: 'scale(0.98)',
        } as unknown as ViewStyle)
      : {}),
  },
  approveText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '700',
  },
});

export function CalendarNotificationOverlay(): React.ReactElement {
  return (
    <PageErrorBoundary pageName="calendar-notification-overlay">
      <CalendarNotificationOverlayInner />
    </PageErrorBoundary>
  );
}
