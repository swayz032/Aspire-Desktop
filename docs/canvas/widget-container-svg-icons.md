# WidgetContainer Custom SVG Icons — Complete Specifications

**Quality Standard:** Professional, scalable, consistent across all platforms. NO EMOJI.

---

## 1. Drag Handle SVG (6 Dots, 2×3 Grid)

### Visual Design

```
  •   •   •     ← Row 1 (y: 2px)
  •   •   •     ← Row 2 (y: 7px)

  ↑   ↑   ↑
  x:  x:  x:
  2   7   12
```

### Full SVG Code

```tsx
import Svg, { Circle } from 'react-native-svg';

interface DragHandleProps {
  color?: string;
  opacity?: number;
}

export function DragHandleSVG({
  color = 'rgba(255,255,255,0.3)',
  opacity = 1
}: DragHandleProps) {
  return (
    <Svg width="14" height="9" viewBox="0 0 14 9">
      {/* Row 1 */}
      <Circle cx="2" cy="2" r="1" fill={color} opacity={opacity} />
      <Circle cx="7" cy="2" r="1" fill={color} opacity={opacity} />
      <Circle cx="12" cy="2" r="1" fill={color} opacity={opacity} />

      {/* Row 2 */}
      <Circle cx="2" cy="7" r="1" fill={color} opacity={opacity} />
      <Circle cx="7" cy="7" r="1" fill={color} opacity={opacity} />
      <Circle cx="12" cy="7" r="1" fill={color} opacity={opacity} />
    </Svg>
  );
}
```

### Interactive States

```tsx
import { Pressable, StyleSheet } from 'react-native';
import Animated, { useSharedValue, useAnimatedProps, withSpring } from 'react-native-reanimated';

const AnimatedSvg = Animated.createAnimatedComponent(Svg);

function AnimatedDragHandle() {
  const opacity = useSharedValue(0.3);

  const animatedProps = useAnimatedProps(() => ({
    opacity: opacity.value,
  }));

  const handlePressIn = () => {
    opacity.value = withSpring(0.8, { damping: 22, stiffness: 280 });
  };

  const handlePressOut = () => {
    opacity.value = withSpring(0.3, { damping: 22, stiffness: 280 });
  };

  return (
    <Pressable
      style={styles.dragHandleContainer}
      onPressIn={handlePressIn}
      onPressOut={handlePressOut}
      accessibilityRole="button"
      accessibilityLabel="Drag widget"
      accessibilityHint="Double tap and hold to drag"
    >
      <AnimatedSvg
        width="14"
        height="9"
        viewBox="0 0 14 9"
        animatedProps={animatedProps}
      >
        {/* Row 1 */}
        <Circle cx="2" cy="2" r="1" fill="white" />
        <Circle cx="7" cy="2" r="1" fill="white" />
        <Circle cx="12" cy="2" r="1" fill="white" />

        {/* Row 2 */}
        <Circle cx="2" cy="7" r="1" fill="white" />
        <Circle cx="7" cy="7" r="1" fill="white" />
        <Circle cx="12" cy="7" r="1" fill="white" />
      </AnimatedSvg>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  dragHandleContainer: {
    width: 44,
    height: 44,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
```

### Color States

| State | Color | Opacity | Notes |
|-------|-------|---------|-------|
| Idle | `rgba(255,255,255,0.3)` | 1.0 | Subtle, visible but not dominant |
| Hover | `rgba(255,255,255,0.6)` | 1.0 | Brighter, clear affordance |
| Dragging | `rgba(59,130,246,0.6)` | 1.0 | Blue tint, active state |

---

## 2. Close Button SVG (Rounded X)

### Visual Design

```
    ╲     ╱      ← Top-left to bottom-right
     ╲   ╱
      ╲ ╱
      ╱ ╲
     ╱   ╲
    ╱     ╲      ← Top-right to bottom-left
```

### Full SVG Code

```tsx
import Svg, { Path } from 'react-native-svg';

interface CloseButtonProps {
  color?: string;
  strokeWidth?: number;
  size?: number;
}

export function CloseButtonSVG({
  color = 'rgba(255,255,255,0.4)',
  strokeWidth = 2,
  size = 16
}: CloseButtonProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 16 16">
      <Path
        d="M4,4 L12,12 M12,4 L4,12"
        stroke={color}
        strokeWidth={strokeWidth}
        strokeLinecap="round"
      />
    </Svg>
  );
}
```

