// __tests__/call-room/CallRoomCard.test.tsx
import { render } from '@testing-library/react-native';
import { CallRoomCard } from '../../components/call-room/CallRoomCard';
import { callRoomFixtures } from '../../components/call-room/fixtures/callRoomFixtures';

describe('CallRoomCard', () => {
  it('renders without crashing', () => {
    const { getByTestId } = render(
      <CallRoomCard callState={callRoomFixtures[0].state} />,
    );
    expect(getByTestId('call-room-card')).toBeTruthy();
  });

  it('renders all three column panels (client memory / center / ai assist)', () => {
    const { getByTestId } = render(
      <CallRoomCard callState={callRoomFixtures[0].state} />,
    );
    expect(getByTestId('call-room-client-memory')).toBeTruthy();
    expect(getByTestId('call-room-center')).toBeTruthy();
    expect(getByTestId('call-room-ai-assist')).toBeTruthy();
  });
});
