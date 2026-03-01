# WidgetContainer Component — $10,000 Premium Design Specification

**Quality Bar:** Bloomberg Terminal level polish. Professional software, not a web app.

---

## 1. Component Overview

**Purpose:** Premium draggable/resizable container for Canvas Mode widgets with REAL physical depth, matching Authority Queue card quality.

**Design Philosophy:**
- Multi-layer shadow system (visible on dark background)
- Premium glass morphism surface treatment
- Two-tone color palette matching Authority Queue
- $10,000 agency-level build quality

**Reference Quality:**
- Authority Queue card depth system (`AuthorityQueueCard.tsx`)
- Apple macOS window chrome
- Figma canvas panels
- Bloomberg Terminal interface elements

---

## 2. Premium Two-Tone Header System

### 2.1 Header Layout (44px height)

```
┌────────────────────────────────────────────────────────┐
│ [••] Title Text                              [×]       │ ← 44px
├────────────────────────────────────────────────────────┤
│                                                        │
│  Content Area                                          │
│  (elevated background #2A2A2A)                         │
│                                                        │
└────────────────────────────────────────────────────────┘
```

### 2.2 Header Specifications

**Background:**
- Base: `Canvas.background.surface` (#1E1E1E)
- Two-tone separation from content (darker than content area)

**Bottom Border (Blue Glow Gradient):**
- Type: LinearGradient (horizontal)
- Colors:
  - Left: `rgba(59,130,246,0.0)` (transparent)
  - Center: `rgba(59,130,246,0.4)` (Canvas.border.emphasis)
  - Right: `rgba(59,130,246,0.0)` (transparent)
- Height: 1px
- Effect: Subtle blue accent separating header from content

**Layout Structure:**
```tsx
<View style={styles.header}> {/* 44px height */}
  <View style={styles.dragHandle}> {/* Custom SVG */}
    {/* 6 dots in 2x3 grid */}
  </View>

  <Text style={styles.title}>Widget Title</Text>

  <Pressable style={styles.closeButton}> {/* Custom SVG */}
    {/* Rounded X icon */}
  </Pressable>
</View>

<LinearGradient
  colors={['rgba(59,130,246,0.0)', 'rgba(59,130,246,0.4)', 'rgba(59,130,246,0.0)']}
  start={{ x: 0, y: 0 }}
  end={{ x: 1, y: 0 }}
  style={styles.headerBorder}
/>
```

### 2.3 Drag Handle (Custom SVG)

**NOT:** Emoji (⠿, ⋮⋮, ≡)
**YES:** Custom SVG icon

**Design:**
- 6 dots in 2 rows × 3 columns grid
- Dot size: 2px diameter
- Dot spacing: 4px horizontal, 3px vertical
- Dot color: `rgba(255,255,255,0.3)` idle
- Dot color hover: `rgba(255,255,255,0.6)`
- Total dimensions: 14px × 9px
- Position: Left side, 12px padding from edge

**SVG Specification:**
```tsx
<Svg width="14" height="9" viewBox="0 0 14 9">
  {/* Row 1 */}
  <Circle cx="2" cy="2" r="1" fill="rgba(255,255,255,0.3)" />
  <Circle cx="7" cy="2" r="1" fill="rgba(255,255,255,0.3)" />
  <Circle cx="12" cy="2" r="1" fill="rgba(255,255,255,0.3)" />

  {/* Row 2 */}
  <Circle cx="2" cy="7" r="1" fill="rgba(255,255,255,0.3)" />
  <Circle cx="7" cy="7" r="1" fill="rgba(255,255,255,0.3)" />
  <Circle cx="12" cy="7" r="1" fill="rgba(255,255,255,0.3)" />
</Svg>
```

**Interaction States:**
- Idle: opacity 0.3
- Hover: opacity 0.6, cursor pointer
- Dragging: opacity 0.8, blue tint `rgba(59,130,246,0.6)`

**Touch Target:** 44×44px (larger than visual)

### 2.4 Close Button (Custom SVG)

**NOT:** Emoji (×, ✕)
**YES:** Custom SVG X icon

**Design:**
- Rounded X shape
- Stroke width: 2px
- Stroke color: `rgba(255,255,255,0.4)` idle
- Stroke color hover: `rgba(255,255,255,0.8)`
- Icon dimensions: 16px × 16px
- Position: Right side, 12px padding from edge

**SVG Specification:**
```tsx
<Svg width="16" height="16" viewBox="0 0 16 16">
  <Path
    d="M4,4 L12,12 M12,4 L4,12"
    stroke="rgba(255,255,255,0.4)"
    strokeWidth="2"
    strokeLinecap="round"
  />
</Svg>
```

**Interaction States:**
- Idle: stroke opacity 0.4
- Hover: stroke opacity 0.8, scale 1.1×
- Press: scale 0.95×, red tint `rgba(239,68,68,0.6)`

**Touch Target:** 44×44px (larger than visual)

**Animation (on press):**
```tsx
Animated.sequence([
  Animated.timing(scale, { toValue: 0.9, duration: 100 }),
  Animated.spring(opacity, { toValue: 0, damping: 15 }),
]).start(() => onClose());
```

### 2.5 Title Text

**Typography:**
- Font size: 14px
- Font weight: 600 (semibold)
- Color: `Colors.text.primary` (#FFFFFF)
- Line height: 20px
- Text align: left

**Layout:**
- Flex: 1 (fills space between drag handle and close button)
- Padding: 0 12px (horizontal spacing from icons)
- Truncation: numberOfLines={1}, ellipsizeMode="tail"

---

## 3. REAL Physical Depth System

### 3.1 Multi-Layer Shadow Stack (CRITICAL)

**PROBLEM:** Single dark shadow is invisible on dark Canvas background (#060608)

**SOLUTION:** 3-layer shadow system with ambient blue glow

**Layer 1: Large Ambient Shadow (outer depth)**
- Offset: 0 12px (vertical only)
- Blur: 32px
- Color: `rgba(0,0,0,0.6)` (60% opacity — strong presence)
- Effect: Creates floating appearance, visible separation from canvas

**Layer 2: Sharp Contact Shadow (grounding)**
- Offset: 0 4px
- Blur: 16px
- Color: `rgba(0,0,0,0.8)` (80% opacity — very dark edge)
- Effect: Grounds widget to surface, prevents floating-in-space look

**Layer 3: Blue Ambient Glow (premium accent)**
- Offset: 0 0 (centered)
- Blur: 40px
- Color: `rgba(59,130,246,0.12)` (Canvas.accent.blue with low opacity)
- Effect: Subtle blue halo matching Aspire brand, premium feel

**Web Implementation (layered box-shadow):**
```tsx
const containerStyle = {
  boxShadow: [
    '0 12px 32px rgba(0,0,0,0.6)',      // Layer 1: Ambient
    '0 4px 16px rgba(0,0,0,0.8)',       // Layer 2: Contact
    '0 0 40px rgba(59,130,246,0.12)',   // Layer 3: Blue glow
  ].join(', '),
} as unknown as ViewStyle;
```

**Native Implementation (iOS/Android):**
```tsx
// Base shadow (Layer 1 + 2 combined)
shadowColor: '#000000',
shadowOffset: { width: 0, height: 8 },
shadowOpacity: 0.6,
shadowRadius: 24,
elevation: 8,

// Blue glow layer (separate View with absolute positioning)
<View style={{
  ...StyleSheet.absoluteFillObject,
  shadowColor: '#3B82F6',
  shadowOffset: { width: 0, height: 0 },
  shadowOpacity: 0.12,
  shadowRadius: 40,
  elevation: 0,
}} />
```

**CRITICAL:** Parent container MUST have `overflow: 'visible'` to allow shadows to extend beyond widget bounds.

### 3.2 Border Lighting System

**Main Border (structural edge):**
- Width: 1px
- Color: `rgba(255,255,255,0.15)` (15% white — visible but subtle)
- Effect: Defines widget edge, glass surface separation

**Top Edge Rim Light (glass surface illusion):**
- Width: 1px (inset)
- Color: `rgba(255,255,255,0.05)` (5% white — very subtle catch light)
- Position: Top 40% of widget (LinearGradient)
- Effect: Creates "light from above" realism, premium glass feel

**Bottom Edge Depth (shadow edge):**
- Width: 1px (inset)
- Color: `rgba(0,0,0,0.3)` (30% black — darker bottom edge)
- Position: Bottom edge
- Effect: Enhances 3D depth, prevents flat appearance

**Web Implementation (layered inset box-shadow):**
```tsx
const surfaceStyle = {
  border: '1px solid rgba(255,255,255,0.15)',
  boxShadow: [
    'inset 0 1px 0 rgba(255,255,255,0.05)',    // Top rim light
    'inset 0 -1px 0 rgba(0,0,0,0.3)',          // Bottom depth
    'inset 0 1px 3px rgba(0,0,0,0.2)',         // Inner shadow (subtle)
  ].join(', '),
} as unknown as ViewStyle;
```

**Native Implementation:**
```tsx
// Main border
borderWidth: 1,
borderColor: 'rgba(255,255,255,0.15)',

// Rim light (LinearGradient overlay in top 40%)
<LinearGradient
  colors={['rgba(255,255,255,0.05)', 'transparent']}
  locations={[0, 0.4]}
  style={{
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: '40%',
    borderTopLeftRadius: 12,
    borderTopRightRadius: 12,
    pointerEvents: 'none',
  }}
/>
```

### 3.3 Background Surface Treatment

**Base Color:**
- `Canvas.background.elevated` (#2A2A2A)
- Two-tone darker than header (#1E1E1E)
- Matches Authority Queue card exactly

**Inner Shadow (depth cueing):**
- Web only: `inset 0 1px 3px rgba(0,0,0,0.2)`
- Effect: Subtle recessed surface feel, not flat plane

**Subtle Gradient Overlay (optional premium polish):**
- Type: LinearGradient (vertical)
- Top: `rgba(255,255,255,0.02)` (2% lighter top edge)
- Bottom: `transparent`
- Effect: Very subtle "light from above" gradient, barely perceptible but adds richness

**Implementation:**
```tsx
// Base surface
<View style={{
  backgroundColor: Canvas.background.elevated, // #2A2A2A
  borderRadius: 12,
  overflow: 'hidden',
}}>
  {/* Optional gradient overlay */}
  <LinearGradient
    colors={['rgba(255,255,255,0.02)', 'transparent']}
    locations={[0, 0.5]}
    style={StyleSheet.absoluteFillObject}
    pointerEvents="none"
  />

  {children}
</View>
```

---

## 4. Premium Resize Handles

### 4.1 Handle Design (Custom SVG)

**NOT:** Emoji (⤡, ⇲, ◢)
**YES:** Custom SVG diagonal arrows

**Design:**
- 4 corner handles (top-left, top-right, bottom-left, bottom-right)
- Visual size: 12px × 12px
- Touch target: 32px × 32px (larger for easy grab)
- Color idle: `rgba(255,255,255,0.3)` (30% white — visible but subtle)
- Color hover: `rgba(59,130,246,0.8)` (blue brand accent)

**SVG Specification (bottom-right example):**
```tsx
<Svg width="12" height="12" viewBox="0 0 12 12">
  {/* Diagonal arrow pointing bottom-right */}
  <Path
    d="M2,10 L10,10 L10,2"
    stroke="rgba(255,255,255,0.3)"
    strokeWidth="1.5"
    strokeLinecap="round"
    strokeLinejoin="round"
    fill="none"
  />
  <Circle cx="10" cy="10" r="1.5" fill="rgba(255,255,255,0.3)" />
</Svg>
```

**Other Corners:**
- **Top-left:** Arrow pointing up-left (rotate 180°)
- **Top-right:** Arrow pointing up-right (rotate 90°)
- **Bottom-left:** Arrow pointing down-left (rotate -90°)
- **Bottom-right:** Arrow pointing down-right (0° — base)

### 4.2 Handle Positioning

**Corner Positions:**
```tsx
// Top-left
{ position: 'absolute', top: -6, left: -6 }

// Top-right
{ position: 'absolute', top: -6, right: -6 }

// Bottom-left
{ position: 'absolute', bottom: -6, left: -6 }

// Bottom-right
{ position: 'absolute', bottom: -6, right: -6 }
```

**CRITICAL:** Parent container MUST have `overflow: 'visible'` for handles to appear outside widget bounds.

### 4.3 Handle Interaction States

**Idle:**
- Opacity: 0.3
- Scale: 1.0
- Cursor: nwse-resize / nesw-resize (web only)

**Hover:**
- Opacity: 1.0
- Scale: 1.2× (spring animation)
- Stroke color: `rgba(59,130,246,0.8)` (blue glow)
- Glow: `0 0 8px rgba(59,130,246,0.4)`

**Dragging:**
- Opacity: 1.0
- Scale: 1.3×
- Stroke color: `rgba(59,130,246,1.0)` (full blue)
- Glow: `0 0 12px rgba(59,130,246,0.6)`

**Animation (hover → dragging):**
```tsx
Animated.spring(scale, {
  toValue: 1.2,
  damping: 22,
  stiffness: 280,
  mass: 0.9,
  useNativeDriver: true,
}).start();
```

### 4.4 Resize Constraints

**Minimum Size:**
- Width: 240px (prevent crushing content)
- Height: 180px (header 44px + content 136px min)

**Maximum Size:**
- Width: 800px (prevent overwhelming canvas)
- Height: 600px (viewport-relative, not hardcoded)

**Snap Behavior:**
- Grid snap: 8px increments (Canvas.workspace grid alignment)
- Spring snap to final size (no harsh stop)

---

## 5. Premium Animations

### 5.1 Entrance Animation (300ms delay stagger)

**Purpose:** Widgets appear in sequence, not all at once (prevents visual overwhelm)

**Timing:**
- Delay: `widgetIndex * 300ms` (300ms per widget)
- Duration: Spring physics (settles in ~400ms)
- Spring config:
  - damping: 22
  - stiffness: 280
  - mass: 0.9

**Animation Sequence:**
1. Initial state: `opacity: 0`, `scale: 0.9`, `translateY: 20`
2. Animate to: `opacity: 1`, `scale: 1.0`, `translateY: 0`

**Implementation:**
```tsx
const entranceAnimation = () => {
  Animated.parallel([
    Animated.spring(opacity, {
      toValue: 1,
      damping: 22,
      stiffness: 280,
      mass: 0.9,
      useNativeDriver: true,
    }),
    Animated.spring(scale, {
      toValue: 1,
      damping: 22,
      stiffness: 280,
      mass: 0.9,
      useNativeDriver: true,
    }),
    Animated.spring(translateY, {
      toValue: 0,
      damping: 22,
      stiffness: 280,
      mass: 0.9,
      useNativeDriver: true,
    }),
  ]).start();
};

// Trigger with delay
setTimeout(() => entranceAnimation(), widgetIndex * 300);
```

### 5.2 Resize Animation

**Purpose:** Smooth spring snap to size constraints, not harsh linear resize

**Constraints:**
- Min/max width/height enforced
- Snaps to 8px grid increments
- Spring physics for organic feel

**Implementation:**
```tsx
const snapToGrid = (value: number, gridSize: number = 8) => {
  return Math.round(value / gridSize) * gridSize;
};

const animateResize = (newWidth: number, newHeight: number) => {
  const snappedWidth = snapToGrid(
    Math.max(240, Math.min(800, newWidth))
  );
  const snappedHeight = snapToGrid(
    Math.max(180, Math.min(600, newHeight))
  );

  Animated.spring(width, {
    toValue: snappedWidth,
    damping: 22,
    stiffness: 280,
    mass: 0.9,
    useNativeDriver: false, // Layout properties
  }).start();

  Animated.spring(height, {
    toValue: snappedHeight,
    damping: 22,
    stiffness: 280,
    mass: 0.9,
    useNativeDriver: false,
  }).start();
};
```

### 5.3 Drag Animation

**Purpose:** Widget follows cursor with momentum physics, not 1:1 rigid tracking

**Behavior:**
- Immediate response (no lag)
- Slight momentum on release (overshoots 2-3px, springs back)
- Shadow intensifies during drag (depth cue)

**Implementation (react-native-gesture-handler + reanimated):**
```tsx
import { Gesture } from 'react-native-gesture-handler';
import Animated, { useSharedValue, useAnimatedStyle, withSpring } from 'react-native-reanimated';

const translateX = useSharedValue(0);
const translateY = useSharedValue(0);

const dragGesture = Gesture.Pan()
  .onUpdate((e) => {
    translateX.value = e.translationX;
    translateY.value = e.translationY;
  })
  .onEnd(() => {
    // Spring back if out of bounds, or settle with momentum
    translateX.value = withSpring(snapToGrid(translateX.value), {
      damping: 22,
      stiffness: 280,
      mass: 0.9,
    });
    translateY.value = withSpring(snapToGrid(translateY.value), {
      damping: 22,
      stiffness: 280,
      mass: 0.9,
    });
  });

const animatedStyle = useAnimatedStyle(() => ({
  transform: [
    { translateX: translateX.value },
    { translateY: translateY.value },
  ],
}));
```

**Shadow Intensification (during drag):**
```tsx
const dragShadowStyle = {
  shadowRadius: 60, // Increased from 32
  shadowOpacity: 1.0, // Increased from 0.6
  shadowOffset: { width: 0, height: 16 }, // Larger offset
};
```

### 5.4 Close Animation (250ms exit)

**Purpose:** Widget gracefully disappears, not harsh pop-out

**Animation Sequence:**
1. Scale down to 0
2. Fade opacity to 0
3. Remove from layout after animation completes

**Implementation:**
```tsx
const closeAnimation = () => {
  Animated.parallel([
    Animated.timing(scale, {
      toValue: 0,
      duration: 250,
      easing: Easing.in(Easing.ease),
      useNativeDriver: true,
    }),
    Animated.timing(opacity, {
      toValue: 0,
      duration: 250,
      easing: Easing.in(Easing.ease),
      useNativeDriver: true,
    }),
  ]).start(() => {
    // Remove widget from state/layout
    onRemove();
  });
};
```

### 5.5 60fps Animation Requirements

**CRITICAL:** All animations MUST run at 60fps for premium feel

**Enforced via:**
- `useNativeDriver: true` for transform/opacity animations (runs on native thread)
- `useNativeDriver: false` only for layout properties (width/height)
- react-native-reanimated for drag gestures (native thread)
- No JavaScript-based `setInterval` animations
- No layout thrashing (batch reads/writes)

---

## 6. Authority Queue Card Matching

### 6.1 Exact Visual Parity Requirements

**Color Palette (MUST MATCH):**
- Header background: #1E1E1E (Canvas.background.surface)
- Content background: #2A2A2A (Canvas.background.elevated)
- Border: rgba(255,255,255,0.15)
- Text primary: #FFFFFF
- Text secondary: #d1d1d6
- Accent blue: #3B82F6

**Shadow Depth (MUST MATCH):**
- Authority Queue uses Card component with `variant="elevated"`
- Card component does NOT have visible shadows (mobile pattern)
- WidgetContainer MUST add premium desktop shadows (3-layer system)

**Border Treatment (MUST MATCH):**
- Authority Queue: 1px solid Colors.border.subtle
- WidgetContainer: 1px solid rgba(255,255,255,0.15) + rim lighting

**Premium Glass Feel (NEW FOR WIDGETS):**
- Authority Queue: flat surface
- WidgetContainer: glass morphism with rim lighting + inner shadow

**WHY THE DIFFERENCE:**
- Authority Queue = mobile-first card (static list item)
- WidgetContainer = desktop Canvas widget (draggable, resizable, floating)
- Widgets need DEEPER shadows (visible floating above canvas)
- Widgets need RIM LIGHTING (glass surface illusion)

### 6.2 What NOT to Match

**Mobile Patterns (Skip These):**
- Authority Queue uses `elevation` prop (Android only)
- Authority Queue has no resize handles
- Authority Queue has no drag handle
- Authority Queue uses flat Card component

**Desktop-Specific Additions:**
- Multi-layer web shadows (visible on dark canvas)
- Resize handles (4 corners)
- Drag handle in header
- Glass morphism surface treatment
- Blue glow accent shadows

---

## 7. Accessibility Requirements

### 7.1 Minimum Tap Targets (44×44px)

**All Interactive Elements:**
- Drag handle: 44×44px (visual 14×9px, padded hit area)
- Close button: 44×44px (visual 16×16px, padded hit area)
- Resize handles: 32×32px each corner (visual 12×12px, acceptable for corners)

**Implementation:**
```tsx
<Pressable
  style={{
    width: 44,
    height: 44,
    alignItems: 'center',
    justifyContent: 'center',
  }}
  hitSlop={{ top: 4, right: 4, bottom: 4, left: 4 }}
  accessibilityRole="button"
  accessibilityLabel="Close widget"
>
  <Svg width="16" height="16"> {/* Visual icon */}
    {/* ... */}
  </Svg>
</Pressable>
```

### 7.2 Accessibility Labels

**Drag Handle:**
```tsx
accessibilityRole="button"
accessibilityLabel={`Drag ${widgetTitle} widget`}
accessibilityHint="Double tap and hold to drag"
```

**Close Button:**
```tsx
accessibilityRole="button"
accessibilityLabel={`Close ${widgetTitle} widget`}
accessibilityHint="Double tap to close"
```

**Resize Handles:**
```tsx
accessibilityRole="adjustable"
accessibilityLabel={`Resize ${widgetTitle} widget from ${corner} corner`}
accessibilityHint="Double tap and drag to resize"
```

**Widget Container:**
```tsx
accessibilityRole="region"
accessibilityLabel={widgetTitle}
```

### 7.3 Keyboard Navigation (Web)

**Tab Order:**
1. Drag handle (focusable)
2. Widget content (depends on content)
3. Close button (focusable)

**Keyboard Shortcuts:**
- **Escape:** Close widget (when focused)
- **Arrow keys:** Move widget by 8px increments (when drag handle focused)
- **Shift + Arrow keys:** Move widget by 1px increments (fine control)

**Focus Ring:**
```tsx
const focusRingStyle = {
  outlineWidth: 2,
  outlineStyle: 'solid',
  outlineColor: '#3B82F6',
  outlineOffset: 2,
} as unknown as ViewStyle;
```

### 7.4 Reduced Motion Support

**Detection:**
```tsx
import { useReducedMotion } from 'react-native-reanimated';

const reducedMotion = useReducedMotion();
```

**Animation Behavior:**
- If `reducedMotion === true`:
  - Skip entrance spring animations (instant opacity 1, scale 1)
  - Skip resize spring animations (instant snap to size)
  - Skip close spring animations (instant remove)
  - Keep drag behavior (functional, not decorative)

**Implementation:**
```tsx
const entranceConfig = reducedMotion
  ? { duration: 0 } // Instant
  : { damping: 22, stiffness: 280, mass: 0.9 }; // Spring

Animated.spring(opacity, {
  toValue: 1,
  ...entranceConfig,
  useNativeDriver: true,
}).start();
```

---

## 8. Design Tokens (New Additions)

### 8.1 Widget-Specific Tokens

**Add to `Canvas` namespace in `constants/tokens.ts`:**

```typescript
export const Canvas = {
  // ... existing tokens ...

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
      colors: ['rgba(59,130,246,0.0)', 'rgba(59,130,246,0.4)', 'rgba(59,130,246,0.0)'],
      locations: [0, 0.5, 1],
    },

    /** Multi-layer shadow system */
    shadow: {
      // Layer 1: Ambient
      ambient: {
        offset: { width: 0, height: 12 },
        blur: 32,
        color: 'rgba(0,0,0,0.6)',
      },
      // Layer 2: Contact
      contact: {
        offset: { width: 0, height: 4 },
        blur: 16,
        color: 'rgba(0,0,0,0.8)',
      },
      // Layer 3: Blue glow
      glow: {
        offset: { width: 0, height: 0 },
        blur: 40,
        color: 'rgba(59,130,246,0.12)',
      },
      // Web box-shadow string (all 3 layers)
      web: '0 12px 32px rgba(0,0,0,0.6), 0 4px 16px rgba(0,0,0,0.8), 0 0 40px rgba(59,130,246,0.12)',
      // Dragging state (intensified)
      webDragging: '0 16px 60px rgba(0,0,0,1.0), 0 8px 24px rgba(0,0,0,0.9), 0 0 48px rgba(59,130,246,0.2)',
    },

    /** Drag handle */
    dragHandle: {
      width: 14,
      height: 9,
      dotSize: 2,
      dotSpacing: { x: 4, y: 3 },
      colorIdle: 'rgba(255,255,255,0.3)',
      colorHover: 'rgba(255,255,255,0.6)',
      colorDragging: 'rgba(59,130,246,0.6)',
    },

    /** Close button */
    closeButton: {
      iconSize: 16,
      strokeWidth: 2,
      colorIdle: 'rgba(255,255,255,0.4)',
      colorHover: 'rgba(255,255,255,0.8)',
      colorPress: 'rgba(239,68,68,0.6)', // Red tint on press
    },

    /** Resize handles */
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

    /** Size constraints */
    minWidth: 240,
    minHeight: 180,
    maxWidth: 800,
    maxHeight: 600,

    /** Grid snap increment */
    gridSnap: 8,

    /** Entrance stagger delay (ms per widget) */
    entranceDelay: 300,

    /** Animation spring config */
    spring: {
      damping: 22,
      stiffness: 280,
      mass: 0.9,
    },
  },
} as const;
```

---

## 9. Visual Comparison

### 9.1 Generic Box (BEFORE) — What NOT to Build

```
┌────────────────────────────┐
│ × Widget Title             │ ← Emoji close button (cheap)
├────────────────────────────┤ ← Single flat border (no depth)
│                            │
│  Content                   │ ← Flat background (boring)
│                            │
└────────────────────────────┘
  ↑ Single shadow (invisible on dark background)
```

**Problems:**
- Emoji icons (unprofessional, inconsistent across platforms)
- Single flat border (no glass surface illusion)
- Single shadow (invisible on dark canvas background)
- Flat background (no depth, looks like generic div)
- No rim lighting (missing premium glass feel)

### 9.2 $10K Premium Container (AFTER) — What TO Build

```
     ╔════════════════════════════════╗
     ║ [••] Widget Title          [×] ║ ← Custom SVG icons
     ╠════════════════════════════════╣ ← Blue gradient border
     ║                                ║
  ◢  ║  Content with rim lighting     ║  ◣ ← Resize handles
     ║  Multi-layer shadows           ║    (custom SVG)
     ║  Glass surface treatment       ║
  ◥  ║                                ║  ◤
     ╚════════════════════════════════╝
        ↑ 3-layer shadow system + blue glow
```

**Features:**
- Custom SVG icons (professional, consistent, scalable)
- Layered border + rim lighting (glass surface illusion)
- 3-layer shadow system (visible on dark background)
- Two-tone background (depth separation)
- Blue accent glow (premium brand integration)

---

## 10. Implementation Checklist

### Phase 1: Core Structure
- [ ] Create `WidgetContainer.tsx` component
- [ ] Implement two-tone header (44px height)
- [ ] Create custom SVG drag handle (6 dots, 2×3 grid)
- [ ] Create custom SVG close button (rounded X)
- [ ] Add blue gradient header border (LinearGradient)

### Phase 2: Depth System
- [ ] Implement 3-layer shadow system (ambient + contact + blue glow)
- [ ] Add border lighting (main border + rim light + depth edge)
- [ ] Add background surface treatment (base + inner shadow + gradient)
- [ ] Verify shadows visible on dark Canvas background (#060608)
- [ ] Ensure `overflow: 'visible'` on container (shadows extend beyond bounds)

### Phase 3: Resize Handles
- [ ] Create custom SVG resize handles (4 corners)
- [ ] Position handles outside widget bounds (-6px offset)
- [ ] Implement hover states (blue glow, scale 1.2×)
- [ ] Wire up resize gesture handlers (react-native-gesture-handler)
- [ ] Add size constraints (min/max width/height)
- [ ] Implement grid snap (8px increments)

### Phase 4: Animations
- [ ] Entrance animation (spring + stagger 300ms per widget)
- [ ] Resize animation (spring snap to constraints)
- [ ] Drag animation (momentum physics, shadow intensify)
- [ ] Close animation (scale 0 + fade out over 250ms)
- [ ] Verify 60fps (useNativeDriver: true for transform/opacity)

### Phase 5: Accessibility
- [ ] Add accessibilityRole + accessibilityLabel to all interactive elements
- [ ] Ensure 44×44px tap targets (drag handle, close button)
- [ ] Implement keyboard navigation (Tab order, Escape to close)
- [ ] Add focus ring styling (2px blue outline)
- [ ] Implement reduced motion support (skip springs if enabled)

### Phase 6: Design Tokens
- [ ] Add `Canvas.widget` namespace to tokens.ts
- [ ] Move all magic numbers to tokens (colors, sizes, spring configs)
- [ ] Document token usage in component
- [ ] Verify token consistency with Authority Queue

### Phase 7: Quality Verification
- [ ] Visual comparison with Authority Queue card (color parity)
- [ ] Test on dark Canvas background (shadows visible?)
- [ ] Test on multiple screen sizes (responsive layout)
- [ ] Test reduced motion mode (animations disabled)
- [ ] Test keyboard navigation (Tab, Escape, Arrow keys)
- [ ] Test screen reader announcements (VoiceOver/TalkBack)

---

## 11. Success Criteria

**Visual Quality:**
- ✅ Shadows visible and prominent on dark Canvas background (#060608)
- ✅ Glass surface illusion (rim lighting + inner shadow)
- ✅ Two-tone header/content separation (matches Authority Queue)
- ✅ Professional custom icons (NOT emoji)
- ✅ Premium feel (Bloomberg Terminal level polish)

**Interaction Quality:**
- ✅ Smooth 60fps animations (spring physics, no jank)
- ✅ Responsive drag/resize (momentum, grid snap)
- ✅ Clear affordances (hover states, cursor changes)
- ✅ Keyboard accessible (Tab navigation, Escape to close)

**Code Quality:**
- ✅ All magic numbers tokenized (no hardcoded values)
- ✅ Platform-specific implementations (web shadows vs native)
- ✅ Reduced motion support (accessibility)
- ✅ TypeScript strict mode (no any types)

**Consistency:**
- ✅ Matches Authority Queue card color palette exactly
- ✅ Uses established Canvas tokens (motion, depth, colors)
- ✅ Follows Aspire design system (spacing, typography, shadows)

---

## 12. Reference Files

**Authority Queue Card:**
- `Aspire-desktop/components/AuthorityQueueCard.tsx` (two-tone color palette)
- `Aspire-desktop/components/ui/Card.tsx` (elevated variant pattern)

**Design Tokens:**
- `Aspire-desktop/constants/tokens.ts` (Canvas namespace, Colors, Shadows)

**Canvas Components:**
- `Aspire-desktop/components/canvas/CanvasWorkspace.tsx` (depth system reference)
- `Aspire-desktop/components/canvas/AgentAvatar.tsx` (premium depth layers, rim lighting)

**Animation Patterns:**
- `Aspire-desktop/components/canvas/CanvasToggle.tsx` (spring animations)

---

## Final Notes

**This is NOT a generic React component.** This is a $10,000 premium agency build with REAL physical depth, premium glass morphism, and Bloomberg Terminal-level polish.

**CRITICAL SUCCESS FACTORS:**
1. **Multi-layer shadows** — 3 layers (ambient + contact + blue glow) make shadows visible on dark background
2. **Rim lighting** — Top edge catch light creates glass surface illusion
3. **Custom SVG icons** — No emoji, professional scalable icons
4. **Spring physics** — Organic animations (damping 22, stiffness 280)
5. **Two-tone palette** — Header #1E1E1E, Content #2A2A2A (matches Authority Queue)

**Quality bar:** When users see this widget container, they should think "this is professional software" not "this is a web app."

**Ship it when it feels premium, sleek, smooth, and seamless.**
