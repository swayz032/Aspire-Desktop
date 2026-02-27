/**
 * Send Feedback section.
 * Simple textarea with category selector and submit button.
 * TODO: Wire to feedback API endpoint when available.
 */
import React, { useState } from 'react';
import { View, Text, StyleSheet, Pressable, Platform, ViewStyle } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { SectionHeader, TextField, SelectField, Divider } from '../SettingsField';
import { SettingsColors, TRANSITION_SMOOTH } from '../settingsConstants';

const CATEGORY_OPTIONS = [
  { value: 'bug', label: 'Bug Report' },
  { value: 'feature', label: 'Feature Request' },
  { value: 'improvement', label: 'Improvement Suggestion' },
  { value: 'question', label: 'Question' },
  { value: 'praise', label: 'Something I Love' },
  { value: 'other', label: 'Other' },
];

const RATING_LABELS = ['Frustrated', 'Unhappy', 'Neutral', 'Happy', 'Delighted'];
const RATING_ICONS: (keyof typeof Ionicons.glyphMap)[] = [
  'sad-outline',
  'sad-outline',
  'remove-circle-outline',
  'happy-outline',
  'heart-outline',
];
const RATING_COLORS = ['#ef4444', '#f59e0b', '#6e6e73', '#10B981', '#3B82F6'];

export default function FeedbackSection() {
  const [category, setCategory] = useState('improvement');
  const [subject, setSubject] = useState('');
  const [message, setMessage] = useState('');
  const [rating, setRating] = useState(3);
  const [submitted, setSubmitted] = useState(false);

  const handleSubmit = () => {
    // TODO: POST to /api/feedback with { category, subject, message, rating }
    setSubmitted(true);
    setTimeout(() => setSubmitted(false), 3000);
  };

  const canSubmit = message.trim().length > 10;

  return (
    <View>
      <SectionHeader
        title="Send Feedback"
        subtitle="Help us make Aspire better"
        icon="chatbox-ellipses-outline"
      />

      {/* Satisfaction Rating */}
      <Text style={styles.groupTitle}>How is your experience?</Text>
      <View style={styles.ratingRow}>
        {RATING_LABELS.map((label, i) => (
          <Pressable
            key={label}
            onPress={() => setRating(i)}
            style={[
              styles.ratingItem,
              i === rating && styles.ratingItemActive,
              i === rating && { borderColor: `${RATING_COLORS[i]}30`, backgroundColor: `${RATING_COLORS[i]}10` },
            ]}
          >
            <Ionicons
              name={RATING_ICONS[i]}
              size={24}
              color={i === rating ? RATING_COLORS[i] : '#48484a'}
            />
            <Text style={[
              styles.ratingLabel,
              i === rating && { color: RATING_COLORS[i] },
            ]}>
              {label}
            </Text>
          </Pressable>
        ))}
      </View>

      <Divider />

      {/* Feedback Form */}
      <Text style={styles.groupTitle}>Your Feedback</Text>
      <SelectField
        label="Category"
        value={category}
        options={CATEGORY_OPTIONS}
        onValueChange={setCategory}
      />
      <TextField
        label="Subject"
        value={subject}
        onChangeText={setSubject}
        placeholder="Brief summary of your feedback"
      />
      <TextField
        label="Message"
        value={message}
        onChangeText={setMessage}
        placeholder="Tell us more about your experience, what went wrong, or what you'd like to see..."
        multiline
        numberOfLines={6}
        hint={`${message.length} characters${message.length < 10 ? ' (minimum 10)' : ''}`}
      />

      {/* Submit */}
      <View style={styles.submitRow}>
        <Pressable
          onPress={handleSubmit}
          disabled={!canSubmit}
          style={({ hovered }: { hovered?: boolean }) => [
            styles.submitBtn,
            hovered && canSubmit && styles.submitBtnHover,
            !canSubmit && styles.submitBtnDisabled,
          ] as ViewStyle[]}
        >
          {submitted ? (
            <>
              <Ionicons name="checkmark-circle" size={16} color="#ffffff" />
              <Text style={styles.submitBtnText}>Sent! Thank You</Text>
            </>
          ) : (
            <>
              <Ionicons name="send" size={14} color="#ffffff" />
              <Text style={styles.submitBtnText}>Send Feedback</Text>
            </>
          )}
        </Pressable>
      </View>

      <Divider />

      {/* Quick actions */}
      <Text style={styles.groupTitle}>Other Ways to Reach Us</Text>
      <View style={styles.quickLinksRow}>
        {[
          { icon: 'logo-twitter' as const, label: 'Twitter', color: '#1DA1F2' },
          { icon: 'logo-discord' as const, label: 'Discord', color: '#5865F2' },
          { icon: 'logo-github' as const, label: 'GitHub', color: '#a1a1a6' },
        ].map(link => (
          <Pressable
            key={link.label}
            style={({ hovered }: { hovered?: boolean }) => [
              styles.quickLink,
              hovered && styles.quickLinkHover,
            ] as ViewStyle[]}
          >
            <Ionicons name={link.icon} size={18} color={link.color} />
            <Text style={styles.quickLinkText}>{link.label}</Text>
          </Pressable>
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  groupTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#d1d1d6',
    marginBottom: 16,
    letterSpacing: -0.1,
  },
  ratingRow: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 8,
  },
  ratingItem: {
    flex: 1,
    alignItems: 'center',
    gap: 6,
    paddingVertical: 14,
    paddingHorizontal: 4,
    borderRadius: 12,
    borderWidth: 1.5,
    borderColor: 'rgba(255,255,255,0.06)',
    backgroundColor: '#111113',
    ...(Platform.OS === 'web' ? { transition: TRANSITION_SMOOTH, cursor: 'pointer' } : {}),
  } as ViewStyle,
  ratingItemActive: {
    borderWidth: 1.5,
  },
  ratingLabel: {
    fontSize: 10,
    fontWeight: '600',
    color: '#48484a',
    textAlign: 'center',
  },
  submitRow: {
    marginTop: 4,
    marginBottom: 8,
  },
  submitBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    gap: 8,
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 10,
    backgroundColor: SettingsColors.accent,
    ...(Platform.OS === 'web' ? { transition: TRANSITION_SMOOTH, cursor: 'pointer' } : {}),
  } as ViewStyle,
  submitBtnHover: {
    backgroundColor: '#2563EB',
  },
  submitBtnDisabled: {
    opacity: 0.4,
    ...(Platform.OS === 'web' ? { cursor: 'default' as const } : {}),
  } as ViewStyle,
  submitBtnText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#ffffff',
  },
  quickLinksRow: {
    flexDirection: 'row',
    gap: 10,
  },
  quickLink: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 12,
    borderRadius: 10,
    backgroundColor: '#111113',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.05)',
    ...(Platform.OS === 'web' ? { transition: TRANSITION_SMOOTH, cursor: 'pointer' } : {}),
  } as ViewStyle,
  quickLinkHover: {
    backgroundColor: '#151517',
    borderColor: 'rgba(255,255,255,0.08)',
  },
  quickLinkText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#a1a1a6',
  },
});
