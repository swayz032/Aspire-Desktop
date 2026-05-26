import React from 'react';
import { render } from '@testing-library/react-native';
import { TierDot } from '@/components/ui/TierDot';

describe('TierDot', () => {
  it('renders for GREEN tier', () => {
    const { getByTestId } = render(<TierDot tier="GREEN" testID="dot-g" />);
    const el = getByTestId('dot-g');
    expect(el).toBeTruthy();
    expect(el.props.accessibilityLabel).toBe('Confidence: Green');
  });

  it('renders for YELLOW tier with pulse by default', () => {
    const { getByTestId } = render(<TierDot tier="YELLOW" testID="dot-y" />);
    const el = getByTestId('dot-y');
    expect(el).toBeTruthy();
    expect(el.props.accessibilityLabel).toBe('Confidence: Yellow');
    // Pulse default => Animated.View with transform style
    const style = Array.isArray(el.props.style) ? el.props.style : [el.props.style];
    const hasTransform = style.some(
      (s: any) => s && s.transform && Array.isArray(s.transform),
    );
    expect(hasTransform).toBe(true);
  });

  it('renders for RED tier', () => {
    const { getByTestId } = render(<TierDot tier="RED" testID="dot-r" />);
    const el = getByTestId('dot-r');
    expect(el).toBeTruthy();
    expect(el.props.accessibilityLabel).toBe('Confidence: Red');
  });

  it('does not pulse when pulse=false on YELLOW', () => {
    const { getByTestId } = render(
      <TierDot tier="YELLOW" pulse={false} testID="dot-yn" />,
    );
    const el = getByTestId('dot-yn');
    const style = Array.isArray(el.props.style) ? el.props.style : [el.props.style];
    const hasTransform = style.some(
      (s: any) => s && s.transform && Array.isArray(s.transform),
    );
    expect(hasTransform).toBe(false);
  });

  it('does not pulse on GREEN even if pulse=true', () => {
    const { getByTestId } = render(
      <TierDot tier="GREEN" pulse={true} testID="dot-gp" />,
    );
    const el = getByTestId('dot-gp');
    const style = Array.isArray(el.props.style) ? el.props.style : [el.props.style];
    const hasTransform = style.some(
      (s: any) => s && s.transform && Array.isArray(s.transform),
    );
    expect(hasTransform).toBe(false);
  });

  it('honors custom size', () => {
    const { getByTestId } = render(
      <TierDot tier="GREEN" size={20} testID="dot-sz" />,
    );
    const el = getByTestId('dot-sz');
    const style = Array.isArray(el.props.style) ? el.props.style : [el.props.style];
    const sized = style.find((s: any) => s && s.width === 20 && s.height === 20);
    expect(sized).toBeTruthy();
    expect(sized.borderRadius).toBe(10);
  });
});
