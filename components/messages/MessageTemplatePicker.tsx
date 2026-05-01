/**
 * MessageTemplatePicker — Lane E5 (plan §3.9.7).
 *
 * Dropdown menu listing the 5 V1 message templates. Triggered by the
 * "Use template" icon button inside the composer (NewMessageSheet + the
 * existing thread composer in MessagesThreadView). Selection fills the
 * composer body with the template, then auto-substitutes any {{tokens}}
 * we can resolve from `threadContext` — unresolved tokens stay in place
 * so the owner can fill them before sending.
 *
 * Visual chrome (Framer §12.1):
 *   - 360px wide · max 320px tall · #1A1A1C bg · subtle 1px border
 *   - Subtle ambient blue glow (matches NewMessageSheet halo)
 *   - Each row: short label (14/600) + body preview (3-line clamp 13/400)
 *     + token chips (small pills showing each {{token}} in the template)
 *   - Hover lifts the row -1px and reveals an Aspire-blue highlight border
 *   - Empty state has personality (sparkle icon + helpful copy)
 *
 * Wiring:
 *   - For Lane E5 we use a local `useMessageTemplates()` mock hook that
 *     returns the same 5 templates Lane E1 will serve from
 *     `GET /api/messages/templates`. Once Lane E6 lands the real hook,
 *     the import swap is one line.
 *
 * Accessibility:
 *   - `role="menu"` semantics on the dropdown
 *   - Each row is a `button` with descriptive accessibilityLabel
 *   - Escape closes the dropdown (caller wires this on the outer composer)
 *   - All rows >= 44pt tall for tap-target compliance
 */

import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  Pressable,
  Platform,
  ScrollView,
  type ViewStyle,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Colors, BorderRadius, Spacing } from '@/constants/tokens';
import { useMessageTemplates } from '@/lib/messages/useMessageTemplates';

// ---------------------------------------------------------------------------
// Types — mirrors `GET /v1/messages/templates` response shape
// ---------------------------------------------------------------------------

/** Allowed dynamic-substitution token names (plan §3.9.7). */
export type TemplateToken =
  | 'date'
  | 'time'
  | 'business_phone'
  | 'first_name'
  | 'relative_time'
  | 'response_window'
  | 'invoice_number'
  | 'amount'
  | 'due_date';

export interface MessageTemplate {
  id: string;
  /** Short label shown at top of row (e.g. "Appointment confirmation"). */
  label: string;
  /** Full body with `{{token}}` placeholders. */
  body: string;
  /** List of every {{token}} that appears in the body (for chips). */
  tokens: TemplateToken[];
}

/**
 * Optional thread / contact context for token substitution. Any field
 * provided will fill its corresponding token; missing fields stay as
 * `{{token}}` so the owner sees what's still pending.
 */
export interface ThreadContext {
  contactName?: string;
  businessName?: string;
  businessPhone?: string;
  /** Most-recent invoice attached to this thread. */
  lastInvoice?: {
    number?: string;
    amount?: string;
    dueDate?: string;
  };
  /** Display-friendly relative time (e.g. "yesterday", "Tuesday"). */
  relativeTime?: string;
  /** Owner's stated typical response window (e.g. "1 business day"). */
  responseWindow?: string;
  /** Optional override of "first_name" — defaults to first word of contactName. */
  firstName?: string;
  /** Owner-resolved appointment slot (single-string label e.g. "Tue 2pm"). */
  appointmentDate?: string;
  appointmentTime?: string;
}

export interface MessageTemplatePickerProps {
  open: boolean;
  onClose: () => void;
  /** Called with the (possibly-substituted) body when the owner picks one. */
  onSelect: (templateBody: string) => void;
  /** Optional thread context for token substitution. */
  threadContext?: ThreadContext;

  /**
   * Test/demo override — bypass the local mock hook and supply explicit
   * templates. Used by `MessageTemplatePicker.demo.tsx` to drive the
   * empty-state and partial-templates fixtures.
   */
  templatesOverride?: MessageTemplate[];

