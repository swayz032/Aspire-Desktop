import React, { useEffect, useMemo } from 'react';
import { View, StyleSheet, Pressable, Platform, useWindowDimensions, ViewStyle } from 'react-native';
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
  const { width } = useWindowDimensions();

  /*
   * When the overlay is opened with initialTab="video", render FinnDeskPanel
   * in immersive video-only mode (FaceTime-style: no tabs, full-bleed video,
   * floating controls, slide-up chat overlay).
   */
  const isVideoOnly = initialTab === 'video';

  const panelStyle = useMemo((): ViewStyle => {
    if (width >= 1200) {
      return {
        width: '70%' as unknown as number,
        maxWidth: 900,
        height: '90vh' as unknown as number,
        borderRadius: 16,
      };
    }
    if (width >= 900) {
      return {
        width: '80%' as unknown as number,
        maxWidth: 900,
        height: '85vh' as unknown as number,
        borderRadius: 16,
      };
    }
    return {
      width: '95%' as unknown as number,
      maxWidth: undefined,
      height: '95vh' as unknown as number,
      borderRadius: 12,
    };
  }, [width]);

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
        <View style={[styles.panel, panelStyle]}>
          <FinnDeskPanel
            initialTab={initialTab}
            templateContext={templateContext}
            isInOverlay
            videoOnly={isVideoOnly}
            onEndCall={onClose}
          />
          {/* Close button floats above the panel content */}
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
    backgroundColor: 'rgba(0,0,0,0.6)',
  } as any,
  panelContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    pointerEvents: 'box-none',
  } as any,
  panel: {
    overflow: 'hidden',
    backgroundColor: '#1C1C1E',
    position: 'relative',
    ...(Platform.OS === 'web' ? {
      boxShadow: '0 25px 50px -12px rgba(0,0,0,0.5), 0 0 0 1px rgba(255,255,255,0.05)',
    } : {}),
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
    /* Ensure 44x44 minimum tap target */
    minWidth: 44,
    minHeight: 44,
    ...(Platform.OS === 'web' ? {
      cursor: 'pointer',
      transition: 'background-color 0.15s ease',
    } : {}),
  } as Record<string, unknown>,
  /* In immersive video-only mode, the close button uses a
     semi-transparent backdrop-blur pill so it floats above the video. */
  closeBtnImmersive: {
    backgroundColor: 'rgba(255,255,255,0.12)',
    ...(Platform.OS === 'web' ? {
      backdropFilter: 'blur(16px)',
      WebkitBackdropFilter: 'blur(16px)',
    } : {}),
  } as Record<string, unknown>,
});
