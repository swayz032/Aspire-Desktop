import React, { useState } from 'react';
import { View, Text, StyleSheet, Modal, Pressable, TextInput, ScrollView } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Colors, Typography, Spacing, BorderRadius } from '@/constants/tokens';
import { MEMBER_DIRECTORY } from '@/data/session';

interface InviteSheetProps {
  visible: boolean;
  onClose: () => void;
  onInviteMember: (memberId: string, name: string) => void;
  onInviteGuest: (name: string, contact: string) => void;
  onCopyLink: () => void;
}

type Tab = 'member' | 'guest' | 'link';

export function InviteSheet({ visible, onClose, onInviteMember, onInviteGuest, onCopyLink }: InviteSheetProps) {
  const [activeTab, setActiveTab] = useState<Tab>('member');
  const [searchQuery, setSearchQuery] = useState('');
  const [guestName, setGuestName] = useState('');
  const [guestContact, setGuestContact] = useState('');
  
  const filteredMembers = MEMBER_DIRECTORY.filter(m => 
    m.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    m.role.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const handleInviteGuest = () => {
    if (guestName.trim()) {
      onInviteGuest(guestName.trim(), guestContact.trim());
      setGuestName('');
      setGuestContact('');
      onClose();
    }
  };

  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      onRequestClose={onClose}
    >
      <View style={[styles.overlay, { pointerEvents: 'box-none' }]}>
        <Pressable style={styles.backdrop} onPress={onClose} />
        <View style={[styles.sheet, { pointerEvents: 'auto' }]}>
          <View style={styles.handle} />
          <Text style={styles.title}>Invite Participant</Text>
          
          <View style={styles.tabs}>
            <Pressable 
              style={({ pressed }) => [styles.tab, activeTab === 'member' && styles.tabActive, pressed && styles.pressed]}
              onPress={() => setActiveTab('member')}
            >
              <Text style={[styles.tabText, activeTab === 'member' && styles.tabTextActive]}>Member</Text>
            </Pressable>
            <Pressable 
              style={({ pressed }) => [styles.tab, activeTab === 'guest' && styles.tabActive, pressed && styles.pressed]}
              onPress={() => setActiveTab('guest')}
            >
              <Text style={[styles.tabText, activeTab === 'guest' && styles.tabTextActive]}>Guest</Text>
            </Pressable>
            <Pressable 
              style={({ pressed }) => [styles.tab, activeTab === 'link' && styles.tabActive, pressed && styles.pressed]}
              onPress={() => setActiveTab('link')}
            >
              <Text style={[styles.tabText, activeTab === 'link' && styles.tabTextActive]}>Link</Text>
            </Pressable>
          </View>
          
          {activeTab === 'member' && (
            <View style={styles.content}>
              <View style={styles.searchContainer}>
                <Ionicons name="search" size={18} color={Colors.text.muted} />
                <TextInput
                  style={styles.searchInput}
                  placeholder="Search members..."
                  placeholderTextColor={Colors.text.muted}
                  value={searchQuery}
                  onChangeText={setSearchQuery}
                />
              </View>
              <ScrollView style={styles.memberList} showsVerticalScrollIndicator={false}>
                {filteredMembers.map((member) => (
                  <Pressable 
                    key={member.id} 
                    style={({ pressed }) => [styles.memberItem, pressed && styles.pressed]}
                    onPress={() => {
                      onInviteMember(member.id, member.name);
                      onClose();
                    }}
                  >
                    <View style={styles.memberAvatar}>
                      <Text style={styles.memberInitial}>{member.name.charAt(0)}</Text>
                    </View>
                    <View style={styles.memberInfo}>
                      <Text style={styles.memberName}>{member.name}</Text>
                      <Text style={styles.memberRole}>{member.role}</Text>
                    </View>
                    <Ionicons name="add-circle" size={24} color={Colors.accent.cyan} />
                  </Pressable>
                ))}
              </ScrollView>
            </View>
          )}
          
          {activeTab === 'guest' && (
            <View style={styles.content}>
              <Text style={styles.inputLabel}>Guest Name</Text>
              <TextInput
                style={styles.textInput}
                placeholder="Enter name"
                placeholderTextColor={Colors.text.muted}
                value={guestName}
                onChangeText={setGuestName}
              />
              <Text style={styles.inputLabel}>Email or Phone</Text>
              <TextInput
                style={styles.textInput}
                placeholder="Enter email or phone"
                placeholderTextColor={Colors.text.muted}
                value={guestContact}
                onChangeText={setGuestContact}
                keyboardType="email-address"
              />
              <Pressable 
                style={({ pressed }) => [styles.inviteButton, !guestName.trim() && styles.inviteButtonDisabled, pressed && styles.pressed]}
                onPress={handleInviteGuest}
                disabled={!guestName.trim()}
              >
                <Text style={styles.inviteButtonText}>Send Invite</Text>
              </Pressable>
            </View>
          )}
          
          {activeTab === 'link' && (
            <View style={styles.content}>
              <View style={styles.linkContainer}>
                <Ionicons name="link" size={24} color={Colors.accent.cyan} />
                <Text style={styles.linkText}>aspire.app/room/CR-01</Text>
              </View>
              <Pressable 
                style={({ pressed }) => [styles.copyButton, pressed && styles.pressed]}
                onPress={() => {
                  onCopyLink();
                  onClose();
                }}
              >
                <Ionicons name="copy" size={18} color={Colors.text.primary} />
                <Text style={styles.copyButtonText}>Copy Room Link</Text>
              </Pressable>
            </View>
          )}
          
          <Pressable style={({ pressed }) => [styles.cancelButton, pressed && styles.pressed]} onPress={onClose}>
            <Text style={styles.cancelText}>Cancel</Text>
          </Pressable>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.6)',
    justifyContent: 'flex-end',
  },
  backdrop: {
    ...StyleSheet.absoluteFillObject,
    zIndex: 0,
  },
  sheet: {
    backgroundColor: Colors.background.secondary,
    borderTopLeftRadius: BorderRadius.xl,
    borderTopRightRadius: BorderRadius.xl,
    paddingHorizontal: Spacing.lg,
    paddingBottom: 40,
    maxHeight: '80%',
    zIndex: 1,
  },
  handle: {
    width: 36,
    height: 4,
    backgroundColor: Colors.border.default,
    borderRadius: 2,
    alignSelf: 'center',
    marginTop: Spacing.md,
    marginBottom: Spacing.lg,
  },
  title: {
    ...Typography.headline,
    color: Colors.text.primary,
    textAlign: 'center',
    marginBottom: Spacing.lg,
  },
  tabs: {
    flexDirection: 'row',
    backgroundColor: Colors.background.tertiary,
    borderRadius: BorderRadius.md,
    padding: 4,
    marginBottom: Spacing.lg,
  },
  tab: {
    flex: 1,
    paddingVertical: Spacing.sm,
    alignItems: 'center',
    borderRadius: BorderRadius.sm,
  },
  tabActive: {
    backgroundColor: Colors.background.secondary,
  },
  tabText: {
    ...Typography.small,
    color: Colors.text.muted,
    fontWeight: '500',
  },
  tabTextActive: {
    color: Colors.text.primary,
  },
  content: {
    minHeight: 200,
  },
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.background.tertiary,
    borderRadius: BorderRadius.md,
    paddingHorizontal: Spacing.md,
    marginBottom: Spacing.md,
  },
  searchInput: {
    flex: 1,
    paddingVertical: Spacing.md,
    paddingLeft: Spacing.sm,
    color: Colors.text.primary,
    ...Typography.body,
  },
  memberList: {
    maxHeight: 250,
  },
  memberItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: Spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border.subtle,
  },
  memberAvatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: Colors.accent.cyanDark,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: Spacing.md,
  },
  memberInitial: {
    ...Typography.body,
    color: Colors.accent.cyan,
    fontWeight: '600',
  },
  memberInfo: {
    flex: 1,
  },
  memberName: {
    ...Typography.body,
    color: Colors.text.primary,
    fontWeight: '500',
  },
  memberRole: {
    ...Typography.small,
    color: Colors.text.muted,
  },
  inputLabel: {
    ...Typography.small,
    color: Colors.text.secondary,
    marginBottom: Spacing.xs,
    marginTop: Spacing.md,
  },
  textInput: {
    backgroundColor: Colors.background.tertiary,
    borderRadius: BorderRadius.md,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.md,
    color: Colors.text.primary,
    ...Typography.body,
    borderWidth: 1,
    borderColor: Colors.border.default,
  },
  inviteButton: {
    backgroundColor: Colors.accent.cyan,
    paddingVertical: Spacing.md,
    borderRadius: BorderRadius.md,
    marginTop: Spacing.lg,
    alignItems: 'center',
  },
  inviteButtonDisabled: {
    opacity: 0.5,
  },
  inviteButtonText: {
    ...Typography.body,
    color: Colors.background.primary,
    fontWeight: '600',
  },
  linkContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.background.tertiary,
    padding: Spacing.lg,
    borderRadius: BorderRadius.md,
    marginBottom: Spacing.lg,
  },
  linkText: {
    ...Typography.body,
    color: Colors.text.secondary,
    marginLeft: Spacing.md,
  },
  copyButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: Colors.accent.cyanDark,
    paddingVertical: Spacing.md,
    borderRadius: BorderRadius.md,
    gap: Spacing.sm,
  },
  copyButtonText: {
    ...Typography.body,
    color: Colors.text.primary,
    fontWeight: '600',
  },
  cancelButton: {
    backgroundColor: Colors.background.tertiary,
    paddingVertical: Spacing.md,
    borderRadius: BorderRadius.md,
    marginTop: Spacing.lg,
    alignItems: 'center',
  },
  cancelText: {
    ...Typography.body,
    color: Colors.text.secondary,
    fontWeight: '600',
  },
  pressed: {
    opacity: 0.7,
  },
});
