/**
 * Attachments -- Unified file attachment display for chat messages.
 *
 * Three display variants: grid (thumbnails), inline (badges), list (rows).
 * Integrates with the existing FileAttachment type from types.ts.
 *
 * Features:
 *   - File type icons (PDF, image, spreadsheet, document, generic)
 *   - Thumbnail preview for image attachments
 *   - File size formatting
 *   - Download/open action
 *   - Agent-colored accent borders
 *   - Responsive layout (grid collapses to list on narrow widths)
 *   - Accessible with ARIA labels
 */

import React, { useCallback, useMemo, createContext, useContext } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Pressable,
  Image,
  Platform,
  Linking,
  type ViewStyle,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Colors, Spacing, BorderRadius, Typography } from '@/constants/tokens';
import type { AgentId, FileAttachment } from './types';
import { AGENT_COLORS } from './types';

// ---------------------------------------------------------------------------
// Context
// ---------------------------------------------------------------------------

type AttachmentVariant = 'grid' | 'inline' | 'list';

interface AttachmentsContextValue {
  variant: AttachmentVariant;
  agentColor: string;
}

const AttachmentsContext = createContext<AttachmentsContextValue>({
  variant: 'grid',
  agentColor: Colors.accent.cyan,
});

// ---------------------------------------------------------------------------
// Utility Functions
// ---------------------------------------------------------------------------

/** Map file kind to appropriate Ionicons icon name. */
function getFileIcon(kind: string): keyof typeof Ionicons.glyphMap {
  const upper = kind.toUpperCase();
  if (upper === 'PDF') return 'document-text';
  if (upper === 'PNG' || upper === 'JPG' || upper === 'JPEG' || upper === 'GIF' || upper === 'WEBP' || upper === 'SVG') return 'image';
  if (upper === 'XLSX' || upper === 'XLS' || upper === 'CSV') return 'grid';
  if (upper === 'DOCX' || upper === 'DOC' || upper === 'TXT' || upper === 'RTF') return 'document';
  if (upper === 'MP4' || upper === 'MOV' || upper === 'AVI' || upper === 'WEBM') return 'videocam';
  if (upper === 'MP3' || upper === 'WAV' || upper === 'OGG' || upper === 'M4A') return 'musical-notes';
  if (upper === 'ZIP' || upper === 'RAR' || upper === '7Z' || upper === 'TAR') return 'archive';
  return 'document';
}

/** Check if file kind is an image type. */
function isImageKind(kind: string): boolean {
  const upper = kind.toUpperCase();
  return ['PNG', 'JPG', 'JPEG', 'GIF', 'WEBP', 'SVG'].includes(upper);
}

/** Format bytes to human-readable string. */
export function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

/** Get display label for an attachment. */
export function getAttachmentLabel(attachment: FileAttachment): string {
  return attachment.name || attachment.kind || 'Attachment';
}

/** Get media category from file kind. */
export function getMediaCategory(
  kind: string,
): 'image' | 'video' | 'audio' | 'document' | 'archive' | 'unknown' {
  const upper = kind.toUpperCase();
  if (['PNG', 'JPG', 'JPEG', 'GIF', 'WEBP', 'SVG'].includes(upper)) return 'image';
  if (['MP4', 'MOV', 'AVI', 'WEBM'].includes(upper)) return 'video';
  if (['MP3', 'WAV', 'OGG', 'M4A'].includes(upper)) return 'audio';
  if (['ZIP', 'RAR', '7Z', 'TAR'].includes(upper)) return 'archive';
  return 'document';
}

// ---------------------------------------------------------------------------
// Root: <Attachments />
// ---------------------------------------------------------------------------

interface AttachmentsProps {
  /** Display layout variant. */
  variant?: AttachmentVariant;
  /** Agent identity for accent theming. */
  agent?: AgentId;
  /** Additional container style. */
  style?: ViewStyle;
  children?: React.ReactNode;
}

export const Attachments = React.memo(function Attachments({
  variant = 'grid',
  agent,
  style,
  children,
}: AttachmentsProps) {
  const agentColor = agent ? AGENT_COLORS[agent] : Colors.accent.cyan;

  const contextValue = useMemo(
    () => ({ variant, agentColor }),
    [variant, agentColor],
  );

  const containerStyle = useMemo(() => {
    switch (variant) {
      case 'grid':
        return s.containerGrid;
      case 'inline':
        return s.containerInline;
      case 'list':
        return s.containerList;
      default:
        return s.containerGrid;
    }
  }, [variant]);

  return (
    <AttachmentsContext.Provider value={contextValue}>
      <View
        style={[containerStyle, style]}
        accessibilityRole="none"
        accessibilityLabel="File attachments"
      >
        {children}
      </View>
    </AttachmentsContext.Provider>
  );
});

