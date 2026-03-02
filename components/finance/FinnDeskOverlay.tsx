import React, { useEffect } from 'react';
import { View, StyleSheet, Pressable, Platform } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Colors, Spacing } from '@/constants/tokens';
import { FinnDeskPanel } from './FinnDeskPanel';

type Props = {
  visible: boolean;
  onClose: () => void;
  initialTab?: 'voice' | 'video';
  templateContext?: { key: string; description: string } | null;
};

export function FinnDeskOverlay({ visible, onClose, initialTab, templateContext }: Props) {
  const isVideoOnly = initialTab === 'video';

  useEffect(() => {
    if (!visible || Platform.OS !== 'web') return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [visible, onClose]);

  if (!visible) return null;

  return (
    <View style={styles.overlay}>
      <Pressable style={styles.backdrop} onPress={onClose} accessibilityLabel="Close overlay" />
      <View style={styles.panelContainer}>
        <View style={[styles.panel, isVideoOnly ? styles.panelLandscape : styles.panelDefault]}>
          <FinnDeskPanel
            initialTab={initialTab}
            templateContext={templateContext}
            isInOverlay
            videoOnly={isVideoOnly}
            onEndCall={onClose}
          />
          <Pressable
            style={[styles.closeBtn, isVideoOnly && styles.closeBtnImmersive]}
            onPress={onClose}
            accessibilityLabel="Close Finn overlay"
            accessibilityRole="button"
          >
            <Ionicons name="close" size={20} color={isVideoOnly ? '#fff' : Colors.text.secondary} />
          </Pressable>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  overlay: {
    position: 'absolute',
    top: 0,
    right: 0,
    bottom: 0,
    left: 0,
    zIndex: 1000,
    ...(Platform.OS === 'web' ? {
      position: 'fixed',
    } : {}),
  } as any,
  backdrop: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0,0,0,0.75)',
  } as any,
  panelContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    pointerEvents: 'box-none',
  } as any,
  panel: {
    overflow: 'hidden',
    backgroundColor: '#0a0a0a',
    position: 'relative',
    ...(Platform.OS === 'web' ? {
      boxShadow: '0 32px 64px -16px rgba(0,0,0,0.7), 0 16px 32px -8px rgba(0,0,0,0.5), 0 0 0 1px rgba(255,255,255,0.06), 0 0 80px rgba(59,130,246,0.06)',
    } : {}),
  } as any,
  panelLandscape: {
    width: '75%',
    maxWidth: 860,
    height: 540,
    borderRadius: 20,
  } as any,
  panelDefault: {
    width: '70%',
    maxWidth: 900,
    height: '90%',
    borderRadius: 16,
  } as any,
  closeBtn: {
    position: 'absolute',
    top: Spacing.md,
    right: Spacing.md,
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: 'rgba(255,255,255,0.08)',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 20,
    minWidth: 44,
    minHeight: 44,
    ...(Platform.OS === 'web' ? {
      cursor: 'pointer',
      transition: 'background-color 0.15s ease',
    } : {}),
  } as Record<string, unknown>,
  closeBtnImmersive: {
    backgroundColor: 'rgba(255,255,255,0.12)',
    ...(Platform.OS === 'web' ? {
      backdropFilter: 'blur(16px)',
      WebkitBackdropFilter: 'blur(16px)',
    } : {}),
  } as Record<string, unknown>,
});