### Interactive States

```tsx
import { Pressable, StyleSheet } from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  useAnimatedProps,
  withSpring,
  withTiming,
  withSequence,
} from 'react-native-reanimated';

const AnimatedSvg = Animated.createAnimatedComponent(Svg);
const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

function AnimatedCloseButton({ onPress }: { onPress: () => void }) {
  const scale = useSharedValue(1);
  const opacity = useSharedValue(0.4);

  const animatedContainerStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
  }));

  const animatedPathProps = useAnimatedProps(() => ({
    stroke: opacity.value > 0.6
      ? 'rgba(255,255,255,0.8)'
      : 'rgba(255,255,255,0.4)',
  }));

  const handlePressIn = () => {
    scale.value = withSpring(0.95, { damping: 22, stiffness: 280 });
    opacity.value = withTiming(0.8, { duration: 100 });
  };

  const handlePressOut = () => {
    scale.value = withSpring(1, { damping: 22, stiffness: 280 });
    opacity.value = withTiming(0.4, { duration: 100 });
  };

  const handlePress = () => {
    // Scale down animation
    scale.value = withSequence(
      withTiming(0.9, { duration: 100 }),
      withTiming(0, { duration: 150 })
    );

    // Fade out animation
    opacity.value = withTiming(0, { duration: 250 });

    // Trigger close callback after animation
    setTimeout(onPress, 250);
  };

  return (
    <AnimatedPressable
      style={[styles.closeButtonContainer, animatedContainerStyle]}
      onPressIn={handlePressIn}
      onPressOut={handlePressOut}
      onPress={handlePress}
      accessibilityRole="button"
      accessibilityLabel="Close widget"
      accessibilityHint="Double tap to close"
    >
      <AnimatedSvg width="16" height="16" viewBox="0 0 16 16">
        <Path
          d="M4,4 L12,12 M12,4 L4,12"
          strokeWidth="2"
          strokeLinecap="round"
          animatedProps={animatedPathProps}
        />
      </AnimatedSvg>
    </AnimatedPressable>
  );
}

const styles = StyleSheet.create({
  closeButtonContainer: {
    width: 44,
    height: 44,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
```

### Color States

| State | Stroke Color | Scale | Notes |
|-------|--------------|-------|-------|
| Idle | `rgba(255,255,255,0.4)` | 1.0 | Subtle, non-intrusive |
| Hover | `rgba(255,255,255,0.8)` | 1.1 | Bright, clear affordance |
| Press | `rgba(239,68,68,0.6)` | 0.95 | Red tint (destructive action) |
| Closing | `rgba(255,255,255,0.0)` | 0 → 0 | Fade out during close animation |

---

## 3. Resize Handles SVG (4 Corners)

### Visual Design (Bottom-Right Example)

```
          ─────►     ← Horizontal line
          │
          │
          ▼          ← Vertical line
          ●          ← Dot at corner
```

### Base SVG Code (Bottom-Right)

```tsx
import Svg, { Path, Circle } from 'react-native-svg';

interface ResizeHandleProps {
  corner: 'top-left' | 'top-right' | 'bottom-left' | 'bottom-right';
  color?: string;
  strokeWidth?: number;
  size?: number;
}

export function ResizeHandleSVG({
  corner,
  color = 'rgba(255,255,255,0.3)',
  strokeWidth = 1.5,
  size = 12
}: ResizeHandleProps) {
  // Base path for bottom-right (0° rotation)
  const getPath = () => {
    switch (corner) {
      case 'bottom-right':
        return "M2,10 L10,10 L10,2";
      case 'top-left':
        return "M10,2 L2,2 L2,10"; // 180° rotation
      case 'top-right':
        return "M2,2 L10,2 L10,10"; // 90° rotation
      case 'bottom-left':
        return "M10,10 L2,10 L2,2"; // -90° rotation
    }
  };

  const getDotPosition = () => {
    switch (corner) {
      case 'bottom-right':
        return { cx: 10, cy: 10 };
      case 'top-left':
        return { cx: 2, cy: 2 };
      case 'top-right':
        return { cx: 10, cy: 2 };
      case 'bottom-left':
        return { cx: 2, cy: 10 };
    }
  };

  const dotPos = getDotPosition();

  return (
    <Svg width={size} height={size} viewBox="0 0 12 12">
      <Path
        d={getPath()}
        stroke={color}
        strokeWidth={strokeWidth}
        strokeLinecap="round"
        strokeLinejoin="round"
        fill="none"
      />
      <Circle
        cx={dotPos.cx}
        cy={dotPos.cy}
        r="1.5"
        fill={color}
      />
    </Svg>
  );
}
```