// ---------------------------------------------------------------------------
// <Attachment /> -- Individual attachment item
// ---------------------------------------------------------------------------

interface AttachmentProps {
  /** The file attachment data. */
  data: FileAttachment;
  /** Callback when remove is pressed. */
  onRemove?: () => void;
  /** Callback when the attachment is pressed (open/download). */
  onPress?: () => void;
  /** Additional style. */
  style?: ViewStyle;
  /** Optional children for composable overrides. */
  children?: React.ReactNode;
}

export const Attachment = React.memo(function Attachment({
  data,
  onRemove,
  onPress,
  style,
  children,
}: AttachmentProps) {
  const { variant, agentColor } = useContext(AttachmentsContext);
  const iconName = getFileIcon(data.kind);
  const isImage = isImageKind(data.kind);

  const handlePress = useCallback(() => {
    if (onPress) {
      onPress();
    } else if (data.url) {
      Linking.openURL(data.url);
    }
  }, [onPress, data.url]);

  // If children are provided, render composable mode
  if (children) {
    return (
      <Pressable
        onPress={handlePress}
        style={[getItemStyle(variant), style]}
        accessibilityRole="button"
        accessibilityLabel={`Open ${data.name}`}
      >
        {children}
      </Pressable>
    );
  }

  // Default rendering per variant
  switch (variant) {
    case 'grid':
      return (
        <AttachmentGridItem
          data={data}
          agentColor={agentColor}
          iconName={iconName}
          isImage={isImage}
          onPress={handlePress}
          onRemove={onRemove}
          style={style}
        />
      );
    case 'inline':
      return (
        <AttachmentInlineItem
          data={data}
          agentColor={agentColor}
          iconName={iconName}
          onPress={handlePress}
          onRemove={onRemove}
          style={style}
        />
      );
    case 'list':
      return (
        <AttachmentListItem
          data={data}
          agentColor={agentColor}
          iconName={iconName}
          isImage={isImage}
          onPress={handlePress}
          onRemove={onRemove}
          style={style}
        />
      );
    default:
      return null;
  }
});

// ---------------------------------------------------------------------------
// <AttachmentPreview />
// ---------------------------------------------------------------------------

interface AttachmentPreviewProps {
  /** The file data (inherited from parent Attachment). */
  data: FileAttachment;
  /** Fallback icon. */
  fallbackIcon?: keyof typeof Ionicons.glyphMap;
  style?: ViewStyle;
}

export const AttachmentPreview = React.memo(function AttachmentPreview({
  data,
  fallbackIcon,
  style,
}: AttachmentPreviewProps) {
  const { agentColor } = useContext(AttachmentsContext);
  const isImage = isImageKind(data.kind);
  const iconName = fallbackIcon ?? getFileIcon(data.kind);

  if (isImage && data.url) {
    return (
      <View style={[s.previewContainer, style]}>
        <Image
          source={{ uri: data.url }}
          style={s.previewImage}
          resizeMode="cover"
          accessibilityLabel={data.name}
        />
      </View>
    );
  }

  return (
    <View style={[s.previewContainer, s.previewIconContainer, style]}>
      <Ionicons name={iconName} size={24} color={agentColor} />
    </View>
  );
});

// ---------------------------------------------------------------------------
// <AttachmentInfo />
// ---------------------------------------------------------------------------

interface AttachmentInfoProps {
  /** The file data. */
  data: FileAttachment;
  /** Show media type label. */
  showMediaType?: boolean;
  style?: ViewStyle;
}

export const AttachmentInfo = React.memo(function AttachmentInfo({
  data,
  showMediaType = false,
  style,
}: AttachmentInfoProps) {
  return (
    <View style={[s.infoContainer, style]}>
      <Text style={s.infoName} numberOfLines={1}>
        {data.name}
      </Text>
      {showMediaType && (
        <Text style={s.infoType}>{getMediaCategory(data.kind)}</Text>
      )}
      {data.size != null && (
        <Text style={s.infoSize}>{formatFileSize(data.size)}</Text>
      )}
    </View>
  );
});

// ---------------------------------------------------------------------------
// <AttachmentRemove />
// ---------------------------------------------------------------------------

interface AttachmentRemoveProps {
  /** Callback when remove is pressed. */
  onRemove: () => void;
  /** Screen reader label. */
  label?: string;
  style?: ViewStyle;
}

export const AttachmentRemove = React.memo(function AttachmentRemove({
  onRemove,
  label = 'Remove attachment',
  style,
}: AttachmentRemoveProps) {
  return (
    <Pressable
      onPress={onRemove}
      hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
      style={[s.removeBtn, style]}
      accessibilityRole="button"
      accessibilityLabel={label}
    >
      <Ionicons name="close-circle" size={16} color={Colors.text.muted} />
    </Pressable>
  );
});

