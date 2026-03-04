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
import { Ionicons } from '@expo/vector-icons';
import { playOpenSound } from '@/lib/sounds';

export type ModalSize = 'standard' | 'wide' | 'agent';

interface WidgetModalProps {
  visible: boolean;
  onClose: () => void;
  children: React.ReactNode;
  size?: ModalSize;
}

const SPRING = { damping: 24, stiffness: 300, mass: 0.8 };

const SIZE_MAP: Record<ModalSize, { width: number; maxHeight: number }> = {
  standard: { width: 580, maxHeight: 700 },
  wide:     { width: 720, maxHeight: 780 },
  agent:    { width: 720, maxHeight: 800 },
};

export function WidgetModal({ visible, onClose, children, size = 'standard' }: WidgetModalProps) {
  const { width: screenW, height: screenH } = useWindowDimensions();
  const scale = useSharedValue(0.94);
  const opacity = useSharedValue(0);
  const backdropOpacity = useSharedValue(0);

  useEffect(() => {
    if (visible) {
      playOpenSound();
      opacity.value = withTiming(1, { duration: 220 });
      backdropOpacity.value = withTiming(1, { duration: 200 });
      scale.value = withSpring(1, SPRING);
    } else {
      opacity.value = withTiming(0, { duration: 180 });
      backdropOpacity.value = withTiming(0, { duration: 160 });
      scale.value = withTiming(0.94, { duration: 160 });
    }
  }, [visible]);

  const modalStyle = useAnimatedStyle(() => ({
    opacity: opacity.value,
    transform: [{ scale: scale.value }],
  }));

  const backdropStyle = useAnimatedStyle(() => ({
    opacity: backdropOpacity.value,
  }));

  const sizeConfig = SIZE_MAP[size];
  const modalW = Math.min(screenW - 32, sizeConfig.width);
  const modalH = Math.min(screenH - 80, sizeConfig.maxHeight);

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

        <Reanimated.View style={[s.card, modalStyle, { width: modalW, height: modalH }]}>
          <Pressable onPress={onClose} style={s.closeBtn}>
            <Ionicons name="close" size={18} color="rgba(255,255,255,0.9)" />
          </Pressable>
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
    backgroundColor: 'rgba(0,0,0,0.85)',
    ...(Platform.OS === 'web'
      ? ({ backdropFilter: 'blur(12px)', WebkitBackdropFilter: 'blur(12px)' } as any)
      : {}),
  },
  card: {
    borderRadius: 20,
    overflow: 'hidden',
    position: 'relative',
    backgroundColor: '#1C1C1E',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.06)',
    ...(Platform.OS === 'web'
      ? ({
          boxShadow:
            '0 24px 80px rgba(0,0,0,0.65), 0 8px 32px rgba(0,0,0,0.4), 0 0 0 1px rgba(255,255,255,0.06)',
        } as any)
      : {
          shadowColor: '#000',
          shadowOffset: { width: 0, height: 12 },
          shadowOpacity: 0.6,
          shadowRadius: 40,
          elevation: 24,
        }),
  },
  closeBtn: {
    position: 'absolute',
    top: 14,
    right: 14,
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: 'rgba(255,255,255,0.08)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 100,
    ...(Platform.OS === 'web'
      ? ({ cursor: 'pointer', boxShadow: '0 2px 8px rgba(0,0,0,0.3)' } as any)
      : {}),
  },
  content: {
    flex: 1,
  },
});