### Interactive States (Single Handle)

```tsx
import { Pressable, StyleSheet } from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  useAnimatedProps,
  withSpring,
} from 'react-native-reanimated';

const AnimatedSvg = Animated.createAnimatedComponent(Svg);
const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

function AnimatedResizeHandle({
  corner,
  onDrag
}: {
  corner: ResizeHandleProps['corner'],
  onDrag: (dx: number, dy: number) => void
}) {
  const scale = useSharedValue(1);
  const opacity = useSharedValue(0.3);

  const animatedContainerStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
  }));

  const animatedPathProps = useAnimatedProps(() => ({
    stroke: opacity.value > 0.6
      ? 'rgba(59,130,246,0.8)' // Blue on hover
      : 'rgba(255,255,255,0.3)', // White idle
  }));

  const handlePressIn = () => {
    scale.value = withSpring(1.2, { damping: 22, stiffness: 280 });
    opacity.value = withSpring(0.8, { damping: 22, stiffness: 280 });
  };

  const handlePressOut = () => {
    scale.value = withSpring(1, { damping: 22, stiffness: 280 });
    opacity.value = withSpring(0.3, { damping: 22, stiffness: 280 });
  };

  return (
    <AnimatedPressable
      style={[styles.resizeHandleContainer, animatedContainerStyle]}
      onPressIn={handlePressIn}
      onPressOut={handlePressOut}
      accessibilityRole="adjustable"
      accessibilityLabel={`Resize from ${corner} corner`}
      accessibilityHint="Double tap and drag to resize"
    >
      <AnimatedSvg width="12" height="12" viewBox="0 0 12 12">
        <Path
          d="M2,10 L10,10 L10,2"
          strokeWidth="1.5"
          strokeLinecap="round"
          strokeLinejoin="round"
          fill="none"
          animatedProps={animatedPathProps}
        />
        <Circle
          cx="10"
          cy="10"
          r="1.5"
          animatedProps={animatedPathProps}
        />
      </AnimatedSvg>
    </AnimatedPressable>
  );
}

const styles = StyleSheet.create({
  resizeHandleContainer: {
    width: 32,
    height: 32,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
```

### Color States

| State | Color | Scale | Glow | Notes |
|-------|-------|-------|------|-------|
| Idle | `rgba(255,255,255,0.3)` | 1.0 | None | Subtle, visible but not dominant |
| Hover | `rgba(59,130,246,0.8)` | 1.2 | `0 0 8px rgba(59,130,246,0.4)` | Blue brand accent, clear affordance |
| Dragging | `rgba(59,130,246,1.0)` | 1.3 | `0 0 12px rgba(59,130,246,0.6)` | Full blue, strong active state |

### Positioning (All 4 Corners)

```tsx
// Top-left
<View style={{
  position: 'absolute',
  top: -6,
  left: -6,
}}>
  <ResizeHandleSVG corner="top-left" />
</View>

// Top-right
<View style={{
  position: 'absolute',
  top: -6,
  right: -6,
}}>
  <ResizeHandleSVG corner="top-right" />
</View>

// Bottom-left
<View style={{
  position: 'absolute',
  bottom: -6,
  left: -6,
}}>
  <ResizeHandleSVG corner="bottom-left" />
</View>

// Bottom-right
<View style={{
  position: 'absolute',
  bottom: -6,
  right: -6,
}}>
  <ResizeHandleSVG corner="bottom-right" />
</View>
```

**CRITICAL:** Parent container MUST have `overflow: 'visible'` for handles to appear outside widget bounds.

---

## 4. Complete Component Integration

### Combined WidgetContainer Header

