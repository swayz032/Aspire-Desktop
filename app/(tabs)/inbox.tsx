import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { StyleSheet, View, ScrollView, TouchableOpacity, TouchableWithoutFeedback, Text, Platform, Animated, TextInput, Image, ImageBackground, Alert, Pressable, Dimensions } from 'react-native';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Colors, Typography, Spacing, BorderRadius, Shadows } from '@/constants/tokens';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { formatRelativeTime, formatMaskedPhone } from '@/lib/formatters';
import { getInboxItems, getProviderCalls } from '@/lib/api';
import { supabase } from '@/lib/supabase';

import { OfficeItem } from '@/types/inbox';
import { CallItem } from '@/types/calls';
import { MailThread, MailDetail, MailMessage } from '@/types/mail';
import { Contact } from '@/types/contacts';
import { useDesktop } from '@/lib/useDesktop';
import { DesktopPageWrapper } from '@/components/desktop/DesktopPageWrapper';
import { useAgentVoice } from '@/hooks/useAgentVoice';
import { useSupabase } from '@/providers';
import { useAuthFetch } from '@/lib/authenticatedFetch';
import { AgentWidget } from '@/components/canvas/widgets/AgentWidget';
import type { AgentActivityEvent } from '@/components/chat';

const eliAvatar = require('@/assets/avatars/eli-avatar.png');
const finnAvatar = require('@/assets/avatars/finn.png');
const inboxHero = require('@/assets/images/inbox-hero.jpg');

type TabType = 'office' | 'calls' | 'mail' | 'contacts';
type EliMessage = { id: string; from: 'user' | 'eli'; text: string; ts: number };

function getMailBody(item: MailThread, detail?: MailDetail | null): string {
  if (detail?.messages?.length) {
    return detail.messages.map(m => m.content).join('\n\n---\n\n');
  }
  return (item as any).body || item.preview;
}

