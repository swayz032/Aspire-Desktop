import React, { useState, useEffect, useRef } from 'react';
import { View, Text, StyleSheet, Pressable, Animated, Dimensions } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { BlurView } from 'expo-blur';
import { Colors, Spacing, Typography, BorderRadius } from '@/constants/tokens';
import { AvaOrbVideo, OrbState } from '@/components/AvaOrbVideo';
import { mockTenant } from '@/data/mockData';
import { ConfirmationModal } from '@/components/session/ConfirmationModal';
import { Toast } from '@/components/session/Toast';
import { BottomSheet } from '@/components/session/BottomSheet';
import { useDesktop } from '@/lib/useDesktop';
import { FullscreenSessionShell } from '@/components/desktop/FullscreenSessionShell';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

type GeneratedContent = {
  id: string;
  type: 'pdf' | 'document' | 'code';
  name: string;
  preview?: string;
};

const MENU_OPTIONS = [
  { id: 'mute', label: 'Mute Microphone', icon: 'mic-off' as const },
  { id: 'speaker', label: 'Speaker Mode', icon: 'volume-high' as const },
  { id: 'transcript', label: 'View Transcript', icon: 'document-text' as const },
  { id: 'settings', label: 'Settings', icon: 'settings' as const },
  { id: 'end', label: 'End Session', icon: 'stop-circle' as const, destructive: true },
];

