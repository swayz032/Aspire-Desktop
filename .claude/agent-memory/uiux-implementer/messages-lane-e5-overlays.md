---
name: Messages Lane E5 Overlays
description: NewMessageSheet, ContactsSidePanel, ContactAutocomplete, MessageTemplatePicker patterns from calm-lynx Lane E5 (2026-04-30)
type: reference
---

# Messages Lane E5 Overlays — Reference

Files (all in `Aspire-desktop/components/messages/`):
- `NewMessageSheet.tsx` + `.demo.tsx` — full overlay compose modal (560px centered)
- `ContactsSidePanel.tsx` + `.demo.tsx` — slide-in 400px right panel
- `ContactAutocomplete.tsx` + `.demo.tsx` — virtualized 4-source dropdown (chip + search modes)
- `MessageTemplatePicker.tsx` + `.demo.tsx` — 360px template menu w/ token chips

Page integration: `app/session/messages.tsx` — both sheets mounted at page level after the grid View. Page state: `composeOpen`, `contactsOpen`, `composePrefill`. Handlers: `handleNewMessage`, `handleOpenContacts`, `handleCloseCompose`, `handleCloseContacts`, `handleContactsCompose`, `handleSent`.

## Modal/overlay pattern (matches AspireNumberPickerSheet)
- Wrap with `Modal presentationStyle="overFullScreen" transparent statusBarTranslucent`
- Web `modalRoot` style: `position: 'fixed', top/left/right/bottom: 0, zIndex: 9999`
- Backdrop: `position: 'absolute', inset 0, backgroundColor: 'rgba(0,0,0,0.72)', zIndex: 9999` (NewMessageSheet) or `0.55` (ContactsSidePanel — secondary surface)
- BlurView underneath: `intensity={20}, tint="dark"`, full inset, `pointerEvents="none"`
- Sheet card zIndex: `10001`, with halo border ring (1px Aspire-blue at 0.18 alpha) sitting at `zIndex: -1` for the ambient glow

## Halo glow trick
```tsx
<View pointerEvents="none" style={{
  position: 'absolute',
  top: -2, left: -2, right: -2, bottom: -2,
  borderRadius: BorderRadius.xl + 2,
  borderWidth: 1,
  borderColor: 'rgba(59,130,246,0.18)',
  zIndex: -1,
}} />
```
Combined with `boxShadow: '... 0 0 60px rgba(59,130,246,0.18) ...'` on the card itself for premium ambient blue ring.

## Side panel slide animation
- 400px width
- `Animated.Value` translateX from PANEL_WIDTH → 0
- 280ms ease-out via `Easing.out(Easing.cubic)`
- Track `mounted` separately so exit animation finishes before unmount
- `useReducedMotion()` skips animation entirely

## Picker dropdown positioning
- Anchor wrapper relative-positioned with className `msg-nms-tpl-anchor`
- Menu absolutely positioned with `top: calc(100% + 6px); left: 0; z-index: 12`
- On native (no CSS), use inline `position: 'absolute', top: 36, right: 0, zIndex: 12`
- The picker itself owns the card chrome; positioning shell stays unstyled

## ContactAutocomplete dual-mode
- Default: search input + dropdown
- Selected: render chip with avatar/name/phone/role + remove × (skip dropdown until cleared)
- Manual E.164 row: appended to results when typed input parses to E.164 and isn't already a result
- Web key handlers: ArrowUp/Down highlight, Enter select, Escape close

## Template token substitution
- `substituteTokens(body, ctx)` exported helper
- Map of `TemplateToken → string | undefined` from threadContext
- Unresolved tokens stay as `{{token}}` for owner to fill
- 5 V1 templates: appointment_confirm, quote_followup, inquiry_response, invoice_reminder, sarah_backstop

## Source pill palette
- Routing: blue `rgba(59,130,246,0.12)` bg, `#60A5FA` text
- Recent SMS: cyan `rgba(8,145,178,0.14)` bg, `#22D3EE` text
- Recent Call: violet `rgba(168,85,247,0.14)` bg, `#C084FC` text
- Manual: gray `rgba(255,255,255,0.05)` bg, `Colors.text.tertiary` text
- Role pills: per-role palette (owner blue, sales violet, support cyan, billing amber, scheduling green)

## Deterministic avatar
```tsx
function avatarHue(seed: string): number { /* djb2 hash, mod 360 */ }
function avatarBg(seed: string): string { return `hsl(${hue}, 28%, 22%)`; }
function avatarFg(seed: string): string { return `hsl(${hue}, 60%, 75%)`; }
```
Same seed → same color. Reused across ThreadView, Autocomplete, SidePanel for visual continuity.

## Yellow-tier confirm pattern
```tsx
if (Platform.OS === 'web') {
  if (window.confirm(`Send SMS to ${display} at ${phone}?`)) proceed();
} else {
  Alert.alert('Send SMS', message, [
    { text: 'Cancel', style: 'cancel' },
    { text: 'Send', style: 'default', onPress: proceed },
  ]);
}
```

## Empty states with personality
Each section/dropdown has a friendly empty state:
- Icon halo (44px circle, blue-tinted)
- Title: descriptive + brief
- Body: helpful next-step ("Type a phone number to message a new contact.")
- NEVER show "No results" alone

## Reduced motion + a11y
- All entrance animations gated by `prefers-reduced-motion`
- Tap targets >=44pt (most are 56pt for rows)
- `accessibilityRole="combobox"` on autocomplete input wrapper (web only via cast)
- `accessibilityViewIsModal` on every sheet
- Char counter `accessibilityLiveRegion="polite"` so VoiceOver announces SMS segment changes
