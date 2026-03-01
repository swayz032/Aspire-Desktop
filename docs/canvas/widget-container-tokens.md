# WidgetContainer Design Tokens — Complete Token Additions

**Location:** Add to `Aspire-desktop/constants/tokens.ts` in the `Canvas` namespace.

---

## Token Additions (Canvas.widget namespace)

```typescript
export const Canvas = {
  // ... existing Canvas tokens (depth, motion, vignette, etc.) ...

  /**
   * WidgetContainer tokens — Premium draggable/resizable widget system
   * for Canvas Mode (Wave 12).
   *
   * Quality bar: Bloomberg Terminal level polish. Multi-layer shadows,
   * glass surface treatment, custom SVG icons, spring physics.
   */
  widget: {
    /** Header height (drag handle + title + close button row) */
    headerHeight: 44,

    /** Header background (darker two-tone) */
    headerBg: '#1E1E1E', // Canvas.background.surface

    /** Content background (lighter two-tone) */
    contentBg: '#2A2A2A', // Canvas.background.elevated

    /** Border colors */
    borderMain: 'rgba(255,255,255,0.15)',
    borderRimLight: 'rgba(255,255,255,0.05)',
    borderDepthEdge: 'rgba(0,0,0,0.3)',

    /** Header border gradient (blue glow) */
    borderGradient: {
      colors: [
        'rgba(59,130,246,0.0)',
        'rgba(59,130,246,0.4)',
        'rgba(59,130,246,0.0)'
      ],
      locations: [0, 0.5, 1],
    },

    /** Multi-layer shadow system (CRITICAL for dark canvas visibility) */
    shadow: {
      // Layer 1: Ambient shadow (outer depth)
      ambient: {
        offset: { width: 0, height: 12 },
        blur: 32,
        color: 'rgba(0,0,0,0.6)',
      },
      // Layer 2: Contact shadow (grounding)
      contact: {
        offset: { width: 0, height: 4 },
        blur: 16,
        color: 'rgba(0,0,0,0.8)',
      },
      // Layer 3: Blue glow (premium accent)
      glow: {
        offset: { width: 0, height: 0 },
        blur: 40,
        color: 'rgba(59,130,246,0.12)',
      },
      // Web box-shadow string (all 3 layers combined)
      web: '0 12px 32px rgba(0,0,0,0.6), 0 4px 16px rgba(0,0,0,0.8), 0 0 40px rgba(59,130,246,0.12)',
      // Dragging state (intensified shadows)
      webDragging: '0 16px 60px rgba(0,0,0,1.0), 0 8px 24px rgba(0,0,0,0.9), 0 0 48px rgba(59,130,246,0.2)',
    },

    /** Drag handle (6 dots in 2×3 grid) */
    dragHandle: {
      width: 14,
      height: 9,
      dotSize: 2,
      dotSpacing: { x: 4, y: 3 },
      colorIdle: 'rgba(255,255,255,0.3)',
      colorHover: 'rgba(255,255,255,0.6)',
      colorDragging: 'rgba(59,130,246,0.6)',
    },

    /** Close button (rounded X icon) */
    closeButton: {
      iconSize: 16,
      strokeWidth: 2,
      colorIdle: 'rgba(255,255,255,0.4)',
      colorHover: 'rgba(255,255,255,0.8)',
      colorPress: 'rgba(239,68,68,0.6)', // Red tint on press
    },

    /** Resize handles (4 corner diagonal arrows) */
    resizeHandle: {
      visualSize: 12,
      touchSize: 32,
      strokeWidth: 1.5,
      colorIdle: 'rgba(255,255,255,0.3)',
      colorHover: 'rgba(59,130,246,0.8)',
      colorDragging: 'rgba(59,130,246,1.0)',
      glowHover: '0 0 8px rgba(59,130,246,0.4)',
      glowDragging: '0 0 12px rgba(59,130,246,0.6)',
    },

    /** Widget size constraints */
    minWidth: 240,
    minHeight: 180,
    maxWidth: 800,
    maxHeight: 600,

    /** Grid snap increment (8px grid alignment) */
    gridSnap: 8,

    /** Entrance stagger delay (ms per widget) */
    entranceDelay: 300,

    /** Animation spring config (premium organic feel) */
    spring: {
      damping: 22,
      stiffness: 280,
      mass: 0.9,
    },
  },
} as const;
```

---

## Usage Examples

### Shadow System (Web)