  /** Test/demo override — force the empty-state branch regardless of hook. */
  forceEmpty?: boolean;
}

// ---------------------------------------------------------------------------
// One-time CSS — hover/focus polish + entrance fade
// ---------------------------------------------------------------------------

let cssInjected = false;
function injectTemplatePickerCss() {
  if (cssInjected || Platform.OS !== 'web') return;
  cssInjected = true;
  const style = document.createElement('style');
  style.id = 'msg-template-picker-css';
  style.textContent = `
    @keyframes msg-tp-pop {
      from { opacity: 0; transform: translateY(-6px) scale(0.98); }
      to   { opacity: 1; transform: translateY(0) scale(1); }
    }
    .msg-tp-menu { animation: msg-tp-pop 180ms cubic-bezier(0.16, 1, 0.3, 1) both; transform-origin: top left; }
    .msg-tp-row { transition: background-color 140ms ease-out, border-color 140ms ease-out, transform 140ms ease-out; cursor: pointer; }
    .msg-tp-row:hover { background-color: rgba(59,130,246,0.06); border-color: rgba(59,130,246,0.30); transform: translateY(-1px); }
    .msg-tp-row:active { transform: translateY(0); }
    .msg-tp-row:focus-visible {
      outline: 2px solid rgba(59,130,246,0.65);
      outline-offset: 2px;
    }
    @media (prefers-reduced-motion: reduce) {
      .msg-tp-menu, .msg-tp-row { animation: none; transition: none; }
    }
  `;
  document.head.appendChild(style);
}

// ---------------------------------------------------------------------------
// V1 templates — exactly the 5 listed in plan §3.9.7
// ---------------------------------------------------------------------------

const V1_TEMPLATES: MessageTemplate[] = [
  {
    id: 'tpl_appt_confirm',
    label: 'Appointment confirmation',
    body: 'Confirming our appointment for {{date}} at {{time}}. Reply YES to confirm or call us at {{business_phone}}.',
    tokens: ['date', 'time', 'business_phone'],
  },
  {
    id: 'tpl_quote_followup',
    label: 'Quote follow-up',
    body: "Hi {{first_name}} — quick follow-up on the quote we sent {{relative_time}}. Any questions?",
    tokens: ['first_name', 'relative_time'],
  },
  {
    id: 'tpl_inquiry_response',
    label: 'Inquiry response',
    body: "Thanks for your inquiry. We'll get back to you within {{response_window}}.",
    tokens: ['response_window'],
  },
  {
    id: 'tpl_invoice_reminder',
    label: 'Invoice reminder',
    body: 'Reminder: your invoice #{{invoice_number}} for {{amount}} is due {{due_date}}.',
    tokens: ['invoice_number', 'amount', 'due_date'],
  },
  {
    id: 'tpl_sarah_backstop',
    label: 'Sarah backstop',
    body: 'We received your message. Sarah will follow up shortly.',
    tokens: [],
  },
];

// ---------------------------------------------------------------------------
// Lane E6 — `useMessageTemplates` from `lib/messages/useMessageTemplates`.
// V1_TEMPLATES (above) is kept as an offline fallback for `*.demo.tsx` and as
// a Law-#3 fail-closed default (if the network read fails the picker still
// renders with the V1 set so the owner can keep working).
// ---------------------------------------------------------------------------

// ---------------------------------------------------------------------------
// Token substitution — fills {{token}} from threadContext when resolvable.
// Unresolved tokens stay in place; owner sees them and fills before sending.
// ---------------------------------------------------------------------------

