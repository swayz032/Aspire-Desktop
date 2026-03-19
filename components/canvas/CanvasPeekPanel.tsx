import React, { useEffect, useRef, useCallback } from 'react';
import {
  View,
  Text,
  Pressable,
  StyleSheet,
  Platform,
  useWindowDimensions,
  Modal,
} from 'react-native';
import Reanimated, {
  useSharedValue,
  useAnimatedStyle,
  withTiming,
  Easing,
} from 'react-native-reanimated';
import { Ionicons } from '@expo/vector-icons';
import { playOpenSound } from '@/lib/sounds';
import { PageErrorBoundary } from '@/components/PageErrorBoundary';

interface CanvasPeekPanelProps {
  visible: boolean;
  onClose: () => void;
  onOpenFullPage: () => void;
  accent: string;
  icon: string;
  title: string;
  subtitle?: string;
  children?: React.ReactNode;
}

const SLIDE_IN  = { duration: 280, easing: Easing.out(Easing.cubic) };
const SLIDE_OUT = { duration: 200, easing: Easing.in(Easing.cubic) };
const CONTENT_IN = { duration: 260, easing: Easing.out(Easing.quad) };

function CanvasPeekPanelInner({
  visible,
  onClose,
  onOpenFullPage,
  accent,
  icon,
  title,
  subtitle,
  children,
}: CanvasPeekPanelProps) {
  const { width: screenW, height: screenH } = useWindowDimensions();
  const panelWidth = Math.min(Math.round(screenW * 0.44), 460);

  const overlayOpacity     = useSharedValue(0);
  const panelTranslateX    = useSharedValue(panelWidth);
  const contentOpacity     = useSharedValue(0);
  const contentTranslateY  = useSharedValue(16);
  const closeBtnScale      = useSharedValue(1);
  const openBtnScale       = useSharedValue(1);

  const soundPlayed = useRef(false);

  useEffect(() => {
    if (visible) {
      if (!soundPlayed.current) {
        try { playOpenSound(); } catch (_e) { console.error('[CanvasPeekPanel] Sound play failed:', _e); }
        soundPlayed.current = true;
      }
      overlayOpacity.value    = withTiming(1, { duration: 240, easing: Easing.out(Easing.ease) });
      panelTranslateX.value   = withTiming(0, SLIDE_IN);
      contentOpacity.value    = withTiming(1, CONTENT_IN);
      contentTranslateY.value = withTiming(0, CONTENT_IN);
    } else {
      soundPlayed.current = false;
      overlayOpacity.value    = withTiming(0, { duration: 180 });
      panelTranslateX.value   = withTiming(panelWidth, SLIDE_OUT);
      contentOpacity.value    = withTiming(0, { duration: 140 });
      contentTranslateY.value = withTiming(16, { duration: 160 });
    }
  }, [visible, panelWidth]);

  const overlayStyle  = useAnimatedStyle(() => ({ opacity: overlayOpacity.value }));
  const panelStyle    = useAnimatedStyle(() => ({ transform: [{ translateX: panelTranslateX.value }] }));
  const contentStyle  = useAnimatedStyle(() => ({
    opacity: contentOpacity.value,
    transform: [{ translateY: contentTranslateY.value }],
  }));
  const closeBtnStyle = useAnimatedStyle(() => ({ transform: [{ scale: closeBtnScale.value }] }));
  const openBtnStyle  = useAnimatedStyle(() => ({ transform: [{ scale: openBtnScale.value }] }));

  const onClosePressIn  = useCallback(() => { closeBtnScale.value = withTiming(0.93, { duration: 80 }); }, []);
  const onClosePressOut = useCallback(() => { closeBtnScale.value = withTiming(1, { duration: 120 }); }, []);
  const onOpenPressIn   = useCallback(() => { openBtnScale.value  = withTiming(0.95, { duration: 80 }); }, []);
  const onOpenPressOut  = useCallback(() => { openBtnScale.value  = withTiming(1, { duration: 120 }); }, []);

  if (!visible) return null;

  return (
    <Modal
      visible={visible}
      transparent
      animationType="none"
      onRequestClose={onClose}
      statusBarTranslucent
    >
      <View style={s.root}>
        <Reanimated.View style={[s.overlay, overlayStyle]}>
          <Pressable style={StyleSheet.absoluteFill} onPress={onClose} />
        </Reanimated.View>

        <Reanimated.View
          style={[
            s.panel,
            { width: panelWidth, height: screenH },
            panelStyle,
            Platform.OS === 'web'
              ? ({
                  boxShadow: `-32px 0 80px rgba(0,0,0,0.7), -1px 0 0 rgba(255,255,255,0.06)`,
                  backdropFilter: 'blur(40px)',
                  WebkitBackdropFilter: 'blur(40px)',
                } as any)
              : {},
          ]}
        >
          <View style={s.header}>
            <View style={[s.accentBar, { backgroundColor: accent }]} />

            <View style={s.headerInner}>
              <View style={s.headerLeft}>
                <View style={[s.iconWrap, { backgroundColor: `${accent}18` }]}>
                  <Ionicons name={icon as any} size={18} color={accent} />
                </View>
                <View style={s.titleBlock}>
                  <Text style={s.title} numberOfLines={1}>{title}</Text>
                  {subtitle ? (
                    <Text style={s.subtitle} numberOfLines={1}>{subtitle}</Text>
                  ) : null}
                </View>
              </View>

              <View style={s.headerRight}>
                <Reanimated.View style={openBtnStyle}>
                  <Pressable
                    style={[s.openBtn, { borderColor: `${accent}60` }]}
                    onPress={onOpenFullPage}
                    onPressIn={onOpenPressIn}
                    onPressOut={onOpenPressOut}
                    accessibilityLabel={`Open full ${title} page`}
                    accessibilityRole="button"
                  >
                    <Text style={[s.openBtnText, { color: accent }]}>Open ↗</Text>
                  </Pressable>
                </Reanimated.View>

                <Reanimated.View style={closeBtnStyle}>
                  <Pressable
                    style={s.closeBtn}
                    onPress={onClose}
                    onPressIn={onClosePressIn}
                    onPressOut={onClosePressOut}
                    hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                    accessibilityLabel="Close panel"
                    accessibilityRole="button"
                  >
                    <Ionicons name="close" size={17} color="rgba(255,255,255,0.65)" />
                  </Pressable>
                </Reanimated.View>
              </View>
            </View>

            <View style={s.headerSep} />
          </View>

          <Reanimated.View style={[s.content, contentStyle]}>
            {children}
          </Reanimated.View>
        </Reanimated.View>
      </View>
    </Modal>
  );
}