export default function VoiceSession() {
  const router = useRouter();
  const isDesktop = useDesktop();
  const [orbState, setOrbState] = useState<OrbState>('idle');
  const [currentActivity, setCurrentActivity] = useState<string>('Connecting to Ava...');
  const [generatedContent, setGeneratedContent] = useState<GeneratedContent | null>(null);
  const [isMuted, setIsMuted] = useState(false);
  const [endSessionVisible, setEndSessionVisible] = useState(false);
  const [menuVisible, setMenuVisible] = useState(false);
  
  const [toastMessage, setToastMessage] = useState('');
  const [toastVisible, setToastVisible] = useState(false);
  const [toastType, setToastType] = useState<'success' | 'error' | 'info'>('success');
  
  const shimmerAnim = useRef(new Animated.Value(0)).current;
  const cardSlideAnim = useRef(new Animated.Value(50)).current;
  const cardFadeAnim = useRef(new Animated.Value(0)).current;
  

  const showToast = (message: string, type: 'success' | 'error' | 'info' = 'success') => {
    setToastMessage(message);
    setToastType(type);
    setToastVisible(true);
  };

  useEffect(() => {
    Animated.loop(
      Animated.sequence([
        Animated.timing(shimmerAnim, {
          toValue: 1,
          duration: 1500,
          useNativeDriver: false,
        }),
        Animated.timing(shimmerAnim, {
          toValue: 0,
          duration: 1500,
          useNativeDriver: false,
        }),
      ])
    ).start();
  }, []);

  useEffect(() => {
    const timer0 = setTimeout(() => {
      setOrbState('listening');
      setCurrentActivity('Listening...');
    }, 1500);
    
    const timer1 = setTimeout(() => {
      setOrbState('processing');
      setCurrentActivity('Thinking...');
    }, 3500);

    const timer2 = setTimeout(() => {
      setCurrentActivity('Searching contract templates...');
    }, 5000);

    const timer3 = setTimeout(() => {
      setCurrentActivity('Reading NDA requirements...');
    }, 6500);

    const timer4 = setTimeout(() => {
      setCurrentActivity('Generating document...');
    }, 8000);

    const timer5 = setTimeout(() => {
      setOrbState('responding');
      setCurrentActivity('');
      setGeneratedContent({
        id: '1',
        type: 'pdf',
        name: 'NDA_ZenithSolutions.pdf',
        preview: 'Non-Disclosure Agreement between Zenith Solutions and...',
      });
      
      Animated.parallel([
        Animated.timing(cardSlideAnim, {
          toValue: 0,
          duration: 300,
          useNativeDriver: false,
        }),
        Animated.timing(cardFadeAnim, {
          toValue: 1,
          duration: 300,
          useNativeDriver: false,
        }),
      ]).start();
    }, 9500);

    const timer7 = setTimeout(() => {
      setOrbState('listening');
      setCurrentActivity('Listening...');
      setGeneratedContent(null);
      cardSlideAnim.setValue(50);
      cardFadeAnim.setValue(0);
    }, 13500);

    return () => {
      clearTimeout(timer0);
      clearTimeout(timer1);
      clearTimeout(timer2);
      clearTimeout(timer3);
      clearTimeout(timer4);
      clearTimeout(timer5);
      clearTimeout(timer7);
    };
  }, []);

  const shimmerOpacity = shimmerAnim.interpolate({
    inputRange: [0, 0.5, 1],
    outputRange: [0.4, 0.8, 0.4],
  });

  const handleEndSession = () => {
    showToast('Session ended. Transcript saved.', 'success');
    setTimeout(() => router.replace('/(tabs)'), 1000);
  };

  const handleMenuSelect = (optionId: string) => {
    switch (optionId) {
      case 'mute':
        setIsMuted(!isMuted);
        showToast(isMuted ? 'Microphone on' : 'Microphone muted', 'info');
        break;
      case 'speaker':
        showToast('Speaker mode enabled', 'info');
        break;
      case 'transcript':
        router.push('/session/transcript');
        break;
      case 'settings':
        showToast('Settings', 'info');
        break;
      case 'end':
        setEndSessionVisible(true);
        break;
    }
  };

  const handleViewDocument = () => {
    showToast('Opening document preview...', 'info');
  };

  const handleDownloadDocument = () => {
    showToast('Document downloaded', 'success');
  };

  const voiceContent = (
    <View style={styles.container}>
      <Toast 
        visible={toastVisible} 
        message={toastMessage} 
        type={toastType}
        onHide={() => setToastVisible(false)} 
      />

      <View style={styles.header}>
        <Pressable onPress={() => setEndSessionVisible(true)} style={styles.closeButton}>
          <Ionicons name="close" size={24} color={Colors.text.secondary} />
        </Pressable>
        
        <View style={styles.identityPill}>
          <View style={styles.liveDot} />
          <Text style={styles.identityText}>
            {mockTenant.businessName}
          </Text>
        </View>

        <Pressable onPress={() => setMenuVisible(true)} style={styles.menuButton}>
          <Ionicons name="ellipsis-vertical" size={20} color={Colors.text.secondary} />
        </Pressable>
      </View>

      <View style={styles.mainContent}>
        <View style={styles.blobSection}>
          <AvaOrbVideo state={orbState} size={280} />
        </View>

        <View style={styles.statusSection}>
          {currentActivity ? (
            <Animated.Text style={[styles.statusText, { opacity: shimmerOpacity }]}>
              {currentActivity}
            </Animated.Text>
          ) : null}
        </View>

        {generatedContent && (
          <Animated.View 
            style={[
              styles.contentCardWrapper,
              {
                opacity: cardFadeAnim,
                transform: [{ translateY: cardSlideAnim }],
              }
            ]}
          >
            <BlurView 
              intensity={40} 
              tint="dark" 
              style={styles.contentCard}
            >
              <View style={styles.contentCardInner}>
                <View style={styles.contentCardHeader}>
                  <Ionicons 
                    name={generatedContent.type === 'pdf' ? 'document-text' : 'code-slash'} 
                    size={20} 
                    color={Colors.text.secondary} 
                  />
                  <Text style={styles.contentCardTitle}>{generatedContent.name}</Text>
                </View>
                {generatedContent.preview && (
                  <Text style={styles.contentCardPreview} numberOfLines={2}>
                    {generatedContent.preview}
                  </Text>
                )}
                <View style={styles.contentCardActions}>
                  <Pressable style={styles.contentCardButton} onPress={handleViewDocument}>
                    <Ionicons name="eye-outline" size={16} color={Colors.accent.cyan} />
                    <Text style={styles.contentCardButtonText}>View</Text>
                  </Pressable>
                  <Pressable style={styles.contentCardButton} onPress={handleDownloadDocument}>
                    <Ionicons name="download-outline" size={16} color={Colors.accent.cyan} />
                    <Text style={styles.contentCardButtonText}>Download</Text>
                  </Pressable>
                </View>
              </View>
            </BlurView>
          </Animated.View>
        )}
      </View>

      <View style={styles.footer}>
        <View style={styles.controlsRow}>
          <Pressable 
            style={[styles.controlButton, isMuted && styles.controlButtonActive]}
            onPress={() => {
              setIsMuted(!isMuted);
              showToast(isMuted ? 'Microphone on' : 'Microphone muted', 'info');
            }}
          >
            <Ionicons 
              name={isMuted ? "mic-off" : "mic"} 
              size={22} 
              color={isMuted ? Colors.semantic.error : Colors.text.primary} 
            />
          </Pressable>

          <Pressable 
            style={styles.endButton}
            onPress={() => setEndSessionVisible(true)}
          >
            <View style={styles.endButtonInner}>
              <Ionicons name="call" size={24} color="#ffffff" style={{ transform: [{ rotate: '135deg' }] }} />
            </View>
          </Pressable>

          <Pressable 
            style={styles.controlButton}
            onPress={() => showToast('Speaker mode toggled', 'info')}
          >
            <Ionicons name="volume-high" size={22} color={Colors.text.primary} />
          </Pressable>
        </View>
      </View>

      <BottomSheet
        visible={menuVisible}
        onClose={() => setMenuVisible(false)}
        title="Session Options"
        options={MENU_OPTIONS}
        onSelect={handleMenuSelect}
      />

      <ConfirmationModal
        visible={endSessionVisible}
        onClose={() => setEndSessionVisible(false)}
        onConfirm={handleEndSession}
        title="End Voice Session"
        message="Are you sure you want to end this voice session? The transcript will be saved."
        confirmLabel="End Session"
        destructive
        icon="mic-off"
      />
    </View>
  );

  if (isDesktop) {
    return (
      <FullscreenSessionShell showBackButton={true} backLabel="Exit Voice">
        {voiceContent}
      </FullscreenSessionShell>
    );
  }

  return voiceContent;
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#000000',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: Spacing.lg,
    paddingTop: 60,
    paddingBottom: Spacing.md,
  },
  closeButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#242426',
    alignItems: 'center',
    justifyContent: 'center',
  },
  menuButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#242426',
    alignItems: 'center',
    justifyContent: 'center',
  },
  identityPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    backgroundColor: '#1E1E20',
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    borderRadius: BorderRadius.full,
  },
  liveDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: Colors.accent.cyan,
  },
  identityText: {
    color: Colors.text.secondary,
    fontSize: Typography.small.fontSize,
  },
  mainContent: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: Spacing.lg,
  },
  blobSection: {
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: Spacing.xl,
  },
  statusSection: {
    height: 24,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: Spacing.xl,
  },
  statusText: {
    color: '#A1A1AA',
    fontSize: 14,
    fontWeight: '400',
    letterSpacing: 0.3,
  },
  contentCardWrapper: {
    width: SCREEN_WIDTH - Spacing.lg * 2,
    borderRadius: 16,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.15)',
  },
  contentCard: {
    borderRadius: 16,
    overflow: 'hidden',
  },
  contentCardInner: {
    padding: Spacing.lg,
    backgroundColor: 'rgba(30, 30, 40, 0.5)',
  },
  contentCardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    marginBottom: Spacing.sm,
  },
  contentCardTitle: {
    color: Colors.text.primary,
    fontSize: 15,
    fontWeight: '600',
  },
  contentCardPreview: {
    color: Colors.text.muted,
    fontSize: 13,
    lineHeight: 18,
    marginBottom: Spacing.md,
  },
  contentCardActions: {
    flexDirection: 'row',
    gap: Spacing.md,
  },
  contentCardButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingVertical: 8,
    paddingHorizontal: 12,
    backgroundColor: 'rgba(52, 152, 219, 0.15)',
    borderRadius: 8,
  },
  contentCardButtonText: {
    color: Colors.accent.cyan,
    fontSize: 13,
    fontWeight: '500',
  },
  footer: {
    alignItems: 'center',
    paddingBottom: 50,
    backgroundColor: '#000000',
  },
  controlsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.xl,
  },
  controlButton: {
    width: 52,
    height: 52,
    borderRadius: 26,
    backgroundColor: '#242426',
    alignItems: 'center',
    justifyContent: 'center',
  },
  controlButtonActive: {
    backgroundColor: 'rgba(239, 68, 68, 0.3)',
  },
  endButton: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  endButtonInner: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: '#ff3b30',
    alignItems: 'center',
    justifyContent: 'center',
  },
});