```tsx
import { View, Text, Pressable, StyleSheet } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Canvas } from '@/constants/tokens';
import { DragHandleSVG } from './DragHandleSVG';
import { CloseButtonSVG } from './CloseButtonSVG';

interface WidgetHeaderProps {
  title: string;
  onDrag?: () => void;
  onClose?: () => void;
}

export function WidgetHeader({ title, onDrag, onClose }: WidgetHeaderProps) {
  return (
    <>
      <View style={styles.header}>
        <Pressable
          style={styles.dragHandleContainer}
          onPress={onDrag}
          accessibilityRole="button"
          accessibilityLabel={`Drag ${title} widget`}
        >
          <DragHandleSVG />
        </Pressable>

        <Text style={styles.title} numberOfLines={1}>
          {title}
        </Text>

        <Pressable
          style={styles.closeButtonContainer}
          onPress={onClose}
          accessibilityRole="button"
          accessibilityLabel={`Close ${title} widget`}
        >
          <CloseButtonSVG />
        </Pressable>
      </View>

      <LinearGradient
        colors={Canvas.widget.borderGradient.colors}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 0 }}
        style={styles.headerBorder}
      />
    </>
  );
}

const styles = StyleSheet.create({
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    height: Canvas.widget.headerHeight,
    backgroundColor: Canvas.widget.headerBg,
    paddingHorizontal: 12,
    gap: 12,
  },
  dragHandleContainer: {
    width: 44,
    height: 44,
    alignItems: 'center',
    justifyContent: 'center',
  },
  title: {
    flex: 1,
    fontSize: 14,
    fontWeight: '600',
    color: '#FFFFFF',
    lineHeight: 20,
  },
  closeButtonContainer: {
    width: 44,
    height: 44,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerBorder: {
    height: 1,
    width: '100%',
  },
});
```

---

## 5. Web-Specific Enhancements

### CSS Cursor Changes (Web Only)

```tsx
import { Platform } from 'react-native';

const webCursorStyles = Platform.OS === 'web' ? {
  dragHandle: { cursor: 'grab' } as any,
  dragHandleActive: { cursor: 'grabbing' } as any,
  closeButton: { cursor: 'pointer' } as any,
  resizeHandleNWSE: { cursor: 'nwse-resize' } as any, // Top-left, bottom-right
  resizeHandleNESW: { cursor: 'nesw-resize' } as any, // Top-right, bottom-left
} : {};
```

### Glow Effects (Web Only)

```tsx
const webGlowStyles = Platform.OS === 'web' ? {
  resizeHandleHover: {
    filter: 'drop-shadow(0 0 8px rgba(59,130,246,0.4))',
  } as any,
  resizeHandleDragging: {
    filter: 'drop-shadow(0 0 12px rgba(59,130,246,0.6))',
  } as any,
} : {};
```

---

## 6. Accessibility Enhancements

### Screen Reader Announcements

```tsx
import { AccessibilityInfo } from 'react-native';

// Announce widget state changes
const announceResize = (width: number, height: number) => {
  AccessibilityInfo.announceForAccessibility(
    `Widget resized to ${width} by ${height} pixels`
  );
};

const announceMove = (x: number, y: number) => {
  AccessibilityInfo.announceForAccessibility(
    `Widget moved to position ${x}, ${y}`
  );
};

const announceClose = (title: string) => {
  AccessibilityInfo.announceForAccessibility(
    `${title} widget closed`
  );
};
```

### Focus Management

```tsx
import { useRef, useEffect } from 'react';

function WidgetContainer({ title, autoFocus }: { title: string, autoFocus?: boolean }) {
  const closeButtonRef = useRef<Pressable>(null);

  useEffect(() => {
    if (autoFocus && Platform.OS === 'web') {
      // Auto-focus close button for keyboard users
      (closeButtonRef.current as any)?.focus();
    }
  }, [autoFocus]);

  return (
    <View>
      {/* ... */}
      <Pressable ref={closeButtonRef}>
        <CloseButtonSVG />
      </Pressable>
    </View>
  );
}
```

---

## 7. Performance Optimizations

### Memoization

```tsx
import React, { memo } from 'react';

// Memoize SVG components (expensive to re-render)
export const DragHandleSVG = memo(DragHandleSVGBase);
export const CloseButtonSVG = memo(CloseButtonSVGBase);
export const ResizeHandleSVG = memo(ResizeHandleSVGBase);
```

### Native Driver (Transform/Opacity Only)

