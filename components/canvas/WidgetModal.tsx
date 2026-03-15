import React, { useEffect } from 'react';
import {
  View,
  Pressable,
  StyleSheet,
  Platform,
  useWindowDimensions,
  Modal,
} from 'react-native';
import Reanimated, {
  useSharedValue,
  useAnimatedStyle,
  withSpring,
  withTiming,
} from 'react-native-reanimated';
import { playOpenSound } from '@/lib/sounds';

export type ModalSize = 'compact' | 'standard' | 'wide' | 'agent' | 'portrait' | 'tape' | 'note';

interface WidgetModalProps {
  visible: boolean;
  onClose: () => void;
  children: React.ReactNode;
  size?: ModalSize;
  accent?: string;
}

const SPRING = { damping: 22, stiffness: 280, mass: 0.8 };

const SIZE_MAP: Record<ModalSize, { width: number; maxHeight: number }> = {
  compact:  { width: 520,  maxHeight: 600  },
  standard: { width: 680,  maxHeight: 780  },
  wide:     { width: 860,  maxHeight: 840  },
  agent:    { width: 720,  maxHeight: 800  },
  portrait: { width: 440,  maxHeight: 780  },
  tape:     { width: 480,  maxHeight: 820  },
  note:     { width: 400,  maxHeight: 440  },
};

export function WidgetModal({
  visible,
  onClose,
  children,
  size = 'standard',
  accent = '#0ea5e9',
}: WidgetModalProps) {
  const { width: screenW, height: screenH } = useWindowDimensions();
  const scale        = useSharedValue(0.92);
  const opacity      = useSharedValue(0);
  const translateY   = useSharedValue(16);
  const backdropOpacity = useSharedValue(0);

  useEffect(() => {
    if (visible) {
      playOpenSound();
      opacity.value         = withTiming(1, { duration: 200 });
      backdropOpacity.value = withTiming(1, { duration: 180 });
      scale.value           = withSpring(1, SPRING);
      translateY.value      = withSpring(0, SPRING);
    } else {
      opacity.value         = withTiming(0, { duration: 160 });
      backdropOpacity.value = withTiming(0, { duration: 140 });
      scale.value           = withTiming(0.92, { duration: 150 });
      translateY.value      = withTiming(16,   { duration: 150 });
    }
  }, [visible]);

  const modalStyle = useAnimatedStyle(() => ({
    opacity:   opacity.value,
    transform: [{ scale: scale.value }, { translateY: translateY.value }],
  }));

  const backdropStyle = useAnimatedStyle(() => ({
    opacity: backdropOpacity.value,
  }));

  const sizeConfig = SIZE_MAP[size];
  const modalW  = Math.min(screenW - 32, sizeConfig.width);
  const modalH  = Math.min(screenH - 80, sizeConfig.maxHeight);
  const isNote  = size === 'note';

  return (
    <Modal
      visible={visible}
      transparent
      animationType="none"
      onRequestClose={onClose}
      statusBarTranslucent
    >
      <View style={s.root}>
        <Reanimated.View style={[s.backdrop, backdropStyle]}>
          <Pressable style={StyleSheet.absoluteFill} onPress={onClose} />
        </Reanimated.View>

        <Reanimated.View
          style={[
            s.card,
            modalStyle,
            { width: modalW, maxHeight: modalH },
            isNote && s.cardNote,
          ]}
        >
          {/* 4px accent gradient strip at top — hidden for frameless note */}
          {!isNote && (
            <View
              style={[
                s.accentStrip,
                {
                  backgroundColor: accent,
                  ...(Platform.OS === 'web'
                    ? ({ background: `linear-gradient(90deg, ${accent}, ${accent}66)` })
                    : {}),
                },
              ]}
            />
          )}

          {/* Close button — tap outside closes note instead */}
          {!isNote && (
            <Pressable
              onPress={onClose}
              style={s.closeBtn}
              hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
            >
              <View style={s.closeLine1} />
              <View style={s.closeLine2} />
            </Pressable>
          )}

          <View style={s.content}>{children}</View>
        </Reanimated.View>
      </View>
    </Modal>
  );
}

const s = StyleSheet.create({
  root: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  backdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.82)',
    ...(Platform.OS === 'web'
      ? ({ backdropFilter: 'blur(20px)', WebkitBackdropFilter: 'blur(20px)' })
      : {}),
  },
  card: {
    borderRadius: 24,
    overflow: 'hidden',
    position: 'relative',
    backgroundColor: 'rgba(12,12,16,0.97)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.07)',
    ...(Platform.OS === 'web'
      ? ({
          boxShadow: '0 32px 96px rgba(0,0,0,0.72), 0 8px 32px rgba(0,0,0,0.5), 0 0 0 1px rgba(255,255,255,0.06)',
          backdropFilter: 'blur(40px)',
          WebkitBackdropFilter: 'blur(40px)',
        })
      : {
          shadowColor: '#000',
          shadowOffset: { width: 0, height: 16 },
          shadowOpacity: 0.7,
          shadowRadius: 48,
          elevation: 32,
        }),
  },
  cardNote: {
    borderRadius: 16,
    borderWidth: 0,
  },
  accentStrip: {
    width: '100%',
    height: 4,
    opacity: 0.9,
  },
  closeBtn: {
    position: 'absolute',
    top: 16,
    right: 16,
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: 'rgba(255,255,255,0.06)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 100,
    ...(Platform.OS === 'web'
      ? ({ cursor: 'pointer' })
      : {}),
  },
  closeLine1: {
    position: 'absolute',
    width: 14,
    height: 1.5,
    backgroundColor: 'rgba(255,255,255,0.7)',
    borderRadius: 1,
    transform: [{ rotate: '45deg' }],
  },
  closeLine2: {
    position: 'absolute',
    width: 14,
    height: 1.5,
    backgroundColor: 'rgba(255,255,255,0.7)',
    borderRadius: 1,
    transform: [{ rotate: '-45deg' }],
  },
  content: {
    flex: 1,
  },
});
