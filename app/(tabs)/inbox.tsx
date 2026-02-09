import React, { useState, useEffect, useRef, useCallback } from 'react';
import { StyleSheet, View, ScrollView, TouchableOpacity, Text, Platform, Animated, TextInput, Image, ImageBackground, Alert } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Colors, Typography, Spacing, BorderRadius, Shadows } from '@/constants/tokens';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { formatRelativeTime, formatMaskedPhone } from '@/lib/formatters';
import { seedDatabase } from '@/lib/mockSeed';
import { getOfficeItems, getCalls, getMailThreads, getContacts } from '@/lib/mockDb';
import { OfficeItem } from '@/types/inbox';
import { CallItem } from '@/types/calls';
import { MailThread } from '@/types/mail';
import { Contact } from '@/types/contacts';
import { useDesktop } from '@/lib/useDesktop';
import { DesktopPageWrapper } from '@/components/desktop/DesktopPageWrapper';
import { useConversation } from '@elevenlabs/react';

const eliAvatar = require('@/assets/avatars/eli-avatar.png');
const inboxHero = require('@/assets/images/inbox-hero.jpg');

type TabType = 'office' | 'calls' | 'mail' | 'contacts';

const TAG_COLORS: Record<string, { bg: string; text: string }> = {
  Legal: { bg: 'rgba(139, 92, 246, 0.2)', text: '#A78BFA' },
  Finance: { bg: 'rgba(251, 191, 36, 0.2)', text: '#FBBF24' },
  Ops: { bg: 'rgba(59, 130, 246, 0.2)', text: '#60A5FA' },
  Security: { bg: 'rgba(239, 68, 68, 0.2)', text: '#F87171' },
  Sales: { bg: 'rgba(34, 197, 94, 0.2)', text: '#4ADE80' },
};

const PRIORITY_ACCENT: Record<string, string> = {
  High: Colors.semantic.error,
  Medium: Colors.semantic.warning,
  Low: Colors.accent.cyan,
};

const PRIORITY_PILL: Record<string, { bg: string; text: string }> = {
  High: { bg: Colors.semantic.errorLight, text: Colors.semantic.error },
  Medium: { bg: Colors.semantic.warningLight, text: Colors.semantic.warning },
  Low: { bg: Colors.accent.cyanLight, text: Colors.accent.cyan },
};

const ROLE_COLORS: Record<string, string> = {
  Client: Colors.semantic.success,
  Vendor: Colors.accent.cyan,
  Internal: '#A78BFA',
  Partner: Colors.accent.amber,
};

const TAB_CONFIG: { key: TabType; label: string; icon: keyof typeof Ionicons.glyphMap }[] = [
  { key: 'office', label: 'Office', icon: 'briefcase' },
  { key: 'calls', label: 'Calls', icon: 'call' },
  { key: 'mail', label: 'Mail', icon: 'mail' },
  { key: 'contacts', label: 'Contacts', icon: 'people' },
];

type FilterConfig = { label: string; icon: keyof typeof Ionicons.glyphMap };

const FILTERS: Record<TabType, FilterConfig[]> = {
  office: [
    { label: 'All', icon: 'grid' },
    { label: 'Unread', icon: 'mail-unread' },
    { label: 'Urgent', icon: 'alert-circle' },
    { label: 'Starred', icon: 'star' },
    { label: 'Archived', icon: 'archive' },
  ],
  calls: [
    { label: 'All', icon: 'grid' },
    { label: 'Inbound', icon: 'arrow-down' },
    { label: 'Outbound', icon: 'arrow-up' },
    { label: 'Missed', icon: 'close-circle' },
    { label: 'Voicemail', icon: 'recording' },
    { label: 'Blocked', icon: 'ban' },
  ],
  mail: [
    { label: 'All', icon: 'grid' },
    { label: 'Unread', icon: 'mail-unread' },
    { label: 'Starred', icon: 'star' },
    { label: 'Sent', icon: 'send' },
    { label: 'Drafts', icon: 'document-text' },
    { label: 'Junk', icon: 'trash' },
  ],
  contacts: [
    { label: 'All', icon: 'grid' },
    { label: 'Clients', icon: 'business' },
    { label: 'Vendors', icon: 'cube' },
    { label: 'Team', icon: 'people-circle' },
    { label: 'Starred', icon: 'star' },
    { label: 'Recent', icon: 'time' },
  ],
};

const EMPTY_STATE_MAP: Record<string, { icon: keyof typeof Ionicons.glyphMap; title: string; subtitle: string }> = {
  Archived: { icon: 'archive-outline', title: 'No Archived items', subtitle: 'Archived items will appear here' },
  Starred: { icon: 'star-outline', title: 'No Starred items', subtitle: 'Star important items for quick access' },
  Sent: { icon: 'send-outline', title: 'No Sent items', subtitle: 'Sent messages will appear here' },
  Drafts: { icon: 'document-text-outline', title: 'No Drafts', subtitle: 'Draft messages will appear here' },
  Junk: { icon: 'trash-outline', title: 'No Junk mail', subtitle: 'Junk mail will appear here' },
  Inbound: { icon: 'arrow-down-outline', title: 'No Inbound calls', subtitle: 'Inbound calls will appear here' },
  Outbound: { icon: 'arrow-up-outline', title: 'No Outbound calls', subtitle: 'Outbound calls will appear here' },
  Missed: { icon: 'close-circle-outline', title: 'No Missed calls', subtitle: 'Missed calls will appear here' },
  Voicemail: { icon: 'recording-outline', title: 'No Voicemails', subtitle: 'Voicemails will appear here' },
  Blocked: { icon: 'ban-outline', title: 'No Blocked calls', subtitle: 'Blocked calls will appear here' },
  Unread: { icon: 'mail-unread-outline', title: 'No Unread items', subtitle: 'All caught up!' },
  Urgent: { icon: 'alert-circle-outline', title: 'No Urgent items', subtitle: 'No urgent items at this time' },
  Clients: { icon: 'business-outline', title: 'No Clients', subtitle: 'Client contacts will appear here' },
  Vendors: { icon: 'cube-outline', title: 'No Vendors', subtitle: 'Vendor contacts will appear here' },
  Team: { icon: 'people-circle-outline', title: 'No Team contacts', subtitle: 'Team contacts will appear here' },
  Recent: { icon: 'time-outline', title: 'No Recent contacts', subtitle: 'Recently contacted people will appear here' },
  default: { icon: 'file-tray-outline', title: 'No items found', subtitle: 'Nothing to show for this filter' },
};

const isWeb = Platform.OS === 'web';

function OfficeItemCard({ item, selected, onPress }: { item: OfficeItem; selected: boolean; onPress: () => void }) {
  const [hovered, setHovered] = useState(false);
  const accentColor = PRIORITY_ACCENT[item.priority] || Colors.surface.cardBorder;
  const priorityPill = PRIORITY_PILL[item.priority];

  return (
    <TouchableOpacity
      style={[
        styles.card,
        { borderLeftWidth: 3, borderLeftColor: accentColor },
        selected && styles.cardSelected,
        hovered && isWeb && styles.cardHover,
      ]}
      onPress={onPress}
      activeOpacity={0.7}
      {...(isWeb ? { onMouseEnter: () => setHovered(true), onMouseLeave: () => setHovered(false) } : {})}
    >
      <View style={styles.cardRow}>
        <View style={styles.iconCircle}>
          <Ionicons name="briefcase" size={20} color={Colors.accent.cyan} />
        </View>
        <View style={{ flex: 1, marginLeft: Spacing.md }}>
          <View style={styles.titleRow}>
            {item.unread && <View style={styles.unreadDot} />}
            <Text style={styles.cardTitle} numberOfLines={1}>{item.title}</Text>
          </View>
          <Text style={styles.cardSubtitle}>{item.department} · {item.requestType}</Text>
        </View>
        <View style={styles.cardRight}>
          <Text style={styles.timeText}>{formatRelativeTime(item.timestamp)}</Text>
          {priorityPill && (
            <View style={[styles.priorityPill, { backgroundColor: priorityPill.bg }]}>
              <Text style={[styles.priorityPillText, { color: priorityPill.text }]}>{item.priority}</Text>
            </View>
          )}
        </View>
      </View>
      <Text style={styles.previewText} numberOfLines={1}>{item.preview}</Text>
      <View style={styles.tagsRow}>
        {item.tags.slice(0, 3).map((tag) => (
          <View key={tag} style={[styles.tag, { backgroundColor: TAG_COLORS[tag]?.bg || Colors.background.tertiary }]}>
            <Text style={[styles.tagText, { color: TAG_COLORS[tag]?.text || Colors.text.secondary }]}>{tag}</Text>
          </View>
        ))}
        <Text style={styles.assignedText}>Assigned to {item.assignedTo}</Text>
      </View>
    </TouchableOpacity>
  );
}