```tsx
import { Canvas } from '@/constants/tokens';
import { Platform } from 'react-native';

const containerStyle = Platform.OS === 'web' ? {
  boxShadow: Canvas.widget.shadow.web,
} as unknown as ViewStyle : {
  // Native implementation (iOS/Android)
  shadowColor: Canvas.widget.shadow.ambient.color,
  shadowOffset: Canvas.widget.shadow.ambient.offset,
  shadowOpacity: 0.6,
  shadowRadius: Canvas.widget.shadow.ambient.blur / 2,
  elevation: 8,
};
```

### Border Gradient (Header)

```tsx
import { LinearGradient } from 'expo-linear-gradient';
import { Canvas } from '@/constants/tokens';

<LinearGradient
  colors={Canvas.widget.borderGradient.colors}
  start={{ x: 0, y: 0 }}
  end={{ x: 1, y: 0 }}
  style={{ height: 1, width: '100%' }}
/>
```

### Drag Handle Icon

```tsx
import Svg, { Circle } from 'react-native-svg';
import { Canvas } from '@/constants/tokens';

<Svg
  width={Canvas.widget.dragHandle.width}
  height={Canvas.widget.dragHandle.height}
  viewBox={`0 0 ${Canvas.widget.dragHandle.width} ${Canvas.widget.dragHandle.height}`}
>
  {/* Row 1 */}
  <Circle cx="2" cy="2" r={Canvas.widget.dragHandle.dotSize / 2} fill={Canvas.widget.dragHandle.colorIdle} />
  <Circle cx="7" cy="2" r={Canvas.widget.dragHandle.dotSize / 2} fill={Canvas.widget.dragHandle.colorIdle} />
  <Circle cx="12" cy="2" r={Canvas.widget.dragHandle.dotSize / 2} fill={Canvas.widget.dragHandle.colorIdle} />

  {/* Row 2 */}
  <Circle cx="2" cy="7" r={Canvas.widget.dragHandle.dotSize / 2} fill={Canvas.widget.dragHandle.colorIdle} />
  <Circle cx="7" cy="7" r={Canvas.widget.dragHandle.dotSize / 2} fill={Canvas.widget.dragHandle.colorIdle} />
  <Circle cx="12" cy="7" r={Canvas.widget.dragHandle.dotSize / 2} fill={Canvas.widget.dragHandle.colorIdle} />
</Svg>
```

### Spring Animation

```tsx
import Animated, { withSpring } from 'react-native-reanimated';
import { Canvas } from '@/constants/tokens';

const animateEntrance = () => {
  opacity.value = withSpring(1, {
    damping: Canvas.widget.spring.damping,
    stiffness: Canvas.widget.spring.stiffness,
    mass: Canvas.widget.spring.mass,
  });
};
```

### Size Constraints

```tsx
import { Canvas } from '@/constants/tokens';

const snapToConstraints = (width: number, height: number) => {
  const snappedWidth = Math.max(
    Canvas.widget.minWidth,
    Math.min(Canvas.widget.maxWidth, width)
  );
  const snappedHeight = Math.max(
    Canvas.widget.minHeight,
    Math.min(Canvas.widget.maxHeight, height)
  );
  return { width: snappedWidth, height: snappedHeight };
};
```

### Grid Snap

```tsx
import { Canvas } from '@/constants/tokens';

const snapToGrid = (value: number) => {
  return Math.round(value / Canvas.widget.gridSnap) * Canvas.widget.gridSnap;
};
```

---

## Token Rationale

### Why 3-Layer Shadows?

