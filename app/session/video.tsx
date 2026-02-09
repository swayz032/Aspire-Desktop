import React, { useState } from 'react';
import { View, Text, StyleSheet, SafeAreaView, ScrollView, Pressable, ImageBackground } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import { Colors, Spacing, Typography, BorderRadius } from '@/constants/tokens';
import { Badge } from '@/components/ui/Badge';
import { SectionHeader } from '@/components/ui/SectionHeader';
import { Card } from '@/components/ui/Card';
import { mockTenant, mockAuthorityQueue, mockDocuments } from '@/data/mockData';
import { AuthorityItem } from '@/types';
import { ConfirmationModal } from '@/components/session/ConfirmationModal';
import { Toast } from '@/components/session/Toast';
import { ChatDrawer } from '@/components/session/ChatDrawer';
import { BottomSheet } from '@/components/session/BottomSheet';
import { useDesktop } from '@/lib/useDesktop';
import { FullscreenSessionShell } from '@/components/desktop/FullscreenSessionShell';

const MENU_OPTIONS = [
  { id: 'flip', label: 'Flip Camera', icon: 'camera-reverse' as const },
  { id: 'pip', label: 'Picture in Picture', icon: 'browsers' as const },
  { id: 'share', label: 'Share Screen', icon: 'desktop' as const },
  { id: 'settings', label: 'Settings', icon: 'settings' as const },
  { id: 'end', label: 'End Session', icon: 'stop-circle' as const, destructive: true },
];