function CallItemCard({ item, selected, onPress }: { item: CallItem; selected: boolean; onPress: () => void }) {
  const [hovered, setHovered] = useState(false);
  const accentColor = PRIORITY_ACCENT[item.priority] || Colors.surface.cardBorder;

  const getCallIconAndColor = (): { icon: keyof typeof Ionicons.glyphMap; color: string; bg: string } => {
    switch (item.callType) {
      case 'inbound': return { icon: 'call', color: Colors.semantic.success, bg: Colors.semantic.successLight };
      case 'outbound': return { icon: 'call', color: Colors.semantic.success, bg: Colors.semantic.successLight };
      case 'missed': return { icon: 'call', color: Colors.semantic.error, bg: Colors.semantic.errorLight };
      case 'voicemail': return { icon: 'recording', color: Colors.semantic.warning, bg: Colors.semantic.warningLight };
      case 'blocked': return { icon: 'close-circle', color: Colors.semantic.error, bg: Colors.semantic.errorLight };
      default: return { icon: 'call', color: Colors.semantic.success, bg: Colors.semantic.successLight };
    }
  };

  const { icon, color, bg } = getCallIconAndColor();
  const outcomeColor = item.outcome === 'Completed' ? Colors.semantic.success : item.outcome === 'Missed' || item.outcome === 'Blocked' ? Colors.semantic.error : Colors.accent.amber;
  const outcomeBg = item.outcome === 'Completed' ? Colors.semantic.successLight : item.outcome === 'Missed' || item.outcome === 'Blocked' ? Colors.semantic.errorLight : Colors.accent.amberLight;

  return (
    <TouchableOpacity
      style={[
        styles.card,
        { borderLeftWidth: 3, borderLeftColor: accentColor },
        selected && styles.cardSelected,
        hovered && isWeb && styles.cardHover,
      ]}
      onPress={onPress}
      activeOpacity={0.7}
      {...(isWeb ? { onMouseEnter: () => setHovered(true), onMouseLeave: () => setHovered(false) } : {})}
    >
      <View style={styles.cardRow}>
        <View style={[styles.iconCircle, { backgroundColor: bg }]}>
          <Ionicons name={icon} size={20} color={color} />
        </View>
        <View style={{ flex: 1, marginLeft: Spacing.md }}>
          <Text style={styles.cardTitle}>{item.callerName}</Text>
          <Text style={styles.cardSubtitle}>{formatMaskedPhone(item.callerNumber)}</Text>
        </View>
        <View style={styles.cardRight}>
          <Text style={styles.timeText}>{formatRelativeTime(item.timestamp)}</Text>
          <Text style={styles.durationText}>{item.duration}</Text>
        </View>
      </View>
      <View style={styles.callMetaRow}>
        <View style={[styles.outcomePill, { backgroundColor: outcomeBg }]}>
          <Text style={[styles.outcomePillText, { color: outcomeColor }]}>{item.outcome}</Text>
        </View>
        {item.hasSummary && (
          <View style={styles.summaryBadge}>
            <Ionicons name="sparkles" size={12} color={Colors.accent.cyan} />
            <Text style={styles.summaryText}>Summary Ready</Text>
          </View>
        )}
      </View>
    </TouchableOpacity>
  );
}

function MailItemCard({ item, selected, onPress }: { item: MailThread; selected: boolean; onPress: () => void }) {
  const [hovered, setHovered] = useState(false);
  const accentColor = PRIORITY_ACCENT[item.priority] || Colors.surface.cardBorder;

  return (
    <TouchableOpacity
      style={[
        styles.card,
        { borderLeftWidth: 3, borderLeftColor: accentColor },
        selected && styles.cardSelected,
        hovered && isWeb && styles.cardHover,
      ]}
      onPress={onPress}
      activeOpacity={0.7}
      {...(isWeb ? { onMouseEnter: () => setHovered(true), onMouseLeave: () => setHovered(false) } : {})}
    >
      <View style={styles.cardRow}>
        <View style={styles.mailAvatar}>
          <Text style={styles.mailAvatarText}>{item.senderName.charAt(0)}</Text>
        </View>
        <View style={{ flex: 1, marginLeft: Spacing.md }}>
          <View style={styles.titleRow}>
            {item.unread && <View style={styles.unreadDot} />}
            <Text style={styles.cardTitle} numberOfLines={1}>{item.subject}</Text>
          </View>
          <Text style={styles.cardSubtitle}>{item.senderName}</Text>
        </View>
        <View style={styles.cardRight}>
          <Text style={styles.timeText}>{formatRelativeTime(item.timestamp)}</Text>
          {item.hasAttachments && <Ionicons name="attach" size={14} color={Colors.text.muted} style={{ marginTop: 4 }} />}
        </View>
      </View>
      <Text style={styles.previewText} numberOfLines={1}>{item.preview}</Text>
      <View style={styles.mailMetaRow}>
        <View style={styles.msgCountPill}>
          <Text style={styles.msgCountText}>{item.messageCount} messages</Text>
        </View>
        {item.tags.length > 0 && (
          <View style={styles.eliReviewBadge}>
            <Ionicons name="sparkles" size={10} color={Colors.accent.cyan} />
            <Text style={styles.eliReviewText}>Eli reviewed</Text>
          </View>
        )}
        {item.tags.slice(0, 2).map((tag) => (
          <View key={tag} style={[styles.tag, { backgroundColor: TAG_COLORS[tag]?.bg || Colors.background.tertiary }]}>
            <Text style={[styles.tagText, { color: TAG_COLORS[tag]?.text || Colors.text.secondary }]}>{tag}</Text>
          </View>
        ))}
      </View>
    </TouchableOpacity>
  );
}

function ContactItemCard({ item, selected, onPress }: { item: Contact; selected: boolean; onPress: () => void }) {
  const [hovered, setHovered] = useState(false);
  const roleColor = ROLE_COLORS[item.role] || Colors.text.secondary;

  return (
    <TouchableOpacity
      style={[
        styles.card,
        { borderLeftWidth: 3, borderLeftColor: Colors.surface.cardBorder },
        selected && styles.cardSelected,
        hovered && isWeb && styles.cardHover,
      ]}
      onPress={onPress}
      activeOpacity={0.7}
      {...(isWeb ? { onMouseEnter: () => setHovered(true), onMouseLeave: () => setHovered(false) } : {})}
    >
      <View style={styles.cardRow}>
        <View style={styles.contactAvatar}>
          <Text style={styles.contactAvatarText}>{item.name.charAt(0)}</Text>
        </View>
        <View style={{ flex: 1, marginLeft: Spacing.md }}>
          <Text style={styles.cardTitle}>{item.name}</Text>
          <Text style={styles.cardSubtitle}>{item.title}</Text>
          <Text style={styles.orgText}>{item.organization}</Text>
        </View>
        <View style={styles.cardRight}>
          <View style={[styles.rolePill, { borderColor: roleColor }]}>
            <Text style={[styles.rolePillText, { color: roleColor }]}>{item.role}</Text>
          </View>
        </View>
      </View>
      <View style={styles.contactMetaRow}>
        <Text style={styles.lastContactedText}>Last contacted {formatRelativeTime(item.lastContacted)}</Text>
      </View>
    </TouchableOpacity>
  );
}

function EmptyState({ filter }: { filter: string }) {
  const config = EMPTY_STATE_MAP[filter] || EMPTY_STATE_MAP.default;
  return (
    <View style={styles.emptyState}>
      <Ionicons name={config.icon} size={48} color={Colors.text.disabled} />
      <Text style={styles.emptyTitle}>{config.title}</Text>
      <Text style={styles.emptySubtitle}>{config.subtitle}</Text>
    </View>
  );
}


