/**
 * React Native Web Style Augmentation
 *
 * Extends React Native's ViewStyle, TextStyle, and ImageStyle with
 * web CSS properties that Expo Web supports at runtime but aren't
 * declared in @types/react-native.
 *
 * This eliminates the need for `as any` casts on style objects
 * containing web-specific CSS properties.
 */

import 'react-native';

declare module 'react-native' {
  interface ViewStyle {
    // Cursor
    cursor?:
      | 'auto'
      | 'default'
      | 'pointer'
      | 'grab'
      | 'grabbing'
      | 'text'
      | 'move'
      | 'not-allowed'
      | 'crosshair'
      | 'wait'
      | 'help'
      | 'col-resize'
      | 'row-resize'
      | 'n-resize'
      | 's-resize'
      | 'e-resize'
      | 'w-resize'
      | 'ne-resize'
      | 'nw-resize'
      | 'se-resize'
      | 'sw-resize'
      | 'ew-resize'
      | 'ns-resize'
      | 'col-resize'
      | 'zoom-in'
      | 'zoom-out'
      | 'none';

    // Transitions & animations
    transition?: string;
    transitionProperty?: string;
    transitionDuration?: string;
    transitionTimingFunction?: string;
    transitionDelay?: string;
    animation?: string;
    animationName?: string;
    animationDuration?: string;
    animationTimingFunction?: string;
    animationDelay?: string;
    animationIterationCount?: string | number;
    animationDirection?: string;
    animationFillMode?: string;
    willChange?: string;

    // Shadows (web)
    boxShadow?: string;

    // Filters
    filter?: string;
    backdropFilter?: string;
    WebkitBackdropFilter?: string;

    // Outline
    outline?: string;
    outlineStyle?: string;
    outlineWidth?: number | string;
    outlineColor?: string;
    outlineOffset?: number | string;

    // User interaction
    userSelect?: 'auto' | 'text' | 'none' | 'contain' | 'all';
    WebkitUserSelect?: 'auto' | 'text' | 'none' | 'contain' | 'all';
    pointerEvents?: 'auto' | 'none' | 'box-none' | 'box-only';
    touchAction?: string;
    resize?: 'none' | 'both' | 'horizontal' | 'vertical';

    // Appearance
    appearance?: string;
    WebkitAppearance?: string;
    MozAppearance?: string;

    // Position: 'fixed' and 'sticky' still require `as any` (RN declares position already)
    // position is NOT augmented here — would conflict with RN's existing declaration

    // Overflow (web extensions)
    overflowX?: 'visible' | 'hidden' | 'scroll' | 'auto';
    overflowY?: 'visible' | 'hidden' | 'scroll' | 'auto';
    overflowWrap?: 'normal' | 'break-word' | 'anywhere';

    // Text
    textOverflow?: 'clip' | 'ellipsis' | string;
    whiteSpace?: 'normal' | 'nowrap' | 'pre' | 'pre-wrap' | 'pre-line' | 'break-spaces';
    wordBreak?: 'normal' | 'break-all' | 'keep-all' | 'break-word';
    wordWrap?: 'normal' | 'break-word';

    // Sizing
    boxSizing?: 'content-box' | 'border-box';
    minWidth?: number | string;
    maxWidth?: number | string;
    minHeight?: number | string;
    maxHeight?: number | string;

    // Background (web extensions)
    background?: string;
    backgroundImage?: string;
    backgroundSize?: string;
    backgroundPosition?: string;
    backgroundRepeat?: string;
    backgroundClip?: string;
    WebkitBackgroundClip?: string;

    // Grid
    gridTemplateColumns?: string;
    gridTemplateRows?: string;
    gridColumn?: string;
    gridRow?: string;
    gridGap?: string | number;
    gap?: number | string;
    rowGap?: number | string;
    columnGap?: number | string;

    // Clip & mask
    clipPath?: string;
    WebkitClipPath?: string;
    mask?: string;
    WebkitMask?: string;

    // Scroll
    scrollBehavior?: 'auto' | 'smooth';
    scrollbarWidth?: 'auto' | 'thin' | 'none';
    WebkitOverflowScrolling?: 'auto' | 'touch';
    scrollSnapType?: string;
    scrollSnapAlign?: string;
    msOverflowStyle?: string;

    // Visibility
    visibility?: 'visible' | 'hidden' | 'collapse';
    content?: string;

    // Border (web extensions)
    borderCollapse?: 'collapse' | 'separate';

    // Object (for containers)
    objectFit?: 'contain' | 'cover' | 'fill' | 'none' | 'scale-down';
    objectPosition?: string;

    // Text decoration (web)
    textDecoration?: string;
    textDecorationLine?: string;
    textDecorationStyle?: string;
    textDecorationColor?: string;

    // Webkit-specific text
    WebkitTextFillColor?: string;
    WebkitLineClamp?: number;
    WebkitBoxOrient?: string;
  }

  interface TextStyle {
    cursor?: ViewStyle['cursor'];
    fontVariantNumeric?: 'normal' | 'ordinal' | 'slashed-zero' | 'lining-nums' | 'oldstyle-nums' | 'proportional-nums' | 'tabular-nums' | string;
    userSelect?: ViewStyle['userSelect'];
    WebkitUserSelect?: ViewStyle['WebkitUserSelect'];
    textOverflow?: ViewStyle['textOverflow'];
    whiteSpace?: ViewStyle['whiteSpace'];
    wordBreak?: ViewStyle['wordBreak'];
    wordWrap?: ViewStyle['wordWrap'];
    textDecoration?: string;
    WebkitTextFillColor?: string;
    WebkitLineClamp?: number;
    WebkitBoxOrient?: string;
    transition?: string;
    outline?: string;
    outlineStyle?: string;
    boxShadow?: string;
    filter?: string;
  }

  interface ImageStyle {
    cursor?: ViewStyle['cursor'];
    objectFit?: ViewStyle['objectFit'];
    objectPosition?: ViewStyle['objectPosition'];
    transition?: string;
    filter?: string;
  }
}
