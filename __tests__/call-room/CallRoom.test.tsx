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
});