export function substituteTokens(
  body: string,
  ctx: ThreadContext | undefined,
): string {
  if (!ctx) return body;
  const firstName =
    ctx.firstName ??
    (ctx.contactName ? ctx.contactName.trim().split(/\s+/)[0] : undefined);

  const map: Record<TemplateToken, string | undefined> = {
    date: ctx.appointmentDate,
    time: ctx.appointmentTime,
    business_phone: ctx.businessPhone,
    first_name: firstName,
    relative_time: ctx.relativeTime,
    response_window: ctx.responseWindow,
    invoice_number: ctx.lastInvoice?.number,
    amount: ctx.lastInvoice?.amount,
    due_date: ctx.lastInvoice?.dueDate,
  };

  return body.replace(/\{\{(\w+)\}\}/g, (raw, key) => {
    const value = map[key as TemplateToken];
    return value && value.trim().length > 0 ? value : raw;
  });
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function MessageTemplatePicker({
  open,
  onClose,
  onSelect,
  threadContext,
  templatesOverride,
  forceEmpty,
}: MessageTemplatePickerProps) {
  injectTemplatePickerCss();

  const hookResult = useMessageTemplates();
  // Fail closed: if the network read returns 0 templates we fall back to
  // V1_TEMPLATES so the picker remains usable. Backend should populate the
  // same 5 rows via Lane E1 — they'll line up by id.
  const networkTemplates =
    hookResult.templates.length > 0 ? hookResult.templates : V1_TEMPLATES;
  const templates = forceEmpty
    ? []
    : templatesOverride ?? networkTemplates;

  if (!open) return null;

  return (
    <View
      style={styles.menu}
      accessibilityRole={
        // RN doesn't have 'menu' but role is a hint for AT on web.
        (Platform.OS === 'web' ? ('menu' as any) : undefined)
      }
      accessibilityLabel="Message templates"
      {...(Platform.OS === 'web'
        ? ({ className: 'msg-tp-menu' } as any)
        : {})}
    >
      <View style={styles.headerRow}>
        <Ionicons
          name="document-text-outline"
          size={12}
          color={Colors.accent.cyan}
        />
        <Text style={styles.headerLabel}>TEMPLATES</Text>
        <Pressable
          onPress={onClose}
          accessibilityRole="button"
          accessibilityLabel="Close template picker"
          hitSlop={12}
          style={({ pressed }) => [
            styles.closeBtn,
            pressed && styles.closeBtnPressed,
          ]}
        >
          <Ionicons name="close" size={14} color={Colors.text.muted} />
        </Pressable>
      </View>

      {templates.length === 0 ? (
        <EmptyState />
      ) : (
        <ScrollView
          style={styles.scroll}
          contentContainerStyle={styles.scrollContent}
          accessibilityLabel="Templates list"
        >
          {templates.map((tpl, i) => (
            <TemplateRow
              key={tpl.id}
              template={tpl}
              isLast={i === templates.length - 1}
              onSelect={() => {
                onSelect(substituteTokens(tpl.body, threadContext));
                onClose();
              }}
            />
          ))}
        </ScrollView>
      )}
    </View>
  );
}

// ---------------------------------------------------------------------------
// Row
// ---------------------------------------------------------------------------

interface TemplateRowProps {
  template: MessageTemplate;
  isLast: boolean;
  onSelect: () => void;
}

function TemplateRow({ template, isLast, onSelect }: TemplateRowProps) {
  return (
    <Pressable
      onPress={onSelect}
      accessibilityRole="button"
      accessibilityLabel={`Use template: ${template.label}`}
      accessibilityHint="Fills the composer with this template"
      style={({ pressed }) => [
        styles.row,
        !isLast && styles.rowDivider,
        pressed && styles.rowPressed,
      ]}
      {...(Platform.OS === 'web'
        ? ({ className: 'msg-tp-row' } as any)
        : {})}
    >
      <View style={styles.rowHead}>
        <Text style={styles.rowLabel} numberOfLines={1}>
          {template.label}
        </Text>
        <Ionicons
          name="arrow-forward"
          size={12}
          color={Colors.text.muted}
          style={styles.rowArrow}
        />
      </View>

      <Text style={styles.rowBody} numberOfLines={3}>
        {template.body}
      </Text>

      {template.tokens.length > 0 ? (
        <View style={styles.tokenRow}>
          {template.tokens.map((tok) => (
            <View key={tok} style={styles.tokenChip}>
              <Text style={styles.tokenText}>{`{{${tok}}}`}</Text>
            </View>
          ))}
        </View>
      ) : null}
    </Pressable>
  );
}

// ---------------------------------------------------------------------------
// Empty state
// ---------------------------------------------------------------------------

function EmptyState() {
  return (
    <View style={styles.empty}>
      <View style={styles.emptyIcon}>
        <Ionicons name="sparkles-outline" size={20} color={Colors.accent.cyan} />
      </View>
      <Text style={styles.emptyTitle}>No templates available</Text>
      <Text style={styles.emptyBody}>
        We couldn&rsquo;t load templates right now. Type your message manually —
        templates will return the next time you open this menu.
      </Text>
    </View>
  );
}

// ---------------------------------------------------------------------------
// Styles
// ---------------------------------------------------------------------------

const PICKER_WIDTH = 360;
const PICKER_MAX_HEIGHT = 320;

const styles = StyleSheet.create({
  menu: {
    width: PICKER_WIDTH,
    maxHeight: PICKER_MAX_HEIGHT,
    backgroundColor: '#1A1A1C',
    borderRadius: BorderRadius.lg,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
    overflow: 'hidden',
    ...(Platform.OS === 'web'
      ? ({
          boxShadow:
            '0 12px 40px rgba(0,0,0,0.55), 0 0 0 1px rgba(59,130,246,0.10), 0 0 24px rgba(59,130,246,0.10)',
        } as object)
      : {
          shadowColor: '#000',
          shadowOffset: { width: 0, height: 8 },
          shadowOpacity: 0.55,
          shadowRadius: 18,
          elevation: 10,
        }),
  } as ViewStyle,

  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 14,
    paddingTop: 10,
    paddingBottom: 8,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,255,255,0.05)',
  },
  headerLabel: {
    flex: 1,
    fontSize: 9,
    fontWeight: '700',
    color: Colors.accent.cyan,
    letterSpacing: 1.2,
    textTransform: 'uppercase',
  },
  closeBtn: {
    width: 22,
    height: 22,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: BorderRadius.sm,
  },
  closeBtnPressed: {
    backgroundColor: 'rgba(255,255,255,0.06)',
  },

  scroll: {
    maxHeight: PICKER_MAX_HEIGHT - 40,
  },
  scrollContent: {
    paddingVertical: 4,
  },

  row: {
    paddingHorizontal: 14,
    paddingVertical: 12,
    minHeight: 44,
    gap: 6,
  },
  rowDivider: {
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,255,255,0.04)',
  },
  rowPressed: {
    backgroundColor: 'rgba(59,130,246,0.10)',
  },
  rowHead: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
  },
  rowLabel: {
    flex: 1,
    fontSize: 14,
    fontWeight: '600',
    color: Colors.text.primary,
    letterSpacing: -0.1,
  },
  rowArrow: {
    opacity: 0.6,
  },
  rowBody: {
    fontSize: 13,
    fontWeight: '400',
    color: Colors.text.tertiary,
    lineHeight: 18,
  },
  tokenRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 5,
    marginTop: 4,
  },
  tokenChip: {
    paddingHorizontal: 7,
    paddingVertical: 2,
    backgroundColor: 'rgba(59,130,246,0.10)',
    borderRadius: BorderRadius.sm,
    borderWidth: 1,
    borderColor: 'rgba(59,130,246,0.22)',
  },
  tokenText: {
    fontSize: 10,
    fontWeight: '500',
    color: Colors.accent.cyan,
    fontVariant: ['tabular-nums'],
    letterSpacing: 0.2,
  },

  empty: {
    paddingHorizontal: 20,
    paddingVertical: 24,
    alignItems: 'center',
    gap: 10,
  },
  emptyIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(59,130,246,0.08)',
    borderWidth: 1,
    borderColor: 'rgba(59,130,246,0.18)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  emptyTitle: {
    fontSize: 13,
    fontWeight: '600',
    color: Colors.text.primary,
    textAlign: 'center',
  },
  emptyBody: {
    fontSize: 12,
    fontWeight: '400',
    color: Colors.text.tertiary,
    textAlign: 'center',
    lineHeight: 17,
    maxWidth: 280,
  },
});
