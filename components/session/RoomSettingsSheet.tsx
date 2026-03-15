import React, { useState } from 'react';
import { View, Text, StyleSheet, Modal, Pressable, Switch } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Colors, Typography, Spacing, BorderRadius } from '@/constants/tokens';

interface RoomSettingsSheetProps {
  visible: boolean;
  onClose: () => void;
  isRecording: boolean;
  onToggleRecording: (value: boolean) => void;
  onSaveSettings: () => void;
}

export function RoomSettingsSheet({ 
  visible, 
  onClose, 
  isRecording, 
  onToggleRecording,
  onSaveSettings 
}: RoomSettingsSheetProps) {
  const [localRecording, setLocalRecording] = useState(isRecording);
  const [autoTranscribe, setAutoTranscribe] = useState(true);
  const [allowGuests, setAllowGuests] = useState(true);
  const [mutedOnEntry, setMutedOnEntry] = useState(false);

  const handleSave = () => {
    onToggleRecording(localRecording);
    onSaveSettings();
    onClose();
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
              <Text style={styles.title}>Room Settings</Text>
              
              <View style={styles.settingsList}>
                <View style={styles.settingItem}>
                  <View style={styles.settingInfo}>
                    <Ionicons name="radio" size={20} color={Colors.semantic.error} />
                    <View style={styles.settingText}>
                      <Text style={styles.settingLabel}>Recording</Text>
                      <Text style={styles.settingDescription}>Record session audio and transcript</Text>
                    </View>
                  </View>
                  <Switch
                    value={localRecording}
                    onValueChange={setLocalRecording}
                    trackColor={{ false: Colors.background.tertiary, true: Colors.semantic.error }}
                    thumbColor={localRecording ? Colors.text.primary : Colors.text.muted}
                  />
                </View>
                
                <View style={styles.settingItem}>
                  <View style={styles.settingInfo}>
                    <Ionicons name="document-text" size={20} color={Colors.accent.cyan} />
                    <View style={styles.settingText}>
                      <Text style={styles.settingLabel}>Auto-Transcribe</Text>
                      <Text style={styles.settingDescription}>Generate live transcript</Text>
                    </View>
                  </View>
                  <Switch
                    value={autoTranscribe}
                    onValueChange={setAutoTranscribe}
                    trackColor={{ false: Colors.background.tertiary, true: Colors.accent.cyanDark }}
                    thumbColor={autoTranscribe ? Colors.accent.cyan : Colors.text.muted}
                  />
                </View>
                
                <View style={styles.settingItem}>
                  <View style={styles.settingInfo}>
                    <Ionicons name="person-add" size={20} color={Colors.semantic.warning} />
                    <View style={styles.settingText}>
                      <Text style={styles.settingLabel}>Allow Guests</Text>
                      <Text style={styles.settingDescription}>External participants can join</Text>
                    </View>
                  </View>
                  <Switch
                    value={allowGuests}
                    onValueChange={setAllowGuests}
                    trackColor={{ false: Colors.background.tertiary, true: Colors.semantic.warningDark }}
                    thumbColor={allowGuests ? Colors.semantic.warning : Colors.text.muted}
                  />
                </View>
                
                <View style={styles.settingItem}>
                  <View style={styles.settingInfo}>
                    <Ionicons name="mic-off" size={20} color={Colors.text.muted} />
                    <View style={styles.settingText}>
                      <Text style={styles.settingLabel}>Muted on Entry</Text>
                      <Text style={styles.settingDescription}>New participants join muted</Text>
                    </View>
                  </View>
                  <Switch
                    value={mutedOnEntry}
                    onValueChange={setMutedOnEntry}
                    trackColor={{ false: Colors.background.tertiary, true: Colors.accent.cyanDark }}
                    thumbColor={mutedOnEntry ? Colors.accent.cyan : Colors.text.muted}
                  />
                </View>
              </View>
              
          <Pressable style={({ pressed }) => [styles.saveButton, pressed && styles.buttonPressed]} onPress={handleSave}>
            <Text style={styles.saveText}>Save Settings</Text>
          </Pressable>
          
          <Pressable style={({ pressed }) => [styles.cancelButton, pressed && styles.buttonPressed]} onPress={onClose}>
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
  settingsList: {
    gap: Spacing.sm,
  },
  settingItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: Colors.background.tertiary,
    padding: Spacing.md,
    borderRadius: BorderRadius.md,
  },
  settingInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
    gap: Spacing.md,
  },
  settingText: {
    flex: 1,
  },
  settingLabel: {
    ...Typography.body,
    color: Colors.text.primary,
    fontWeight: '500',
  },
  settingDescription: {
    ...Typography.micro,
    color: Colors.text.muted,
  },
  saveButton: {
    backgroundColor: Colors.accent.cyan,
    paddingVertical: Spacing.md,
    borderRadius: BorderRadius.md,
    marginTop: Spacing.lg,
    alignItems: 'center',
  },
  saveText: {
    ...Typography.body,
    color: Colors.background.primary,
    fontWeight: '600',
  },
  cancelButton: {
    backgroundColor: Colors.background.tertiary,
    paddingVertical: Spacing.md,
    borderRadius: BorderRadius.md,
    marginTop: Spacing.sm,
    alignItems: 'center',
  },
  cancelText: {
    ...Typography.body,
    color: Colors.text.secondary,
    fontWeight: '600',
  },
  buttonPressed: {
    opacity: 0.7,
  },
});
