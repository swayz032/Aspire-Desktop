// __tests__/call-room/CallRoomNightLight.test.tsx
import { render } from '@testing-library/react-native';
import { Platform } from 'react-native';
import { CallRoomNightLight } from '../../components/call-room/CallRoomNightLight';

// Short-circuit the @react-three/* require()s inside the scene so jest
// never tries to evaluate Three.js / WebGL. The component itself doesn't
// reach NightLightScene unless mounted on web with active=true.
jest.mock('@react-three/fiber', () => ({ Canvas: () => null }), {
  virtual: true,
});
jest.mock('@react-three/drei', () => ({ SpotLight: () => null }), {
  virtual: true,
});
jest.mock(
  '@react-three/postprocessing',
  () => ({ EffectComposer: () => null, Bloom: () => null }),
  { virtual: true },
);

describe('CallRoomNightLight', () => {
  it('renders null on native regardless of active', () => {
    Platform.OS = 'ios';
    const { queryByTestId } = render(<CallRoomNightLight active={true} />);
    expect(queryByTestId('call-room-night-light')).toBeNull();
    Platform.OS = 'web';
  });

  it('renders null on web when inactive (and never mounted)', () => {
    Platform.OS = 'web';
    const { queryByTestId } = render(<CallRoomNightLight active={false} />);
    expect(queryByTestId('call-room-night-light')).toBeNull();
  });

  it('mounts the night-light wrapper on web when active', () => {
    Platform.OS = 'web';
    const { getByTestId } = render(<CallRoomNightLight active={true} />);
    expect(getByTestId('call-room-night-light')).toBeTruthy();
  });
});
