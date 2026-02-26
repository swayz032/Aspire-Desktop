import React, { useEffect, useMemo } from 'react';
import { View, StyleSheet, Pressable, Platform, useWindowDimensions, ViewStyle } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Colors } from '@/constants/tokens';
import { FinnDeskPanel } from './FinnDeskPanel';

type Props = {
  visible: boolean;
  onClose: () => void;
  initialTab?: 'voice' | 'video';
  templateContext?: { key: string; description: string } | null;
};

export function FinnDeskOverlay({ visible, onClose, initialTab, templateContext }: Props) {
  const { width } = useWindowDimensions();

  const panelStyle = useMemo((): ViewStyle => {
    if (width >= 1200) {
      // Desktop: generous modal
      return {
        width: '70%' as unknown as number,
        maxWidth: 900,
        height: '90vh' as unknown as number,
        borderRadius: 16,
      };
    }
    if (width >= 900) {
      // Laptop: wider proportion
      return {
        width: '80%' as unknown as number,
        maxWidth: 900,
        height: '85vh' as unknown as number,
        borderRadius: 16,
      };
    }
    // Tablet / small: near-fullscreen
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
      <Pressable style={styles.backdrop} onPress={onClose} />
      <View style={styles.panelContainer}>
        <View style={[styles.panel, panelStyle]}>
          <FinnDeskPanel initialTab={initialTab} templateContext={templateContext} isInOverlay />
          <Pressable style={styles.closeBtn} onPress={onClose}>
            <Ionicons name="close" size={20} color={Colors.text.secondary} />
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
    top: 12,
    right: 12,
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: 'rgba(255,255,255,0.08)',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 20,
    ...(Platform.OS === 'web' ? {
      cursor: 'pointer',
      transition: 'background-color 0.15s ease',
    } : {}),
  } as any,
});
