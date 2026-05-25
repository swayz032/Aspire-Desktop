import React from 'react';
import { Platform, Text } from 'react-native';
import { render } from '@testing-library/react-native';
import { HoverLens } from '@/components/ui/HoverLens';

// HoverLens is a thin web-only wrapper. The mouse-driven magnifier is
// jsdom-tricky (raw <div> children outside the RN tree), so we focus tests
// on the contract that matters for safety:
//   1. Native + no-source branches MUST render children unchanged (zero
//      cost on iOS/Android and no broken affordance when there's no
//      image).
//   2. Web + source branch MUST render children inside its wrapper without
//      crashing — full mouse-event behavior is verified by visual QA on
//      the Railway deploy.

describe('HoverLens', () => {
  it('renders children unchanged on native', () => {
    const original = Platform.OS;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (Platform as { OS: string }).OS = 'ios';
    try {
      const { getByText } = render(
        <HoverLens src="https://example.com/x.png" testID="lens-native">
          <Text>native-child</Text>
        </HoverLens>,
      );
      expect(getByText('native-child')).toBeTruthy();
    } finally {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (Platform as { OS: string }).OS = original;
    }
  });

  it('renders children unchanged when src is null on any platform', () => {
    const { getByText } = render(
      <HoverLens src={null} testID="lens-nosrc">
        <Text>nosrc-child</Text>
      </HoverLens>,
    );
    expect(getByText('nosrc-child')).toBeTruthy();
  });

  it('renders children unchanged when src is undefined', () => {
    const { getByText } = render(
      <HoverLens src={undefined} testID="lens-undef">
        <Text>undef-child</Text>
      </HoverLens>,
    );
    expect(getByText('undef-child')).toBeTruthy();
  });

  it('does not crash when given a valid src on web', () => {
    const original = Platform.OS;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (Platform as { OS: string }).OS = 'web';
    try {
      const { getByText } = render(
        <HoverLens src="https://example.com/x.png" testID="lens-web">
          <Text>web-child</Text>
        </HoverLens>,
      );
      // Children render — the wrapper doesn't swallow them.
      expect(getByText('web-child')).toBeTruthy();
    } finally {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (Platform as { OS: string }).OS = original;
    }
  });

  it('accepts zoom + size + showIcon props without throwing', () => {
    const original = Platform.OS;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (Platform as { OS: string }).OS = 'web';
    try {
      const { getByText } = render(
        <HoverLens
          src="https://example.com/x.png"
          zoom={3.5}
          size={200}
          showIcon={false}
          testID="lens-config"
        >
          <Text>config-child</Text>
        </HoverLens>,
      );
      expect(getByText('config-child')).toBeTruthy();
    } finally {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (Platform as { OS: string }).OS = original;
    }
  });
});