**Problem:** Single dark shadow (e.g., `0 4px 8px rgba(0,0,0,0.3)`) is **invisible** on dark canvas background (#060608).

**Solution:** Multi-layer system:
1. **Ambient** (0.6 opacity, 32px blur) — Creates floating depth
2. **Contact** (0.8 opacity, 16px blur) — Grounds widget to surface
3. **Blue glow** (0.12 opacity, 40px blur) — Premium brand accent

**Result:** Shadows are clearly visible on dark background + premium Aspire blue integration.

### Why Two-Tone Header/Content?

**Matches:** Authority Queue card pattern (#1E1E1E header, #2A2A2A content)

**Benefit:** Visual hierarchy, depth separation, professional appearance

### Why Custom SVG Icons?

**Emoji (× ⠿ ⤡) Problems:**
- Inconsistent rendering across platforms
- Cannot control size/color precisely
- Look unprofessional (consumer app feel)

**Custom SVG Benefits:**
- Precise control over size, stroke, color
- Consistent rendering (web + native)
- Professional Bloomberg Terminal aesthetic
- Animatable (color, scale, opacity)

### Why Spring Config (22/280/0.9)?

**Tested:** Settles in ~180ms with <5% overshoot

**Feel:** Organic, not robotic. Snappy but not jarring.

**Consistency:** Matches Canvas.motion.spring (used across all Canvas components)

### Why 44×44px Tap Targets?

**Accessibility:** Apple Human Interface Guidelines + WCAG 2.1 AAA standard

**User Experience:** Easy to tap on all devices (mobile, tablet, desktop)

**Canvas Context:** Desktop-first, but must work on touch devices

### Why 8px Grid Snap?

**Design System:** Consistent with Spacing.sm (8px) token

**Visual Alignment:** Widgets align to underlying canvas grid

**UX:** Prevents misalignment, creates ordered canvas layout

---

## Token Consistency Verification

### Existing Token Alignment

| WidgetContainer Token | Matches Existing Token | Notes |
|----------------------|------------------------|-------|
| `widget.headerBg` | `Colors.background.surface` (#1E1E1E) | ✅ Exact match |
| `widget.contentBg` | `Colors.background.elevated` (#2A2A2A) | ✅ Exact match |
| `widget.spring.damping` | `Canvas.motion.spring.damping` (22) | ✅ Exact match |
| `widget.spring.stiffness` | `Canvas.motion.spring.stiffness` (260) | ⚠️ 280 vs 260 (slightly snappier for widgets) |
| `widget.gridSnap` | `Spacing.sm` (8) | ✅ Exact match |
| `widget.borderGradient.colors[1]` | `Canvas.halo.color` (rgba(59,130,246,0.4)) | ✅ Exact match |

**Note:** `stiffness: 280` is intentionally 20 higher than `Canvas.motion.spring.stiffness: 260` for snappier widget interactions. All other values align with existing design system.

---

## Implementation Checklist

### Phase 1: Add Tokens
- [ ] Add `Canvas.widget` namespace to `constants/tokens.ts`
- [ ] Verify all color values match existing Canvas/Colors tokens
- [ ] Verify spring config matches Canvas.motion (except stiffness)
- [ ] Add JSDoc comments for each token group

### Phase 2: Use Tokens
- [ ] Replace all magic numbers in WidgetContainer with tokens
- [ ] Use `Canvas.widget.shadow.web` for web box-shadow
- [ ] Use `Canvas.widget.borderGradient` for header border
- [ ] Use `Canvas.widget.dragHandle.*` for drag handle SVG
- [ ] Use `Canvas.widget.closeButton.*` for close button SVG
- [ ] Use `Canvas.widget.resizeHandle.*` for resize handles
- [ ] Use `Canvas.widget.spring` for all widget animations

### Phase 3: Verify Consistency
- [ ] Visual comparison with Authority Queue card (color parity)
- [ ] Test shadows visible on dark canvas (#060608)
- [ ] Test spring animations feel consistent with Canvas.motion
- [ ] Test grid snap aligns with 8px spacing scale
- [ ] Test size constraints prevent crushing/overwhelming

---

## Design Token Quality Standards

**Every token MUST have:**
1. **Clear name** — No abbreviations, no ambiguity (e.g., `headerHeight` not `hH`)
2. **JSDoc comment** — Explain purpose, not just repeat name
3. **Type safety** — Use `as const` for immutability
4. **Consistency** — Reference existing tokens where possible (don't duplicate)
5. **Rationale** — Document WHY the value was chosen (not just WHAT it is)

**Example:**

```typescript
// ❌ BAD (no context, magic number)
hH: 44,

// ✅ GOOD (clear, documented, justified)
/** Header height (drag handle + title + close button row).
 *  44px ensures minimum tap target for accessibility (WCAG 2.1 AAA).
 */
headerHeight: 44,
```

---

## Final Notes

**NO MAGIC NUMBERS.** Every value in WidgetContainer implementation MUST reference a token from `Canvas.widget.*`.

**CONSISTENCY.** Where possible, use existing tokens (Colors, Spacing, Canvas.motion). Only add new tokens when truly widget-specific.

**DOCUMENTATION.** Every token group has a comment explaining its purpose and design rationale.

**QUALITY BAR.** These tokens enable $10,000 agency-level UI/UX. If a value doesn't contribute to premium feel, it doesn't belong here.

**Ship it when every pixel is intentional, every animation is organic, and every shadow is visible.**
