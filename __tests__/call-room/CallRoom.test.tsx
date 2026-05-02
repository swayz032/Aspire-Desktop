// __tests__/call-room/CallRoom.test.tsx
import { render } from '@testing-library/react-native';
import { CallRoom } from '../../components/call-room/CallRoom';
import { callRoomFixtures } from '../../components/call-room/fixtures/callRoomFixtures';

describe('CallRoom', () => {
  it('renders nothing when not visible', () => {
    const { queryByTestId } = render(
      <CallRoom visible={false} callState={callRoomFixtures[0].state} />,
    );
    expect(queryByTestId('call-room-root')).toBeNull();
  });

  it('renders root when visible', () => {
    const { getByTestId } = render(
      <CallRoom visible={true} callState={callRoomFixtures[0].state} />,
    );
    expect(getByTestId('call-room-root')).toBeTruthy();
  });

  it('renders without crashing when parallaxIntensity is provided', () => {
    const { getByTestId } = render(
      <CallRoom
        visible={true}
        callState={callRoomFixtures[0].state}
        parallaxIntensity={1.5}
      />,
    );
    expect(getByTestId('call-room-root')).toBeTruthy();
    expect(getByTestId('call-room-background')).toBeTruthy();
  });

  it('renders without crashing when parallaxIntensity is omitted (defaults to 1)', () => {
    const { getByTestId } = render(
      <CallRoom visible={true} callState={callRoomFixtures[0].state} />,
    );
    expect(getByTestId('call-room-background')).toBeTruthy();
  });

  it('renders with parallaxIntensity=0 (parallax disabled)', () => {
    const { getByTestId } = render(
      <CallRoom
        visible={true}
        callState={callRoomFixtures[0].state}
        parallaxIntensity={0}
      />,
    );
    expect(getByTestId('call-room-background')).toBeTruthy();
  });
});
