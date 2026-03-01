/**
 * Mock for react-native-webview
 * Used in Jest tests to avoid native module errors
 */

import React from 'react';
import { View, Text } from 'react-native';

export const WebView = ({ source, ...props }: any) => {
  return (
    <View testID="webview-mock" {...props}>
      <Text testID="webview-content">
        {typeof source?.html === 'string' ? source.html : 'WebView'}
      </Text>
    </View>
  );
};

export default WebView;