function OfficePreview({ item }: { item: OfficeItem }) {
  const priorityPill = PRIORITY_PILL[item.priority];
  const timelineSteps = ['Received', 'In Review', 'Resolved'];
  const currentStep = item.status === 'resolved' ? 2 : item.status === 'in_progress' ? 1 : 0;
  return (
    <View style={fp.section}>
      <View style={fp.headerRow}>
        <View style={{ flex: 1 }}>
          <View style={fp.badgeRow}>
            {priorityPill && (
              <View style={[fp.badge, { backgroundColor: priorityPill.bg }]}>
                <Ionicons name="flag" size={11} color={priorityPill.text} />
                <Text style={[fp.badgeText, { color: priorityPill.text }]}>{item.priority} Priority</Text>
              </View>
            )}
            {item.unread && (
              <View style={[fp.badge, { backgroundColor: Colors.accent.cyanLight }]}>
                <Text style={[fp.badgeText, { color: Colors.accent.cyan }]}>Unread</Text>
              </View>
            )}
          </View>
          <Text style={fp.pageTitle}>{item.title}</Text>
          <Text style={fp.timestamp}>{formatRelativeTime(item.timestamp)}</Text>
        </View>
      </View>
      <View style={fp.divider} />
      <View style={fp.chipRow}>
        <View style={fp.contextChip}>
          <Ionicons name="business" size={14} color={Colors.accent.cyan} />
          <View>
            <Text style={fp.chipLabel}>Department</Text>
            <Text style={fp.chipValue}>{item.department}</Text>
          </View>
        </View>
        <View style={fp.contextChip}>
          <Ionicons name="document-text" size={14} color={Colors.accent.amber} />
          <View>
            <Text style={fp.chipLabel}>Request Type</Text>
            <Text style={fp.chipValue}>{item.requestType}</Text>
          </View>
        </View>
        <View style={fp.contextChip}>
          <Ionicons name="person" size={14} color={Colors.semantic.success} />
          <View>
            <Text style={fp.chipLabel}>Assigned To</Text>
            <Text style={fp.chipValue}>{item.assignedTo}</Text>
          </View>
        </View>
      </View>
      <View style={fp.divider} />
      <Text style={fp.sectionLabel}>Message</Text>
      <View style={fp.bodyCard}>
        <Text style={fp.bodyText}>{item.preview}</Text>
      </View>
      <View style={fp.divider} />
      <Text style={fp.sectionLabel}>Tags</Text>
      <View style={fp.tagsRow}>
        {item.tags.map((tag) => (
          <View key={tag} style={[styles.tag, { backgroundColor: TAG_COLORS[tag]?.bg || Colors.background.tertiary }]}>
            <Text style={[styles.tagText, { color: TAG_COLORS[tag]?.text || Colors.text.secondary }]}>{tag}</Text>
          </View>
        ))}
      </View>
      <View style={fp.divider} />
      <Text style={fp.sectionLabel}>Status Timeline</Text>
      <View style={fp.timelineRow}>
        {timelineSteps.map((step, idx) => {
          const isActive = idx <= currentStep;
          const isCurrent = idx === currentStep;
          return (
            <React.Fragment key={step}>
              {idx > 0 && <View style={[fp.timelineConnector, isActive && { backgroundColor: Colors.accent.cyan }]} />}
              <View style={fp.timelineStep}>
                <View style={[fp.timelineDot, isActive && { backgroundColor: Colors.accent.cyan, borderColor: Colors.accent.cyan }, isCurrent && { ...Shadows.glow(Colors.accent.cyan) }]}>
                  {isActive && <Ionicons name="checkmark" size={10} color="#fff" />}
                </View>
                <Text style={[fp.timelineLabel, isActive && { color: Colors.text.primary }]}>{step}</Text>
              </View>
            </React.Fragment>
          );
        })}
      </View>
      <View style={fp.divider} />
      <View style={fp.actionBar}>
        <TouchableOpacity style={[fp.actionBtn, { backgroundColor: Colors.semantic.successLight, borderColor: Colors.semantic.success + '44' }]} activeOpacity={0.7}>
          <Ionicons name="checkmark-circle" size={16} color={Colors.semantic.success} />
          <Text style={[fp.actionBtnText, { color: Colors.semantic.success }]}>Approve</Text>
        </TouchableOpacity>
        <TouchableOpacity style={[fp.actionBtn, { backgroundColor: Colors.accent.cyanLight, borderColor: Colors.accent.cyan + '44' }]} activeOpacity={0.7}>
          <Ionicons name="chatbubble" size={16} color={Colors.accent.cyan} />
          <Text style={[fp.actionBtnText, { color: Colors.accent.cyan }]}>Reply</Text>
        </TouchableOpacity>
        <TouchableOpacity style={fp.actionBtn} activeOpacity={0.7}>
          <Ionicons name="arrow-redo" size={16} color={Colors.text.tertiary} />
          <Text style={fp.actionBtnText}>Forward</Text>
        </TouchableOpacity>
        <TouchableOpacity style={fp.actionBtn} activeOpacity={0.7}>
          <Ionicons name="trending-up" size={16} color={Colors.semantic.warning} />
          <Text style={[fp.actionBtnText, { color: Colors.semantic.warning }]}>Escalate</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

function CallPreview({ item }: { item: CallItem }) {
  const outcomeColor = item.outcome === 'Completed' ? Colors.semantic.success : item.outcome === 'Missed' || item.outcome === 'Blocked' ? Colors.semantic.error : Colors.accent.amber;
  const typeColor = item.callType === 'missed' || item.callType === 'blocked' ? Colors.semantic.error : item.callType === 'voicemail' ? Colors.semantic.warning : Colors.semantic.success;
  const typeLabel = item.callType.charAt(0).toUpperCase() + item.callType.slice(1);
  const typeIcon: keyof typeof Ionicons.glyphMap = item.callType === 'inbound' ? 'arrow-down' : item.callType === 'outbound' ? 'arrow-up' : item.callType === 'missed' ? 'close' : item.callType === 'voicemail' ? 'recording' : 'close-circle';
  return (
    <View style={fp.section}>
      <View style={fp.headerRow}>
        <View style={[fp.callerAvatar, { backgroundColor: typeColor + '22', borderColor: typeColor + '44' }]}>
          <Ionicons name="call" size={28} color={typeColor} />
        </View>
        <View style={{ flex: 1, marginLeft: Spacing.lg }}>
          <Text style={fp.pageTitle}>{item.callerName}</Text>
          <Text style={fp.subtitleText}>{formatMaskedPhone(item.callerNumber)}</Text>
          <View style={[fp.badge, { backgroundColor: typeColor + '22', alignSelf: 'flex-start', marginTop: Spacing.xs }]}>
            <Ionicons name={typeIcon} size={11} color={typeColor} />
            <Text style={[fp.badgeText, { color: typeColor }]}>{typeLabel}</Text>
          </View>
        </View>
        <Text style={fp.timestamp}>{formatRelativeTime(item.timestamp)}</Text>
      </View>
      <View style={fp.divider} />
      <View style={fp.metricGrid}>
        <View style={fp.metricCard}>
          <Ionicons name="time-outline" size={20} color={Colors.accent.cyan} />
          <Text style={fp.metricLabel}>Duration</Text>
          <Text style={fp.metricValue}>{item.duration}</Text>
        </View>
        <View style={fp.metricCard}>
          <View style={[fp.metricDot, { backgroundColor: outcomeColor }]} />
          <Text style={fp.metricLabel}>Outcome</Text>
          <Text style={[fp.metricValue, { color: outcomeColor }]}>{item.outcome}</Text>
        </View>
        <View style={fp.metricCard}>
          <Ionicons name="calendar-outline" size={20} color={Colors.text.muted} />
          <Text style={fp.metricLabel}>Time</Text>
          <Text style={fp.metricValue}>{formatRelativeTime(item.timestamp)}</Text>
        </View>
      </View>
      <View style={fp.divider} />
      <Text style={fp.sectionLabel}>Recording</Text>
      <View style={fp.recordingCard}>
        <TouchableOpacity style={fp.playBtn} activeOpacity={0.7}>
          <Ionicons name="play" size={20} color="#fff" />
        </TouchableOpacity>
        <View style={{ flex: 1, marginLeft: Spacing.md }}>
          <View style={fp.waveformBar}>
            {Array.from({ length: 24 }).map((_, i) => (
              <View key={i} style={[fp.waveformLine, { height: 4 + Math.random() * 16, opacity: 0.4 + Math.random() * 0.6 }]} />
            ))}
          </View>
        </View>
        <Text style={fp.recordingDuration}>{item.duration}</Text>
      </View>
      {item.hasSummary && (
        <>
          <View style={fp.divider} />
          <Text style={fp.sectionLabel}>AI Summary</Text>
          <View style={fp.aiSummaryCard}>
            <View style={fp.aiSummaryHeader}>
              <Ionicons name="sparkles" size={16} color={Colors.accent.cyan} />
              <Text style={fp.aiSummaryLabel}>Sarah AI Summary</Text>
            </View>
            <Text style={fp.bodyText}>Call with {item.callerName} regarding {item.tags.join(' & ').toLowerCase()} matters. Duration: {item.duration}. Outcome: {item.outcome}. Follow-up actions may be required based on discussion points.</Text>
          </View>
        </>
      )}
      <View style={fp.divider} />
      <Text style={fp.sectionLabel}>Tags</Text>
      <View style={fp.tagsRow}>
        {item.tags.map((tag) => (
          <View key={tag} style={[styles.tag, { backgroundColor: TAG_COLORS[tag]?.bg || Colors.background.tertiary }]}>
            <Text style={[styles.tagText, { color: TAG_COLORS[tag]?.text || Colors.text.secondary }]}>{tag}</Text>
          </View>
        ))}
      </View>
      <View style={fp.divider} />
      <View style={fp.actionBar}>
        <TouchableOpacity style={[fp.actionBtn, { backgroundColor: Colors.semantic.successLight, borderColor: Colors.semantic.success + '44' }]} activeOpacity={0.7}>
          <Ionicons name="call" size={16} color={Colors.semantic.success} />
          <Text style={[fp.actionBtnText, { color: Colors.semantic.success }]}>Call Back</Text>
        </TouchableOpacity>
        <TouchableOpacity style={[fp.actionBtn, { backgroundColor: Colors.accent.cyanLight, borderColor: Colors.accent.cyan + '44' }]} activeOpacity={0.7}>
          <Ionicons name="chatbubble" size={16} color={Colors.accent.cyan} />
          <Text style={[fp.actionBtnText, { color: Colors.accent.cyan }]}>Message</Text>
        </TouchableOpacity>
        <TouchableOpacity style={fp.actionBtn} activeOpacity={0.7}>
          <Ionicons name="ban" size={16} color={Colors.semantic.error} />
          <Text style={[fp.actionBtnText, { color: Colors.semantic.error }]}>Block</Text>
        </TouchableOpacity>
        <TouchableOpacity style={fp.actionBtn} activeOpacity={0.7}>
          <Ionicons name="person-add" size={16} color={Colors.text.tertiary} />
          <Text style={fp.actionBtnText}>Add to Contacts</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

function MailPreview({ item }: { item: MailThread }) {
  return (
    <View style={fp.section}>
      <View style={fp.badgeRow}>
        {item.unread && (
          <View style={[fp.badge, { backgroundColor: Colors.accent.cyanLight }]}>
            <View style={{ width: 6, height: 6, borderRadius: 3, backgroundColor: Colors.accent.cyan }} />
            <Text style={[fp.badgeText, { color: Colors.accent.cyan }]}>Unread</Text>
          </View>
        )}
        {item.hasAttachments && (
          <View style={[fp.badge, { backgroundColor: Colors.background.tertiary }]}>
            <Ionicons name="attach" size={11} color={Colors.text.tertiary} />
            <Text style={[fp.badgeText, { color: Colors.text.tertiary }]}>Attachments</Text>
          </View>
        )}
      </View>
      <Text style={fp.mailSubject}>{item.subject}</Text>
      <View style={fp.divider} />
      <View style={fp.mailSenderRow}>
        <View style={fp.mailAvatarLg}>
          <Text style={fp.mailAvatarLgText}>{item.senderName.charAt(0)}</Text>
        </View>
        <View style={{ flex: 1, marginLeft: Spacing.md }}>
          <Text style={fp.mailSenderName}>{item.senderName}</Text>
          <Text style={fp.mailSenderEmail}>{item.senderEmail}</Text>
        </View>
        <Text style={fp.timestamp}>{formatRelativeTime(item.timestamp)}</Text>
      </View>
      <View style={fp.mailRecipientsBar}>
        <Text style={fp.mailRecipientsLabel}>To:</Text>
        <Text style={fp.mailRecipientsValue}>{item.recipients.join(', ')}</Text>
      </View>
      <View style={fp.divider} />
      <View style={fp.mailBodyArea}>
        <Text style={fp.mailBodyText}>{item.preview}</Text>
      </View>
      {item.hasAttachments && (
        <>
          <View style={fp.divider} />
          <Text style={fp.sectionLabel}>Attachments</Text>
          <View style={fp.attachmentsRow}>
            <View style={fp.attachmentItem}>
              <Ionicons name="document" size={20} color={Colors.accent.cyan} />
              <Text style={fp.attachmentName}>Document.pdf</Text>
              <Text style={fp.attachmentSize}>2.4 MB</Text>
            </View>
            <View style={fp.attachmentItem}>
              <Ionicons name="image" size={20} color={Colors.semantic.success} />
              <Text style={fp.attachmentName}>Screenshot.png</Text>
              <Text style={fp.attachmentSize}>1.1 MB</Text>
            </View>
          </View>
        </>
      )}
      <View style={fp.divider} />
      <Text style={fp.sectionLabel}>Tags</Text>
      <View style={fp.tagsRow}>
        {item.tags.map((tag) => (
          <View key={tag} style={[styles.tag, { backgroundColor: TAG_COLORS[tag]?.bg || Colors.background.tertiary }]}>
            <Text style={[styles.tagText, { color: TAG_COLORS[tag]?.text || Colors.text.secondary }]}>{tag}</Text>
          </View>
        ))}
        {item.tags.length > 0 && (
          <View style={[fp.badge, { backgroundColor: Colors.accent.cyanLight }]}>
            <Ionicons name="sparkles" size={10} color={Colors.accent.cyan} />
            <Text style={[fp.badgeText, { color: Colors.accent.cyan }]}>Eli reviewed</Text>
          </View>
        )}
      </View>
      <View style={fp.divider} />
      <View style={fp.actionBar}>
        <TouchableOpacity style={[fp.actionBtn, { backgroundColor: Colors.accent.cyanLight, borderColor: Colors.accent.cyan + '44' }]} activeOpacity={0.7}>
          <Ionicons name="arrow-undo" size={16} color={Colors.accent.cyan} />
          <Text style={[fp.actionBtnText, { color: Colors.accent.cyan }]}>Reply</Text>
        </TouchableOpacity>
        <TouchableOpacity style={fp.actionBtn} activeOpacity={0.7}>
          <Ionicons name="arrow-undo" size={16} color={Colors.text.tertiary} />
          <Text style={fp.actionBtnText}>Reply All</Text>
        </TouchableOpacity>
        <TouchableOpacity style={fp.actionBtn} activeOpacity={0.7}>
          <Ionicons name="arrow-redo" size={16} color={Colors.text.tertiary} />
          <Text style={fp.actionBtnText}>Forward</Text>
        </TouchableOpacity>
        <TouchableOpacity style={fp.actionBtn} activeOpacity={0.7}>
          <Ionicons name="archive" size={16} color={Colors.text.tertiary} />
          <Text style={fp.actionBtnText}>Archive</Text>
        </TouchableOpacity>
        <TouchableOpacity style={fp.actionBtn} activeOpacity={0.7}>
          <Ionicons name="star-outline" size={16} color={Colors.accent.amber} />
          <Text style={[fp.actionBtnText, { color: Colors.accent.amber }]}>Star</Text>
        </TouchableOpacity>
      </View>
      <View style={fp.divider} />
      <Text style={fp.sectionLabel}>Smart Replies</Text>
      <View style={styles.smartReplyRow}>
        {['Thanks, received!', "I'll review and respond shortly", 'Forward to team for review'].map((reply) => (
          <TouchableOpacity key={reply} style={styles.smartReplyPill} activeOpacity={0.7}>
            <Text style={styles.smartReplyText}>{reply}</Text>
          </TouchableOpacity>
        ))}
      </View>
    </View>
  );
}

function ContactPreview({ item }: { item: Contact }) {
  const roleColor = ROLE_COLORS[item.role] || Colors.text.secondary;
  const activityHistory = [
    { type: 'call' as const, icon: 'call' as keyof typeof Ionicons.glyphMap, desc: 'Phone call — 5 min', time: '2 days ago', color: Colors.semantic.success },
    { type: 'email' as const, icon: 'mail' as keyof typeof Ionicons.glyphMap, desc: `Email thread — RE: ${item.organization} update`, time: '5 days ago', color: Colors.accent.cyan },
    { type: 'meeting' as const, icon: 'videocam' as keyof typeof Ionicons.glyphMap, desc: 'Video meeting — Quarterly review', time: '2 weeks ago', color: '#A78BFA' },
  ];
  return (
    <View style={fp.section}>
      <View style={fp.headerRow}>
        <View style={fp.profileAvatarLg}>
          <Text style={fp.profileAvatarLgText}>{item.name.charAt(0)}</Text>
        </View>
        <View style={{ flex: 1, marginLeft: Spacing.xl }}>
          <Text style={fp.pageTitle}>{item.name}</Text>
          <Text style={fp.subtitleText}>{item.title}</Text>
          <Text style={[fp.subtitleText, { color: Colors.text.muted, marginTop: 2 }]}>{item.organization}</Text>
          <View style={[fp.badge, { backgroundColor: roleColor + '22', alignSelf: 'flex-start', marginTop: Spacing.sm }]}>
            <Text style={[fp.badgeText, { color: roleColor }]}>{item.role}</Text>
          </View>
        </View>
      </View>
      <View style={fp.divider} />
      <Text style={fp.sectionLabel}>Contact Information</Text>
      <View style={fp.contactGrid}>
        <View style={fp.contactGridItem}>
          <Ionicons name="mail-outline" size={18} color={Colors.accent.cyan} />
          <Text style={fp.contactGridLabel}>Email</Text>
          <Text style={fp.contactGridValue}>{item.email}</Text>
        </View>
        <View style={fp.contactGridItem}>
          <Ionicons name="call-outline" size={18} color={Colors.semantic.success} />
          <Text style={fp.contactGridLabel}>Phone</Text>
          <Text style={fp.contactGridValue}>{formatMaskedPhone(item.phone)}</Text>
        </View>
        <View style={fp.contactGridItem}>
          <Ionicons name="business-outline" size={18} color={Colors.accent.amber} />
          <Text style={fp.contactGridLabel}>Organization</Text>
          <Text style={fp.contactGridValue}>{item.organization}</Text>
        </View>
        <View style={fp.contactGridItem}>
          <Ionicons name="time-outline" size={18} color={Colors.text.muted} />
          <Text style={fp.contactGridLabel}>Last Contacted</Text>
          <Text style={fp.contactGridValue}>{formatRelativeTime(item.lastContacted)}</Text>
        </View>
      </View>
      <View style={fp.divider} />
      <Text style={fp.sectionLabel}>Notes</Text>
      <View style={fp.bodyCard}>
        <Text style={fp.bodyText}>{item.notes}</Text>
      </View>
      <View style={fp.divider} />
      <Text style={fp.sectionLabel}>Communication History</Text>
      <View style={fp.historyList}>
        {activityHistory.map((act, idx) => (
          <View key={idx} style={fp.historyItem}>
            <View style={[fp.historyDot, { backgroundColor: act.color + '22', borderColor: act.color + '44' }]}>
              <Ionicons name={act.icon} size={14} color={act.color} />
            </View>
            <View style={{ flex: 1, marginLeft: Spacing.md }}>
              <Text style={fp.historyDesc}>{act.desc}</Text>
              <Text style={fp.historyTime}>{act.time}</Text>
            </View>
          </View>
        ))}
      </View>
      <View style={fp.divider} />
      <Text style={fp.sectionLabel}>Tags</Text>
      <View style={fp.tagsRow}>
        {item.tags.map((tag) => (
          <View key={tag} style={[styles.tag, { backgroundColor: TAG_COLORS[tag]?.bg || Colors.background.tertiary }]}>
            <Text style={[styles.tagText, { color: TAG_COLORS[tag]?.text || Colors.text.secondary }]}>{tag}</Text>
          </View>
        ))}
      </View>
      <View style={fp.divider} />
      <View style={fp.actionBar}>
        <TouchableOpacity style={[fp.actionBtn, { backgroundColor: Colors.accent.cyanLight, borderColor: Colors.accent.cyan + '44' }]} activeOpacity={0.7}>
          <Ionicons name="mail" size={16} color={Colors.accent.cyan} />
          <Text style={[fp.actionBtnText, { color: Colors.accent.cyan }]}>Email</Text>
        </TouchableOpacity>
        <TouchableOpacity style={[fp.actionBtn, { backgroundColor: Colors.semantic.successLight, borderColor: Colors.semantic.success + '44' }]} activeOpacity={0.7}>
          <Ionicons name="call" size={16} color={Colors.semantic.success} />
          <Text style={[fp.actionBtnText, { color: Colors.semantic.success }]}>Call</Text>
        </TouchableOpacity>
        <TouchableOpacity style={fp.actionBtn} activeOpacity={0.7}>
          <Ionicons name="calendar" size={16} color={Colors.text.tertiary} />
          <Text style={fp.actionBtnText}>Schedule</Text>
        </TouchableOpacity>
        <TouchableOpacity style={fp.actionBtn} activeOpacity={0.7}>
          <Ionicons name="create" size={16} color={Colors.text.tertiary} />
          <Text style={fp.actionBtnText}>Edit Contact</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

export default function InboxScreen() {
  const insets = useSafeAreaInsets();
  const isDesktop = useDesktop();

  const [activeTab, setActiveTab] = useState<TabType>('office');
  const [activeFilter, setActiveFilter] = useState<Record<TabType, string>>({ office: 'All', calls: 'All', mail: 'All', contacts: 'All' });
  const [loading, setLoading] = useState(true);
  const [officeItems, setOfficeItems] = useState<OfficeItem[]>([]);
  const [calls, setCalls] = useState<CallItem[]>([]);
  const [mailThreads, setMailThreads] = useState<MailThread[]>([]);
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [eliOpen, setEliOpen] = useState(false);
  const [eliVoiceActive, setEliVoiceActive] = useState(false);
  const [eliTranscript, setEliTranscript] = useState('');

  const eliConversation = useConversation({
    onConnect: () => {
      console.log('Eli connected');
      setEliVoiceActive(true);
    },
    onDisconnect: () => {
      console.log('Eli disconnected');
      setEliVoiceActive(false);
      setEliTranscript('');
    },
    onMessage: (message) => {
      console.log('Eli message:', message);
      if (message && typeof message === 'object' && 'message' in message) {
        setEliTranscript(String((message as any).message));
      }
    },
    onError: (error) => {
      console.error('Eli error:', error);
      setEliVoiceActive(false);
    },
  });

  const eliMicPulse = useRef(new Animated.Value(1)).current;

  const handleEliMicPress = useCallback(async () => {
    if (Platform.OS !== 'web') {
      Alert.alert('Voice Unavailable', 'Voice is only available on the web version.');
      return;
    }
    if (eliConversation.status === 'connected') {
      await eliConversation.endSession();
    } else {
      try {
        await navigator.mediaDevices.getUserMedia({ audio: true });
        const resp = await fetch('/api/elevenlabs/signed-url', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ agent: 'eli' }),
        });
        if (!resp.ok) {
          throw new Error(`Server error: ${resp.status}`);
        }
        const { signedUrl } = await resp.json();
        if (signedUrl) {
          await eliConversation.startSession({ signedUrl });
        } else {
          Alert.alert('Connection Error', 'Unable to connect to Eli. Please try again.');
        }
      } catch (error) {
        console.error('Failed to start Eli session:', error);
        Alert.alert('Connection Error', 'Unable to connect to Eli. Please try again.');
      }
    }
  }, [eliConversation]);

  const breathAnim = useRef(new Animated.Value(1)).current;
  const scrollRef = useRef<ScrollView>(null);

  useEffect(() => {
    seedDatabase();
    const timer = setTimeout(() => {
      setOfficeItems(getOfficeItems());
      setCalls(getCalls());
      setMailThreads(getMailThreads());
      setContacts(getContacts());
      setLoading(false);
    }, 100);
    return () => clearTimeout(timer);
  }, []);

  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(breathAnim, { toValue: 1.03, duration: 1500, useNativeDriver: false }),
        Animated.timing(breathAnim, { toValue: 1, duration: 1500, useNativeDriver: false }),
      ])
    );
    loop.start();
    return () => loop.stop();
  }, [breathAnim]);

  useEffect(() => {
    if (eliVoiceActive) {
      const loop = Animated.loop(
        Animated.sequence([
          Animated.timing(eliMicPulse, { toValue: 1.15, duration: 600, useNativeDriver: false }),
          Animated.timing(eliMicPulse, { toValue: 1, duration: 600, useNativeDriver: false }),
        ])
      );
      loop.start();
      return () => loop.stop();
    } else {
      eliMicPulse.setValue(1);
    }
  }, [eliVoiceActive, eliMicPulse]);

  const currentFilter = activeFilter[activeTab];

  const getFilteredOffice = (): OfficeItem[] => {
    switch (currentFilter) {
      case 'Unread': return officeItems.filter(i => i.unread);
      case 'Urgent': return officeItems.filter(i => i.priority === 'High');
      case 'Starred': return officeItems.slice(0, 2);
      case 'Archived': return [];
      default: return officeItems;
    }
  };

  const getFilteredCalls = (): CallItem[] => {
    switch (currentFilter) {
      case 'Inbound': return calls.filter(i => i.callType === 'inbound');
      case 'Outbound': return calls.filter(i => i.callType === 'outbound');
      case 'Missed': return calls.filter(i => i.callType === 'missed');
      case 'Voicemail': return calls.filter(i => i.callType === 'voicemail');
      case 'Blocked': return calls.filter(i => i.callType === 'blocked');
      default: return calls;
    }
  };

  const getFilteredMail = (): MailThread[] => {
    switch (currentFilter) {
      case 'Unread': return mailThreads.filter(i => i.unread);
      case 'Starred': return mailThreads.slice(0, 1);
      case 'Sent': return [];
      case 'Drafts': return [];
      case 'Junk': return [];
      default: return mailThreads;
    }
  };

  const getFilteredContacts = (): Contact[] => {
    switch (currentFilter) {
      case 'Clients': return contacts.filter(i => i.role === 'Client');
      case 'Vendors': return contacts.filter(i => i.role === 'Vendor');
      case 'Team': return contacts.filter(i => i.role === 'Internal');
      case 'Starred': return contacts.slice(0, 2);
      case 'Recent': return [...contacts].sort((a, b) => new Date(b.lastContacted).getTime() - new Date(a.lastContacted).getTime());
      default: return contacts;
    }
  };

  const getFilteredItems = (): any[] => {
    switch (activeTab) {
      case 'office': return getFilteredOffice();
      case 'calls': return getFilteredCalls();
      case 'mail': return getFilteredMail();
      case 'contacts': return getFilteredContacts();
    }
  };

  const filteredItems = loading ? [] : getFilteredItems();

  const getSelectedItem = (): OfficeItem | CallItem | MailThread | Contact | null => {
    if (!selectedId) return null;
    switch (activeTab) {
      case 'office': return officeItems.find(i => i.id === selectedId) || null;
      case 'calls': return calls.find(i => i.id === selectedId) || null;
      case 'mail': return mailThreads.find(i => i.id === selectedId) || null;
      case 'contacts': return contacts.find(i => i.id === selectedId) || null;
    }
  };

  const selectedItem = getSelectedItem();

  const handleItemPress = (id: string) => {
    setSelectedId(id);
    scrollRef.current?.scrollTo({ y: 0, animated: true });
  };

  const handleTabChange = (tab: TabType) => {
    setActiveTab(tab);
    setSelectedId(null);
  };

  const handleFilterChange = (filter: string) => {
    setActiveFilter(prev => ({ ...prev, [activeTab]: filter }));
    setSelectedId(null);
  };

  const tabCounts = {
    office: officeItems.length,
    calls: calls.length,
    mail: mailThreads.length,
    contacts: contacts.length,
  };

  const eliTriagedCount = mailThreads.filter(i => i.tags.length > 0).length + officeItems.filter(i => i.unread).length;

  const renderListItems = () => {
    if (loading) {
      return Array.from({ length: 5 }).map((_, i) => (
        <View key={i} style={styles.skeletonCard}>
          <View style={styles.skeletonRow}>
            <View style={styles.skeletonCircle} />
            <View style={{ flex: 1, marginLeft: 12 }}>
              <View style={styles.skeletonTitle} />
              <View style={styles.skeletonSubtitle} />
            </View>
          </View>
        </View>
      ));
    }

    if (filteredItems.length === 0) {
      return <EmptyState filter={currentFilter} />;
    }

    switch (activeTab) {
      case 'office':
        return (filteredItems as OfficeItem[]).map(item => (
          <OfficeItemCard key={item.id} item={item} selected={selectedId === item.id} onPress={() => handleItemPress(item.id)} />
        ));
      case 'calls':
        return (filteredItems as CallItem[]).map(item => (
          <CallItemCard key={item.id} item={item} selected={selectedId === item.id} onPress={() => handleItemPress(item.id)} />
        ));
      case 'mail':
        return (filteredItems as MailThread[]).map(item => (
          <MailItemCard key={item.id} item={item} selected={selectedId === item.id} onPress={() => handleItemPress(item.id)} />
        ));
      case 'contacts':
        return (filteredItems as Contact[]).map(item => (
          <ContactItemCard key={item.id} item={item} selected={selectedId === item.id} onPress={() => handleItemPress(item.id)} />
        ));
    }
  };

  const content = (
    <View style={styles.container}>
      <ScrollView ref={scrollRef} style={{ flex: 1 }} contentContainerStyle={styles.pageScrollContent} showsVerticalScrollIndicator={false}>
        <ImageBackground source={inboxHero} style={styles.headerBanner} imageStyle={styles.headerBannerImage}>
          <LinearGradient
            colors={['rgba(10, 10, 10, 0.35)', 'rgba(10, 10, 10, 0.65)']}
            style={styles.headerOverlay}
          >
            <View style={styles.headerRow}>
              <View style={styles.headerLeft}>
                <LinearGradient colors={[Colors.accent.cyan, Colors.accent.cyanDark]} style={styles.headerIconWrap}>
                  <Ionicons name="mail" size={24} color="#fff" />
                </LinearGradient>
                <View style={{ marginLeft: Spacing.md }}>
                  <Text style={styles.headerTitle}>Inbox</Text>
                  <Text style={styles.headerSubtitle}>
                    {loading ? 'Loading...' : `${officeItems.length + calls.length + mailThreads.length + contacts.length} items across all channels`}
                  </Text>
                </View>
              </View>
            </View>
          </LinearGradient>
        </ImageBackground>

        <View style={styles.tabBar}>
          {TAB_CONFIG.map((tab) => {
            const isActive = activeTab === tab.key;
            const count = tabCounts[tab.key];
            return (
              <TouchableOpacity key={tab.key} onPress={() => handleTabChange(tab.key)} activeOpacity={0.7}>
                {isActive ? (
                  <LinearGradient colors={[Colors.accent.cyan, Colors.accent.cyanDark]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.tabActive}>
                    <Ionicons name={tab.icon} size={18} color="#fff" />
                    <Text style={styles.tabTextActive}>{tab.label}</Text>
                    {!loading && (
                      <View style={styles.tabBadgeActive}>
                        <Text style={styles.tabBadgeTextActive}>{count}</Text>
                      </View>
                    )}
                    <View style={styles.tabGlowBorder} />
                  </LinearGradient>
                ) : (
                  <View style={styles.tabInactive}>
                    <Ionicons name={tab.icon} size={18} color={Colors.text.tertiary} />
                    <Text style={styles.tabTextInactive}>{tab.label}</Text>
                    {!loading && (
                      <View style={styles.tabBadgeInactive}>
                        <Text style={styles.tabBadgeTextInactive}>{count}</Text>
                      </View>
                    )}
                  </View>
                )}
              </TouchableOpacity>
            );
          })}
        </View>

        <View style={styles.filterBar}>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.filterScroll}>
            {FILTERS[activeTab].map((f) => {
              const isActive = currentFilter === f.label;
              return (
                <TouchableOpacity
                  key={f.label}
                  style={[styles.filterPill, isActive && styles.filterPillActive]}
                  onPress={() => handleFilterChange(f.label)}
                  activeOpacity={0.7}
                >
                  <Ionicons name={f.icon} size={12} color={isActive ? '#fff' : Colors.text.secondary} style={{ marginRight: 4 }} />
                  <Text style={[styles.filterPillText, isActive && styles.filterPillTextActive]}>{f.label}</Text>
                </TouchableOpacity>
              );
            })}
          </ScrollView>
        </View>

        {selectedItem ? (
          <View>
            <TouchableOpacity style={styles.backButton} onPress={() => setSelectedId(null)} activeOpacity={0.7}>
              <Ionicons name="arrow-back" size={20} color={Colors.accent.cyan} />
              <Text style={styles.backButtonText}>Back</Text>
            </TouchableOpacity>
            <View style={fp.detailContent}>
              {activeTab === 'office' && <OfficePreview item={selectedItem as OfficeItem} />}
              {activeTab === 'calls' && <CallPreview item={selectedItem as CallItem} />}
              {activeTab === 'mail' && <MailPreview item={selectedItem as MailThread} />}
              {activeTab === 'contacts' && <ContactPreview item={selectedItem as Contact} />}
            </View>
          </View>
        ) : (
          <View style={styles.listContent}>
            {renderListItems()}
          </View>
        )}
      </ScrollView>

      <Animated.View style={[styles.eliChipWrapper, { transform: [{ scale: breathAnim }] }]}>
        <TouchableOpacity onPress={() => setEliOpen(!eliOpen)} activeOpacity={0.8}>
          <View style={styles.eliChip}>
            <Image source={eliAvatar} style={styles.eliChipAvatar} />
            <Text style={styles.eliChipText}>Eli</Text>
          </View>
          <View style={styles.eliNotifDot} />
        </TouchableOpacity>
      </Animated.View>

      {eliOpen && (
        <View style={[styles.eliPanel, eliVoiceActive && { height: 280 }]}>
          <View style={styles.eliPanelHeader}>
            <View style={{ flexDirection: 'row', alignItems: 'center' }}>
              <Image source={eliAvatar} style={styles.eliPanelAvatar} />
              <Text style={styles.eliPanelTitle}>Eli · Voice & Chat Agent</Text>
              {eliVoiceActive && (
                <View style={styles.eliActiveBadge}>
                  <View style={styles.eliActiveDot} />
                  <Text style={styles.eliActiveText}>Live</Text>
                </View>
              )}
            </View>
            <TouchableOpacity onPress={() => { if (eliVoiceActive) { eliConversation.endSession(); } setEliOpen(false); }}>
              <Ionicons name="close" size={20} color={Colors.text.secondary} />
            </TouchableOpacity>
          </View>
          <Text style={styles.eliPanelStat}>{eliTriagedCount} items triaged today</Text>
          {eliVoiceActive && eliTranscript ? (
            <View style={styles.eliTranscriptBox}>
              <Ionicons name="chatbubble-ellipses" size={14} color={Colors.accent.cyan} />
              <Text style={styles.eliTranscriptText} numberOfLines={3}>{eliTranscript}</Text>
            </View>
          ) : null}
          <View style={styles.eliInputRow}>
            <View style={[styles.eliInputWrapper, { flex: 1 }]}>
              <TextInput
                style={styles.eliInput}
                placeholder="Ask Eli anything..."
                placeholderTextColor={Colors.text.muted}
                editable={false}
              />
            </View>
            <Animated.View style={{ transform: [{ scale: eliMicPulse }] }}>
              <TouchableOpacity
                onPress={handleEliMicPress}
                style={[
                  styles.eliMicButton,
                  eliVoiceActive && styles.eliMicButtonActive,
                ]}
                activeOpacity={0.7}
              >
                <Ionicons
                  name={eliVoiceActive ? 'mic' : 'mic-outline'}
                  size={20}
                  color={eliVoiceActive ? '#fff' : Colors.accent.cyan}
                />
              </TouchableOpacity>
            </Animated.View>
          </View>
        </View>
      )}
    </View>
  );

  if (isDesktop) {
    return (
      <DesktopPageWrapper scrollable={false} fullWidth>
        {content}
      </DesktopPageWrapper>
    );
  }

  return content;
}

