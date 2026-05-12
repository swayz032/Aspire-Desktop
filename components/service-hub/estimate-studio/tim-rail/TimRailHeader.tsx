import React from 'react';
import { View, Text, Image, StyleSheet, TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

const timPortrait = require('@/assets/agents/tim/tim-portrait.png');

export function TimRailHeader() {
  return (
    <View style={styles.container} testID="tim-rail-header">
      <View style={styles.left}>
        <View style={styles.avatarWrap}>
          <Image source={timPortrait} style={styles.avatar} resizeMode="cover" />
          <View style={styles.onlineDot} />
        </View>
        <View style={styles.identity}>
          <Text style={styles.name}>Tim — Service Hub Manager</Text>
          <Text style={styles.role}>AI estimating assistant</Text>
          <View style={styles.statusBadge}>
            <Text style={styles.statusBadgeText}>Private Beta</Text>
          </View>
        </View>
      </View>
      <View style={styles.right}>
        <TouchableOpacity activeOpacity={0.85} style={styles.iconButton} testID="tim-rail-call-btn">
          <Ionicons name="call-outline" size={15} color="rgba(255,255,255,0.7)" />
        </TouchableOpacity>
        <TouchableOpacity activeOpacity={0.85} style={styles.iconButton} testID="tim-rail-video-btn">
          <Ionicons name="videocam-outline" size={15} color="rgba(255,255,255,0.7)" />
        </TouchableOpacity>
        <TouchableOpacity activeOpacity={0.85} style={[styles.iconButton, styles.iconButtonAccent]} testID="tim-rail-mic-btn-header">
          <Ionicons name="mic-outline" size={15} color="#fbbf24" />
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    paddingHorizontal: 14,
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,255,255,0.06)',
    gap: 8,
  },
  left: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
    flex: 1,
  },
  avatarWrap: {
    position: 'relative',
    width: 40,
    height: 40,
  },
  avatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(255,255,255,0.06)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.12)',
  },
  onlineDot: {
    position: 'absolute',
    bottom: -1,
    right: -1,
    width: 11,
    height: 11,
    borderRadius: 5.5,
    backgroundColor: '#34d399',
    borderWidth: 2,
    borderColor: '#0A0A0F',
  },
  identity: {
    flex: 1,
    gap: 2,
  },
  name: {
    fontSize: 13,
    fontWeight: '700',
    color: 'rgba(255,255,255,0.95)',
    letterSpacing: -0.1,
  },
  role: {
    fontSize: 11,
    color: 'rgba(255,255,255,0.55)',
    marginBottom: 4,
  },
  statusBadge: {
    alignSelf: 'flex-start',
    paddingHorizontal: 7,
    paddingVertical: 2,
    borderRadius: 4,
    backgroundColor: 'rgba(251, 191, 36, 0.12)',
    borderWidth: 1,
    borderColor: 'rgba(251, 191, 36, 0.25)',
  },
  statusBadgeText: {
    fontSize: 9,
    fontWeight: '700',
    color: '#fbbf24',
    letterSpacing: 0.4,
  },
  right: {
    flexDirection: 'row',
    gap: 5,
  },
  iconButton: {
    width: 30,
    height: 30,
    borderRadius: 15,
    backgroundColor: 'rgba(255,255,255,0.04)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  iconButtonAccent: {
    backgroundColor: 'rgba(251, 191, 36, 0.10)',
    borderColor: 'rgba(251, 191, 36, 0.30)',
  },
});