// ---------------------------------------------------------------------------
// <AttachmentEmpty />
// ---------------------------------------------------------------------------

interface AttachmentEmptyProps {
  /** Empty state message. */
  message?: string;
  style?: ViewStyle;
}

export const AttachmentEmpty = React.memo(function AttachmentEmpty({
  message = 'No attachments',
  style,
}: AttachmentEmptyProps) {
  return (
    <View style={[s.emptyContainer, style]} accessibilityRole="none">
      <Ionicons name="attach" size={20} color={Colors.text.disabled} />
      <Text style={s.emptyText}>{message}</Text>
    </View>
  );
});

// ---------------------------------------------------------------------------
// Internal Variant Components
// ---------------------------------------------------------------------------

interface VariantItemProps {
  data: FileAttachment;
  agentColor: string;
  iconName: keyof typeof Ionicons.glyphMap;
  isImage?: boolean;
  onPress: () => void;
  onRemove?: () => void;
  style?: ViewStyle;
}

/** Grid variant: thumbnail card. */
const AttachmentGridItem = React.memo(function AttachmentGridItem({
  data,
  agentColor,
  iconName,
  isImage,
  onPress,
  onRemove,
  style,
}: VariantItemProps) {
  return (
    <Pressable
      onPress={onPress}
      style={[s.gridItem, { borderColor: `${agentColor}33` }, style]}
      accessibilityRole="button"
      accessibilityLabel={`Open ${data.name}`}
    >
      {/* Preview */}
      <View style={s.gridPreview}>
        {isImage && data.url ? (
          <Image
            source={{ uri: data.url }}
            style={s.gridImage}
            resizeMode="cover"
            accessibilityLabel={data.name}
          />
        ) : (
          <Ionicons name={iconName} size={28} color={agentColor} />
        )}
      </View>

      {/* Info */}
      <View style={s.gridInfo}>
        <Text style={s.gridName} numberOfLines={1}>
          {data.name}
        </Text>
        {data.size != null && (
          <Text style={s.gridSize}>{formatFileSize(data.size)}</Text>
        )}
      </View>

      {/* Remove */}
      {onRemove && (
        <Pressable
          onPress={onRemove}
          style={s.gridRemove}
          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          accessibilityRole="button"
          accessibilityLabel={`Remove ${data.name}`}
        >
          <Ionicons name="close-circle" size={14} color={Colors.text.muted} />
        </Pressable>
      )}
    </Pressable>
  );
});

/** Inline variant: compact badge. */
const AttachmentInlineItem = React.memo(function AttachmentInlineItem({
  data,
  agentColor,
  iconName,
  onPress,
  onRemove,
  style,
}: VariantItemProps) {
  return (
    <Pressable
      onPress={onPress}
      style={[s.inlineItem, { borderColor: `${agentColor}33` }, style]}
      accessibilityRole="button"
      accessibilityLabel={`Open ${data.name}`}
    >
      <Ionicons name={iconName} size={12} color={agentColor} />
      <Text style={s.inlineName} numberOfLines={1}>
        {data.name}
      </Text>
      {onRemove && (
        <Pressable
          onPress={onRemove}
          hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}
          accessibilityRole="button"
          accessibilityLabel={`Remove ${data.name}`}
        >
          <Ionicons name="close" size={10} color={Colors.text.muted} />
        </Pressable>
      )}
    </Pressable>
  );
});

/** List variant: full-width row. */
const AttachmentListItem = React.memo(function AttachmentListItem({
  data,
  agentColor,
  iconName,
  isImage,
  onPress,
  onRemove,
  style,
}: VariantItemProps) {
  return (
    <Pressable
      onPress={onPress}
      style={[s.listItem, style]}
      accessibilityRole="button"
      accessibilityLabel={`Open ${data.name}`}
    >
      {/* Icon / thumbnail */}
      <View style={[s.listIconWrap, { backgroundColor: `${agentColor}1F` }]}>
        {isImage && data.url ? (
          <Image
            source={{ uri: data.url }}
            style={s.listThumb}
            resizeMode="cover"
            accessibilityLabel={data.name}
          />
        ) : (
          <Ionicons name={iconName} size={18} color={agentColor} />
        )}
      </View>

      {/* File info */}
      <View style={s.listTextCol}>
        <Text style={s.listName} numberOfLines={1}>
          {data.name}
        </Text>
        <View style={s.listMeta}>
          <Text style={s.listKind}>{data.kind}</Text>
          {data.size != null && (
            <Text style={s.listSize}>{formatFileSize(data.size)}</Text>
          )}
        </View>
      </View>

      {/* Actions */}
      <View style={s.listActions}>
        {data.url && (
          <Ionicons
            name="download-outline"
            size={16}
            color={Colors.text.muted}
          />
        )}
        {onRemove && (
          <Pressable
            onPress={onRemove}
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            accessibilityRole="button"
            accessibilityLabel={`Remove ${data.name}`}
          >
            <Ionicons name="close-circle" size={16} color={Colors.text.muted} />
          </Pressable>
        )}
      </View>
    </Pressable>
  );
});

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function getItemStyle(variant: AttachmentVariant): ViewStyle {
  switch (variant) {
    case 'grid':
      return s.gridItem;
    case 'inline':
      return s.inlineItem;
    case 'list':
      return s.listItem;
    default:
      return {};
  }
}