const fp = StyleSheet.create({
  detailContent: {
    width: '100%',
    paddingHorizontal: Spacing.xl,
    paddingBottom: 100,
  },
  section: {
    width: '100%',
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
  },
  badgeRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.sm,
    marginBottom: Spacing.md,
  },
  badge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: Spacing.sm + 2,
    paddingVertical: 3,
    borderRadius: BorderRadius.full,
  },
  badgeText: {
    ...Typography.micro,
    fontWeight: '700',
  },
  pageTitle: {
    ...Typography.title,
    color: Colors.text.primary,
    fontWeight: '700',
    marginBottom: Spacing.xs,
  },
  timestamp: {
    ...Typography.small,
    color: Colors.text.muted,
    marginTop: 2,
  },
  subtitleText: {
    ...Typography.caption,
    color: Colors.text.tertiary,
  },
  divider: {
    height: 1,
    backgroundColor: Colors.border.subtle,
    marginVertical: Spacing.lg,
  },
  sectionLabel: {
    ...Typography.smallMedium,
    color: Colors.text.muted,
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: 0.8,
    marginBottom: Spacing.md,
  },
  chipRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.sm,
  },
  contextChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm + 2,
    borderRadius: BorderRadius.lg,
    backgroundColor: Colors.surface.card,
    borderWidth: 1,
    borderColor: Colors.border.subtle,
    flex: 1,
    minWidth: 140,
  },
  chipLabel: {
    ...Typography.micro,
    color: Colors.text.muted,
    fontWeight: '500',
  },
  chipValue: {
    ...Typography.caption,
    color: Colors.text.primary,
    fontWeight: '600',
    marginTop: 1,
  },
  bodyCard: {
    backgroundColor: Colors.surface.card,
    borderRadius: BorderRadius.lg,
    padding: Spacing.xl,
    borderWidth: 1,
    borderColor: Colors.border.subtle,
  },
  bodyText: {
    ...Typography.body,
    color: Colors.text.secondary,
    lineHeight: 24,
  },
  tagsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.sm,
  },
  actionBar: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.sm,
  },
  actionBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.xs,
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.sm + 2,
    borderRadius: BorderRadius.md,
    backgroundColor: Colors.background.tertiary,
    borderWidth: 1,
    borderColor: Colors.border.subtle,
  },
  actionBtnText: {
    ...Typography.caption,
    color: Colors.text.tertiary,
    fontWeight: '500',
  },
  timelineRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: Spacing.md,
  },
  timelineStep: {
    alignItems: 'center',
    gap: Spacing.xs,
  },
  timelineDot: {
    width: 24,
    height: 24,
    borderRadius: 12,
    borderWidth: 2,
    borderColor: Colors.border.default,
    backgroundColor: Colors.background.tertiary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  timelineConnector: {
    flex: 1,
    height: 2,
    backgroundColor: Colors.border.default,
    marginHorizontal: Spacing.xs,
  },
  timelineLabel: {
    ...Typography.micro,
    color: Colors.text.muted,
    fontWeight: '500',
  },
  callerAvatar: {
    width: 64,
    height: 64,
    borderRadius: 32,
    borderWidth: 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  metricGrid: {
    flexDirection: 'row',
    gap: Spacing.sm,
  },
  metricCard: {
    flex: 1,
    backgroundColor: Colors.surface.card,
    borderRadius: BorderRadius.lg,
    padding: Spacing.lg,
    borderWidth: 1,
    borderColor: Colors.border.subtle,
    alignItems: 'center',
    gap: Spacing.xs,
  },
  metricDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    marginTop: 5,
  },
  metricLabel: {
    ...Typography.micro,
    color: Colors.text.muted,
    fontWeight: '500',
    textTransform: 'uppercase',
  },
  metricValue: {
    ...Typography.bodyMedium,
    color: Colors.text.primary,
    fontWeight: '700',
  },
  recordingCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.surface.card,
    borderRadius: BorderRadius.lg,
    padding: Spacing.lg,
    borderWidth: 1,
    borderColor: Colors.border.subtle,
  },
  playBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: Colors.accent.cyan,
    alignItems: 'center',
    justifyContent: 'center',
  },
  waveformBar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
    height: 24,
  },
  waveformLine: {
    width: 3,
    borderRadius: 2,
    backgroundColor: Colors.accent.cyan,
  },
  recordingDuration: {
    ...Typography.caption,
    color: Colors.text.muted,
    fontWeight: '600',
    marginLeft: Spacing.md,
  },
  aiSummaryCard: {
    backgroundColor: Colors.background.tertiary,
    borderRadius: BorderRadius.lg,
    padding: Spacing.xl,
    borderWidth: 1,
    borderColor: Colors.accent.cyanLight,
  },
  aiSummaryHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    marginBottom: Spacing.md,
  },
  aiSummaryLabel: {
    ...Typography.captionMedium,
    color: Colors.accent.cyan,
    fontWeight: '600',
  },
  mailSubject: {
    fontSize: 24,
    fontWeight: '700',
    color: Colors.text.primary,
    lineHeight: 32,
    marginBottom: Spacing.sm,
  },
  mailSenderRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  mailAvatarLg: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: Colors.accent.cyanDark,
    alignItems: 'center',
    justifyContent: 'center',
  },
  mailAvatarLgText: {
    fontSize: 20,
    fontWeight: '700',
    color: '#fff',
  },
  mailSenderName: {
    ...Typography.bodyMedium,
    color: Colors.text.primary,
    fontWeight: '600',
  },
  mailSenderEmail: {
    ...Typography.small,
    color: Colors.text.muted,
    marginTop: 1,
  },
  mailRecipientsBar: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: Spacing.md,
    paddingVertical: Spacing.sm,
    paddingHorizontal: Spacing.md,
    backgroundColor: Colors.background.tertiary,
    borderRadius: BorderRadius.md,
  },
  mailRecipientsLabel: {
    ...Typography.small,
    color: Colors.text.muted,
    fontWeight: '600',
    marginRight: Spacing.xs,
  },
  mailRecipientsValue: {
    ...Typography.small,
    color: Colors.text.secondary,
    flex: 1,
  },
  mailBodyArea: {
    paddingVertical: Spacing.md,
  },
  mailBodyText: {
    ...Typography.body,
    color: Colors.text.secondary,
    lineHeight: 26,
  },
  attachmentsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.sm,
  },
  attachmentItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    backgroundColor: Colors.surface.card,
    borderRadius: BorderRadius.md,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm + 2,
    borderWidth: 1,
    borderColor: Colors.border.subtle,
  },
  attachmentName: {
    ...Typography.caption,
    color: Colors.text.primary,
    fontWeight: '500',
  },
  attachmentSize: {
    ...Typography.small,
    color: Colors.text.muted,
  },
  profileAvatarLg: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: Colors.accent.cyanDark,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: Colors.accent.cyan + '44',
  },
  profileAvatarLgText: {
    fontSize: 26,
    fontWeight: '700',
    color: '#fff',
  },
  contactGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.sm,
  },
  contactGridItem: {
    width: '48%',
    backgroundColor: Colors.surface.card,
    borderRadius: BorderRadius.lg,
    padding: Spacing.lg,
    borderWidth: 1,
    borderColor: Colors.border.subtle,
    gap: Spacing.xs,
  },
  contactGridLabel: {
    ...Typography.micro,
    color: Colors.text.muted,
    fontWeight: '500',
    textTransform: 'uppercase',
    marginTop: Spacing.xs,
  },
  contactGridValue: {
    ...Typography.caption,
    color: Colors.text.primary,
    fontWeight: '600',
  },
  historyList: {
    gap: Spacing.md,
  },
  historyItem: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  historyDot: {
    width: 32,
    height: 32,
    borderRadius: 16,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  historyDesc: {
    ...Typography.caption,
    color: Colors.text.primary,
    fontWeight: '500',
  },
  historyTime: {
    ...Typography.small,
    color: Colors.text.muted,
    marginTop: 1,
  },
});

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background.primary,
  },
  pageScrollContent: {
    flexGrow: 1,
  },
  headerBanner: {
    height: 130,
    overflow: 'hidden',
  },
  headerBannerImage: {
    resizeMode: 'cover',
  },
  headerOverlay: {
    flex: 1,
    paddingHorizontal: Spacing.xl,
    justifyContent: 'center',
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  headerIconWrap: {
    width: 48,
    height: 48,
    borderRadius: BorderRadius.md,
    alignItems: 'center',
    justifyContent: 'center',
    ...Shadows.glow(Colors.accent.cyan),
  },
  headerTitle: {
    fontSize: 28,
    fontWeight: '800',
    color: '#fff',
    letterSpacing: 1,
  },
  headerSubtitle: {
    ...Typography.small,
    color: 'rgba(255,255,255,0.7)',
    marginTop: 2,
  },
  tabBar: {
    flexDirection: 'row',
    paddingHorizontal: Spacing.xl,
    paddingTop: Spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border.subtle,
    gap: Spacing.xs,
  },
  tabActive: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.sm + 2,
    borderRadius: BorderRadius.md,
    borderBottomLeftRadius: 0,
    borderBottomRightRadius: 0,
    position: 'relative',
    gap: Spacing.xs,
  },
  tabInactive: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.sm + 2,
    gap: Spacing.xs,
  },
  tabTextActive: {
    ...Typography.caption,
    color: '#fff',
    fontWeight: '600',
  },
  tabTextInactive: {
    ...Typography.caption,
    color: Colors.text.tertiary,
    fontWeight: '500',
  },
  tabBadgeActive: {
    backgroundColor: '#fff',
    borderRadius: BorderRadius.full,
    paddingHorizontal: 7,
    paddingVertical: 1,
    marginLeft: 2,
  },
  tabBadgeTextActive: {
    ...Typography.micro,
    color: Colors.accent.cyanDark,
    fontWeight: '700',
  },
  tabBadgeInactive: {
    backgroundColor: Colors.background.tertiary,
    borderRadius: BorderRadius.full,
    paddingHorizontal: 7,
    paddingVertical: 1,
    marginLeft: 2,
  },
  tabBadgeTextInactive: {
    ...Typography.micro,
    color: Colors.text.muted,
  },
  tabGlowBorder: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    height: 2,
    backgroundColor: Colors.accent.cyan,
    ...Shadows.glow(Colors.accent.cyan),
  },
  filterBar: {
    paddingVertical: Spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border.subtle,
  },
  filterScroll: {
    paddingHorizontal: Spacing.xl,
    gap: Spacing.sm,
    flexDirection: 'row',
  },
  filterPill: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.xs + 2,
    borderRadius: BorderRadius.full,
    backgroundColor: Colors.background.tertiary,
    borderWidth: 1,
    borderColor: Colors.border.default,
  },
  filterPillActive: {
    backgroundColor: Colors.accent.cyan,
    borderColor: Colors.accent.cyan,
  },
  filterPillText: {
    ...Typography.small,
    color: Colors.text.secondary,
    fontWeight: '500',
  },
  filterPillTextActive: {
    color: '#fff',
  },
  backButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: Spacing.xl,
    paddingVertical: Spacing.md,
    gap: Spacing.xs,
  },
  backButtonText: {
    ...Typography.caption,
    color: Colors.accent.cyan,
    fontWeight: '600',
  },
  detailScrollContent: {
    alignItems: 'center',
    paddingHorizontal: Spacing.xl,
    paddingBottom: 100,
  },
  detailCard: {
    width: '100%',
    maxWidth: 800,
    backgroundColor: Colors.surface.card,
    borderRadius: BorderRadius.xl,
    borderWidth: 1,
    borderColor: Colors.surface.cardBorder,
    padding: Spacing.xl,
  },
  listContent: {
    paddingHorizontal: Spacing.lg,
    paddingTop: Spacing.md,
    paddingBottom: 100,
  },
  card: {
    backgroundColor: Colors.surface.card,
    borderRadius: BorderRadius.lg,
    borderWidth: 1,
    borderColor: Colors.surface.cardBorder,
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.md,
    marginBottom: Spacing.sm,
  },
  cardSelected: {
    borderColor: Colors.accent.cyan,
    backgroundColor: Colors.background.elevated,
  },
  cardHover: {
    backgroundColor: Colors.surface.cardHover,
    ...(isWeb ? { transform: [{ translateY: -1 }] } : {}),
  },
  cardRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
  },
  iconCircle: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: Colors.background.tertiary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  unreadDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: Colors.accent.cyan,
    marginRight: Spacing.xs,
  },
  cardTitle: {
    ...Typography.body,
    color: Colors.text.primary,
    fontWeight: '700',
    flex: 1,
  },
  cardSubtitle: {
    ...Typography.small,
    color: Colors.text.tertiary,
    marginTop: 2,
  },
  cardRight: {
    alignItems: 'flex-end',
    marginLeft: Spacing.sm,
  },
  timeText: {
    ...Typography.small,
    color: Colors.text.tertiary,
  },
  previewText: {
    ...Typography.caption,
    color: Colors.text.secondary,
    marginTop: Spacing.sm,
    marginBottom: Spacing.sm,
  },
  tagsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: Spacing.xs,
  },
  tag: {
    paddingHorizontal: Spacing.sm,
    paddingVertical: 2,
    borderRadius: BorderRadius.xs,
  },
  tagText: {
    ...Typography.micro,
    fontWeight: '600',
  },
  assignedText: {
    ...Typography.small,
    color: Colors.text.muted,
    marginLeft: 'auto',
  },
  priorityPill: {
    paddingHorizontal: Spacing.sm,
    paddingVertical: 2,
    borderRadius: BorderRadius.xs,
    marginTop: 4,
  },
  priorityPillText: {
    ...Typography.micro,
    fontWeight: '700',
  },
  durationText: {
    ...Typography.small,
    color: Colors.text.muted,
    marginTop: 2,
  },
  callMetaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: Spacing.sm,
    gap: Spacing.md,
  },
  outcomePill: {
    paddingHorizontal: Spacing.sm,
    paddingVertical: 2,
    borderRadius: BorderRadius.xs,
  },
  outcomePillText: {
    ...Typography.micro,
    fontWeight: '600',
  },
  summaryBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  summaryText: {
    ...Typography.small,
    color: Colors.accent.cyan,
  },
  summaryBadgeLarge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginTop: Spacing.md,
    paddingVertical: Spacing.sm,
    paddingHorizontal: Spacing.md,
    backgroundColor: Colors.accent.cyanLight,
    borderRadius: BorderRadius.md,
  },
  mailAvatar: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: Colors.accent.cyanDark,
    alignItems: 'center',
    justifyContent: 'center',
  },
  mailAvatarText: {
    ...Typography.headline,
    color: '#fff',
    fontWeight: '600',
  },
  mailMetaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    flexWrap: 'wrap',
  },
  msgCountPill: {
    backgroundColor: Colors.background.tertiary,
    paddingHorizontal: Spacing.sm,
    paddingVertical: 2,
    borderRadius: BorderRadius.xs,
  },
  msgCountText: {
    ...Typography.micro,
    color: Colors.text.muted,
  },
  eliReviewBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
  },
  eliReviewText: {
    ...Typography.micro,
    color: Colors.accent.cyan,
  },
  contactAvatar: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: Colors.accent.cyanDark,
    alignItems: 'center',
    justifyContent: 'center',
  },
  contactAvatarText: {
    ...Typography.headline,
    color: Colors.accent.cyan,
    fontWeight: '600',
  },
  orgText: {
    ...Typography.small,
    color: Colors.text.muted,
    marginTop: 2,
  },
  rolePill: {
    paddingHorizontal: Spacing.sm,
    paddingVertical: 2,
    borderRadius: BorderRadius.xs,
    borderWidth: 1,
  },
  rolePillText: {
    ...Typography.micro,
    fontWeight: '600',
  },
  contactMetaRow: {
    marginTop: Spacing.sm,
    paddingTop: Spacing.sm,
    borderTopWidth: 1,
    borderTopColor: Colors.border.subtle,
  },
  lastContactedText: {
    ...Typography.small,
    color: Colors.text.muted,
  },
  previewHeader: {
    marginBottom: 0,
  },
  previewHeaderTop: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: Spacing.sm,
  },
  previewPriorityPill: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: Spacing.sm + 2,
    paddingVertical: 3,
    borderRadius: BorderRadius.full,
  },
  previewPriorityText: {
    ...Typography.micro,
    fontWeight: '700',
  },
  previewTime: {
    ...Typography.small,
    color: Colors.text.muted,
  },
  previewHeadline: {
    ...Typography.headline,
    color: Colors.text.primary,
    fontWeight: '700',
    marginBottom: Spacing.sm,
  },
  previewSubhead: {
    ...Typography.caption,
    color: Colors.text.tertiary,
    marginBottom: Spacing.sm,
  },
  previewChipRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.xs,
    marginTop: Spacing.xs,
  },
  previewChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: Spacing.sm,
    paddingVertical: 3,
    borderRadius: BorderRadius.full,
    borderWidth: 1,
    borderColor: Colors.border.subtle,
    backgroundColor: Colors.background.tertiary,
  },
  previewChipText: {
    ...Typography.micro,
    color: Colors.text.tertiary,
  },
  previewChipDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  previewSectionTitle: {
    ...Typography.small,
    color: Colors.text.muted,
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: Spacing.sm,
  },
  previewTagsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.xs,
    marginTop: Spacing.md,
  },
  previewDivider: {
    height: 1,
    backgroundColor: Colors.border.subtle,
    marginVertical: Spacing.md,
  },
  previewBody: {
    ...Typography.caption,
    color: Colors.text.secondary,
    lineHeight: 22,
  },
  previewActionsRow: {
    flexDirection: 'row',
    gap: Spacing.md,
  },
  previewActionBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.xs,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    borderRadius: BorderRadius.md,
    backgroundColor: Colors.background.tertiary,
    borderWidth: 1,
    borderColor: Colors.border.subtle,
  },
  previewActionText: {
    ...Typography.small,
    color: Colors.text.tertiary,
    fontWeight: '500',
  },
  previewAiSection: {
    backgroundColor: Colors.background.tertiary,
    borderRadius: BorderRadius.md,
    padding: Spacing.md,
    borderWidth: 1,
    borderColor: Colors.accent.cyanLight,
  },
  previewAiBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.xs,
    marginBottom: Spacing.sm,
  },
  previewAiLabel: {
    ...Typography.small,
    color: Colors.accent.cyan,
    fontWeight: '600',
  },
  previewUnreadBadge: {
    backgroundColor: Colors.accent.cyanLight,
    paddingHorizontal: Spacing.sm,
    paddingVertical: 2,
    borderRadius: BorderRadius.full,
  },
  previewUnreadText: {
    ...Typography.micro,
    color: Colors.accent.cyan,
    fontWeight: '700',
  },
  previewMailMeta: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: Spacing.md,
  },
  previewMailAvatar: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: Colors.accent.cyanDark,
    alignItems: 'center',
    justifyContent: 'center',
  },
  previewMailAvatarText: {
    fontSize: 16,
    fontWeight: '700',
    color: Colors.accent.cyan,
  },
  previewMailSender: {
    ...Typography.caption,
    color: Colors.text.primary,
    fontWeight: '600',
  },
  previewMailEmail: {
    ...Typography.micro,
    color: Colors.text.muted,
  },
  previewMailTo: {
    ...Typography.micro,
    color: Colors.text.muted,
    marginTop: Spacing.sm,
  },
  smartReplyRow: {
    flexDirection: 'row',
    gap: Spacing.sm,
    flexWrap: 'wrap',
  },
  smartReplyPill: {
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.xs + 2,
    borderRadius: BorderRadius.full,
    borderWidth: 1,
    borderColor: Colors.accent.cyan,
    backgroundColor: Colors.accent.cyanLight,
  },
  smartReplyText: {
    ...Typography.small,
    color: Colors.accent.cyan,
    fontWeight: '500',
  },
  contactPreviewHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: Spacing.md,
  },
  contactPreviewAvatar: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: Colors.accent.cyanDark,
    alignItems: 'center',
    justifyContent: 'center',
  },
  contactPreviewAvatarText: {
    fontSize: 24,
    fontWeight: '700',
    color: Colors.accent.cyan,
  },
  contactPreviewTitle: {
    ...Typography.caption,
    color: Colors.text.tertiary,
    marginTop: 2,
  },
  contactInfoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    paddingVertical: Spacing.sm,
  },
  contactInfoText: {
    ...Typography.caption,
    color: Colors.text.secondary,
  },
  emptyState: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingTop: 80,
    paddingHorizontal: Spacing.xl,
  },
  emptyTitle: {
    ...Typography.body,
    color: Colors.text.secondary,
    marginTop: Spacing.lg,
  },
  emptySubtitle: {
    ...Typography.small,
    color: Colors.text.muted,
    marginTop: Spacing.xs,
    textAlign: 'center',
  },
  eliChipWrapper: {
    position: 'absolute',
    bottom: 24,
    right: 24,
    zIndex: 100,
  },
  eliChip: {
    flexDirection: 'row',
    alignItems: 'center',
    height: 48,
    paddingLeft: 4,
    paddingRight: Spacing.lg,
    borderRadius: BorderRadius.full,
    gap: Spacing.sm,
    backgroundColor: Colors.surface.card,
    borderWidth: 1,
    borderColor: Colors.surface.cardBorder,
  },
  eliChipAvatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
  },
  eliChipText: {
    ...Typography.caption,
    color: Colors.text.primary,
    fontWeight: '700',
  },
  eliNotifDot: {
    position: 'absolute',
    top: -2,
    right: -2,
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: Colors.semantic.success,
  },
  eliPanel: {
    position: 'absolute',
    bottom: 80,
    right: 24,
    width: 320,
    height: 200,
    backgroundColor: Colors.surface.card,
    borderRadius: BorderRadius.xl,
    borderWidth: 1,
    borderColor: Colors.surface.cardBorder,
    padding: Spacing.lg,
    zIndex: 101,
    ...Shadows.lg,
  },
  eliPanelHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: Spacing.md,
  },
  eliPanelAvatar: {
    width: 28,
    height: 28,
    borderRadius: 14,
    marginRight: Spacing.sm,
  },
  eliPanelTitle: {
    ...Typography.headline,
    color: Colors.text.primary,
    fontWeight: '600',
    marginLeft: Spacing.sm,
  },
  eliPanelStat: {
    ...Typography.caption,
    color: Colors.text.secondary,
    marginBottom: Spacing.lg,
  },
  eliInputWrapper: {
    backgroundColor: Colors.surface.input,
    borderRadius: BorderRadius.md,
    borderWidth: 1,
    borderColor: Colors.surface.inputBorder,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
  },
  eliInput: {
    ...Typography.caption,
    color: Colors.text.primary,
  },
  eliInputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
  },
  eliMicButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: Colors.surface.input,
    borderWidth: 1,
    borderColor: Colors.accent.cyan,
    alignItems: 'center',
    justifyContent: 'center',
  },
  eliMicButtonActive: {
    backgroundColor: Colors.accent.cyan,
    borderColor: Colors.accent.cyan,
  },
  eliActiveBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginLeft: Spacing.sm,
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: BorderRadius.full,
    backgroundColor: Colors.accent.cyanLight,
  },
  eliActiveDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: Colors.accent.cyan,
  },
  eliActiveText: {
    ...Typography.micro,
    color: Colors.accent.cyan,
    fontWeight: '700',
  },
  eliTranscriptBox: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: Spacing.sm,
    backgroundColor: Colors.background.tertiary,
    borderRadius: BorderRadius.md,
    padding: Spacing.sm,
    marginBottom: Spacing.md,
  },
  eliTranscriptText: {
    ...Typography.small,
    color: Colors.text.secondary,
    flex: 1,
    lineHeight: 18,
  },
  skeletonCard: {
    backgroundColor: Colors.surface.card,
    borderRadius: BorderRadius.lg,
    padding: Spacing.lg,
    marginBottom: Spacing.sm,
    borderWidth: 1,
    borderColor: Colors.surface.cardBorder,
  },
  skeletonRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  skeletonCircle: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: Colors.background.tertiary,
  },
  skeletonTitle: {
    width: '70%',
    height: 14,
    backgroundColor: Colors.background.tertiary,
    borderRadius: 4,
    marginBottom: Spacing.sm,
  },
  skeletonSubtitle: {
    width: '40%',
    height: 10,
    backgroundColor: Colors.background.tertiary,
    borderRadius: 4,
  },
});
