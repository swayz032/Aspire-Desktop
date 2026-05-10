import React from 'react';
import { View, Text, TextInput, TouchableOpacity, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useProjectAddress } from '@/hooks/useProjectAddress';

interface ProjectAddressBarProps {
  /** Optional override (mostly for tests / Storybook). When omitted, the
   *  bar reads + writes the shared `useProjectAddress` store. */
  initialAddress?: string;
  onAddressChange?: (address: string) => void;
  onNewProject?: () => void;
}

export function ProjectAddressBar({
  initialAddress,
  onAddressChange,
  onNewProject,
}: ProjectAddressBarProps) {
  const { address: storedAddress, setAddress: setStoredAddress } =
    useProjectAddress();

  // If a parent passed `initialAddress` we honor it on mount but otherwise
  // stay in sync with the store. Most callers use the store directly.
  const value = initialAddress !== undefined && storedAddress.length === 0
    ? initialAddress
    : storedAddress;

  const handleChange = (next: string) => {
    setStoredAddress(next);
    onAddressChange?.(next);
  };

  return (
    <View style={styles.container} testID="estimate-studio-project-address-bar">
      <View style={styles.searchWrap}>
        <View style={styles.searchInner}>
          <Ionicons name="location-outline" size={16} color="rgba(255,255,255,0.45)" />
          <TextInput
            value={value}
            onChangeText={handleChange}
            placeholder="Enter property address..."
            placeholderTextColor="rgba(255,255,255,0.35)"
            style={styles.input}
            testID="estimate-studio-address-input"
          />
          {value.length === 0 && (
            <View style={styles.recentChip}>
              <Ionicons name="time-outline" size={12} color="rgba(255,255,255,0.45)" />
              <Text style={styles.recentChipText}>Recent</Text>
              <Ionicons name="chevron-down" size={12} color="rgba(255,255,255,0.45)" />
            </View>
          )}
        </View>
      </View>

      <TouchableOpacity
        style={styles.uploadButton}
        activeOpacity={0.85}
        testID="estimate-studio-upload-evidence"
      >
        <Ionicons name="cloud-upload-outline" size={16} color="rgba(255,255,255,0.85)" />
        <Text style={styles.uploadButtonText}>Upload</Text>
      </TouchableOpacity>

      <TouchableOpacity
        style={styles.newProjectButton}
        activeOpacity={0.85}
        onPress={onNewProject}
        testID="estimate-studio-new-project"
      >
        <Ionicons name="add" size={16} color="#0A0A0F" />
        <Text style={styles.newProjectButtonText}>New Project</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingVertical: 8,
    marginBottom: 16,
  },
  searchWrap: {
    flex: 1,
  },
  searchInner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 12,
    paddingVertical: 9,
    backgroundColor: '#1C1C1E',
    borderRadius: 10,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.06)',
  },
  input: {
    flex: 1,
    color: '#ffffff',
    fontSize: 13,
    padding: 0,
    margin: 0,
    outlineStyle: 'none' as any,
  },
  recentChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
    backgroundColor: 'rgba(255,255,255,0.04)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
  },
  recentChipText: {
    fontSize: 11,
    color: 'rgba(255,255,255,0.55)',
    fontWeight: '500',
  },
  uploadButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 9,
    borderRadius: 10,
    backgroundColor: '#1C1C1E',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.06)',
  },
  uploadButtonText: {
    fontSize: 12,
    fontWeight: '500',
    color: 'rgba(255,255,255,0.85)',
    letterSpacing: -0.1,
  },
  newProjectButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 14,
    paddingVertical: 9,
    borderRadius: 10,
    backgroundColor: '#fbbf24',
  },
  newProjectButtonText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#0A0A0F',
    letterSpacing: -0.1,
  },
});