```tsx
// ✅ GOOD: Transform/opacity on native thread
Animated.spring(scale, {
  toValue: 1.2,
  useNativeDriver: true, // 60fps
}).start();

// ❌ BAD: Color changes cannot use native driver
Animated.timing(strokeColor, {
  toValue: 'rgba(59,130,246,0.8)',
  useNativeDriver: true, // ERROR: color not supported
}).start();

// ✅ GOOD: Use conditional color based on animated opacity
const animatedPathProps = useAnimatedProps(() => ({
  stroke: opacity.value > 0.6
    ? 'rgba(59,130,246,0.8)'
    : 'rgba(255,255,255,0.3)',
}));
```

---

## 8. Testing Checklist

### Visual Tests
- [ ] Drag handle: 6 dots, 2×3 grid, correct spacing
- [ ] Close button: Rounded X, 2px stroke, correct size
- [ ] Resize handles: 4 corners, diagonal arrows, correct rotation
- [ ] All icons scale correctly on different screen densities
- [ ] Colors match design tokens exactly

### Interaction Tests
- [ ] Drag handle: Hover → opacity increases, cursor changes (web)
- [ ] Close button: Press → red tint, scale down, fade out
- [ ] Resize handles: Hover → blue glow, scale 1.2×
- [ ] All tap targets ≥ 44×44px (accessibility)

### Accessibility Tests
- [ ] Screen reader announces all interactive elements
- [ ] Keyboard navigation works (Tab, Enter, Escape)
- [ ] Focus rings visible on all interactive elements
- [ ] Reduced motion: Animations disabled, icons still functional

### Platform Tests
- [ ] iOS: Native shadows render correctly
- [ ] Android: Elevation fallback works
- [ ] Web: CSS cursor changes, glow effects render
- [ ] All platforms: SVG icons render identically

---

## 9. Common Issues & Solutions

### Issue 1: SVG Icons Look Blurry on High-DPI Screens

**Problem:** SVG viewBox doesn't scale correctly

**Solution:** Use `preserveAspectRatio="xMidYMid meet"`

```tsx
<Svg
  width="14"
  height="9"
  viewBox="0 0 14 9"
  preserveAspectRatio="xMidYMid meet" // Add this
>
  {/* ... */}
</Svg>
```

### Issue 2: Touch Targets Too Small (Accessibility Violation)

**Problem:** Visual icon 12×12px, touch target only 12×12px

**Solution:** Wrap in larger Pressable with padding

```tsx
<Pressable
  style={{
    width: 44,
    height: 44,
    alignItems: 'center',
    justifyContent: 'center',
  }}
>
  <Svg width="12" height="12"> {/* Visual icon */}
    {/* ... */}
  </Svg>
</Pressable>
```

### Issue 3: Resize Handles Not Visible Outside Widget

**Problem:** Parent container has `overflow: 'hidden'`

**Solution:** Set `overflow: 'visible'` on widget container

```tsx
<View style={{
  overflow: 'visible', // CRITICAL for resize handles
}}>
  {/* Widget content */}
  <View style={{ position: 'absolute', top: -6, left: -6 }}>
    <ResizeHandleSVG corner="top-left" />
  </View>
</View>
```

### Issue 4: Color Animations Not Smooth

**Problem:** Cannot use `useNativeDriver: true` for color changes

**Solution:** Use conditional colors based on animated opacity

```tsx
// Instead of animating color directly:
// ❌ Animated.timing(color, { toValue: 'blue' })

// Use animated opacity to switch colors:
// ✅
const animatedProps = useAnimatedProps(() => ({
  stroke: opacity.value > 0.6
    ? 'rgba(59,130,246,0.8)' // Blue
    : 'rgba(255,255,255,0.3)', // White
}));
```

---

## Final Notes

**NO EMOJI.** All icons are custom SVG. This is professional software, not a consumer app.

**Consistency.** All 3 icon types (drag handle, close button, resize handles) follow the same design language:
- Rounded strokes (strokeLinecap="round")
- Similar stroke widths (1.5-2px)
- Same color palette (white idle, blue hover)
- Same animation spring config (damping 22, stiffness 280)

**Accessibility First.** Every interactive element has:
- Correct accessibilityRole
- Clear accessibilityLabel
- Helpful accessibilityHint
- Minimum 44×44px touch target (or 32×32px for corners)

**Performance.** All animations run at 60fps:
- useNativeDriver: true for transform/opacity
- Memoized SVG components
- Conditional colors (not animated color values)

**This is $10,000 agency-level work.** Every icon should feel intentional, professional, and premium.
