import React from 'react';
import { fireEvent, render } from '@testing-library/react-native';
import { SmartText } from '@/components/service-hub/estimate-studio/scope/SmartText';

describe('SmartText', () => {
  it('renders plain text unchanged when no matches present', () => {
    const { getByText } = render(<SmartText>Just regular sentence.</SmartText>);
    expect(getByText('Just regular sentence.')).toBeTruthy();
  });

  it('decorates a glossary term with an accessibility label that includes the expansion', () => {
    const { getByLabelText } = render(<SmartText>Mount the EWC at 36 in.</SmartText>);
    expect(getByLabelText(/EWC — Electric Water Cooler/)).toBeTruthy();
  });

  it('renders a sheet code as a Pressable chip', () => {
    const { getByLabelText } = render(<SmartText>See A-101 for partitions.</SmartText>);
    expect(getByLabelText(/Jump to sheet A-101/)).toBeTruthy();
  });

  it('fires onSheetJump with the sheet code when the chip is pressed', () => {
    const onJump = jest.fn();
    const { getByLabelText } = render(
      <SmartText onSheetJump={onJump}>See A-101 for partitions.</SmartText>
    );
    fireEvent.press(getByLabelText(/Jump to sheet A-101/));
    expect(onJump).toHaveBeenCalledWith('A-101');
  });

  it('no-ops gracefully when onSheetJump is omitted', () => {
    const { getByLabelText } = render(<SmartText>See A-101 for partitions.</SmartText>);
    expect(() => fireEvent.press(getByLabelText(/Jump to sheet A-101/))).not.toThrow();
  });

  it('handles mixed glossary + sheet codes in one string', () => {
    const { getByLabelText } = render(
      <SmartText>Install the EWC per A-101 at 36 in AFF.</SmartText>
    );
    expect(getByLabelText(/EWC — Electric Water Cooler/)).toBeTruthy();
    expect(getByLabelText(/AFF — Above Finish Floor/)).toBeTruthy();
    expect(getByLabelText(/Jump to sheet A-101/)).toBeTruthy();
  });

  it('decorates dotted glossary terms (V.T.R.) correctly', () => {
    const { getByLabelText } = render(<SmartText>Run a 3" V.T.R. above roof.</SmartText>);
    expect(getByLabelText(/V\.T\.R\. — Vent Through Roof/)).toBeTruthy();
  });
});