const s = StyleSheet.create({
  root: {
    flex: 1,
    flexDirection: 'row',
    justifyContent: 'flex-end',
  },
  overlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.6)',
  },
  panel: {
    position: 'absolute',
    right: 0,
    top: 0,
    backgroundColor: 'rgba(6,6,10,0.98)',
    borderLeftWidth: 1,
    borderLeftColor: 'rgba(255,255,255,0.07)',
    overflow: 'hidden',
  },
  header: {
    height: 64,
    flexDirection: 'row',
    alignItems: 'stretch',
    position: 'relative',
  },
  accentBar: {
    width: 3,
    alignSelf: 'stretch',
  },
  headerInner: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 14,
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    flex: 1,
    marginRight: 10,
  },
  iconWrap: {
    width: 34,
    height: 34,
    borderRadius: 9,
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  titleBlock: { flex: 1 },
  title: {
    fontSize: 16,
    fontWeight: '700',
    color: '#F0F0F2',
    letterSpacing: -0.2,
  },
  subtitle: {
    fontSize: 11,
    color: 'rgba(255,255,255,0.35)',
    marginTop: 1,
  },
  headerRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    flexShrink: 0,
  },
  openBtn: {
    borderWidth: 1,
    borderRadius: 8,
    paddingHorizontal: 11,
    paddingVertical: 6,
    justifyContent: 'center',
    alignItems: 'center',
    ...(Platform.OS === 'web' ? ({ cursor: 'pointer' } as any) : {}),
  },
  openBtnText: {
    fontSize: 11,
    fontWeight: '600',
    letterSpacing: 0.1,
  },
  closeBtn: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: 'rgba(255,255,255,0.06)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.09)',
    alignItems: 'center',
    justifyContent: 'center',
    ...(Platform.OS === 'web' ? ({ cursor: 'pointer' } as any) : {}),
  },
  headerSep: {
    position: 'absolute',
    bottom: 0,
    left: 3,
    right: 0,
    height: 1,
    backgroundColor: 'rgba(255,255,255,0.06)',
  },
  content: { flex: 1 },
});

export function CanvasPeekPanel(props: any) {
  return (
    <PageErrorBoundary pageName="canvas-peek-panel">
      <CanvasPeekPanelInner {...props} />
    </PageErrorBoundary>
  );
}