function decodeHtmlEntities(value: string): string {
  return value
    .replace(/&nbsp;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>')
    .replace(/&quot;/gi, '"')
    .replace(/&#39;/gi, "'")
    .replace(/&zwnj;/gi, '')
    .replace(/&shy;/gi, '')
    .replace(/&#8204;/g, '')
    .replace(/&#8203;/g, '')
    .replace(/&#xFEFF;/gi, '')
    .replace(/&#x200B;/gi, '')
    .replace(/&#x200C;/gi, '')
    .replace(/&#x200D;/gi, '')
    .replace(/&#xAD;/gi, '')
    .replace(/&lrm;/gi, '')
    .replace(/&rlm;/gi, '');
}

function formatEmailContent(value: string): string {
  if (!value) return '';
  let text = decodeHtmlEntities(value);

  text = text
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/p>/gi, '\n\n')
    .replace(/<\/div>/gi, '\n');

  text = text
    .replace(/<style[\s\S]*?<\/style>/gi, '')
    .replace(/<script[\s\S]*?<\/script>/gi, '')
    .replace(/<[^>]+>/g, '');

  text = decodeHtmlEntities(text);
  text = text.replace(/[\u200B-\u200D\uFEFF\u00AD\u200E\u200F]/g, '');

  return text
    .replace(/\r\n/g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .replace(/[ \t]+\n/g, '\n')
    .replace(/^[\s\n]+/, '')
    .replace(/[\s\n]+$/, '')
    .trim();
}

function containsHtmlTags(content: string): boolean {
  if (!content) return false;
  const htmlPattern = /<\s*(div|p|table|tr|td|th|span|a|img|br|ul|ol|li|h[1-6]|head|body|html|style|link|meta|center|font|b|i|u|strong|em|section|article|header|footer|nav|main|aside|figure|figcaption|blockquote|pre|code|form|input|button|select|textarea|label|fieldset|legend|details|summary|dialog|template|slot|picture|source|video|audio|canvas|svg|iframe)\b[^>]*>/i;
  return htmlPattern.test(content);
}

function EmailHtmlRenderer({ htmlContent }: { htmlContent: string }) {
  const iframeHeightAnim = useRef(new Animated.Value(400)).current;
  const [iframeHeight, setIframeHeight] = useState(400);
  const iframeRef = useRef<HTMLIFrameElement | null>(null);
  const reportCount = useRef(0);

  const darkStyleOverride = `
    <style>
      html, body {
        background-color: #0D0D0F !important;
        color: #d1d1d6 !important;
        font-family: -apple-system, BlinkMacSystemFont, 'SF Pro Display', 'SF Pro Text', 'Segoe UI', Roboto, sans-serif !important;
        font-size: 14px !important;
        line-height: 1.7 !important;
        margin: 0 !important;
        padding: 16px 20px !important;
        overflow-x: hidden !important;
        overflow-y: hidden !important;
        word-wrap: break-word !important;
        overflow-wrap: break-word !important;
        -webkit-font-smoothing: antialiased !important;
      }
      a { color: #38BDF8 !important; text-decoration: none !important; }
      a:hover { text-decoration: underline !important; }
      img { max-width: 100% !important; height: auto !important; border-radius: 6px; }
      table { max-width: 100% !important; border-collapse: collapse !important; }
      td, th { max-width: 100% !important; }
      * { max-width: 100% !important; box-sizing: border-box !important; }
      p { margin: 0 0 12px 0 !important; }
      h1, h2, h3, h4 { color: #f5f5f7 !important; font-weight: 600 !important; }
    </style>
    <script>
      var reported = 0;
      function reportHeight() {
        if (reported >= 3) return;
        reported++;
        var h = Math.max(document.documentElement.scrollHeight, document.body.scrollHeight);
        window.parent.postMessage({ type: 'email-iframe-height', height: h }, '*');
      }
      window.addEventListener('load', function() {
        setTimeout(reportHeight, 100);
        setTimeout(reportHeight, 600);
        setTimeout(reportHeight, 1400);
      });
    </script>
  `;

  const wrappedHtml = htmlContent.includes('<html') || htmlContent.includes('<HTML')
    ? htmlContent.replace(/<head([^>]*)>/i, `<head$1>${darkStyleOverride}`)
    : `<!DOCTYPE html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">${darkStyleOverride}</head><body style="background:#0D0D0F">${htmlContent}</body></html>`;

  useEffect(() => {
    if (!isWeb) return;
    reportCount.current = 0;
    const handler = (event: MessageEvent) => {
      if (event.data?.type === 'email-iframe-height' && typeof event.data.height === 'number') {
        if (reportCount.current >= 3) return;
        reportCount.current += 1;
        const newH = Math.min(Math.max(event.data.height + 40, 100), 8000);
        setIframeHeight(newH);
        Animated.timing(iframeHeightAnim, { toValue: newH, duration: 200, useNativeDriver: false }).start();
      }
    };
    window.addEventListener('message', handler);
    return () => window.removeEventListener('message', handler);
  }, [htmlContent]);

  if (!isWeb) {
    return (
      <View style={{ paddingVertical: Spacing.md }}>
        <Text style={{ ...Typography.body, color: Colors.text.secondary, lineHeight: 26 }}>
          {formatEmailContent(htmlContent)}
        </Text>
      </View>
    );
  }

  return (
    <Animated.View style={{ overflow: 'hidden' as any, height: iframeHeightAnim }}>
      <iframe
        ref={iframeRef as any}
        srcDoc={wrappedHtml}
        sandbox="allow-same-origin allow-scripts"
        scrolling="no"
        style={{
          width: '100%',
          height: iframeHeight,
          border: 'none',
          outline: 'none',
          boxShadow: 'none',
          backgroundColor: '#0D0D0F',
          display: 'block',
          overflow: 'hidden',
        } as any}
        title="Email content"
      />
    </Animated.View>
  );
}

interface ComposeState {
  visible: boolean;
  to: string;
  cc: string;
  bcc: string;
  subject: string;
  body: string;
  replyToThreadId?: string;
  replyToMessageId?: string;
  mode: 'new' | 'reply' | 'replyAll' | 'forward';
  attachments: AttachedFile[];
}

interface AttachedFile {
  name: string;
  size: number;
  type: string;
  file: File;
}

function getCallSummary(item: CallItem): string {
  if ((item as any).summary) return (item as any).summary;
  return `Call with ${item.callerName} regarding ${item.tags.join(' & ').toLowerCase()} matters. Duration: ${item.duration}. Outcome: ${item.outcome}. Follow-up actions may be required based on discussion points.`;
}

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

const PRIORITY_DOT_COLOR: Record<string, string> = {
  High: Colors.semantic.error,
  Medium: Colors.semantic.warning,
  Low: Colors.accent.cyan,
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
  Unread: { icon: 'mail-unread-outline', title: 'All caught up', subtitle: 'No unread items right now' },
  Urgent: { icon: 'alert-circle-outline', title: 'No Urgent items', subtitle: 'No urgent items at this time' },
  Clients: { icon: 'business-outline', title: 'No Clients', subtitle: 'Client contacts will appear here' },
  Vendors: { icon: 'cube-outline', title: 'No Vendors', subtitle: 'Vendor contacts will appear here' },
  Team: { icon: 'people-circle-outline', title: 'No Team contacts', subtitle: 'Team contacts will appear here' },
  Recent: { icon: 'time-outline', title: 'No Recent contacts', subtitle: 'Recently contacted people will appear here' },
  default: { icon: 'file-tray-outline', title: 'Nothing here yet', subtitle: 'Items will appear as they come in' },
};

const isWeb = Platform.OS === 'web';
const screenW = isWeb && typeof window !== 'undefined' ? window.innerWidth : Dimensions.get('window').width;
const isTablet = screenW >= 768 && screenW < 1200;
const isDesktop = screenW >= 1200;
const isWideScreen = screenW >= 768;

function getFileTypeIcon(mimeType: string): { icon: keyof typeof Ionicons.glyphMap; color: string } {
  if (mimeType.startsWith('image/')) return { icon: 'image', color: '#A78BFA' };
  if (mimeType === 'application/pdf') return { icon: 'document-text', color: '#F87171' };
  if (mimeType.includes('spreadsheet') || mimeType.includes('excel') || mimeType.includes('.sheet')) return { icon: 'grid', color: '#4ADE80' };
  if (mimeType.includes('word') || mimeType.includes('.document')) return { icon: 'document', color: '#60A5FA' };
  if (mimeType.includes('presentation') || mimeType.includes('powerpoint')) return { icon: 'easel', color: '#FBBF24' };
  if (mimeType.startsWith('video/')) return { icon: 'videocam', color: '#F472B6' };
  if (mimeType.startsWith('audio/')) return { icon: 'musical-notes', color: '#34D399' };
  if (mimeType.includes('zip') || mimeType.includes('archive') || mimeType.includes('compressed')) return { icon: 'file-tray-stacked', color: '#6B7280' };
  return { icon: 'document-outline', color: Colors.text.muted };
}

function OfficeItemCard({ item, selected, onPress }: { item: OfficeItem; selected: boolean; onPress: () => void }) {
  const [hovered, setHovered] = useState(false);
  const priorityColor = PRIORITY_DOT_COLOR[item.priority];

  return (
    <TouchableOpacity
      style={[
        styles.card,
        selected && styles.cardSelected,
        hovered && isWeb && styles.cardHover,
        item.unread && styles.cardUnread,
      ]}
      onPress={onPress}
      activeOpacity={0.7}
      {...(isWeb ? { onMouseEnter: () => setHovered(true), onMouseLeave: () => setHovered(false) } : {})}
    >
      <View style={styles.cardRow}>
        <View style={styles.iconCircle}>
          <Ionicons name="briefcase" size={18} color={Colors.accent.cyan} />
        </View>
        <View style={{ flex: 1, marginLeft: Spacing.md }}>
          <View style={styles.titleRow}>
            {item.unread && <View style={styles.unreadDot} />}
            {priorityColor && <View style={[styles.priorityDot, { backgroundColor: priorityColor }]} />}
            <Text style={[styles.cardTitle, item.unread && styles.cardTitleUnread]} numberOfLines={1}>{item.title}</Text>
          </View>
          <Text style={styles.cardPreview} numberOfLines={1}>{item.department} · {item.preview}</Text>
        </View>
        <Text style={styles.timeText}>{formatRelativeTime(item.timestamp)}</Text>
      </View>
    </TouchableOpacity>
  );
}

function CallItemCard({ item, selected, onPress }: { item: CallItem; selected: boolean; onPress: () => void }) {
  const [hovered, setHovered] = useState(false);

  const getCallIcon = (): { icon: keyof typeof Ionicons.glyphMap; color: string } => {
    switch (item.callType) {
      case 'inbound': return { icon: 'call', color: Colors.semantic.success };
      case 'outbound': return { icon: 'call', color: Colors.semantic.success };
      case 'missed': return { icon: 'call', color: Colors.semantic.error };
      case 'voicemail': return { icon: 'recording', color: Colors.semantic.warning };
      case 'blocked': return { icon: 'close-circle', color: Colors.semantic.error };
      default: return { icon: 'call', color: Colors.semantic.success };
    }
  };

  const { icon, color } = getCallIcon();
  const outcomeColor = item.outcome === 'Completed' ? Colors.semantic.success : item.outcome === 'Missed' || item.outcome === 'Blocked' ? Colors.semantic.error : Colors.accent.amber;

  return (
    <TouchableOpacity
      style={[
        styles.card,
        selected && styles.cardSelected,
        hovered && isWeb && styles.cardHover,
      ]}
      onPress={onPress}
      activeOpacity={0.7}
      {...(isWeb ? { onMouseEnter: () => setHovered(true), onMouseLeave: () => setHovered(false) } : {})}
    >
      <View style={styles.cardRow}>
        <View style={[styles.iconCircle, { backgroundColor: color + '18' }]}>
          <Ionicons name={icon} size={18} color={color} />
        </View>
        <View style={{ flex: 1, marginLeft: Spacing.md }}>
          <Text style={styles.cardTitle}>{item.callerName}</Text>
          <Text style={styles.cardPreview}>{formatMaskedPhone(item.callerNumber)} · <Text style={{ color: outcomeColor }}>{item.outcome}</Text> · {item.duration}</Text>
        </View>
        <Text style={styles.timeText}>{formatRelativeTime(item.timestamp)}</Text>
      </View>
    </TouchableOpacity>
  );
}

function MailItemCard({ item, selected, onPress }: { item: MailThread; selected: boolean; onPress: () => void }) {
  const [hovered, setHovered] = useState(false);
  const isSent = (item as any).labelIds?.includes('SENT') && !(item as any).labelIds?.includes('INBOX');
  const recipientDisplay = item.recipients?.length > 0 ? item.recipients[0].replace(/<.*>/, '').trim() : '';
  const initial = isSent ? '→' : item.senderName.charAt(0).toUpperCase();

  return (
    <TouchableOpacity
      style={[
        styles.mailRow,
        selected && styles.mailRowSelected,
        hovered && isWeb && styles.mailRowHover,
        item.unread && styles.mailRowUnread,
      ]}
      onPress={onPress}
      activeOpacity={0.85}
      {...(isWeb ? { onMouseEnter: () => setHovered(true), onMouseLeave: () => setHovered(false) } : {})}
    >
      {item.unread && !selected && <View style={styles.mailUnreadAccent} />}
      <View style={styles.mailRowInner}>
        <View style={[styles.mailAvatarNew, isSent && styles.mailAvatarSent]}>
          {isSent ? (
            <Ionicons name="arrow-forward" size={13} color={Colors.accent.cyan} />
          ) : (
            <LinearGradient
              colors={item.unread ? [Colors.accent.cyan, '#1D6FA4'] : ['#2A2A2E', '#222226']}
              style={styles.mailAvatarGradient}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
            >
              <Text style={[styles.mailAvatarText, !item.unread && { color: Colors.text.muted }]}>{initial}</Text>
            </LinearGradient>
          )}
        </View>

        <View style={{ flex: 1, marginLeft: 12 }}>
          <View style={styles.mailRowLine1}>
            <Text style={[styles.mailSenderLabel, item.unread && styles.mailSenderLabelUnread]} numberOfLines={1}>
              {isSent ? `To: ${recipientDisplay || 'Unknown'}` : item.senderName}
            </Text>
            <View style={styles.mailRowMeta}>
              {item.hasAttachments && <Ionicons name="attach" size={11} color={Colors.text.disabled} style={{ marginRight: 3 }} />}
              {item.messageCount > 1 && <Text style={styles.mailThreadCount}>{item.messageCount}</Text>}
              <Text style={[styles.mailTimeLabel, item.unread && styles.mailTimeLabelUnread]}>{formatRelativeTime(item.timestamp)}</Text>
            </View>
          </View>

          <Text style={[styles.mailSubjectLabel, item.unread && styles.mailSubjectLabelUnread]} numberOfLines={1}>
            {item.subject}
          </Text>

          <Text style={styles.mailPreviewLabel} numberOfLines={1}>
            {item.preview || ' '}
          </Text>
        </View>
      </View>
      <View style={styles.mailRowSeparator} />
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
          <Text style={styles.cardPreview}>{item.title} · {item.organization} · <Text style={{ color: roleColor }}>{item.role}</Text></Text>
        </View>
        <Text style={styles.timeText}>{formatRelativeTime(item.lastContacted)}</Text>
      </View>
    </TouchableOpacity>
  );
}

function EmptyState({ filter, searchQuery }: { filter: string; searchQuery?: string }) {
  if (searchQuery) {
    return (
      <View style={styles.emptyState}>
        <Ionicons name="search-outline" size={40} color={Colors.text.disabled} style={{ opacity: 0.4 }} />
        <Text style={styles.emptyTitle}>No results for "{searchQuery}"</Text>
        <Text style={styles.emptySubtitle}>Try a different search term or clear your filters</Text>
      </View>
    );
  }
  const config = EMPTY_STATE_MAP[filter] || EMPTY_STATE_MAP.default;
  return (
    <View style={styles.emptyState}>
      <Ionicons name={config.icon} size={40} color={Colors.text.disabled} style={{ opacity: 0.4 }} />
      <Text style={styles.emptyTitle}>{config.title}</Text>
      <Text style={styles.emptySubtitle}>{config.subtitle}</Text>
    </View>
  );
}

function OfficePreview({ item }: { item: OfficeItem }) {
  const priorityColor = PRIORITY_DOT_COLOR[item.priority];
  const timelineSteps = ['Received', 'In Review', 'Resolved'];
  const currentStep = item.status === 'resolved' ? 2 : item.status === 'in_progress' ? 1 : 0;
  return (
    <View style={fp.section}>
      <View style={fp.headerRow}>
        <View style={{ flex: 1 }}>
          <View style={fp.badgeRow}>
            {priorityColor && (
              <View style={[fp.badge, { backgroundColor: priorityColor + '20' }]}>
                <View style={{ width: 6, height: 6, borderRadius: 3, backgroundColor: priorityColor }} />
                <Text style={[fp.badgeText, { color: priorityColor }]}>{item.priority}</Text>
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
        <Text style={fp.bodyText}>{item.body || item.preview}</Text>
      </View>
      <View style={fp.divider} />
      <Text style={fp.sectionLabel}>Status</Text>
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
        <TouchableOpacity style={[fp.actionBtn, { backgroundColor: Colors.semantic.successLight }]} activeOpacity={0.7}>
          <Ionicons name="checkmark-circle" size={15} color={Colors.semantic.success} />
          <Text style={[fp.actionBtnText, { color: Colors.semantic.success }]}>Approve</Text>
        </TouchableOpacity>
        <TouchableOpacity style={fp.actionBtn} activeOpacity={0.7}>
          <Ionicons name="chatbubble" size={15} color={Colors.text.tertiary} />
          <Text style={fp.actionBtnText}>Reply</Text>
        </TouchableOpacity>
        <TouchableOpacity style={fp.actionBtn} activeOpacity={0.7}>
          <Ionicons name="arrow-redo" size={15} color={Colors.text.tertiary} />
          <Text style={fp.actionBtnText}>Forward</Text>
        </TouchableOpacity>
        <TouchableOpacity style={fp.actionBtn} activeOpacity={0.7}>
          <Ionicons name="trending-up" size={15} color={Colors.semantic.warning} />
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
  const waveformHeights = useMemo(() => Array.from({ length: 24 }, () => 4 + Math.random() * 16), []);
  const waveformOpacities = useMemo(() => Array.from({ length: 24 }, () => 0.4 + Math.random() * 0.6), []);

  return (
    <View style={fp.section}>
      <View style={fp.headerRow}>
        <View style={[fp.callerAvatar, { backgroundColor: typeColor + '18', borderColor: typeColor + '30' }]}>
          <Ionicons name="call" size={24} color={typeColor} />
        </View>
        <View style={{ flex: 1, marginLeft: Spacing.lg }}>
          <Text style={fp.pageTitle}>{item.callerName}</Text>
          <Text style={fp.subtitleText}>{formatMaskedPhone(item.callerNumber)}</Text>
          <View style={[fp.badge, { backgroundColor: typeColor + '18', alignSelf: 'flex-start', marginTop: Spacing.xs }]}>
            <Ionicons name={typeIcon} size={11} color={typeColor} />
            <Text style={[fp.badgeText, { color: typeColor }]}>{typeLabel}</Text>
          </View>
        </View>
        <Text style={fp.timestamp}>{formatRelativeTime(item.timestamp)}</Text>
      </View>
      <View style={fp.divider} />
      <View style={fp.metricGrid}>
        <View style={fp.metricCard}>
          <Ionicons name="time-outline" size={18} color={Colors.accent.cyan} />
          <Text style={fp.metricLabel}>Duration</Text>
          <Text style={fp.metricValue}>{item.duration}</Text>
        </View>
        <View style={fp.metricCard}>
          <View style={[fp.metricDot, { backgroundColor: outcomeColor }]} />
          <Text style={fp.metricLabel}>Outcome</Text>
          <Text style={[fp.metricValue, { color: outcomeColor }]}>{item.outcome}</Text>
        </View>
      </View>
      <View style={fp.divider} />
      <Text style={fp.sectionLabel}>Recording</Text>
      <View style={fp.recordingCard}>
        <TouchableOpacity style={fp.playBtn} activeOpacity={0.7}>
          <Ionicons name="play" size={18} color="#fff" />
        </TouchableOpacity>
        <View style={{ flex: 1, marginLeft: Spacing.md }}>
          <View style={fp.waveformBar}>
            {waveformHeights.map((h, i) => (
              <View key={i} style={[fp.waveformLine, { height: h, opacity: waveformOpacities[i] }]} />
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
              <Ionicons name="sparkles" size={14} color={Colors.accent.cyan} />
              <Text style={fp.aiSummaryLabel}>AI Summary</Text>
            </View>
            <Text style={fp.bodyText}>{getCallSummary(item)}</Text>
          </View>
        </>
      )}
      <View style={fp.divider} />
      <View style={fp.actionBar}>
        <TouchableOpacity style={[fp.actionBtn, { backgroundColor: Colors.semantic.successLight }]} activeOpacity={0.7}>
          <Ionicons name="call" size={15} color={Colors.semantic.success} />
          <Text style={[fp.actionBtnText, { color: Colors.semantic.success }]}>Call Back</Text>
        </TouchableOpacity>
        <TouchableOpacity style={fp.actionBtn} activeOpacity={0.7}>
          <Ionicons name="chatbubble" size={15} color={Colors.text.tertiary} />
          <Text style={fp.actionBtnText}>Message</Text>
        </TouchableOpacity>
        <TouchableOpacity style={fp.actionBtn} activeOpacity={0.7}>
          <Ionicons name="person-add" size={15} color={Colors.text.tertiary} />
          <Text style={fp.actionBtnText}>Save Contact</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

function MailPreview({ item, detail, loading: detailLoading, onReply, onReplyAll, onForward, onSmartReply }: {
  item: MailThread;
  detail?: MailDetail | null;
  loading?: boolean;
  onReply?: () => void;
  onReplyAll?: () => void;
  onForward?: () => void;
  onSmartReply?: (text: string) => void;
}) {
  const messages = detail?.messages || [];

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
        <View style={[fp.badge, { backgroundColor: Colors.background.tertiary }]}>
          <Text style={[fp.badgeText, { color: Colors.text.tertiary }]}>{item.messageCount} messages</Text>
        </View>
      </View>
      <Text style={fp.mailSubject}>{item.subject}</Text>
      <View style={fp.divider} />

      {detailLoading ? (
        <View style={{ padding: Spacing.xl, alignItems: 'center' }}>
          <Text style={{ color: Colors.text.muted, ...Typography.caption }}>Loading email...</Text>
        </View>
      ) : messages.length > 0 ? (
        messages.map((msg, idx) => (
          <View key={msg.id || idx}>
            <View style={fp.mailSenderRow}>
              <View style={fp.mailAvatarLg}>
                <Text style={fp.mailAvatarLgText}>{msg.sender.charAt(0)}</Text>
              </View>
              <View style={{ flex: 1, marginLeft: Spacing.md }}>
                <Text style={fp.mailSenderName}>{msg.sender}</Text>
                <Text style={fp.mailSenderEmail}>{msg.senderEmail}</Text>
              </View>
              <Text style={fp.timestamp}>{formatRelativeTime(msg.timestamp)}</Text>
            </View>
            <View style={fp.mailBodyArea}>
              {containsHtmlTags(msg.content) ? (
                <EmailHtmlRenderer htmlContent={msg.content} />
              ) : (
                <Text style={fp.mailBodyText}>{formatEmailContent(msg.content) || 'No readable email body available.'}</Text>
              )}
            </View>
            {msg.attachments?.length > 0 && (
              <View style={fp.attachmentsSection}>
                <Text style={fp.attachmentsLabel}>Attachments ({msg.attachments.length})</Text>
                <View style={fp.attachmentsGrid}>
                  {msg.attachments.map((att) => {
                    const fileInfo = getFileTypeIcon(att.type);
                    const isImage = att.type.startsWith('image/');
                    return (
                      <TouchableOpacity
                        key={att.id}
                        style={fp.attachmentCard}
                        activeOpacity={0.7}
                        onPress={() => {
                          if (isWeb) {
                            window.open(`/api/mail/attachments/${msg.id}/${att.id}?name=${encodeURIComponent(att.name)}&type=${encodeURIComponent(att.type)}`, '_blank');
                          }
                        }}
                      >
                        {isImage ? (
                          <View style={fp.attachmentImagePreview}>
                            <Ionicons name="image" size={24} color={fileInfo.color} />
                          </View>
                        ) : (
                          <View style={[fp.attachmentIconWrap, { backgroundColor: fileInfo.color + '18' }]}>
                            <Ionicons name={fileInfo.icon} size={20} color={fileInfo.color} />
                          </View>
                        )}
                        <View style={{ flex: 1 }}>
                          <Text style={fp.attachmentName} numberOfLines={1}>{att.name}</Text>
                          <Text style={fp.attachmentSize}>{att.size}</Text>
                        </View>
                        <Ionicons name="download-outline" size={16} color={Colors.text.muted} />
                      </TouchableOpacity>
                    );
                  })}
                </View>
              </View>
            )}
            {idx < messages.length - 1 && (
              <View style={fp.threadSeparator}>
                <View style={fp.threadSeparatorLine} />
              </View>
            )}
          </View>
        ))
      ) : (
        <>
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
            {containsHtmlTags(item.preview) ? (
              <EmailHtmlRenderer htmlContent={item.preview} />
            ) : (
              <Text style={fp.mailBodyText}>{formatEmailContent(item.preview)}</Text>
            )}
          </View>
        </>
      )}

      <View style={fp.divider} />
      <View style={fp.actionBar}>
        <TouchableOpacity style={[fp.actionBtn, { backgroundColor: Colors.accent.cyanLight }]} activeOpacity={0.7} onPress={onReply}>
          <Ionicons name="arrow-undo" size={15} color={Colors.accent.cyan} />
          <Text style={[fp.actionBtnText, { color: Colors.accent.cyan }]}>Reply</Text>
        </TouchableOpacity>
        <TouchableOpacity style={fp.actionBtn} activeOpacity={0.7} onPress={onReplyAll}>
          <Ionicons name="arrow-undo" size={15} color={Colors.text.tertiary} />
          <Text style={fp.actionBtnText}>Reply All</Text>
        </TouchableOpacity>
        <TouchableOpacity style={fp.actionBtn} activeOpacity={0.7} onPress={onForward}>
          <Ionicons name="arrow-redo" size={15} color={Colors.text.tertiary} />
          <Text style={fp.actionBtnText}>Forward</Text>
        </TouchableOpacity>
      </View>
      <View style={fp.divider} />
      <Text style={fp.sectionLabel}>Quick Replies</Text>
      <View style={styles.smartReplyRow}>
        {['Thanks, received!', "I'll review shortly", 'Forward to team'].map((reply) => (
          <TouchableOpacity key={reply} style={styles.smartReplyPill} activeOpacity={0.7} onPress={() => onSmartReply?.(reply)}>
            <Text style={styles.smartReplyText}>{reply}</Text>
          </TouchableOpacity>
        ))}
      </View>
    </View>
  );
}

function ContactPreview({ item }: { item: Contact }) {
  const roleColor = ROLE_COLORS[item.role] || Colors.text.secondary;
  const activityHistory = useMemo(() => [
    { icon: 'call' as keyof typeof Ionicons.glyphMap, desc: 'Phone call — 5 min', time: '2 days ago', color: Colors.semantic.success },
    { icon: 'mail' as keyof typeof Ionicons.glyphMap, desc: `Email — RE: ${item.organization} update`, time: '5 days ago', color: Colors.accent.cyan },
    { icon: 'videocam' as keyof typeof Ionicons.glyphMap, desc: 'Video meeting — Quarterly review', time: '2 weeks ago', color: '#A78BFA' },
  ], [item.organization]);

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
          <View style={[fp.badge, { backgroundColor: roleColor + '18', alignSelf: 'flex-start', marginTop: Spacing.sm }]}>
            <Text style={[fp.badgeText, { color: roleColor }]}>{item.role}</Text>
          </View>
        </View>
      </View>
      <View style={fp.divider} />
      <Text style={fp.sectionLabel}>Contact Information</Text>
      <View style={fp.contactGrid}>
        <View style={fp.contactGridItem}>
          <Ionicons name="mail-outline" size={16} color={Colors.accent.cyan} />
          <Text style={fp.contactGridLabel}>Email</Text>
          <Text style={fp.contactGridValue}>{item.email}</Text>
        </View>
        <View style={fp.contactGridItem}>
          <Ionicons name="call-outline" size={16} color={Colors.semantic.success} />
          <Text style={fp.contactGridLabel}>Phone</Text>
          <Text style={fp.contactGridValue}>{formatMaskedPhone(item.phone)}</Text>
        </View>
      </View>
      <View style={fp.divider} />
      <Text style={fp.sectionLabel}>Notes</Text>
      <View style={fp.bodyCard}>
        <Text style={fp.bodyText}>{item.notes}</Text>
      </View>
      <View style={fp.divider} />
      <Text style={fp.sectionLabel}>History</Text>
      <View style={fp.historyList}>
        {activityHistory.map((act, idx) => (
          <View key={idx} style={fp.historyItem}>
            <View style={[fp.historyDot, { backgroundColor: act.color + '18', borderColor: act.color + '30' }]}>
              <Ionicons name={act.icon} size={13} color={act.color} />
            </View>
            <View style={{ flex: 1, marginLeft: Spacing.md }}>
              <Text style={fp.historyDesc}>{act.desc}</Text>
              <Text style={fp.historyTime}>{act.time}</Text>
            </View>
          </View>
        ))}
      </View>
      <View style={fp.divider} />
      <View style={fp.actionBar}>
        <TouchableOpacity style={[fp.actionBtn, { backgroundColor: Colors.accent.cyanLight }]} activeOpacity={0.7}>
          <Ionicons name="mail" size={15} color={Colors.accent.cyan} />
          <Text style={[fp.actionBtnText, { color: Colors.accent.cyan }]}>Email</Text>
        </TouchableOpacity>
        <TouchableOpacity style={[fp.actionBtn, { backgroundColor: Colors.semantic.successLight }]} activeOpacity={0.7}>
          <Ionicons name="call" size={15} color={Colors.semantic.success} />
          <Text style={[fp.actionBtnText, { color: Colors.semantic.success }]}>Call</Text>
        </TouchableOpacity>
        <TouchableOpacity style={fp.actionBtn} activeOpacity={0.7}>
          <Ionicons name="calendar" size={15} color={Colors.text.tertiary} />
          <Text style={fp.actionBtnText}>Schedule</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

export default function InboxScreen() {
  const insets = useSafeAreaInsets();
  const isDesktop = useDesktop();
  const router = useRouter();
  const { authenticatedFetch } = useAuthFetch();

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
  const [eliMessages, setEliMessages] = useState<EliMessage[]>([
    { id: '1', from: 'eli', text: 'Hey! I\'ve been sorting through your inbox. What would you like me to help with?', ts: Date.now() },
  ]);
  const [eliRun, setEliRun] = useState<{ events: AgentActivityEvent[]; status: 'running' | 'completed' } | null>(null);
  const [mailDetail, setMailDetail] = useState<MailDetail | null>(null);
  const [mailDetailLoading, setMailDetailLoading] = useState(false);
  const [compose, setCompose] = useState<ComposeState>({ visible: false, to: '', cc: '', bcc: '', subject: '', body: '', mode: 'new', attachments: [] });
  const [composeSending, setComposeSending] = useState(false);
  const [showCcBcc, setShowCcBcc] = useState(false);

  const [showFinnMenu, setShowFinnMenu] = useState(false);

  const [showMailSetupModal, setShowMailSetupModal] = useState(false);
  const [mailSetupChecked, setMailSetupChecked] = useState(false);
  const [hasActiveMailbox, setHasActiveMailbox] = useState(false);
  const [mailAccounts, setMailAccounts] = useState<any[]>([]);
  const [selectedMailbox, setSelectedMailbox] = useState<string | null>(null);
  const [showMailboxDropdown, setShowMailboxDropdown] = useState(false);
  const [removingMailboxId, setRemovingMailboxId] = useState<string | null>(null);
  const [showMailboxModal, setShowMailboxModal] = useState(false);

  const [dateFilter, setDateFilter] = useState<string | null>(null);
  const dateInputRef = useRef<HTMLInputElement | null>(null);

  const [selectedEmail, setSelectedEmail] = useState<MailThread | null>(null);
  const [replyPopupOpen, setReplyPopupOpen] = useState(false);
  const replyPopupAnim = useRef(new Animated.Value(0)).current;

  const emailPageFadeAnim = useRef(new Animated.Value(0)).current;

  const [eliVoiceModalOpen, setEliVoiceModalOpen] = useState(false);
  const eliModalSlideAnim = useRef(new Animated.Value(80)).current;
  const eliModalOpacityAnim = useRef(new Animated.Value(0)).current;

  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<MailThread[] | null>(null);
  const [searching, setSearching] = useState(false);
  const [labelResults, setLabelResults] = useState<MailThread[] | null>(null);
  const [labelLoading, setLabelLoading] = useState(false);
  const searchTimerRef = useRef<any>(null);

  const [unifiedModalTab, setUnifiedModalTab] = useState<'compose' | 'eli'>('compose');
  const modalScaleAnim = useRef(new Animated.Value(0.97)).current;
  const modalOpacityAnim = useRef(new Animated.Value(0)).current;

  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const { suiteId, session } = useSupabase();

  const appendEliRunEvent = useCallback(
    (
      partial: Pick<AgentActivityEvent, 'label'> &
        Partial<Pick<AgentActivityEvent, 'type' | 'status' | 'icon' | 'timestamp'>>,
    ) => {
      const mapped: AgentActivityEvent = {
        id: `eli_evt_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
        type: partial.type || 'step',
        label: partial.label,
        status: partial.status || 'completed',
        timestamp: partial.timestamp || Date.now(),
        icon: partial.icon as any,
      };
      setEliRun(prev => {
        if (!prev) return { events: [mapped], status: 'running' };
        return { ...prev, events: [...prev.events, mapped] };
      });
    },
    [],
  );

  const eliVoice = useAgentVoice({
    agent: 'eli',
    suiteId: suiteId ?? undefined,
    accessToken: session?.access_token,
    onStatusChange: (voiceStatus) => {
      setEliVoiceActive(voiceStatus !== 'idle' && voiceStatus !== 'error');
      if (voiceStatus === 'idle') setEliTranscript('');
    },
    onTranscript: (text) => {
      setEliTranscript(text);
    },
    onResponse: (text) => {
      setEliTranscript(text);
      setEliMessages(prev => [...prev, { id: String(Date.now()), from: 'eli', text, ts: Date.now() }]);
      setEliRun(prev => {
        if (!prev || prev.events.length === 0) {
          return {
            events: [{
              id: `eli_evt_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
              type: 'done',
              label: 'Response drafted and ready.',
              status: 'completed',
              timestamp: Date.now(),
              icon: 'checkmark-circle',
            } as any],
            status: 'completed',
          };
        }
        return { ...prev, status: 'completed' };
      });
    },
    onActivityEvent: (event) => {
      const message = event.message?.trim();
      if (!message) return;
      appendEliRunEvent({
        type: (event.type as AgentActivityEvent['type']) || 'step',
        label: message,
        status:
          event.type === 'done'
            ? 'completed'
            : event.type === 'error'
            ? 'error'
            : event.type === 'thinking'
            ? 'active'
            : 'completed',
        timestamp: event.timestamp || Date.now(),
        icon: event.icon as any,
      });
    },
    onError: (error) => {
      console.error('Eli voice error:', error);
      setEliVoiceActive(false);
      appendEliRunEvent({
        type: 'error',
        label: 'Voice pipeline error. Eli can retry now.',
        status: 'error',
        icon: 'alert-circle',
      });
      setEliRun(prev => (prev ? { ...prev, status: 'completed' } : prev));
    },
  });

  const eliMicPulse = useRef(new Animated.Value(1)).current;
  const breathAnim = useRef(new Animated.Value(1)).current;

  const selectedMailboxAccount = mailAccounts.find((a: any) => a.id === selectedMailbox) || mailAccounts[0];
  const selectedMailboxEmail = selectedMailboxAccount?.email as string | undefined;

  const handleEliMicPress = useCallback(async () => {
    if (Platform.OS !== 'web') {
      Alert.alert('Voice Unavailable', 'Voice is only available on the web version.');
      return;
    }
    if (!session?.access_token) {
      Alert.alert('Authentication Required', 'Please sign in again to talk to Eli.');
      return;
    }
    if (eliVoice.isActive) {
      eliVoice.endSession();
    } else {
      try {
        await eliVoice.startSession();
      } catch (error) {
        console.error('Failed to start Eli voice session:', error);
        Alert.alert('Connection Error', 'Unable to connect to Eli. Please try again.');
      }
    }
  }, [eliVoice, session?.access_token]);

  const handleEliSendMessage = useCallback(async (text: string) => {
    setEliMessages(prev => [...prev, { id: String(Date.now()), from: 'user', text, ts: Date.now() }]);
    setEliRun({
      events: [{
        id: `eli_evt_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
        type: 'thinking',
        label: 'Understanding your request...',
        status: 'active',
        timestamp: Date.now(),
        icon: 'sparkles',
      } as any],
      status: 'running',
    });
    if (!session?.access_token) {
      setEliMessages(prev => [
        ...prev,
        { id: String(Date.now() + 1), from: 'eli', text: 'Your session expired. Please sign in again so I can access your inbox.', ts: Date.now() },
      ]);
      setEliRun(null);
      return;
    }
    try {
      await eliVoice.sendText(text);
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      setEliMessages(prev => [
        ...prev,
        { id: String(Date.now() + 2), from: 'eli', text: `I couldn't process that: ${msg}`, ts: Date.now() },
      ]);
      appendEliRunEvent({
        type: 'error',
        label: `Error: ${msg}`,
        status: 'error',
        icon: 'alert-circle',
      });
      setEliRun(prev => (prev ? { ...prev, status: 'completed' } : prev));
    }
  }, [eliVoice, session?.access_token, appendEliRunEvent]);

  const fetchMailDetail = useCallback(async (threadId: string) => {
    setMailDetailLoading(true);
    setMailDetail(null);
    try {
      const params = new URLSearchParams();
      if (selectedMailboxEmail) params.set('account', selectedMailboxEmail);
      const qs = params.toString();
      const res = await authenticatedFetch(`/api/mail/threads/${threadId}${qs ? `?${qs}` : ''}`);
      if (res.ok) {
        const data = await res.json();
        setMailDetail(data);
      }
    } catch (e) {
      console.error('Failed to load thread detail', e);
    }
    setMailDetailLoading(false);
  }, [authenticatedFetch, selectedMailboxEmail]);

  const openCompose = useCallback((mode: ComposeState['mode'] = 'new', thread?: MailThread) => {
    if (!thread) {
      setCompose({ visible: true, to: '', cc: '', bcc: '', subject: '', body: '', mode: 'new', attachments: [] });
      setShowCcBcc(false);
      setUnifiedModalTab('compose');
      return;
    }
    const lastMsg = mailDetail?.messages?.[mailDetail.messages.length - 1];
    const replyTo = lastMsg?.senderEmail || thread.senderEmail;
    const allRecipients = [...new Set([replyTo, ...thread.recipients])].join(', ');
    if (mode === 'reply') {
      setCompose({ visible: true, to: replyTo, cc: '', bcc: '', subject: `Re: ${thread.subject}`, body: '', mode, replyToThreadId: thread.id, attachments: [] });
    } else if (mode === 'replyAll') {
      setCompose({ visible: true, to: allRecipients, cc: '', bcc: '', subject: `Re: ${thread.subject}`, body: '', mode, replyToThreadId: thread.id, attachments: [] });
    } else if (mode === 'forward') {
      const fwdBody = lastMsg ? `\n\n---------- Forwarded message ----------\nFrom: ${lastMsg.sender} <${lastMsg.senderEmail}>\n\n${lastMsg.content}` : '';
      setCompose({ visible: true, to: '', cc: '', bcc: '', subject: `Fwd: ${thread.subject}`, body: fwdBody, mode, attachments: [] });
    }
    setShowCcBcc(false);
    setUnifiedModalTab('compose');
  }, [mailDetail]);

  const handleSendEmail = useCallback(async () => {
    if (!compose.to || !compose.subject) return;
    setComposeSending(true);
    try {
      const res = await authenticatedFetch('/api/mail/send', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          to: compose.to,
          cc: compose.cc || undefined,
          bcc: compose.bcc || undefined,
          subject: compose.subject,
          body: compose.body,
          account: selectedMailboxEmail,
          replyToThreadId: compose.replyToThreadId,
        }),
      });
      if (res.ok) {
        setCompose({ visible: false, to: '', cc: '', bcc: '', subject: '', body: '', mode: 'new', attachments: [] });
        Alert.alert('Sent', 'Email sent successfully.');
      } else {
        Alert.alert('Error', 'Failed to send email. Please try again.');
      }
    } catch (e) {
      Alert.alert('Error', 'Failed to send email. Please try again.');
    }
    setComposeSending(false);
  }, [compose, authenticatedFetch, selectedMailboxEmail]);

  const handleSmartReply = useCallback(async (text: string, thread: MailThread) => {
    setComposeSending(true);
    try {
      const res = await authenticatedFetch('/api/mail/send', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          to: thread.senderEmail,
          subject: `Re: ${thread.subject}`,
          body: text,
          account: selectedMailboxEmail,
          replyToThreadId: thread.id,
        }),
      });
      if (res.ok) {
        Alert.alert('Sent', `Quick reply sent: "${text}"`);
      } else {
        Alert.alert('Error', 'Failed to send reply.');
      }
    } catch {
      Alert.alert('Error', 'Failed to send reply.');
    }
    setComposeSending(false);
  }, [authenticatedFetch, selectedMailboxEmail]);

  const loadMailThreads = useCallback(async () => {
    try {
      const params = new URLSearchParams();
      if (selectedMailboxEmail) params.set('account', selectedMailboxEmail);
      const qs = params.toString();
      const mailRes = await authenticatedFetch(`/api/mail/threads${qs ? `?${qs}` : ''}`);
      if (mailRes.ok) {
        const mailData = await mailRes.json();
        setMailThreads(mailData.threads ?? []);
      } else {
        setMailThreads([]);
      }
    } catch {
      setMailThreads([]);
    }
  }, [authenticatedFetch, selectedMailboxEmail]);

  const handleSearch = useCallback(async (query: string) => {
    if (!query.trim()) {
      setSearchResults(null);
      return;
    }
    setSearching(true);
    try {
      const params = new URLSearchParams();
      if (selectedMailboxEmail) params.set('account', selectedMailboxEmail);
      params.set('q', query);
      const qs = params.toString();
      const res = await authenticatedFetch(`/api/mail/threads?${qs}`);
      if (res.ok) {
        const data = await res.json();
        setSearchResults(data.threads ?? []);
      } else {
        setSearchResults([]);
      }
    } catch {
      setSearchResults([]);
    }
    setSearching(false);
  }, [authenticatedFetch, selectedMailboxEmail]);

  const onSearchChange = useCallback((text: string) => {
    setSearchQuery(text);
    if (searchTimerRef.current) clearTimeout(searchTimerRef.current);
    if (!text.trim()) {
      setSearchResults(null);
      return;
    }
    searchTimerRef.current = setTimeout(() => handleSearch(text), 300);
  }, [handleSearch]);

  const fetchMailByLabel = useCallback(async (label: string) => {
    setLabelLoading(true);
    setLabelResults(null);
    try {
      const params = new URLSearchParams();
      if (selectedMailboxEmail) params.set('account', selectedMailboxEmail);
      params.set('label', label);
      const qs = params.toString();
      const res = await authenticatedFetch(`/api/mail/threads?${qs}`);
      if (res.ok) {
        const data = await res.json();
        setLabelResults(data.threads ?? []);
      } else {
        setLabelResults([]);
      }
    } catch {
      setLabelResults([]);
    }
    setLabelLoading(false);
  }, [authenticatedFetch, selectedMailboxEmail]);

  const handleAttachFiles = useCallback(() => {
    if (isWeb && fileInputRef.current) {
      fileInputRef.current.click();
    }
  }, []);

  const handleFileSelected = useCallback((e: any) => {
    const files = e.target?.files;
    if (!files) return;
    const newFiles: AttachedFile[] = [];
    for (let i = 0; i < files.length; i++) {
      newFiles.push({
        name: files[i].name,
        size: files[i].size,
        type: files[i].type,
        file: files[i],
      });
    }
    setCompose(prev => ({
      ...prev,
      attachments: [...prev.attachments, ...newFiles],
    }));
    if (fileInputRef.current) fileInputRef.current.value = '';
  }, []);

  const removeAttachment = useCallback((index: number) => {
    setCompose(prev => ({
      ...prev,
      attachments: prev.attachments.filter((_, i) => i !== index),
    }));
  }, []);

  const totalAttachmentSize = compose.attachments.reduce((sum, f) => sum + f.size, 0);

  const scrollRef = useRef<ScrollView>(null);

  useEffect(() => {
    let cancelled = false;
    async function loadData() {
      await loadMailThreads();
      try {
        const items = await getInboxItems(50);
        if (!cancelled) setOfficeItems(items);
      } catch {
        if (!cancelled) setOfficeItems([]);
      }
      try {
        const callData = await getProviderCalls(50);
        if (!cancelled) setCalls(callData);
      } catch {
        if (!cancelled) setCalls([]);
      }
      try {
        const { data: contactData } = await supabase
          .from('contacts')
          .select('*')
          .order('name', { ascending: true })
          .limit(100);
        if (!cancelled) setContacts(contactData ?? []);
      } catch {
        if (!cancelled) setContacts([]);
      }
      if (!cancelled) setLoading(false);
    }
    loadData();
    return () => { cancelled = true; };
  }, [loadMailThreads]);

  useEffect(() => {
    if (activeTab === 'mail' && hasActiveMailbox) {
      loadMailThreads();
      setSelectedId(null);
      setMailDetail(null);
    }
  }, [activeTab, hasActiveMailbox, selectedMailbox, loadMailThreads]);

  useEffect(() => {
    if (activeTab !== 'mail') {
      setMailSetupChecked(false);
    }
  }, [activeTab]);

  useEffect(() => {
    if (activeTab === 'mail' && !mailSetupChecked) {
      (async () => {
        try {
          const accountsRes = await authenticatedFetch('/api/mail/accounts');
          if (!accountsRes.ok) {
            setMailAccounts([]);
            setHasActiveMailbox(false);
            setShowMailSetupModal(true);
            setMailSetupChecked(true);
            return;
          }
          const data = await accountsRes.json();
          const accounts = data.accounts || [];
          setMailAccounts(accounts);
          const active = accounts.find((a: any) => a.status === 'ACTIVE') || accounts[0];
          if (active) {
            setHasActiveMailbox(true);
            setSelectedMailbox(active.id);
          } else {
            setHasActiveMailbox(false);
            setShowMailSetupModal(true);
          }
        } catch (e) {
          console.error('Mail accounts check failed', e);
        }
        setMailSetupChecked(true);
      })();
    }
  }, [activeTab, mailSetupChecked]);

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

  useEffect(() => {
    if (compose.visible || eliOpen) {
      Animated.parallel([
        Animated.spring(modalScaleAnim, { toValue: 1, useNativeDriver: false, damping: 20, stiffness: 300 }),
        Animated.timing(modalOpacityAnim, { toValue: 1, duration: 200, useNativeDriver: false }),
      ]).start();
    } else {
      modalScaleAnim.setValue(0.97);
      modalOpacityAnim.setValue(0);
    }
  }, [compose.visible, eliOpen]);

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
    if (searchResults !== null) return searchResults;
    if (labelResults !== null && (currentFilter === 'Sent' || currentFilter === 'Drafts' || currentFilter === 'Junk')) return labelResults;
    switch (currentFilter) {
      case 'Unread': return mailThreads.filter(i => i.unread);
      case 'Starred': return mailThreads.filter(i => (i as any).starred);
      case 'Sent': return labelResults ?? [];
      case 'Drafts': return labelResults ?? [];
      case 'Junk': return labelResults ?? [];
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
      case 'mail': {
        const base = getFilteredMail();
        if (!dateFilter) return base;
        return base.filter((thread: MailThread) => {
          const d = new Date(thread.timestamp);
          const ds = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
          return ds === dateFilter;
        });
      }
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

  const closeEmailDetail = useCallback(() => {
    setSelectedEmail(null);
    setMailDetail(null);
    setReplyPopupOpen(false);
    replyPopupAnim.setValue(0);
  }, [replyPopupAnim]);

  const toggleReplyPopup = useCallback(() => {
    if (replyPopupOpen) {
      Animated.timing(replyPopupAnim, { toValue: 0, duration: 160, useNativeDriver: true }).start(() => setReplyPopupOpen(false));
    } else {
      setReplyPopupOpen(true);
      Animated.timing(replyPopupAnim, { toValue: 1, duration: 200, useNativeDriver: true }).start();
    }
  }, [replyPopupOpen, replyPopupAnim]);

  useEffect(() => {
    if (selectedEmail) {
      emailPageFadeAnim.setValue(0);
      Animated.timing(emailPageFadeAnim, {
        toValue: 1,
        duration: 280,
        useNativeDriver: true,
      }).start();
    }
  }, [selectedEmail, emailPageFadeAnim]);

  const openEliVoiceModal = useCallback(() => {
    setEliVoiceModalOpen(true);
    eliModalSlideAnim.setValue(80);
    eliModalOpacityAnim.setValue(0);
    Animated.parallel([
      Animated.timing(eliModalSlideAnim, { toValue: 0, duration: 360, useNativeDriver: true }),
      Animated.timing(eliModalOpacityAnim, { toValue: 1, duration: 280, useNativeDriver: true }),
    ]).start();
  }, [eliModalSlideAnim, eliModalOpacityAnim]);

  const closeEliVoiceModal = useCallback(() => {
    if (eliVoiceActive) eliVoice.endSession();
    Animated.parallel([
      Animated.timing(eliModalSlideAnim, { toValue: 80, duration: 240, useNativeDriver: true }),
      Animated.timing(eliModalOpacityAnim, { toValue: 0, duration: 200, useNativeDriver: true }),
    ]).start(() => {
      setEliVoiceModalOpen(false);
    });
  }, [eliModalSlideAnim, eliModalOpacityAnim, eliVoiceActive, eliVoice]);

  const handleItemPress = (id: string) => {
    if (activeTab === 'mail') {
      const thread = mailThreads.find(t => t.id === id) || (labelResults ?? []).find((t: MailThread) => t.id === id);
      if (thread) {
        setSelectedEmail(thread as MailThread);
        setMailDetail(null);
        fetchMailDetail(thread.id);
        scrollRef.current?.scrollTo({ y: 0, animated: true });
      }
      return;
    }
    setSelectedId(id);
    scrollRef.current?.scrollTo({ y: 0, animated: true });
  };

  const handleTabChange = (tab: TabType) => {
    setActiveTab(tab);
    setSelectedId(null);
    setSelectedEmail(null);
    setMailDetail(null);
    setSearchQuery('');
    setSearchResults(null);
    setLabelResults(null);
  };

  const handleFilterChange = (filter: string) => {
    setActiveFilter(prev => ({ ...prev, [activeTab]: filter }));
    setSelectedId(null);
    if (activeTab === 'mail') {
      const labelMap: Record<string, string> = { Sent: 'SENT', Drafts: 'DRAFT', Junk: 'SPAM' };
      if (labelMap[filter]) {
        fetchMailByLabel(labelMap[filter]);
      } else {
        setLabelResults(null);
      }
    }
  };

  const handleRemoveMailbox = useCallback((accountId: string, accountEmail: string) => {
    if (!accountId) return;
    Alert.alert(
      'Remove mailbox',
      `Disconnect ${accountEmail}?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Remove',
          style: 'destructive',
          onPress: async () => {
            setRemovingMailboxId(accountId);
            try {
              const res = await authenticatedFetch(`/api/mail/accounts/${encodeURIComponent(accountId)}`, { method: 'DELETE' });
              if (!res.ok) {
                Alert.alert('Error', 'Failed to remove mailbox.');
                return;
              }
              const nextAccounts = mailAccounts.filter((a: any) => a.id !== accountId);
              setMailAccounts(nextAccounts);
              const nextSelected = nextAccounts[0]?.id || null;
              setSelectedMailbox(nextSelected);
              setHasActiveMailbox(nextAccounts.length > 0);
              setShowMailboxDropdown(false);
              if (nextAccounts.length === 0) {
                setMailThreads([]);
                setMailDetail(null);
                setShowMailSetupModal(true);
              }
            } catch (e) {
              Alert.alert('Error', 'Failed to remove mailbox.');
            } finally {
              setRemovingMailboxId(null);
            }
          },
        },
      ],
    );
  }, [authenticatedFetch, mailAccounts]);

  const tabCounts = {
    office: officeItems.length,
    calls: calls.length,
    mail: mailThreads.length,
    contacts: contacts.length,
  };

  const eliTriagedCount = mailThreads.filter(i => i.tags.length > 0).length + officeItems.filter(i => i.unread).length;

  const openUnifiedModal = useCallback((tab: 'compose' | 'eli' = 'compose') => {
    if (tab === 'compose') {
      if (!compose.visible) {
        setCompose({ visible: true, to: '', cc: '', bcc: '', subject: '', body: '', mode: 'new', attachments: [] });
      } else {
        setCompose(prev => ({ ...prev, visible: true }));
      }
      setEliOpen(false);
    } else {
      setEliOpen(true);
      setCompose(prev => ({ ...prev, visible: false }));
    }
    setUnifiedModalTab(tab);
  }, [compose.visible]);

  const closeUnifiedModal = useCallback(() => {
    if (eliVoiceActive) eliVoice.endSession();
    setCompose(prev => ({ ...prev, visible: false }));
    setEliOpen(false);
  }, [eliVoiceActive, eliVoice]);

  const isUnifiedModalOpen = compose.visible || eliOpen;

  const renderListItems = () => {
    if (loading || labelLoading) {
      return Array.from({ length: 5 }).map((_, i) => (
        <Animated.View key={i} style={styles.skeletonCard}>
          <View style={styles.skeletonRow}>
            <View style={styles.skeletonCircle} />
            <View style={{ flex: 1, marginLeft: 12 }}>
              <View style={styles.skeletonTitle} />
              <View style={styles.skeletonSubtitle} />
            </View>
          </View>
        </Animated.View>
      ));
    }

    if (filteredItems.length === 0) {
      return <EmptyState filter={currentFilter} searchQuery={searchResults !== null ? searchQuery : undefined} />;
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

  if (selectedEmail) {
    const emailPage = (
      <Animated.View style={[styles.emailFullPage, { opacity: emailPageFadeAnim }]}>
        {/* ── Slim top nav ── */}
        <View style={styles.emailFullNav}>
          <TouchableOpacity style={styles.emailFullNavBack} onPress={closeEmailDetail} activeOpacity={0.7}>
            <Ionicons name="chevron-back" size={22} color="rgba(255,255,255,0.55)" />
            <Text style={styles.emailFullNavBackText}>Inbox</Text>
          </TouchableOpacity>
          <Text style={styles.emailFullNavTime}>{formatRelativeTime(selectedEmail.timestamp)}</Text>
        </View>

        {/* ── Scrollable reading area ── */}
        {isWeb && (
          <style dangerouslySetInnerHTML={{ __html: '.aspire-email-scroll::-webkit-scrollbar{display:none}' }} />
        )}
        <ScrollView
          style={styles.emailFullBody}
          contentContainerStyle={styles.emailFullBodyContent}
          showsVerticalScrollIndicator={false}
          showsHorizontalScrollIndicator={false}
          {...(isWeb ? { className: 'aspire-email-scroll' } : {})}
        >
          {/* Sender block */}
          <View style={styles.emailFullSenderBlock}>
            <LinearGradient
              colors={[Colors.accent.cyan, '#1D6FA4']}
              style={styles.emailFullAvatar}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
            >
              <Text style={styles.emailFullAvatarText}>{selectedEmail.senderName.charAt(0).toUpperCase()}</Text>
            </LinearGradient>
            <View style={styles.emailFullSenderMeta}>
              <Text style={styles.emailFullSenderName} numberOfLines={1}>{selectedEmail.senderName}</Text>
              <Text style={styles.emailFullSenderEmail} numberOfLines={1}>{selectedEmail.senderEmail}</Text>
            </View>
          </View>

          {/* Subject + unread badge */}
          <View style={styles.emailFullSubjectWrap}>
            <Text style={styles.emailFullSubject}>{selectedEmail.subject}</Text>
            {selectedEmail.unread && (
              <View style={styles.emailModalUnreadBadge}>
                <Text style={styles.emailModalUnreadBadgeText}>Unread</Text>
              </View>
            )}
          </View>

          {/* Divider */}
          <View style={styles.emailFullDivider} />

          {/* Email body — show preview instantly, replace with full content once loaded */}
          {mailDetail?.messages?.length ? (
            mailDetail.messages.map((msg, idx) => (
              <View key={msg.id || idx}>
                {idx > 0 && (
                  <View style={styles.emailModalThreadSep}>
                    <View style={styles.emailModalThreadSepLine} />
                    <Text style={styles.emailModalThreadSepText}>Earlier message</Text>
                    <View style={styles.emailModalThreadSepLine} />
                  </View>
                )}
                {containsHtmlTags(msg.content) ? (
                  <EmailHtmlRenderer htmlContent={msg.content} />
                ) : (
                  <Text style={styles.emailFullBodyText}>{formatEmailContent(msg.content) || 'No readable content.'}</Text>
                )}
                {msg.attachments?.length > 0 && (
                  <View style={{ marginTop: 20 }}>
                    <Text style={styles.emailModalAttachLabel}>Attachments ({msg.attachments.length})</Text>
                    {msg.attachments.map((att) => {
                      const fi = getFileTypeIcon(att.type);
                      return (
                        <TouchableOpacity
                          key={att.id}
                          style={styles.emailModalAttachItem}
                          activeOpacity={0.7}
                          onPress={() => { if (isWeb) window.open(`/api/mail/attachments/${msg.id}/${att.id}?name=${encodeURIComponent(att.name)}&type=${encodeURIComponent(att.type)}`, '_blank'); }}
                        >
                          <Ionicons name={fi.icon} size={16} color={fi.color} />
                          <Text style={styles.emailModalAttachName} numberOfLines={1}>{att.name}</Text>
                          <Ionicons name="download-outline" size={14} color={Colors.text.muted} />
                        </TouchableOpacity>
                      );
                    })}
                  </View>
                )}
              </View>
            ))
          ) : containsHtmlTags(selectedEmail.preview) ? (
            <EmailHtmlRenderer htmlContent={selectedEmail.preview} />
          ) : (
            <Text style={styles.emailFullBodyText}>{formatEmailContent(selectedEmail.preview) || 'No preview available.'}</Text>
          )}
        </ScrollView>

        {/* ── Reply popup backdrop ── */}
        {replyPopupOpen && (
          <TouchableWithoutFeedback onPress={toggleReplyPopup}>
            <View style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, zIndex: 10 }} />
          </TouchableWithoutFeedback>
        )}

        {/* ── Reply popup menu ── */}
        {replyPopupOpen && (
          <Animated.View
            style={[
              styles.emailReplyPopup,
              {
                opacity: replyPopupAnim,
                transform: [{ translateY: replyPopupAnim.interpolate({ inputRange: [0, 1], outputRange: [12, 0] }) }],
              },
            ]}
          >
            {/* Smart reply pills */}
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6, padding: 12 }}>
              {['Thanks, received!', "I'll review shortly", 'Forward to team'].map((r) => (
                <TouchableOpacity
                  key={r}
                  style={styles.emailReplyPopupPill}
                  activeOpacity={0.7}
                  onPress={() => { handleSmartReply(r, selectedEmail); toggleReplyPopup(); closeEmailDetail(); }}
                >
                  <Text style={styles.emailReplyPopupPillText}>{r}</Text>
                </TouchableOpacity>
              ))}
            </View>
            <View style={styles.emailReplyPopupDivider} />
            {/* Action rows */}
            {[
              { label: 'Reply', icon: 'arrow-undo-outline' as const, mode: 'reply' as const },
              { label: 'Reply All', icon: 'arrow-undo-outline' as const, mode: 'replyAll' as const },
              { label: 'Forward', icon: 'arrow-redo-outline' as const, mode: 'forward' as const },
            ].map((action, idx, arr) => (
              <View key={action.label}>
                <TouchableOpacity
                  style={styles.emailReplyPopupRow}
                  activeOpacity={0.65}
                  onPress={() => { toggleReplyPopup(); closeEmailDetail(); openCompose(action.mode, selectedEmail); }}
                >
                  <Ionicons name={action.icon} size={15} color="rgba(255,255,255,0.55)" />
                  <Text style={styles.emailReplyPopupRowText}>{action.label}</Text>
                </TouchableOpacity>
                {idx < arr.length - 1 && <View style={styles.emailReplyPopupDivider} />}
              </View>
            ))}
          </Animated.View>
        )}

        {/* ── Floating reply FAB ── */}
        <LinearGradient
          colors={['#D97706', '#B45309']}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={styles.emailReplyFab}
        >
          <TouchableOpacity
            onPress={toggleReplyPopup}
            activeOpacity={0.82}
            style={{ width: '100%', height: '100%', alignItems: 'center', justifyContent: 'center' }}
          >
            <Ionicons name={replyPopupOpen ? 'close' : 'arrow-undo-outline'} size={22} color="#fff" />
          </TouchableOpacity>
        </LinearGradient>
      </Animated.View>
    );
    return isDesktop
      ? <DesktopPageWrapper scrollable={false} fullWidth>{emailPage}</DesktopPageWrapper>
      : emailPage;
  }

  const content = (
    <View style={styles.container}>
      <ScrollView ref={scrollRef} style={{ flex: 1 }} contentContainerStyle={styles.pageScrollContent} showsVerticalScrollIndicator={false}>
        {/* ── Header Banner (UNTOUCHED) ── */}
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

        {/* ── Tab Bar (UNTOUCHED) ── */}
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

        {/* ── Smart Filter Pills + Mailbox Pill ── */}
        <View style={styles.filterBar}>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.filterScroll}>
            {activeTab === 'mail' && hasActiveMailbox && (
              <>
                <TouchableOpacity
                  style={[styles.filterPill, styles.filterPillDate, dateFilter && styles.filterPillDateActive]}
                  onPress={() => {
                    if (isWeb && dateInputRef.current) {
                      dateInputRef.current.click();
                    }
                  }}
                  activeOpacity={0.75}
                >
                  <Ionicons name="calendar-outline" size={13} color={dateFilter ? '#fff' : Colors.accent.cyan} />
                  <Text style={[styles.filterPillText, dateFilter && styles.filterPillTextActive]}>
                    {dateFilter ? dateFilter : 'Date'}
                  </Text>
                  {dateFilter && (
                    <TouchableOpacity
                      onPress={(e) => { (e as any).stopPropagation?.(); setDateFilter(null); }}
                      hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}
                    >
                      <Ionicons name="close-circle" size={13} color="rgba(255,255,255,0.7)" />
                    </TouchableOpacity>
                  )}
                </TouchableOpacity>
                {isWeb && (
                  <input
                    ref={dateInputRef as any}
                    type="date"
                    style={{ position: 'absolute', opacity: 0, pointerEvents: 'none', width: 1, height: 1, top: -100, left: -100 } as any}
                    onChange={(e: any) => setDateFilter(e.target.value || null)}
                  />
                )}
              </>
            )}
            {FILTERS[activeTab].map((f) => {
              const isActive = currentFilter === f.label;
              return (
                <TouchableOpacity
                  key={f.label}
                  style={[styles.filterPill, isActive && styles.filterPillActive]}
                  onPress={() => handleFilterChange(f.label)}
                  activeOpacity={0.7}
                >
                  <Text style={[styles.filterPillText, isActive && styles.filterPillTextActive]}>{f.label}</Text>
                </TouchableOpacity>
              );
            })}
            {activeTab === 'mail' && hasActiveMailbox && mailAccounts.length > 0 && (
              <TouchableOpacity
                style={[styles.filterPill, styles.filterPillDate]}
                onPress={() => setShowMailboxModal(true)}
                activeOpacity={0.75}
              >
                <Ionicons
                  name={selectedMailboxAccount?.provider === 'GOOGLE' ? 'logo-google' : 'shield-checkmark'}
                  size={13}
                  color={selectedMailboxAccount?.provider === 'GOOGLE' ? '#EA4335' : Colors.accent.cyan}
                />
                <Text style={[styles.filterPillText, { maxWidth: 160 }]} numberOfLines={1}>
                  {selectedMailboxAccount?.email || 'Mailbox'}
                </Text>
                <Ionicons name="chevron-down" size={11} color={Colors.text.muted} />
              </TouchableOpacity>
            )}
          </ScrollView>
        </View>

        {/* Mail Setup Modal */}
        {showMailSetupModal && activeTab === 'mail' && (
          <View style={styles.mailSetupOverlay}>
            <View style={styles.mailSetupModal}>
              <View style={styles.mailSetupIconContainer}>
                <Ionicons name="mail-outline" size={40} color={Colors.accent.cyan} />
              </View>
              <Text style={styles.mailSetupTitle}>Set Up Your Mailbox</Text>
              <Text style={styles.mailSetupDescription}>
                Connect business email so Aspire Inbox can read, draft, and send messages with receipts.
              </Text>
              <View style={styles.mailSetupFeatures}>
                <View style={styles.mailSetupFeatureRow}>
                  <Ionicons name="checkmark-circle" size={18} color={Colors.accent.cyan} />
                  <Text style={styles.mailSetupFeatureText}>Mailbox selector + unified inbox</Text>
                </View>
                <View style={styles.mailSetupFeatureRow}>
                  <Ionicons name="checkmark-circle" size={18} color={Colors.accent.cyan} />
                  <Text style={styles.mailSetupFeatureText}>Verification checks and health status</Text>
                </View>
                <View style={styles.mailSetupFeatureRow}>
                  <Ionicons name="checkmark-circle" size={18} color={Colors.accent.cyan} />
                  <Text style={styles.mailSetupFeatureText}>Eli drafting with policy-gated sending</Text>
                </View>
              </View>
              <TouchableOpacity
                style={styles.mailSetupPrimaryButton}
                onPress={() => {
                  setShowMailSetupModal(false);
                  router.push('/inbox/setup' as any);
                }}
              >
                <Text style={styles.mailSetupPrimaryButtonText}>Set Up Mailbox</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.mailSetupSecondaryButton}
                onPress={() => setShowMailSetupModal(false)}
              >
                <Text style={styles.mailSetupSecondaryButtonText}>Maybe Later</Text>
              </TouchableOpacity>
            </View>
          </View>
        )}

        {/* Mail Setup Required Empty State */}
        {activeTab === 'mail' && mailSetupChecked && !hasActiveMailbox && !showMailSetupModal ? (
          <View style={styles.mailSetupEmptyState}>
            <Ionicons name="mail-unread-outline" size={36} color={Colors.text.muted} style={{ opacity: 0.4 }} />
            <Text style={styles.mailSetupEmptyTitle}>Mailbox Not Connected</Text>
            <Text style={styles.mailSetupEmptyDesc}>Set up your business email to start receiving and managing mail in Aspire Inbox.</Text>
            <TouchableOpacity
              style={styles.mailSetupEmptyCTA}
              onPress={() => router.push('/inbox/setup' as any)}
            >
              <Ionicons name="settings-outline" size={15} color="#fff" />
              <Text style={styles.mailSetupEmptyCTAText}>Set Up Mailbox</Text>
            </TouchableOpacity>
          </View>
        ) : selectedItem && activeTab !== 'mail' ? (
          <View>
            <TouchableOpacity style={styles.backButton} onPress={() => setSelectedId(null)} activeOpacity={0.7}>
              <Ionicons name="chevron-back" size={18} color={Colors.text.tertiary} />
              <Text style={styles.backButtonText}>Back</Text>
            </TouchableOpacity>
            <View style={fp.detailContent}>
              {activeTab === 'office' && <OfficePreview item={selectedItem as OfficeItem} />}
              {activeTab === 'calls' && <CallPreview item={selectedItem as CallItem} />}
              {activeTab === 'contacts' && <ContactPreview item={selectedItem as Contact} />}
            </View>
          </View>
        ) : (
          <View style={activeTab === 'mail' ? styles.mailListContent : styles.listContent}>
            {renderListItems()}
          </View>
        )}
      </ScrollView>

      {/* ── Finn Floating Avatar + Selector ── */}
      {activeTab === 'mail' && hasActiveMailbox && !compose.visible && !eliVoiceModalOpen && (
        <View style={styles.finnFabContainer}>
          {showFinnMenu && (
            <>
              <Pressable style={StyleSheet.absoluteFill} onPress={() => setShowFinnMenu(false)} />
              <View style={styles.finnMenu}>
                <TouchableOpacity
                  style={styles.finnMenuItem}
                  activeOpacity={0.7}
                  onPress={() => { setShowFinnMenu(false); openUnifiedModal('compose'); }}
                >
                  <View style={[styles.finnMenuIcon, { backgroundColor: 'rgba(59,130,246,0.15)' }]}>
                    <Ionicons name="create-outline" size={18} color={Colors.accent.cyan} />
                  </View>
                  <Text style={styles.finnMenuText}>Compose</Text>
                </TouchableOpacity>
                <View style={styles.finnMenuDivider} />
                <TouchableOpacity
                  style={styles.finnMenuItem}
                  activeOpacity={0.7}
                  onPress={() => { setShowFinnMenu(false); openEliVoiceModal(); }}
                >
                  <View style={[styles.finnMenuIcon, { backgroundColor: 'rgba(245,158,11,0.15)' }]}>
                    <Ionicons name="sparkles" size={18} color="#F59E0B" />
                  </View>
                  <Text style={styles.finnMenuText}>Eli Chat</Text>
                </TouchableOpacity>
              </View>
            </>
          )}
          <TouchableOpacity
            style={styles.finnFab}
            activeOpacity={0.8}
            onPress={() => setShowFinnMenu(!showFinnMenu)}
          >
            <Image source={finnAvatar} style={styles.finnFabImage} />
          </TouchableOpacity>
        </View>
      )}

      {/* ── Compose Modal (Standalone) ── */}
      {compose.visible && (
        <View style={styles.unifiedOverlay}>
          <Pressable style={StyleSheet.absoluteFill} onPress={closeUnifiedModal} />
          <Animated.View style={[
            styles.unifiedModal,
            { transform: [{ scale: modalScaleAnim }], opacity: modalOpacityAnim },
          ]}>
            <View style={styles.unifiedModalHeader}>
              <View style={styles.unifiedModalTabs}>
                <View style={[styles.unifiedModalTab, styles.unifiedModalTabActive]}>
                  <Ionicons name="mail" size={16} color={Colors.accent.cyan} />
                  <Text style={[styles.unifiedModalTabText, styles.unifiedModalTabTextActive]}>
                    {compose.mode === 'reply' ? 'Reply' : compose.mode === 'replyAll' ? 'Reply All' : compose.mode === 'forward' ? 'Forward' : 'Compose'}
                  </Text>
                </View>
              </View>
              <TouchableOpacity onPress={closeUnifiedModal} activeOpacity={0.7} style={styles.unifiedModalClose}>
                <Ionicons name="close" size={20} color={Colors.text.tertiary} />
              </TouchableOpacity>
            </View>

              <View style={styles.composeContent}>
                {/* From */}
                {selectedMailboxEmail && (
                  <View style={styles.composeFieldRow}>
                    <Text style={styles.composeFieldLabel}>From</Text>
                    <Text style={styles.composeFromText}>{selectedMailboxEmail}</Text>
                  </View>
                )}
                {/* To */}
                <View style={styles.composeFieldRow}>
                  <Text style={styles.composeFieldLabel}>To</Text>
                  <TextInput
                    style={styles.composeFieldInput}
                    value={compose.to}
                    onChangeText={(t) => setCompose(c => ({ ...c, to: t }))}
                    placeholder="recipient@example.com"
                    placeholderTextColor={Colors.text.disabled}
                    autoFocus={compose.mode === 'new' || compose.mode === 'forward'}
                  />
                  {!showCcBcc && (
                    <TouchableOpacity onPress={() => setShowCcBcc(true)} activeOpacity={0.7}>
                      <Text style={styles.ccBccToggle}>Cc Bcc</Text>
                    </TouchableOpacity>
                  )}
                </View>
                {/* CC */}
                {showCcBcc && (
                  <View style={styles.composeFieldRow}>
                    <Text style={styles.composeFieldLabel}>Cc</Text>
                    <TextInput
                      style={styles.composeFieldInput}
                      value={compose.cc}
                      onChangeText={(t) => setCompose(c => ({ ...c, cc: t }))}
                      placeholder="cc@example.com"
                      placeholderTextColor={Colors.text.disabled}
                    />
                  </View>
                )}
                {/* BCC */}
                {showCcBcc && (
                  <View style={styles.composeFieldRow}>
                    <Text style={styles.composeFieldLabel}>Bcc</Text>
                    <TextInput
                      style={styles.composeFieldInput}
                      value={compose.bcc}
                      onChangeText={(t) => setCompose(c => ({ ...c, bcc: t }))}
                      placeholder="bcc@example.com"
                      placeholderTextColor={Colors.text.disabled}
                    />
                  </View>
                )}
                {/* Subject */}
                <View style={styles.composeFieldRow}>
                  <Text style={styles.composeFieldLabel}>Subject</Text>
                  <TextInput
                    style={styles.composeFieldInput}
                    value={compose.subject}
                    onChangeText={(t) => setCompose(c => ({ ...c, subject: t }))}
                    placeholder="Subject"
                    placeholderTextColor={Colors.text.disabled}
                  />
                </View>
                {/* Body */}
                <TextInput
                  style={styles.composeBody}
                  value={compose.body}
                  onChangeText={(t) => setCompose(c => ({ ...c, body: t }))}
                  placeholder="Write your email..."
                  placeholderTextColor={Colors.text.disabled}
                  multiline
                  textAlignVertical="top"
                  autoFocus={compose.mode === 'reply' || compose.mode === 'replyAll'}
                />
                {/* Attached files */}
                {compose.attachments.length > 0 && (
                  <View style={styles.composeAttachmentsList}>
                    {compose.attachments.map((f, idx) => {
                      const fi = getFileTypeIcon(f.type);
                      return (
                        <View key={idx} style={styles.composeAttachmentChip}>
                          <Ionicons name={fi.icon} size={14} color={fi.color} />
                          <Text style={styles.composeAttachmentName} numberOfLines={1}>{f.name}</Text>
                          <Text style={styles.composeAttachmentSize}>{(f.size / 1024).toFixed(0)} KB</Text>
                          <TouchableOpacity onPress={() => removeAttachment(idx)} activeOpacity={0.7}>
                            <Ionicons name="close" size={14} color={Colors.text.muted} />
                          </TouchableOpacity>
                        </View>
                      );
                    })}
                    {totalAttachmentSize > 25 * 1024 * 1024 && (
                      <Text style={styles.attachmentWarning}>Total size exceeds 25MB limit</Text>
                    )}
                  </View>
                )}
                {/* Toolbar + Send */}
                <View style={styles.composeFooter}>
                  <View style={styles.composeToolbar}>
                    <TouchableOpacity style={styles.composeToolbarBtn} activeOpacity={0.7} onPress={handleAttachFiles}>
                      <Ionicons name="attach" size={18} color={Colors.text.muted} />
                    </TouchableOpacity>
                    <TouchableOpacity style={styles.composeToolbarBtn} activeOpacity={0.7}>
                      <Ionicons name="link" size={18} color={Colors.text.muted} />
                    </TouchableOpacity>
                  </View>
                  <TouchableOpacity
                    style={[styles.composeSendBtn, (composeSending || !compose.to || !compose.subject) && { opacity: 0.4 }]}
                    activeOpacity={0.7}
                    onPress={handleSendEmail}
                    disabled={composeSending || !compose.to || !compose.subject}
                  >
                    <Text style={styles.composeSendText}>{composeSending ? 'Sending...' : 'Send'}</Text>
                    <Ionicons name="send" size={14} color="#fff" />
                  </TouchableOpacity>
                </View>
                {/* Hidden file input for web */}
                {isWeb && (
                  <input
                    ref={fileInputRef as any}
                    type="file"
                    multiple
                    style={{ display: 'none' }}
                    onChange={handleFileSelected}
                  />
                )}
              </View>

          </Animated.View>
        </View>
      )}

      {/* ── Mailbox Manager Modal (T001) ── */}
      {showMailboxModal && (
        <View style={styles.mailboxModalOverlay}>
          <Pressable style={StyleSheet.absoluteFill} onPress={() => setShowMailboxModal(false)} />
          <View style={styles.mailboxModalCard}>
            <View style={styles.mailboxModalHeader}>
              <Text style={styles.mailboxModalTitle}>Mailboxes</Text>
              <TouchableOpacity onPress={() => setShowMailboxModal(false)} activeOpacity={0.7}>
                <Ionicons name="close" size={20} color={Colors.text.tertiary} />
              </TouchableOpacity>
            </View>
            <ScrollView showsVerticalScrollIndicator={false}>
              {mailAccounts.map((acct: any) => (
                <TouchableOpacity
                  key={acct.id}
                  style={[styles.mailboxModalItem, selectedMailbox === acct.id && styles.mailboxModalItemActive]}
                  activeOpacity={0.75}
                  onPress={() => { setSelectedMailbox(acct.id); setLabelResults(null); setShowMailboxModal(false); }}
                >
                  <View style={styles.mailboxModalItemLeft}>
                    <View style={[styles.mailboxModalProviderIcon, { backgroundColor: acct.provider === 'GOOGLE' ? 'rgba(234,67,53,0.12)' : 'rgba(59,130,246,0.12)' }]}>
                      <Ionicons name={acct.provider === 'GOOGLE' ? 'logo-google' : 'shield-checkmark'} size={16} color={acct.provider === 'GOOGLE' ? '#EA4335' : '#3B82F6'} />
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.mailboxModalName}>{acct.displayName}</Text>
                      <Text style={styles.mailboxModalEmail}>{acct.email}</Text>
                    </View>
                  </View>
                  <View style={styles.mailboxModalItemRight}>
                    {selectedMailbox === acct.id && <Ionicons name="checkmark-circle" size={18} color={Colors.accent.cyan} />}
                    <TouchableOpacity
                      style={styles.mailboxModalRemoveBtn}
                      onPress={() => { setShowMailboxModal(false); handleRemoveMailbox(acct.id, acct.email); }}
                      activeOpacity={0.7}
                      hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                    >
                      <Ionicons name="trash-outline" size={15} color={Colors.semantic.error} />
                    </TouchableOpacity>
                  </View>
                </TouchableOpacity>
              ))}
            </ScrollView>
            <TouchableOpacity
              style={styles.mailboxModalAddBtn}
              activeOpacity={0.8}
              onPress={() => { setShowMailboxModal(false); router.push('/inbox/setup' as any); }}
            >
              <Ionicons name="add-circle-outline" size={16} color="#fff" />
              <Text style={styles.mailboxModalAddText}>Add Mailbox</Text>
            </TouchableOpacity>
          </View>
        </View>
      )}

      {/* ── Eli Voice Modal ── */}
      {eliVoiceModalOpen && (
        <Animated.View style={[styles.eliVoiceOverlay, { opacity: eliModalOpacityAnim }]}>
          <Animated.View style={[styles.eliVoiceModal, { transform: [{ translateY: eliModalSlideAnim }] }]}>
            {/* Close button — floats above AgentWidget */}
            <TouchableOpacity style={styles.eliVoiceClose} onPress={closeEliVoiceModal} activeOpacity={0.7}>
              <Ionicons name="close" size={20} color="rgba(255,255,255,0.5)" />
            </TouchableOpacity>
            <AgentWidget
              agentId="eli"
              suiteId={suiteId ?? ''}
              officeId={suiteId ?? ''}
              voiceStatus={eliVoiceActive ? 'listening' : 'idle'}
              onPrimaryAction={handleEliMicPress}
            />
          </Animated.View>
        </Animated.View>
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
    fontWeight: '600',
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
    backgroundColor: 'rgba(255,255,255,0.06)',
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
    borderColor: 'rgba(255,255,255,0.06)',
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
    borderColor: 'rgba(255,255,255,0.06)',
  },
  bodyText: {
    ...Typography.body,
    color: Colors.text.secondary,
    lineHeight: 26,
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
    borderColor: 'rgba(255,255,255,0.06)',
    ...(isWeb ? { transition: 'background-color 0.2s ease' } : {}),
  } as any,
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
    width: 56,
    height: 56,
    borderRadius: 28,
    borderWidth: 1,
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
    borderColor: 'rgba(255,255,255,0.06)',
    alignItems: 'center',
    gap: Spacing.xs,
  },
  metricDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
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
    borderColor: 'rgba(255,255,255,0.06)',
  },
  playBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
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
    fontSize: 22,
    fontWeight: '700',
    color: Colors.text.primary,
    lineHeight: 30,
    marginBottom: Spacing.sm,
  },
  mailSenderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: Spacing.md,
  },
  mailAvatarLg: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: Colors.accent.cyanDark,
    alignItems: 'center',
    justifyContent: 'center',
  },
  mailAvatarLgText: {
    fontSize: 18,
    fontWeight: '700',
    color: '#fff',
  },
  mailSenderName: {
    ...Typography.bodyMedium,
    color: Colors.text.primary,
    fontWeight: '500',
  },
  mailSenderEmail: {
    ...Typography.small,
    color: Colors.text.muted,
    marginTop: 1,
  },
  mailRecipientsBar: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: Spacing.sm,
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
  attachmentsSection: {
    marginTop: Spacing.md,
  },
  attachmentsLabel: {
    ...Typography.smallMedium,
    color: Colors.text.muted,
    fontWeight: '600',
    marginBottom: Spacing.sm,
  },
  attachmentsGrid: {
    gap: Spacing.sm,
  },
  attachmentCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    backgroundColor: Colors.surface.card,
    borderRadius: BorderRadius.lg,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.md,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.06)',
    ...(isWeb ? { cursor: 'pointer', transition: 'background-color 0.2s ease' } : {}),
  } as any,
  attachmentIconWrap: {
    width: 36,
    height: 36,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  attachmentImagePreview: {
    width: 36,
    height: 36,
    borderRadius: 8,
    backgroundColor: 'rgba(167,139,250,0.15)',
    alignItems: 'center',
    justifyContent: 'center',
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
  threadSeparator: {
    paddingVertical: Spacing.md,
    alignItems: 'center',
  },
  threadSeparatorLine: {
    width: '100%',
    height: 1,
    backgroundColor: 'rgba(255,255,255,0.06)',
  },
  profileAvatarLg: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: Colors.accent.cyanDark,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: Colors.accent.cyan + '30',
  },
  profileAvatarLgText: {
    fontSize: 24,
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
    borderColor: 'rgba(255,255,255,0.06)',
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
    width: 30,
    height: 30,
    borderRadius: 15,
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

  // ── Search Bar ──
  searchBar: {
    paddingHorizontal: Spacing.xl,
    paddingTop: Spacing.md,
  },
  searchInputWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.04)',
    borderRadius: BorderRadius.lg,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm + 2,
    gap: Spacing.sm,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.06)',
  } as any,
  searchInput: {
    flex: 1,
    ...Typography.caption,
    color: Colors.text.primary,
    padding: 0,
  } as any,
  capacityText: {
    ...Typography.small,
    color: Colors.text.disabled,
  },
  searchResultsLabel: {
    ...Typography.small,
    color: Colors.text.muted,
    marginTop: Spacing.xs,
    paddingLeft: Spacing.xs,
  },

  // ── Filter Pills (Redesigned) ──
  filterBar: {
    paddingVertical: Spacing.md,
  },
  filterScroll: {
    paddingHorizontal: Spacing.xl,
    gap: Spacing.sm,
    flexDirection: 'row',
  },
  filterPill: {
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.xs + 3,
    borderRadius: BorderRadius.full,
    backgroundColor: 'rgba(255,255,255,0.04)',
    ...(isWeb ? { transition: 'all 0.2s ease', cursor: 'pointer' } : {}),
  } as any,
  filterPillActive: {
    backgroundColor: Colors.accent.cyan,
  },
  filterPillText: {
    ...Typography.small,
    color: Colors.text.secondary,
    fontWeight: '500',
  },
  filterPillTextActive: {
    color: '#fff',
    fontWeight: '600',
  },

  // ── Back Button ──
  backButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: Spacing.xl,
    paddingVertical: Spacing.md,
    gap: Spacing.xs,
  },
  backButtonText: {
    ...Typography.caption,
    color: Colors.text.tertiary,
    fontWeight: '500',
  },

  // ── List & Cards (Redesigned) ──
  listContent: {
    paddingHorizontal: Spacing.lg,
    paddingTop: Spacing.xs,
    paddingBottom: 100,
  },
  card: {
    backgroundColor: Colors.surface.card,
    borderRadius: BorderRadius.lg,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.06)',
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.lg,
    marginBottom: Spacing.sm,
    ...(isWeb ? { transition: 'background-color 0.2s ease', cursor: 'pointer' } : {}),
  } as any,
  cardSelected: {
    borderLeftWidth: 3,
    borderLeftColor: Colors.accent.cyan,
    backgroundColor: Colors.background.elevated,
  },
  cardHover: {
    backgroundColor: Colors.surface.cardHover,
  },
  cardUnread: {
    backgroundColor: 'rgba(59,130,246,0.03)',
  },
  cardRow: {
    flexDirection: 'row',
    alignItems: 'center',
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
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: Colors.accent.cyan,
    marginRight: Spacing.xs,
  },
  priorityDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    marginRight: Spacing.xs,
  },
  cardTitle: {
    ...Typography.caption,
    color: Colors.text.primary,
    fontWeight: '400',
    flex: 1,
  },
  cardTitleUnread: {
    fontWeight: '600',
  },
  cardPreview: {
    ...Typography.small,
    color: Colors.text.tertiary,
    marginTop: 3,
  },
  cardMeta: {
    alignItems: 'flex-end',
    marginLeft: Spacing.sm,
    gap: 4,
  },
  cardMetaIcons: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  timeText: {
    ...Typography.small,
    color: Colors.text.muted,
  },
  attachIndicator: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  msgCount: {
    ...Typography.micro,
    color: Colors.text.muted,
    fontWeight: '600',
  },
  mailAvatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: Colors.accent.cyanDark,
    alignItems: 'center',
    justifyContent: 'center',
  },
  mailAvatarText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#fff',
  },
  mailAvatarSent: {
    backgroundColor: 'rgba(59,130,246,0.12)',
    borderWidth: 1,
    borderColor: 'rgba(59,130,246,0.2)',
  },
  cardSent: {
    borderLeftWidth: 2,
    borderLeftColor: 'rgba(59,130,246,0.4)',
  },
  sentLabel: {
    fontSize: 10,
    fontWeight: '600',
    color: Colors.accent.cyan,
    letterSpacing: 0.3,
    textTransform: 'uppercase',
  },
  contactAvatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: Colors.accent.cyanDark,
    alignItems: 'center',
    justifyContent: 'center',
  },
  contactAvatarText: {
    fontSize: 16,
    fontWeight: '600',
    color: Colors.accent.cyan,
  },

  // ── Smart Reply ──
  smartReplyRow: {
    flexDirection: 'row',
    gap: Spacing.sm,
    flexWrap: 'wrap',
  },
  smartReplyPill: {
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.xs + 3,
    borderRadius: BorderRadius.full,
    backgroundColor: Colors.background.tertiary,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.06)',
    ...(isWeb ? { transition: 'background-color 0.2s ease', cursor: 'pointer' } : {}),
  } as any,
  smartReplyText: {
    ...Typography.small,
    color: Colors.text.secondary,
    fontWeight: '500',
  },

  // ── Empty State ──
  emptyState: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 80,
    paddingHorizontal: Spacing.xl,
  },
  emptyTitle: {
    ...Typography.bodyMedium,
    color: Colors.text.secondary,
    marginTop: Spacing.lg,
  },
  emptySubtitle: {
    ...Typography.caption,
    color: Colors.text.muted,
    marginTop: Spacing.xs,
    textAlign: 'center',
    lineHeight: 20,
  },

  // ── Skeleton ──
  skeletonCard: {
    borderRadius: BorderRadius.lg,
    padding: Spacing.lg,
    marginBottom: Spacing.sm,
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
    height: 12,
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

  // ── Mailbox Selector (Refined) ──
  mailboxSelectorBar: {
    paddingHorizontal: Spacing.xl,
    paddingVertical: Spacing.sm,
    position: 'relative' as const,
    zIndex: 100,
  },
  mailboxSelector: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    justifyContent: 'space-between' as const,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm + 2,
    borderRadius: BorderRadius.lg,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.06)',
    backgroundColor: Colors.surface.card,
    ...(isWeb ? { transition: 'background-color 0.2s ease', cursor: 'pointer' } : {}),
  } as any,
  mailboxSelectorHover: {
    backgroundColor: Colors.surface.cardHover,
  },
  mailboxSelectorLeft: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    gap: Spacing.sm,
  },
  mailboxDisplayName: {
    ...Typography.smallMedium,
    color: Colors.text.primary,
    fontWeight: '500' as const,
  },
  mailboxEmail: {
    ...Typography.small,
    color: Colors.text.muted,
  },
  mailboxDropdown: {
    position: 'absolute' as const,
    top: '100%' as unknown as number,
    left: Spacing.xl,
    right: Spacing.xl,
    backgroundColor: Colors.surface.card,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
    borderRadius: BorderRadius.lg,
    ...Shadows.lg,
    zIndex: 200,
    overflow: 'hidden' as const,
  },
  mailboxDropdownItem: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,255,255,0.04)',
  },
  mailboxDropdownSelectArea: {
    flex: 1,
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    gap: Spacing.sm,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm + 2,
    ...(isWeb ? { cursor: 'pointer' } : {}),
  } as any,
  mailboxRemoveButton: {
    width: 32,
    height: 32,
    marginRight: Spacing.xs,
    borderRadius: BorderRadius.sm,
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
    ...(isWeb ? { cursor: 'pointer' } : {}),
  } as any,
  mailboxDropdownItemActive: {
    backgroundColor: 'rgba(59,130,246,0.06)',
  },
  mailboxDropdownItemHover: {
    backgroundColor: Colors.background.tertiary,
  },
  mailboxDropdownName: {
    ...Typography.smallMedium,
    color: Colors.text.primary,
    fontWeight: '500' as const,
  },
  mailboxDropdownEmail: {
    ...Typography.small,
    color: Colors.text.muted,
  },
  mailboxAddItem: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    gap: Spacing.sm,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm + 2,
    borderBottomWidth: 0,
    ...(isWeb ? { cursor: 'pointer' } : {}),
  } as any,

  // ── Mail Setup ──
  mailSetupOverlay: {
    ...(Platform.OS === 'web' ? { position: 'fixed' as any } : { position: 'absolute' as const }),
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0,0,0,0.6)',
    justifyContent: 'center' as const,
    alignItems: 'center' as const,
    zIndex: 9999,
    paddingHorizontal: Spacing.xl,
    ...(isWeb ? { backdropFilter: 'blur(12px)' } : {}),
  } as any,
  mailSetupModal: {
    width: '100%' as unknown as number,
    maxWidth: 440,
    backgroundColor: Colors.surface.card,
    borderRadius: BorderRadius.xl,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
    padding: Spacing.xl + Spacing.sm,
    alignItems: 'center' as const,
    ...(isWeb ? { boxShadow: '0 24px 64px rgba(0,0,0,0.5)' } : {}),
  } as any,
  mailSetupIconContainer: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: Colors.accent.cyan + '15',
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
    marginBottom: Spacing.lg,
  },
  mailSetupTitle: {
    ...Typography.headline,
    color: Colors.text.primary,
    fontWeight: '700' as const,
    textAlign: 'center' as const,
    marginBottom: Spacing.sm,
  },
  mailSetupDescription: {
    ...Typography.caption,
    color: Colors.text.secondary,
    textAlign: 'center' as const,
    lineHeight: 22,
    marginBottom: Spacing.lg,
  },
  mailSetupFeatures: {
    width: '100%' as unknown as number,
    gap: Spacing.md,
    marginBottom: Spacing.xl,
  },
  mailSetupFeatureRow: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    gap: Spacing.sm,
  },
  mailSetupFeatureText: {
    ...Typography.caption,
    color: Colors.text.primary,
  },
  mailSetupPrimaryButton: {
    width: '100%' as unknown as number,
    paddingVertical: Spacing.md,
    backgroundColor: Colors.accent.cyan,
    borderRadius: BorderRadius.lg,
    alignItems: 'center' as const,
    marginBottom: Spacing.sm,
  },
  mailSetupPrimaryButtonText: {
    ...Typography.bodyMedium,
    color: '#fff',
    fontWeight: '600' as const,
  },
  mailSetupSecondaryButton: {
    width: '100%' as unknown as number,
    paddingVertical: Spacing.md,
    alignItems: 'center' as const,
  },
  mailSetupSecondaryButtonText: {
    ...Typography.caption,
    color: Colors.text.muted,
  },
  mailSetupEmptyState: {
    flex: 1,
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
    paddingVertical: 80,
    paddingHorizontal: Spacing.xl,
  },
  mailSetupEmptyTitle: {
    ...Typography.bodyMedium,
    color: Colors.text.secondary,
    fontWeight: '600' as const,
    marginTop: Spacing.lg,
    marginBottom: Spacing.sm,
  },
  mailSetupEmptyDesc: {
    ...Typography.caption,
    color: Colors.text.muted,
    textAlign: 'center' as const,
    lineHeight: 22,
    maxWidth: 380,
    marginBottom: Spacing.lg,
  },
  mailSetupEmptyCTA: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    gap: Spacing.sm,
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.md,
    backgroundColor: Colors.accent.cyan,
    borderRadius: BorderRadius.lg,
  },
  mailSetupEmptyCTAText: {
    ...Typography.bodyMedium,
    color: '#fff',
    fontWeight: '600' as const,
  },

  // ── Unified FAB ──
  unifiedFab: {
    position: 'absolute',
    bottom: 28,
    right: 24,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.accent.cyan,
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: BorderRadius.full,
    gap: 8,
    zIndex: 90,
    ...Shadows.glow(Colors.accent.cyan),
    ...(isWeb ? {
      cursor: 'pointer',
      transition: 'transform 0.2s ease, box-shadow 0.2s ease',
    } : {}),
  } as any,
  unifiedFabText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '600' as const,
  },

  // ── Unified Modal (Compose + Eli) ──
  unifiedOverlay: {
    ...(isWeb ? { position: 'fixed' as any } : { position: 'absolute' as const }),
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center' as const,
    alignItems: 'center' as const,
    zIndex: 200,
    ...(isWeb ? { backdropFilter: 'blur(12px)' } : {}),
  } as any,
  unifiedModal: {
    width: '92%',
    maxWidth: 640,
    maxHeight: '85%',
    backgroundColor: Colors.surface.card,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
    overflow: 'hidden',
    ...(isWeb ? {
      boxShadow: 'inset 0 0 0 1px rgba(255,255,255,0.06), 0 24px 64px rgba(0,0,0,0.5)',
    } : {}),
  } as any,
  unifiedModalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,255,255,0.06)',
  } as any,
  unifiedModalTabs: {
    flexDirection: 'row',
    gap: Spacing.xs,
  } as any,
  unifiedModalTab: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    borderRadius: BorderRadius.md,
    ...(isWeb ? { cursor: 'pointer', transition: 'background-color 0.2s ease' } : {}),
  } as any,
  unifiedModalTabActive: {
    backgroundColor: Colors.accent.cyanLight,
  },
  unifiedModalTabActiveEli: {
    backgroundColor: 'rgba(245,158,11,0.15)',
  },
  unifiedModalTabText: {
    ...Typography.caption,
    color: Colors.text.muted,
    fontWeight: '500',
  },
  unifiedModalTabTextActive: {
    color: Colors.accent.cyan,
    fontWeight: '600',
  },
  unifiedModalTabTextActiveEli: {
    color: '#F59E0B',
    fontWeight: '600',
  },
  eliTabAvatar: {
    width: 18,
    height: 18,
    borderRadius: 9,
  },
  eliNotifBadge: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: '#F59E0B',
    marginLeft: -2,
  },
  unifiedModalClose: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    ...(isWeb ? { cursor: 'pointer', transition: 'background-color 0.2s ease' } : {}),
  } as any,

  // ── Compose Tab ──
  composeContent: {
    flex: 1,
    padding: 0,
  },
  composeFieldRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.sm + 2,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,255,255,0.04)',
  } as any,
  composeFieldLabel: {
    ...Typography.small,
    color: Colors.text.muted,
    fontWeight: '500',
    width: 56,
  },
  composeFieldInput: {
    flex: 1,
    ...Typography.caption,
    color: Colors.text.primary,
    padding: 0,
    ...(isWeb ? { outlineStyle: 'none' } : {}),
  } as any,
  composeFromText: {
    ...Typography.caption,
    color: Colors.text.tertiary,
    flex: 1,
  },
  ccBccToggle: {
    ...Typography.small,
    color: Colors.text.muted,
    fontWeight: '500',
    marginLeft: Spacing.sm,
    ...(isWeb ? { cursor: 'pointer' } : {}),
  } as any,
  composeBody: {
    flex: 1,
    minHeight: 240,
    ...Typography.body,
    color: Colors.text.primary,
    padding: Spacing.lg,
    lineHeight: 24,
    textAlignVertical: 'top',
    ...(isWeb ? { outlineStyle: 'none' } : {}),
  } as any,
  composeAttachmentsList: {
    paddingHorizontal: Spacing.lg,
    paddingBottom: Spacing.sm,
    gap: Spacing.xs,
  },
  composeAttachmentChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.xs,
    backgroundColor: Colors.background.tertiary,
    borderRadius: BorderRadius.md,
    paddingHorizontal: Spacing.sm + 2,
    paddingVertical: Spacing.xs + 2,
  } as any,
  composeAttachmentName: {
    ...Typography.small,
    color: Colors.text.primary,
    flex: 1,
  },
  composeAttachmentSize: {
    ...Typography.small,
    color: Colors.text.muted,
  },
  attachmentWarning: {
    ...Typography.small,
    color: Colors.semantic.error,
    marginTop: Spacing.xs,
  },
  composeFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.md,
    borderTopWidth: 1,
    borderTopColor: 'rgba(255,255,255,0.04)',
  } as any,
  composeToolbar: {
    flexDirection: 'row',
    gap: Spacing.xs,
  } as any,
  composeToolbarBtn: {
    width: 36,
    height: 36,
    borderRadius: BorderRadius.md,
    alignItems: 'center',
    justifyContent: 'center',
    ...(isWeb ? { cursor: 'pointer', transition: 'background-color 0.2s ease' } : {}),
  } as any,
  composeSendBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: Colors.accent.cyan,
    paddingHorizontal: Spacing.lg + 4,
    paddingVertical: Spacing.sm + 2,
    borderRadius: BorderRadius.full,
    ...(isWeb ? { cursor: 'pointer', transition: 'opacity 0.2s ease' } : {}),
  } as any,
  composeSendText: {
    color: '#fff',
    fontSize: 13,
    fontWeight: '600' as const,
  },

  // ── Eli Tab ──
  eliTabContent: {
    flex: 1,
    minHeight: 400,
  },

  // ── Finn Floating Avatar ──
  finnFabContainer: {
    position: 'absolute',
    bottom: 28,
    right: 24,
    alignItems: 'flex-end',
    zIndex: 90,
  } as any,
  finnFab: {
    width: 56,
    height: 56,
    borderRadius: 28,
    overflow: 'hidden' as const,
    borderWidth: 2,
    borderColor: 'rgba(59,130,246,0.4)',
    ...Shadows.glow(Colors.accent.cyan),
    ...(isWeb ? {
      cursor: 'pointer',
      transition: 'transform 0.2s ease, box-shadow 0.2s ease',
    } : {}),
  } as any,
  finnFabImage: {
    width: 52,
    height: 52,
    borderRadius: 26,
  },
  finnMenu: {
    position: 'absolute' as const,
    bottom: 68,
    right: 0,
    backgroundColor: Colors.surface.card,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
    overflow: 'hidden' as const,
    width: 180,
    zIndex: 200,
    ...Shadows.lg,
    ...(isWeb ? { backdropFilter: 'blur(16px)', boxShadow: '0 16px 48px rgba(0,0,0,0.5)' } : {}),
  } as any,
  finnMenuItem: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    gap: 12,
    paddingHorizontal: 16,
    paddingVertical: 14,
    ...(isWeb ? { cursor: 'pointer', transition: 'background-color 0.2s ease' } : {}),
  } as any,
  finnMenuIcon: {
    width: 36,
    height: 36,
    borderRadius: 10,
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
  },
  finnMenuText: {
    ...Typography.caption,
    color: Colors.text.primary,
    fontWeight: '500' as const,
  },
  finnMenuDivider: {
    height: 1,
    backgroundColor: 'rgba(255,255,255,0.06)',
    marginHorizontal: 12,
  },

  // ── Mail List (iOS style, T005) ──
  mailListContent: {
    paddingTop: Spacing.xs,
    paddingBottom: 100,
  },
  mailRow: {
    position: 'relative' as const,
    backgroundColor: 'transparent',
    ...(isWeb ? { cursor: 'pointer', transition: 'background-color 0.15s ease' } : {}),
  } as any,
  mailRowInner: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    paddingHorizontal: 20,
    paddingVertical: 14,
    paddingLeft: 24,
  },
  mailRowSeparator: {
    height: 1,
    backgroundColor: 'rgba(255,255,255,0.045)',
    marginLeft: 72,
  },
  mailRowHover: {
    backgroundColor: 'rgba(255,255,255,0.025)',
  },
  mailRowUnread: {
    backgroundColor: 'rgba(56,189,248,0.03)',
  },
  mailRowSelected: {
    borderLeftWidth: 3,
    borderLeftColor: Colors.accent.cyan,
    backgroundColor: 'rgba(56,189,248,0.06)',
    paddingLeft: 21,
  },
  mailUnreadAccent: {
    position: 'absolute' as const,
    left: 8,
    top: '50%' as unknown as number,
    marginTop: -3,
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: Colors.accent.cyan,
  },
  mailAvatarNew: {
    width: 42,
    height: 42,
    borderRadius: 21,
    overflow: 'hidden' as const,
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
    backgroundColor: 'rgba(59,130,246,0.12)',
    borderWidth: 1,
    borderColor: 'rgba(59,130,246,0.2)',
  },
  mailAvatarGradient: {
    width: 42,
    height: 42,
    borderRadius: 21,
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
  },
  mailRowLine1: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    marginBottom: 3,
  },
  mailSenderLabel: {
    flex: 1,
    fontSize: 14,
    fontWeight: '400' as const,
    color: Colors.text.muted,
    letterSpacing: -0.1,
  },
  mailSenderLabelUnread: {
    fontWeight: '600' as const,
    color: Colors.text.primary,
  },
  mailRowMeta: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    gap: 4,
    marginLeft: 8,
  },
  mailTimeLabel: {
    fontSize: 11,
    color: Colors.text.disabled,
    letterSpacing: -0.1,
  },
  mailTimeLabelUnread: {
    color: Colors.accent.cyan,
    fontWeight: '500' as const,
  },
  mailThreadCount: {
    fontSize: 10,
    color: Colors.text.disabled,
    fontWeight: '500' as const,
    backgroundColor: Colors.background.tertiary,
    paddingHorizontal: 4,
    paddingVertical: 1,
    borderRadius: 4,
  },
  mailSubjectLabel: {
    fontSize: 13,
    fontWeight: '400' as const,
    color: Colors.text.tertiary,
    marginBottom: 2,
    letterSpacing: -0.1,
  },
  mailSubjectLabelUnread: {
    fontWeight: '600' as const,
    color: Colors.text.primary,
  },
  mailPreviewLabel: {
    fontSize: 12,
    color: '#6B7280',
    lineHeight: 17,
  },

  // ── Mailbox Pill (T001) ──
  mailboxPillBar: {
    paddingHorizontal: Spacing.xl,
    paddingTop: Spacing.sm,
    paddingBottom: 2,
  },
  mailboxPill: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    alignSelf: 'flex-start' as const,
    gap: 6,
    backgroundColor: 'rgba(255,255,255,0.05)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
    borderRadius: BorderRadius.full,
    paddingHorizontal: 12,
    paddingVertical: 6,
    maxWidth: 260,
    ...(isWeb ? { cursor: 'pointer', transition: 'background-color 0.2s ease' } : {}),
  } as any,
  mailboxPillText: {
    ...Typography.small,
    color: Colors.text.secondary,
    fontWeight: '500' as const,
    flex: 1,
  },

  // ── Filter pill date variant (T002) ──
  filterPillDate: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    gap: 5,
    borderWidth: 1,
    borderColor: Colors.accent.cyan + '40',
  },
  filterPillDateActive: {
    backgroundColor: Colors.accent.cyan,
    borderColor: Colors.accent.cyan,
  },

  // ── Full-screen email reader ──
  emailFullPage: {
    flex: 1,
    backgroundColor: '#0a0a0c',
  },
  emailFullNav: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    justifyContent: 'space-between' as const,
    height: 56,
    paddingHorizontal: 20,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,255,255,0.05)',
    backgroundColor: '#0a0a0c',
    ...(isWeb ? { boxShadow: '0 1px 0 rgba(255,255,255,0.04)' } : {}),
  } as any,
  emailFullNavBack: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    gap: 2,
    paddingVertical: 8,
    paddingRight: 16,
  },
  emailFullNavBackText: {
    fontSize: 16,
    color: 'rgba(255,255,255,0.55)',
    fontWeight: '400' as const,
  },
  emailFullNavTime: {
    fontSize: 12,
    color: 'rgba(255,255,255,0.28)',
    letterSpacing: 0.2,
  },
  emailFullBody: {
    flex: 1,
    ...(isWeb ? { scrollbarWidth: 'none', msOverflowStyle: 'none' } : {}),
  } as any,
  emailFullBodyContent: {
    paddingHorizontal: isWideScreen ? 56 : 22,
    paddingTop: 32,
    paddingBottom: 100,
    ...(isWideScreen ? { maxWidth: 720, alignSelf: 'center' as const, width: '100%' } : {}),
  } as any,
  emailFullSenderBlock: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    gap: 14,
    marginBottom: 24,
  },
  emailFullAvatar: {
    width: 52,
    height: 52,
    borderRadius: 26,
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
  },
  emailFullAvatarText: {
    fontSize: 20,
    fontWeight: '700' as const,
    color: '#fff',
  },
  emailFullSenderMeta: {
    flex: 1,
  },
  emailFullSenderName: {
    fontSize: 16,
    fontWeight: '600' as const,
    color: Colors.text.primary,
    letterSpacing: -0.1,
  },
  emailFullSenderEmail: {
    fontSize: 13,
    color: Colors.text.muted,
    marginTop: 3,
  },
  emailFullSubjectWrap: {
    marginBottom: 20,
    gap: 10,
  },
  emailFullSubject: {
    fontSize: isWideScreen ? 26 : 22,
    fontWeight: '700' as const,
    color: Colors.text.primary,
    letterSpacing: -0.4,
    lineHeight: isWideScreen ? 34 : 30,
  },
  emailFullDivider: {
    height: 1,
    backgroundColor: 'rgba(255,255,255,0.05)',
    marginBottom: 24,
  },
  emailFullBodyText: {
    fontSize: 15,
    color: Colors.text.secondary,
    lineHeight: 26,
    fontFamily: '-apple-system',
  },
  emailReplyFab: {
    position: 'absolute' as const,
    bottom: 28,
    right: isWideScreen ? 32 : 20,
    width: 52,
    height: 52,
    borderRadius: 26,
    zIndex: 20,
    ...(isWeb ? { boxShadow: '0 4px 20px rgba(217,119,6,0.45)' } : { elevation: 8 }),
    overflow: 'hidden' as const,
  } as any,
  emailReplyPopup: {
    position: 'absolute' as const,
    bottom: 92,
    right: isWideScreen ? 32 : 20,
    width: 210,
    backgroundColor: 'rgba(16,16,18,0.97)',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
    zIndex: 20,
    overflow: 'hidden' as const,
    ...(isWeb ? { backdropFilter: 'blur(24px)', boxShadow: '0 8px 32px rgba(0,0,0,0.6)' } : { elevation: 12 }),
  } as any,
  emailReplyPopupPill: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 20,
    backgroundColor: 'rgba(255,255,255,0.07)',
  },
  emailReplyPopupPillText: {
    fontSize: 12,
    color: 'rgba(255,255,255,0.75)',
    fontWeight: '500' as const,
  },
  emailReplyPopupDivider: {
    height: 0.5,
    backgroundColor: 'rgba(255,255,255,0.06)',
  },
  emailReplyPopupRow: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    gap: 10,
    paddingHorizontal: 16,
    paddingVertical: 13,
  },
  emailReplyPopupRowText: {
    fontSize: 14,
    color: 'rgba(255,255,255,0.85)',
    fontWeight: '400' as const,
  },
  emailModalOverlay: {
    ...(isWeb ? { position: 'fixed' as any } : { position: 'absolute' as const }),
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: isWideScreen ? 'rgba(0,0,0,0.78)' : 'rgba(0,0,0,0.82)',
    zIndex: 9999,
    justifyContent: isWideScreen ? ('center' as const) : ('flex-end' as const),
    alignItems: isWideScreen ? ('center' as const) : ('stretch' as const),
    ...(isWideScreen ? { backdropFilter: 'blur(10px)' } : {}),
  } as any,
  emailModalCard: {
    backgroundColor: '#0D0D0F',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    ...(isWideScreen ? { borderBottomLeftRadius: 20, borderBottomRightRadius: 20 } : {}),
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.07)',
    height: isWideScreen ? ('88%' as any) : ('95%' as any),
    ...(isTablet ? { width: '90%' as any, maxWidth: 720 } : {}),
    ...(isDesktop ? { width: '82%' as any, maxWidth: 1000 } : {}),
    flexDirection: 'column' as const,
    ...(isWideScreen ? { boxShadow: '0 32px 80px rgba(0,0,0,0.7)' } : { boxShadow: '0 -24px 64px rgba(0,0,0,0.6)' }),
  } as any,
  emailModalHeader: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    paddingHorizontal: isWideScreen ? 28 : 20,
    paddingTop: 20,
    paddingBottom: 14,
  },
  emailModalAvatar: {
    width: 46,
    height: 46,
    borderRadius: 23,
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
  },
  emailModalAvatarText: {
    fontSize: 18,
    fontWeight: '700' as const,
    color: '#fff',
  },
  emailModalSenderName: {
    fontSize: 15,
    fontWeight: '600' as const,
    color: Colors.text.primary,
  },
  emailModalSenderEmail: {
    fontSize: 12,
    color: Colors.text.muted,
    marginTop: 1,
  },
  emailModalTime: {
    fontSize: 11,
    color: Colors.text.disabled,
    marginRight: 8,
  },
  emailModalClose: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: 'rgba(255,255,255,0.06)',
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
  },
  emailModalSubjectWrap: {
    paddingHorizontal: isWideScreen ? 28 : 20,
    paddingBottom: 16,
    flexDirection: 'row' as const,
    alignItems: 'flex-start' as const,
    gap: 10,
  },
  emailModalSubject: {
    flex: 1,
    fontSize: isDesktop ? 22 : 20,
    fontWeight: '700' as const,
    color: Colors.text.primary,
    lineHeight: isDesktop ? 30 : 27,
    letterSpacing: -0.3,
  },
  emailModalUnreadBadge: {
    backgroundColor: Colors.accent.cyan + '18',
    borderRadius: BorderRadius.full,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderWidth: 1,
    borderColor: Colors.accent.cyan + '30',
    marginTop: 4,
  },
  emailModalUnreadBadgeText: {
    fontSize: 11,
    fontWeight: '600' as const,
    color: Colors.accent.cyan,
  },
  emailModalDivider: {
    height: 1,
    backgroundColor: 'rgba(255,255,255,0.06)',
    marginHorizontal: 0,
  },
  emailModalBody: {
    flex: 1,
    paddingHorizontal: isWideScreen ? 28 : 20,
    paddingTop: 16,
  },
  emailModalBodyText: {
    fontSize: 14,
    color: Colors.text.secondary,
    lineHeight: 24,
    fontFamily: '-apple-system',
  },
  emailModalThreadSep: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    gap: 10,
    marginVertical: 20,
  },
  emailModalThreadSepLine: {
    flex: 1,
    height: 1,
    backgroundColor: 'rgba(255,255,255,0.06)',
  },
  emailModalThreadSepText: {
    fontSize: 11,
    color: Colors.text.disabled,
    fontWeight: '500' as const,
  },
  emailModalAttachLabel: {
    fontSize: 12,
    color: Colors.text.muted,
    fontWeight: '600' as const,
    marginBottom: 8,
    letterSpacing: 0.3,
    textTransform: 'uppercase' as const,
  },
  emailModalAttachItem: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    gap: 10,
    backgroundColor: 'rgba(255,255,255,0.04)',
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 10,
    marginBottom: 6,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.06)',
    ...(isWeb ? { cursor: 'pointer' } : {}),
  } as any,
  emailModalAttachName: {
    flex: 1,
    fontSize: 13,
    color: Colors.text.primary,
    fontWeight: '500' as const,
  },
  emailModalFooter: {
    position: 'absolute' as const,
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: '#0D0D0F',
    borderTopWidth: 1,
    borderTopColor: 'rgba(255,255,255,0.06)',
    paddingTop: 12,
    paddingBottom: 28,
    paddingHorizontal: isWideScreen ? 28 : 16,
  },
  emailModalSmartReplies: {
    flexDirection: 'row' as const,
    gap: 8,
    marginBottom: 12,
    flexWrap: 'wrap' as const,
  },
  emailModalSmartPill: {
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: BorderRadius.full,
    backgroundColor: 'rgba(255,255,255,0.06)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
  },
  emailModalSmartPillText: {
    fontSize: 12,
    color: Colors.text.secondary,
    fontWeight: '500' as const,
  },
  emailModalActions: {
    flexDirection: 'row' as const,
    gap: 8,
  },
  emailModalActionBtn: {
    flex: 1,
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
    gap: 6,
    paddingVertical: 11,
    borderRadius: BorderRadius.lg,
    backgroundColor: 'rgba(255,255,255,0.05)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
  },
  emailModalActionBtnPrimary: {
    backgroundColor: Colors.accent.cyan,
    borderColor: Colors.accent.cyan,
    flex: 1.3,
  },
  emailModalActionBtnText: {
    fontSize: 13,
    color: Colors.text.secondary,
    fontWeight: '500' as const,
  },
  emailModalActionBtnTextPrimary: {
    fontSize: 13,
    color: '#fff',
    fontWeight: '600' as const,
  },

  // ── Mailbox Manager Modal (T001) ──
  mailboxModalOverlay: {
    ...(isWeb ? { position: 'fixed' as any } : { position: 'absolute' as const }),
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0,0,0,0.7)',
    zIndex: 9998,
    justifyContent: 'center' as const,
    alignItems: 'center' as const,
    paddingHorizontal: 20,
    ...(isWeb ? { backdropFilter: 'blur(10px)' } : {}),
  } as any,
  mailboxModalCard: {
    width: '100%' as unknown as number,
    maxWidth: 420,
    backgroundColor: '#111113',
    borderRadius: 20,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
    overflow: 'hidden' as const,
    maxHeight: '70%' as unknown as number,
    ...(isWeb ? { boxShadow: '0 24px 64px rgba(0,0,0,0.6)' } : {}),
  } as any,
  mailboxModalHeader: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    justifyContent: 'space-between' as const,
    paddingHorizontal: 20,
    paddingVertical: 18,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,255,255,0.06)',
  },
  mailboxModalTitle: {
    fontSize: 16,
    fontWeight: '700' as const,
    color: Colors.text.primary,
  },
  mailboxModalItem: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    justifyContent: 'space-between' as const,
    paddingHorizontal: 20,
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,255,255,0.04)',
    ...(isWeb ? { cursor: 'pointer', transition: 'background-color 0.15s ease' } : {}),
  } as any,
  mailboxModalItemActive: {
    backgroundColor: 'rgba(56,189,248,0.05)',
  },
  mailboxModalItemLeft: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    gap: 12,
    flex: 1,
  },
  mailboxModalProviderIcon: {
    width: 36,
    height: 36,
    borderRadius: 10,
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
  },
  mailboxModalName: {
    fontSize: 14,
    fontWeight: '600' as const,
    color: Colors.text.primary,
  },
  mailboxModalEmail: {
    fontSize: 12,
    color: Colors.text.muted,
    marginTop: 1,
  },
  mailboxModalItemRight: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    gap: 12,
  },
  mailboxModalRemoveBtn: {
    width: 28,
    height: 28,
    borderRadius: 8,
    backgroundColor: 'rgba(239,68,68,0.1)',
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
  },
  mailboxModalAddBtn: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
    gap: 8,
    margin: 16,
    paddingVertical: 13,
    backgroundColor: Colors.accent.cyan,
    borderRadius: BorderRadius.lg,
  },
  mailboxModalAddText: {
    fontSize: 14,
    fontWeight: '600' as const,
    color: '#fff',
  },

  // ── Eli Voice Modal (T006) ──
  eliVoiceOverlay: {
    ...(isWeb ? { position: 'fixed' as any } : { position: 'absolute' as const }),
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0,0,0,0.80)',
    zIndex: 9997,
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
    ...(isWeb ? { backdropFilter: 'blur(8px)' } : {}),
  } as any,
  eliVoiceModal: {
    backgroundColor: '#000',
    borderRadius: 28,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
    width: isWeb ? 440 : '92%' as any,
    height: isWeb ? 560 : 520,
    overflow: 'hidden' as const,
    position: 'relative' as const,
    ...(isWeb ? { boxShadow: '0 32px 80px rgba(0,0,0,0.9)' } : {}),
  } as any,
  eliVoiceClose: {
    position: 'absolute' as const,
    top: 20,
    right: 20,
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: 'rgba(255,255,255,0.08)',
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
    zIndex: 10,
  },
  eliVoiceTitle: {
    fontSize: 36,
    fontWeight: '300' as const,
    color: '#fff',
    letterSpacing: 2,
    marginBottom: 4,
  },
  eliVoiceSubtitle: {
    fontSize: 13,
    color: 'rgba(255,255,255,0.4)',
    marginBottom: 28,
    letterSpacing: 0.5,
  },
  eliOrbContainer: {
    marginBottom: 36,
  },
  eliOrbVideoWrap: {
    width: 200,
    height: 200,
    borderRadius: 100,
    overflow: 'hidden' as const,
    position: 'relative' as const,
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
  },
  eliOrbGlowRing: {
    position: 'absolute' as const,
    top: -8,
    left: -8,
    right: -8,
    bottom: -8,
    borderRadius: 139,
    borderWidth: 2,
    borderColor: '#F59E0B',
    ...(isWeb ? { boxShadow: '0 0 40px rgba(245,158,11,0.4)' } : {}),
  } as any,
  eliOrbFallback: {
    width: 220,
    height: 220,
    borderRadius: 110,
    backgroundColor: 'rgba(245,158,11,0.1)',
    borderWidth: 2,
    borderColor: 'rgba(245,158,11,0.3)',
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
  },
  eliOrbFallbackActive: {
    borderColor: '#F59E0B',
    backgroundColor: 'rgba(245,158,11,0.2)',
  },
  eliVoiceTranscript: {
    fontSize: 14,
    color: 'rgba(255,255,255,0.6)',
    textAlign: 'center' as const,
    lineHeight: 22,
    marginBottom: 24,
    paddingHorizontal: 20,
  },
  eliVoiceButtons: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
    gap: 12,
  },
  eliVoiceSessionBtn: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
    gap: 8,
    paddingHorizontal: 22,
    paddingVertical: 13,
    borderRadius: BorderRadius.full,
    backgroundColor: '#F59E0B',
  },
  eliVoiceSessionBtnActive: {
    backgroundColor: '#EF4444',
  },
  eliVoiceSessionBtnText: {
    fontSize: 15,
    fontWeight: '600' as const,
    color: '#000',
  },
  eliVoiceChatBtn: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
    gap: 8,
    paddingHorizontal: 22,
    paddingVertical: 12,
    borderRadius: BorderRadius.full,
    borderWidth: 1.5,
    borderColor: '#F59E0B',
    backgroundColor: 'transparent',
  },
  eliVoiceChatBtnText: {
    fontSize: 15,
    fontWeight: '500' as const,
    color: '#F59E0B',
  },
  eliChatSubHeader: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    justifyContent: 'space-between' as const,
    width: '100%' as unknown as number,
    paddingHorizontal: 16,
    paddingTop: 20,
    paddingBottom: 8,
    position: 'absolute' as const,
    top: 0,
    left: 0,
    right: 0,
    zIndex: 10,
    backgroundColor: 'rgba(0,0,0,0.8)',
  },
  eliChatBackBtn: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    gap: 4,
  },
  eliChatBackText: {
    fontSize: 15,
    color: 'rgba(255,255,255,0.6)',
    fontWeight: '500' as const,
  },
});