// ---------------------------------------------------------------------------
// Styles
// ---------------------------------------------------------------------------

const webCursor =
  Platform.OS === 'web'
    ? ({ cursor: 'pointer' } as unknown as ViewStyle)
    : {};

const webTransition =
  Platform.OS === 'web'
    ? ({ transition: 'background-color 150ms ease-out, border-color 150ms ease-out' } as unknown as ViewStyle)
    : {};

const s = StyleSheet.create({
  // Container variants
  containerGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.sm,
  },
  containerInline: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.xs,
    alignItems: 'center',
  },
  containerList: {
    gap: Spacing.xs,
  },

  // Grid variant
  gridItem: {
    width: 120,
    borderRadius: BorderRadius.md,
    backgroundColor: '#1A1A1C',
    borderWidth: 1,
    overflow: 'hidden',
    ...webCursor,
    ...webTransition,
  },
  gridPreview: {
    height: 80,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255,255,255,0.03)',
  },
  gridImage: {
    width: '100%' as unknown as number,
    height: 80,
  },
  gridInfo: {
    paddingHorizontal: Spacing.sm,
    paddingVertical: Spacing.xs + 2,
  },
  gridName: {
    ...Typography.micro,
    color: Colors.text.secondary,
  },
  gridSize: {
    ...Typography.micro,
    color: Colors.text.muted,
    marginTop: 1,
  },
  gridRemove: {
    position: 'absolute',
    top: Spacing.xs,
    right: Spacing.xs,
    backgroundColor: 'rgba(0,0,0,0.6)',
    borderRadius: BorderRadius.full,
    padding: 2,
  },

  // Inline variant
  inlineItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.xs,
    paddingHorizontal: Spacing.sm,
    paddingVertical: Spacing.xs,
    backgroundColor: 'rgba(255,255,255,0.04)',
    borderRadius: BorderRadius.sm,
    borderWidth: 1,
    ...webCursor,
    ...webTransition,
  },
  inlineName: {
    ...Typography.micro,
    color: Colors.text.tertiary,
    maxWidth: 120,
  },

  // List variant
  listItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm + 2,
    paddingVertical: Spacing.sm,
    paddingHorizontal: Spacing.md,
    backgroundColor: '#1A1A1C',
    borderRadius: BorderRadius.md,
    minHeight: 44,
    ...webCursor,
    ...webTransition,
  },
  listIconWrap: {
    width: 36,
    height: 36,
    borderRadius: BorderRadius.sm,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  listThumb: {
    width: 36,
    height: 36,
  },
  listTextCol: {
    flex: 1,
  },
  listName: {
    ...Typography.small,
    color: Colors.text.secondary,
  },
  listMeta: {
    flexDirection: 'row',
    gap: Spacing.sm,
    marginTop: 1,
  },
  listKind: {
    ...Typography.micro,
    color: Colors.text.muted,
    textTransform: 'uppercase',
  },
  listSize: {
    ...Typography.micro,
    color: Colors.text.muted,
  },
  listActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
  },

  // Preview (composable)
  previewContainer: {
    borderRadius: BorderRadius.md,
    overflow: 'hidden',
    backgroundColor: '#1A1A1C',
  },
  previewImage: {
    width: 80,
    height: 80,
    borderRadius: BorderRadius.md,
  },
  previewIconContainer: {
    width: 80,
    height: 80,
    alignItems: 'center',
    justifyContent: 'center',
  },

  // Info (composable)
  infoContainer: {
    gap: 1,
  },
  infoName: {
    ...Typography.small,
    color: Colors.text.secondary,
  },
  infoType: {
    ...Typography.micro,
    color: Colors.text.muted,
    textTransform: 'capitalize',
  },
  infoSize: {
    ...Typography.micro,
    color: Colors.text.muted,
  },

  // Remove button
  removeBtn: {
    minWidth: 24,
    minHeight: 24,
    alignItems: 'center',
    justifyContent: 'center',
  },

  // Empty state
  emptyContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    paddingVertical: Spacing.md,
    paddingHorizontal: Spacing.md,
  },
  emptyText: {
    ...Typography.small,
    color: Colors.text.disabled,
  },
});