export default function VideoSession() {
  const router = useRouter();
  const isDesktop = useDesktop();
  const [isMuted, setIsMuted] = useState(false);
  const [isVideoOff, setIsVideoOff] = useState(false);
  const [endSessionVisible, setEndSessionVisible] = useState(false);
  const [chatVisible, setChatVisible] = useState(false);
  const [menuVisible, setMenuVisible] = useState(false);
  const [chatMessages, setChatMessages] = useState<{id: string; senderId: string; senderName: string; text: string; timestamp: Date}[]>([]);
  const [authorityItems, setAuthorityItems] = useState(() => mockAuthorityQueue.slice(0, 2));
  const [connectionState, setConnectionState] = useState<'connecting' | 'connected'>('connecting');
  
  const [toastMessage, setToastMessage] = useState('');
  const [toastVisible, setToastVisible] = useState(false);
  const [toastType, setToastType] = useState<'success' | 'error' | 'info'>('success');
  const [contextPanelVisible, setContextPanelVisible] = useState(false);
  const [duration, setDuration] = useState(0);

  React.useEffect(() => {
    const timer = setInterval(() => {
      setDuration(d => d + 1);
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  React.useEffect(() => {
    const timer = setTimeout(() => {
      setConnectionState('connected');
    }, 2500);
    return () => clearTimeout(timer);
  }, []);

  const showToast = (message: string, type: 'success' | 'error' | 'info' = 'success') => {
    setToastMessage(message);
    setToastType(type);
    setToastVisible(true);
  };

  const handleEndSession = () => {
    showToast('Session ended. Recording saved.', 'success');
    setTimeout(() => router.replace('/(tabs)'), 1000);
  };

  const handleMenuSelect = (optionId: string) => {
    switch (optionId) {
      case 'flip':
        showToast('Camera flipped', 'info');
        break;
      case 'pip':
        showToast('Picture in Picture enabled', 'info');
        break;
      case 'share':
        showToast('Screen sharing started', 'success');
        break;
      case 'settings':
        showToast('Settings opening...', 'info');
        break;
      case 'end':
        setEndSessionVisible(true);
        break;
    }
  };

  const handleSendChat = (text: string) => {
    const newMessage = {
      id: `msg-${Date.now()}`,
      senderId: 'host-1',
      senderName: 'You',
      text,
      timestamp: new Date(),
    };
    setChatMessages([...chatMessages, newMessage]);
    showToast('Message sent', 'success');
  };

  const handleApprove = (itemId: string) => {
    const item = authorityItems.find(i => i.id === itemId);
    setAuthorityItems(prev => prev.filter(i => i.id !== itemId));
    showToast(`Approved: ${item?.title || 'Action'}`, 'success');
  };

  const handleDeny = (itemId: string) => {
    const item = authorityItems.find(i => i.id === itemId);
    setAuthorityItems(prev => prev.filter(i => i.id !== itemId));
    showToast(`Denied: ${item?.title || 'Action'}`, 'error');
  };

  const videoContent = (
    <SafeAreaView style={styles.container}>
      <Toast 
        visible={toastVisible} 
        message={toastMessage} 
        type={toastType}
        onHide={() => setToastVisible(false)} 
      />

      <View style={styles.videoContainer}>
        <ImageBackground
          source={{ uri: 'https://images.unsplash.com/photo-1557804506-669a67965ba0?q=80&w=800' }}
          style={styles.videoBackground}
          imageStyle={{ opacity: 0.3 }}
        >
          <LinearGradient
            colors={['transparent', Colors.background.primary]}
            style={styles.videoGradient}
          />
          
          <View style={styles.videoHeader}>
            <Pressable onPress={() => setEndSessionVisible(true)} style={styles.backButton}>
              <Ionicons name="chevron-down" size={24} color={Colors.text.primary} />
            </Pressable>
            <View style={styles.headerCenter}>
              <Badge label="VIDEO SESSION" variant="live" size="sm" />
              <View style={styles.headerBadges}>
                <View style={styles.liveBadge}>
                  <View style={styles.liveDot} />
                  <Text style={styles.liveText}>Live</Text>
                </View>
                <View style={styles.recordingBadge}>
                  <Ionicons name="radio" size={10} color={Colors.semantic.error} />
                  <Text style={styles.recordingText}>Recording</Text>
                </View>
              </View>
            </View>
            <Pressable style={styles.menuButton} onPress={() => setMenuVisible(true)}>
              <Ionicons name="ellipsis-vertical" size={20} color={Colors.text.primary} />
            </Pressable>
          </View>

          {connectionState === 'connecting' || isVideoOff ? (
            <View style={styles.avatarContainer}>
              {connectionState === 'connecting' ? (
                <>
                  <View style={[styles.avatarCircle, styles.avatarCircleConnecting]}>
                    <Text style={styles.avatarLetter}>A</Text>
                  </View>
                  <Text style={styles.avatarName}>Ava</Text>
                  <Text style={styles.avatarStatusConnecting}>Connecting...</Text>
                </>
              ) : (
                <>
                  <View style={[styles.avatarCircle, styles.avatarCircleOff]}>
                    <Text style={styles.avatarLetter}>A</Text>
                  </View>
                  <Text style={styles.avatarName}>Ava</Text>
                  <Text style={styles.avatarStatusOff}>Video Off</Text>
                </>
              )}
            </View>
          ) : (
            <View style={styles.videoTileWrapper}>
              <ImageBackground
                source={{ uri: 'https://images.unsplash.com/photo-1573497019940-1c28c88b4f3e?q=80&w=800' }}
                style={styles.videoTile}
                imageStyle={styles.videoTileImage}
              >
                <LinearGradient
                  colors={['rgba(0,0,0,0.1)', 'transparent', 'rgba(0,0,0,0.5)']}
                  locations={[0, 0.3, 1]}
                  style={styles.videoTileGradient}
                />
                <View style={styles.videoTileLabel}>
                  <Text style={styles.videoTileName}>Ava</Text>
                  <View style={styles.videoTileLiveDot} />
                </View>
              </ImageBackground>
            </View>
          )}
        </ImageBackground>
      </View>

      <ScrollView 
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.identityBar}>
          <View style={styles.identityDot} />
          <Text style={styles.identityText}>
            {mockTenant.businessName} • Suite {mockTenant.suiteId}
          </Text>
        </View>

        <View style={styles.contextSection}>
          <SectionHeader title="Session Context" subtitle={`(${mockDocuments.length})`} />
          <View style={styles.contextChips}>
            {mockDocuments.map((doc) => (
              <Pressable 
                key={doc.id} 
                style={styles.contextChip}
                onPress={() => showToast(`Opening ${doc.title}...`, 'info')}
              >
                <Ionicons name="document-text" size={14} color={Colors.accent.cyan} />
                <Text style={styles.chipText} numberOfLines={1}>{doc.title}</Text>
              </Pressable>
            ))}
          </View>
        </View>

        <View style={styles.authoritySection}>
          <SectionHeader title="Authority Queue" subtitle={`(${authorityItems.length})`} />
          {authorityItems.map((item) => (
            <Card key={item.id} variant="filled" style={styles.authorityCard}>
              <View style={styles.authorityHeader}>
                <Text style={styles.authorityTitle}>{item.title}</Text>
                <View style={[
                  styles.riskBadge, 
                  { backgroundColor: item.priority === 'high' ? 'rgba(239, 68, 68, 0.2)' : 'rgba(251, 191, 36, 0.2)' }
                ]}>
                  <Text style={[
                    styles.riskText,
                    { color: item.priority === 'high' ? Colors.semantic.error : Colors.semantic.warning }
                  ]}>
                    {item.priority === 'high' ? 'High' : 'Medium'}
                  </Text>
                </View>
              </View>
              <Text style={styles.authorityDescription}>{item.subtitle}</Text>
              <View style={styles.authorityActions}>
                <Pressable 
                  style={styles.denyButton}
                  onPress={() => handleDeny(item.id)}
                >
                  <Ionicons name="close" size={16} color={Colors.semantic.error} />
                  <Text style={styles.denyText}>Deny</Text>
                </Pressable>
                <Pressable 
                  style={styles.approveButton}
                  onPress={() => handleApprove(item.id)}
                >
                  <Ionicons name="checkmark" size={16} color={Colors.semantic.success} />
                  <Text style={styles.approveText}>Approve</Text>
                </Pressable>
              </View>
            </Card>
          ))}
        </View>
      </ScrollView>

      <View style={styles.controls}>
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
          style={[styles.controlButton, isVideoOff && styles.controlButtonActive]}
          onPress={() => {
            setIsVideoOff(!isVideoOff);
            showToast(isVideoOff ? 'Camera on' : 'Camera off', 'info');
          }}
        >
          <Ionicons 
            name={isVideoOff ? "videocam-off" : "videocam"} 
            size={22} 
            color={isVideoOff ? Colors.semantic.error : Colors.text.primary} 
          />
        </Pressable>
        
        <Pressable 
          style={styles.endCallButton}
          onPress={() => setEndSessionVisible(true)}
        >
          <Ionicons name="call" size={22} color={Colors.text.primary} />
        </Pressable>
        
        <Pressable 
          style={styles.controlButton}
          onPress={() => setChatVisible(true)}
        >
          <Ionicons name="chatbubble" size={22} color={Colors.text.primary} />
          {chatMessages.length > 0 && (
            <View style={styles.chatBadge}>
              <Text style={styles.chatBadgeText}>{chatMessages.length}</Text>
            </View>
          )}
        </Pressable>
        
        <Pressable 
          style={styles.controlButton}
          onPress={() => setMenuVisible(true)}
        >
          <Ionicons name="ellipsis-horizontal" size={22} color={Colors.text.primary} />
        </Pressable>
      </View>

      <BottomSheet
        visible={menuVisible}
        onClose={() => setMenuVisible(false)}
        title="Session Options"
        options={MENU_OPTIONS}
        onSelect={handleMenuSelect}
      />

      <ChatDrawer
        visible={chatVisible}
        onClose={() => setChatVisible(false)}
        messages={chatMessages}
        onSend={handleSendChat}
      />

      <ConfirmationModal
        visible={endSessionVisible}
        onClose={() => setEndSessionVisible(false)}
        onConfirm={handleEndSession}
        title="End Video Session"
        message="Are you sure you want to end this video session? The recording will be saved."
        confirmLabel="End Session"
        destructive
        icon="videocam-off"
      />
    </SafeAreaView>
  );

  if (isDesktop) {
    return (
      <FullscreenSessionShell showBackButton={true} backLabel="Exit Video">
        <View style={desktopStyles.container}>
          <Toast 
            visible={toastVisible} 
            message={toastMessage} 
            type={toastType}
            onHide={() => setToastVisible(false)} 
          />

          {/* Main Content Area - Video + Authority Queue */}
          <View style={desktopStyles.mainContent}>
            {/* Video Section - Ava video tile */}
            <View style={desktopStyles.videoSection}>
            {connectionState === 'connecting' || isVideoOff ? (
              <ImageBackground
                source={{ uri: 'https://images.unsplash.com/photo-1557804506-669a67965ba0?q=80&w=800' }}
                style={desktopStyles.videoBackground}
                imageStyle={{ opacity: 0.3 }}
              >
                <LinearGradient
                  colors={['transparent', 'rgba(0,0,0,0.8)']}
                  style={StyleSheet.absoluteFillObject}
                />
                
                {/* Top bar with badges */}
                <View style={desktopStyles.topBar}>
                  <View style={desktopStyles.sessionBadges}>
                    <Badge label="VIDEO SESSION" variant="live" size="sm" />
                    <View style={desktopStyles.liveBadge}>
                      <View style={desktopStyles.liveDot} />
                      <Text style={desktopStyles.liveText}>Live</Text>
                    </View>
                    <View style={desktopStyles.recordingBadge}>
                      <Ionicons name="radio" size={10} color={Colors.semantic.error} />
                      <Text style={desktopStyles.recordingText}>Recording</Text>
                    </View>
                  </View>
                  <Text style={desktopStyles.identityText}>
                    {mockTenant.businessName} • Suite {mockTenant.suiteId}
                  </Text>
                </View>

                {/* Center avatar - connecting or video off state */}
                <View style={desktopStyles.avatarCenter}>
                  {connectionState === 'connecting' ? (
                    <>
                      <View style={[desktopStyles.avatarCircle, desktopStyles.avatarCircleConnecting]}>
                        <Text style={desktopStyles.avatarLetter}>A</Text>
                      </View>
                      <Text style={desktopStyles.avatarName}>Ava</Text>
                      <Text style={desktopStyles.avatarStatusConnecting}>Connecting...</Text>
                    </>
                  ) : (
                    <>
                      <View style={[desktopStyles.avatarCircle, desktopStyles.avatarCircleOff]}>
                        <Text style={desktopStyles.avatarLetter}>A</Text>
                      </View>
                      <Text style={desktopStyles.avatarName}>Ava</Text>
                      <Text style={desktopStyles.avatarStatusOff}>Video Off</Text>
                    </>
                  )}
                </View>
              </ImageBackground>
            ) : (
              <ImageBackground
                source={{ uri: 'https://images.unsplash.com/photo-1573497019940-1c28c88b4f3e?q=80&w=800' }}
                style={desktopStyles.fullscreenVideoTile}
                imageStyle={{ resizeMode: 'cover' }}
              >
                <LinearGradient
                  colors={['rgba(0,0,0,0.3)', 'transparent', 'rgba(0,0,0,0.6)']}
                  locations={[0, 0.3, 1]}
                  style={StyleSheet.absoluteFillObject}
                />
                
                {/* Top bar with badges */}
                <View style={desktopStyles.topBar}>
                  <View style={desktopStyles.sessionBadges}>
                    <Badge label="VIDEO SESSION" variant="live" size="sm" />
                    <View style={desktopStyles.liveBadge}>
                      <View style={desktopStyles.liveDot} />
                      <Text style={desktopStyles.liveText}>Live</Text>
                    </View>
                    <View style={desktopStyles.recordingBadge}>
                      <Ionicons name="radio" size={10} color={Colors.semantic.error} />
                      <Text style={desktopStyles.recordingText}>Recording</Text>
                    </View>
                  </View>
                  <Text style={desktopStyles.identityText}>
                    {mockTenant.businessName} • Suite {mockTenant.suiteId}
                  </Text>
                </View>

                {/* Bottom label for Ava */}
                <View style={desktopStyles.fullscreenVideoLabel}>
                  <Text style={desktopStyles.videoTileName}>Ava</Text>
                  <View style={desktopStyles.videoTileLiveDot} />
                </View>
              </ImageBackground>
            )}
            </View>

            {/* Zoom-style control bar - between video and authority queue */}
            <View style={desktopStyles.controlBar}>
              <View style={desktopStyles.controlBarInner}>
                <Pressable 
                  style={desktopStyles.controlButtonLabeled}
                  onPress={() => {
                    setIsMuted(!isMuted);
                    showToast(isMuted ? 'Microphone on' : 'Microphone muted', 'info');
                  }}
                >
                  <View style={[desktopStyles.controlIconWrapper, isMuted && desktopStyles.controlIconWrapperActive]}>
                    <Ionicons 
                      name={isMuted ? "mic-off" : "mic"} 
                      size={20} 
                      color={isMuted ? Colors.semantic.error : '#fff'} 
                    />
                  </View>
                  <Text style={desktopStyles.controlLabel}>{isMuted ? 'Unmute' : 'Mute'}</Text>
                </Pressable>
                
                <Pressable 
                  style={desktopStyles.controlButtonLabeled}
                  onPress={() => {
                    setIsVideoOff(!isVideoOff);
                    showToast(isVideoOff ? 'Video on' : 'Video off', 'info');
                  }}
                >
                  <View style={[desktopStyles.controlIconWrapper, isVideoOff && desktopStyles.controlIconWrapperActive]}>
                    <Ionicons 
                      name={isVideoOff ? "videocam-off" : "videocam"} 
                      size={20} 
                      color={isVideoOff ? Colors.semantic.error : '#fff'} 
                    />
                  </View>
                  <Text style={desktopStyles.controlLabel}>{isVideoOff ? 'Start Video' : 'Stop Video'}</Text>
                </Pressable>
                
                <Pressable style={desktopStyles.controlButtonLabeled}>
                  <View style={desktopStyles.controlIconWrapper}>
                    <Ionicons name="desktop-outline" size={20} color="#fff" />
                  </View>
                  <Text style={desktopStyles.controlLabel}>Share Screen</Text>
                </Pressable>
                
                <Pressable 
                  style={desktopStyles.controlButtonLabeled}
                  onPress={() => setChatVisible(true)}
                >
                  <View style={[desktopStyles.controlIconWrapper, chatMessages.length > 0 && desktopStyles.controlWithBadge]}>
                    <Ionicons name="chatbubble-ellipses-outline" size={20} color="#fff" />
                    {chatMessages.length > 0 && (
                      <View style={desktopStyles.controlBadge}>
                        <Text style={desktopStyles.controlBadgeText}>{chatMessages.length}</Text>
                      </View>
                    )}
                  </View>
                  <Text style={desktopStyles.controlLabel}>Chat</Text>
                </Pressable>
                
                <Pressable 
                  style={desktopStyles.controlButtonLabeled}
                  onPress={() => setContextPanelVisible(true)}
                >
                  <View style={desktopStyles.controlIconWrapper}>
                    <Ionicons name="layers-outline" size={20} color="#fff" />
                  </View>
                  <Text style={desktopStyles.controlLabel}>Context</Text>
                </Pressable>
                
                <Pressable 
                  style={desktopStyles.controlButtonLabeled}
                  onPress={() => setMenuVisible(true)}
                >
                  <View style={desktopStyles.controlIconWrapper}>
                    <Ionicons name="ellipsis-horizontal" size={20} color="#fff" />
                  </View>
                  <Text style={desktopStyles.controlLabel}>More</Text>
                </Pressable>
                
                <Pressable 
                  style={desktopStyles.endCallButton}
                  onPress={() => setEndSessionVisible(true)}
                >
                  <Ionicons name="call" size={22} color="#fff" style={{ transform: [{ rotate: '135deg' }] }} />
                </Pressable>
              </View>
            </View>

            {/* Permanent Authority Queue Section - Fixed below video */}
            <View style={desktopStyles.authoritySection}>
              <View style={desktopStyles.authoritySectionHeader}>
                <Text style={desktopStyles.authoritySectionTitle}>Authority Queue</Text>
                <Text style={desktopStyles.authoritySectionCount}>{authorityItems.length} pending</Text>
              </View>
              <ScrollView 
                horizontal 
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={desktopStyles.authorityScrollContent}
              >
                {authorityItems.length === 0 ? (
                  <View style={desktopStyles.emptyQueueInline}>
                    <Ionicons name="checkmark-circle" size={24} color={Colors.semantic.success} />
                    <Text style={desktopStyles.emptyQueueInlineText}>No pending approvals</Text>
                  </View>
                ) : (
                  authorityItems.map((item) => (
                    <View key={item.id} style={desktopStyles.authorityCardInline}>
                      <View style={desktopStyles.authorityCardInlineHeader}>
                        <Ionicons 
                          name={item.type === 'invoice' ? 'document-text' : item.type === 'contract' ? 'document' : 'card'} 
                          size={16} 
                          color={Colors.accent.cyan} 
                        />
                        <Text style={desktopStyles.authorityCardInlineTitle} numberOfLines={1}>{item.title}</Text>
                      </View>
                      <Text style={desktopStyles.authorityCardInlineDesc} numberOfLines={2}>{item.subtitle}</Text>
                      <View style={desktopStyles.authorityCardInlineActions}>
                        <Pressable 
                          style={desktopStyles.approveButtonSmall}
                          onPress={() => handleApprove(item.id)}
                        >
                          <Text style={desktopStyles.approveButtonSmallText}>Approve</Text>
                        </Pressable>
                        <Pressable 
                          style={desktopStyles.reviewButtonSmall}
                          onPress={() => router.push('/session/authority')}
                        >
                          <Text style={desktopStyles.reviewButtonSmallText}>Review</Text>
                        </Pressable>
                      </View>
                    </View>
                  ))
                )}
              </ScrollView>
            </View>
          </View>

          <BottomSheet
            visible={menuVisible}
            onClose={() => setMenuVisible(false)}
            title="Session Options"
            options={MENU_OPTIONS}
            onSelect={handleMenuSelect}
          />

          <ChatDrawer
            visible={chatVisible}
            onClose={() => setChatVisible(false)}
            messages={chatMessages}
            onSend={handleSendChat}
          />

          {/* Context Panel Drawer for Session Context & Authority Queue */}
          {contextPanelVisible && (
            <View style={desktopStyles.contextDrawer}>
              <View style={desktopStyles.drawerHeader}>
                <Text style={desktopStyles.drawerTitle}>Session Context</Text>
                <Pressable onPress={() => setContextPanelVisible(false)}>
                  <Ionicons name="close" size={24} color="#fff" />
                </Pressable>
              </View>
              
              <ScrollView style={desktopStyles.drawerContent}>
                {/* Session Context */}
                <View style={desktopStyles.contextSection}>
                  <Text style={desktopStyles.contextSectionTitle}>Current Context</Text>
                  <View style={desktopStyles.contextCard}>
                    <Text style={desktopStyles.contextLabel}>Topic</Text>
                    <Text style={desktopStyles.contextValue}>Account Review - Q4 Billing</Text>
                  </View>
                  <View style={desktopStyles.contextCard}>
                    <Text style={desktopStyles.contextLabel}>Client</Text>
                    <Text style={desktopStyles.contextValue}>Zenith Solutions</Text>
                  </View>
                  <View style={desktopStyles.contextCard}>
                    <Text style={desktopStyles.contextLabel}>Duration</Text>
                    <Text style={desktopStyles.contextValue}>{Math.floor(duration / 60)}:{String(duration % 60).padStart(2, '0')}</Text>
                  </View>
                </View>
                
                {/* Authority Queue */}
                <View style={desktopStyles.contextSection}>
                  <Text style={desktopStyles.contextSectionTitle}>Authority Queue</Text>
                  {authorityItems.length === 0 ? (
                    <View style={desktopStyles.emptyQueue}>
                      <Ionicons name="checkmark-circle" size={32} color={Colors.semantic.success} />
                      <Text style={desktopStyles.emptyQueueText}>No pending approvals</Text>
                    </View>
                  ) : (
                    authorityItems.map((item, index) => (
                      <View key={index} style={desktopStyles.authorityCard}>
                        <View style={desktopStyles.authorityCardHeader}>
                          <Ionicons 
                            name={item.type === 'invoice' ? 'document-text' : item.type === 'contract' ? 'document' : 'card'} 
                            size={18} 
                            color={Colors.accent.cyan} 
                          />
                          <Text style={desktopStyles.authorityTitle}>{item.title}</Text>
                        </View>
                        <Text style={desktopStyles.authorityDescription}>{item.subtitle}</Text>
                        <View style={desktopStyles.authorityActions}>
                          <Pressable 
                            style={desktopStyles.approveButton}
                            onPress={() => {
                              setAuthorityItems(prev => prev.filter((_, i) => i !== index));
                              showToast('Approved', 'success');
                            }}
                          >
                            <Text style={desktopStyles.approveButtonText}>Approve</Text>
                          </Pressable>
                          <Pressable 
                            style={desktopStyles.reviewButton}
                            onPress={() => router.push('/session/authority')}
                          >
                            <Text style={desktopStyles.reviewButtonText}>Review</Text>
                          </Pressable>
                        </View>
                      </View>
                    ))
                  )}
                </View>
              </ScrollView>
            </View>
          )}

          <ConfirmationModal
            visible={endSessionVisible}
            onClose={() => setEndSessionVisible(false)}
            onConfirm={handleEndSession}
            title="End Video Session"
            message="Are you sure you want to end this video session? The recording will be saved."
            confirmLabel="End Session"
            destructive
            icon="videocam-off"
          />
        </View>
      </FullscreenSessionShell>
    );
  }

  return videoContent;
}

const desktopStyles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#000000',
  },
  mainArea: {
    flex: 1,
    flexDirection: 'row',
  },
  mainContent: {
    flex: 1,
    flexDirection: 'column',
  },
  videoSection: {
    flex: 1,
    flexDirection: 'column',
  },
  videoContent: {
    flex: 1,
    position: 'relative',
  },
  authoritySection: {
    backgroundColor: 'rgba(20, 20, 25, 0.95)',
    borderTopWidth: 1,
    borderTopColor: 'rgba(255,255,255,0.08)',
    paddingVertical: 12,
    paddingHorizontal: 16,
  },
  authoritySectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 10,
  },
  authoritySectionTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#fff',
  },
  authoritySectionCount: {
    fontSize: 12,
    color: '#A1A1AA',
  },
  authorityScrollContent: {
    gap: 12,
    paddingRight: 16,
  },
  emptyQueueInline: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingVertical: 8,
  },
  emptyQueueInlineText: {
    fontSize: 13,
    color: '#D4D4D8',
  },
  authorityCardInline: {
    width: 280,
    backgroundColor: 'rgba(255,255,255,0.05)',
    borderRadius: 10,
    padding: 12,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
  },
  authorityCardInlineHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 6,
  },
  authorityCardInlineTitle: {
    fontSize: 13,
    fontWeight: '600',
    color: '#fff',
    flex: 1,
  },
  authorityCardInlineDesc: {
    fontSize: 12,
    color: '#D4D4D8',
    marginBottom: 10,
    lineHeight: 16,
  },
  authorityCardInlineActions: {
    flexDirection: 'row',
    gap: 8,
  },
  approveButtonSmall: {
    backgroundColor: Colors.semantic.success,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 6,
  },
  approveButtonSmallText: {
    color: '#fff',
    fontSize: 11,
    fontWeight: '600',
  },
  reviewButtonSmall: {
    backgroundColor: 'rgba(255,255,255,0.1)',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 6,
  },
  reviewButtonSmallText: {
    color: '#fff',
    fontSize: 11,
    fontWeight: '500',
  },
  videoBackground: {
    flex: 1,
    backgroundColor: '#000000',
  },
  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 80,
    paddingTop: 24,
  },
  sessionBadges: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
  },
  liveBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  liveDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: Colors.semantic.success,
  },
  liveText: {
    fontSize: 12,
    color: Colors.semantic.success,
    fontWeight: '600',
  },
  recordingBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  recordingText: {
    fontSize: 12,
    color: Colors.semantic.error,
    fontWeight: '500',
  },
  identityText: {
    fontSize: 13,
    color: '#D4D4D8',
  },
  avatarCenter: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarCircle: {
    width: 160,
    height: 160,
    borderRadius: 80,
    backgroundColor: 'rgba(52, 152, 219, 0.2)',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
    borderWidth: 3,
    borderColor: Colors.accent.cyan,
  },
  avatarCircleOff: {
    borderColor: 'rgba(255,255,255,0.3)',
    backgroundColor: 'rgba(255,255,255,0.05)',
  },
  avatarLetter: {
    color: Colors.accent.cyan,
    fontSize: 64,
    fontWeight: '700',
  },
  avatarName: {
    color: '#fff',
    fontSize: 24,
    fontWeight: '600',
    marginBottom: 4,
  },
  avatarStatus: {
    color: Colors.semantic.success,
    fontSize: 14,
  },
  avatarCircleConnecting: {
    borderColor: Colors.semantic.warning,
    borderStyle: 'dashed',
  },
  avatarStatusConnecting: {
    color: Colors.semantic.warning,
    fontSize: 14,
  },
  avatarStatusOff: {
    color: '#A1A1AA',
    fontSize: 14,
  },
  videoTileWrapper: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  videoTile: {
    width: '80%',
    height: '70%',
    borderRadius: 16,
    overflow: 'hidden',
  },
  videoTileImage: {
    borderRadius: 16,
  },
  videoTileGradient: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
  },
  videoTileLabel: {
    position: 'absolute',
    bottom: 24,
    left: 24,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: 'rgba(0, 0, 0, 0.6)',
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 20,
  },
  videoTileName: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  videoTileLiveDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: Colors.semantic.success,
  },
  fullscreenVideoTile: {
    flex: 1,
    backgroundColor: '#000',
  },
  fullscreenVideoLabel: {
    position: 'absolute',
    bottom: 24,
    left: 24,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    backgroundColor: 'rgba(0,0,0,0.5)',
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 24,
  },
  contextDrawer: {
    position: 'absolute',
    top: 0,
    right: 0,
    bottom: 0,
    width: 380,
    backgroundColor: 'rgba(20, 20, 25, 0.98)',
    borderLeftWidth: 1,
    borderLeftColor: 'rgba(255,255,255,0.08)',
    zIndex: 100,
  },
  drawerHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,255,255,0.08)',
  },
  drawerTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#fff',
  },
  drawerContent: {
    flex: 1,
    padding: 16,
  },
  contextSection: {
    marginBottom: 24,
  },
  contextSectionTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#D4D4D8',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 12,
  },
  contextCard: {
    backgroundColor: 'rgba(255,255,255,0.05)',
    borderRadius: 10,
    padding: 14,
    marginBottom: 8,
  },
  contextLabel: {
    fontSize: 12,
    color: '#A1A1AA',
    marginBottom: 4,
  },
  contextValue: {
    fontSize: 15,
    color: '#fff',
    fontWeight: '500',
  },
  emptyQueue: {
    alignItems: 'center',
    paddingVertical: 32,
    gap: 12,
  },
  emptyQueueText: {
    fontSize: 14,
    color: '#D4D4D8',
  },
  authorityCard: {
    backgroundColor: 'rgba(255,255,255,0.05)',
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
  },
  authorityCardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginBottom: 8,
  },
  authorityTitle: {
    fontSize: 15,
    fontWeight: '600',
    color: '#fff',
    flex: 1,
  },
  authorityDescription: {
    fontSize: 13,
    color: '#D4D4D8',
    marginBottom: 12,
  },
  authorityActions: {
    flexDirection: 'row',
    gap: 12,
  },
  approveButton: {
    backgroundColor: Colors.semantic.success,
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 8,
  },
  approveButtonText: {
    color: '#fff',
    fontSize: 13,
    fontWeight: '600',
  },
  reviewButton: {
    backgroundColor: 'rgba(255,255,255,0.1)',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 8,
  },
  reviewButtonText: {
    color: '#fff',
    fontSize: 13,
    fontWeight: '500',
  },
  sidePanel: {
    width: 360,
    backgroundColor: 'rgba(20, 20, 25, 0.95)',
    borderLeftWidth: 1,
    borderLeftColor: 'rgba(255,255,255,0.08)',
    paddingTop: 80,
  },
  panelSection: {
    padding: 20,
  },
  panelTitle: {
    fontSize: 12,
    fontWeight: '600',
    color: '#A1A1AA',
    letterSpacing: 0.5,
    textTransform: 'uppercase',
    marginBottom: 16,
  },
  panelDivider: {
    height: 1,
    backgroundColor: 'rgba(255,255,255,0.06)',
    marginHorizontal: 20,
  },
  contextChips: {
    gap: 8,
  },
  contextChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    backgroundColor: 'rgba(255,255,255,0.05)',
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 8,
  },
  chipText: {
    color: 'rgba(255,255,255,0.8)',
    fontSize: 13,
    flex: 1,
  },
  authorityCardMobile: {
    backgroundColor: 'rgba(255,255,255,0.03)',
    borderRadius: 10,
    padding: 14,
    marginBottom: 10,
  },
  authorityHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 6,
  },
  authorityTitleMobile: {
    fontSize: 14,
    color: '#fff',
    fontWeight: '500',
    flex: 1,
    marginRight: 8,
  },
  riskBadge: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 4,
  },
  riskText: {
    fontSize: 10,
    fontWeight: '600',
  },
  authorityDescriptionMobile: {
    fontSize: 12,
    color: '#A1A1AA',
    marginBottom: 12,
  },
  authorityActionsMobile: {
    flexDirection: 'row',
    gap: 10,
  },
  denyButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    backgroundColor: 'rgba(239, 68, 68, 0.15)',
    paddingVertical: 8,
    borderRadius: 6,
  },
  denyText: {
    fontSize: 12,
    color: Colors.semantic.error,
    fontWeight: '600',
  },
  approveButtonMobile: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    backgroundColor: 'rgba(34, 197, 94, 0.15)',
    paddingVertical: 8,
    borderRadius: 6,
  },
  approveText: {
    fontSize: 12,
    color: Colors.semantic.success,
    fontWeight: '600',
  },
  controlBar: {
    paddingVertical: 12,
    paddingHorizontal: 20,
    backgroundColor: 'rgba(20, 20, 25, 0.98)',
    borderTopWidth: 1,
    borderTopColor: 'rgba(255,255,255,0.08)',
  },
  controlBarInner: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 16,
  },
  controlButton: {
    width: 52,
    height: 52,
    borderRadius: 26,
    backgroundColor: 'rgba(255,255,255,0.15)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  controlButtonActive: {
    backgroundColor: 'rgba(239, 68, 68, 0.3)',
  },
  controlButtonLabeled: {
    alignItems: 'center',
    gap: 6,
  },
  controlIconWrapper: {
    width: 48,
    height: 48,
    borderRadius: 12,
    backgroundColor: 'rgba(255,255,255,0.12)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  controlIconWrapperActive: {
    backgroundColor: 'rgba(59, 130, 246, 0.25)',
  },
  controlLabel: {
    fontSize: 11,
    color: 'rgba(255,255,255,0.8)',
    fontWeight: '500',
  },
  endCallButton: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: '#ff3b30',
    alignItems: 'center',
    justifyContent: 'center',
  },
});

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background.primary,
  },
  videoContainer: {
    height: 280,
    overflow: 'hidden',
  },
  videoBackground: {
    flex: 1,
    backgroundColor: Colors.background.secondary,
  },
  videoGradient: {
    ...StyleSheet.absoluteFillObject,
  },
  videoHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: Spacing.lg,
    paddingTop: Spacing.md,
  },
  backButton: {
    padding: Spacing.sm,
  },
  headerCenter: {
    flex: 1,
    alignItems: 'center',
  },
  headerBadges: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    marginTop: 4,
  },
  liveBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  liveDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: Colors.semantic.success,
  },
  liveText: {
    ...Typography.micro,
    color: Colors.semantic.success,
  },
  recordingBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  recordingText: {
    ...Typography.micro,
    color: Colors.semantic.error,
  },
  menuButton: {
    padding: Spacing.sm,
  },
  avatarContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarCircle: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: Colors.accent.cyanDark,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: Spacing.sm,
    borderWidth: 2,
    borderColor: Colors.accent.cyan,
  },
  avatarCircleOff: {
    borderColor: Colors.text.muted,
    backgroundColor: Colors.background.tertiary,
  },
  avatarLetter: {
    color: Colors.accent.cyan,
    fontSize: 32,
    fontWeight: '700',
  },
  avatarName: {
    color: Colors.text.primary,
    fontSize: Typography.headline.fontSize,
    fontWeight: '600',
  },
  avatarStatus: {
    color: Colors.semantic.success,
    fontSize: Typography.small.fontSize,
  },
  avatarCircleConnecting: {
    borderColor: Colors.semantic.warning,
    borderStyle: 'dashed',
  },
  avatarStatusConnecting: {
    color: Colors.semantic.warning,
    fontSize: Typography.small.fontSize,
  },
  avatarStatusOff: {
    color: Colors.text.muted,
    fontSize: Typography.small.fontSize,
  },
  videoTileWrapper: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
  },
  videoTile: {
    flex: 1,
    width: '100%',
    height: '100%',
  },
  videoTileImage: {
    resizeMode: 'cover',
  },
  videoTileGradient: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
  },
  videoTileLabel: {
    position: 'absolute',
    bottom: 12,
    left: 12,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
  },
  videoTileName: {
    color: Colors.text.primary,
    fontSize: Typography.body.fontSize,
    fontWeight: '600',
  },
  videoTileLiveDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: Colors.semantic.success,
  },
  content: {
    paddingHorizontal: Spacing.xl,
    paddingBottom: 140,
  },
  identityBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.sm,
    paddingVertical: Spacing.md,
  },
  identityDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: Colors.semantic.success,
  },
  identityText: {
    color: Colors.text.muted,
    fontSize: Typography.small.fontSize,
  },
  contextSection: {
    marginBottom: Spacing.xl,
  },
  contextChips: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.sm,
  },
  contextChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.xs,
    backgroundColor: Colors.background.secondary,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    borderRadius: BorderRadius.sm,
    borderWidth: 1,
    borderColor: Colors.border.subtle,
    maxWidth: '48%',
  },
  chipText: {
    color: Colors.text.secondary,
    fontSize: Typography.small.fontSize,
    flex: 1,
  },
  authoritySection: {
    marginBottom: Spacing.xl,
  },
  authorityCard: {
    marginBottom: Spacing.md,
    padding: Spacing.md,
    borderRadius: BorderRadius.md,
    borderWidth: 1,
    borderColor: Colors.border.default,
  },
  authorityHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: Spacing.xs,
  },
  authorityTitle: {
    ...Typography.body,
    color: Colors.text.primary,
    fontWeight: '600',
    flex: 1,
    marginRight: Spacing.sm,
  },
  riskBadge: {
    paddingHorizontal: Spacing.sm,
    paddingVertical: 2,
    borderRadius: BorderRadius.sm,
  },
  riskText: {
    ...Typography.micro,
    fontWeight: '600',
  },
  authorityDescription: {
    ...Typography.small,
    color: Colors.text.muted,
    marginBottom: Spacing.md,
  },
  authorityActions: {
    flexDirection: 'row',
    gap: Spacing.md,
  },
  denyButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.xs,
    backgroundColor: Colors.semantic.errorDark,
    paddingVertical: Spacing.sm,
    borderRadius: BorderRadius.md,
  },
  denyText: {
    ...Typography.small,
    color: Colors.semantic.error,
    fontWeight: '600',
  },
  approveButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.xs,
    backgroundColor: Colors.semantic.successDark,
    paddingVertical: Spacing.sm,
    borderRadius: BorderRadius.md,
  },
  approveText: {
    ...Typography.small,
    color: Colors.semantic.success,
    fontWeight: '600',
  },
  controls: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    flexDirection: 'row',
    justifyContent: 'center',
    gap: Spacing.md,
    paddingVertical: Spacing.xl,
    paddingBottom: 40,
    backgroundColor: Colors.background.primary,
    borderTopWidth: 1,
    borderTopColor: Colors.border.subtle,
  },
  controlButton: {
    width: 52,
    height: 52,
    borderRadius: 26,
    backgroundColor: Colors.background.tertiary,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: Colors.border.default,
  },
  controlButtonActive: {
    backgroundColor: Colors.semantic.errorDark,
    borderColor: Colors.semantic.error,
  },
  endCallButton: {
    width: 52,
    height: 52,
    borderRadius: 26,
    backgroundColor: Colors.semantic.error,
    alignItems: 'center',
    justifyContent: 'center',
    transform: [{ rotate: '135deg' }],
  },
  chatBadge: {
    position: 'absolute',
    top: -4,
    right: -4,
    backgroundColor: Colors.accent.cyan,
    borderRadius: 10,
    minWidth: 18,
    height: 18,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 4,
  },
  chatBadgeText: {
    ...Typography.micro,
    color: Colors.background.primary,
    fontWeight: '700',
  },
});
