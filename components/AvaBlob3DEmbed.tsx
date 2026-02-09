import React, { useRef, useEffect, useState } from 'react';
import { View, StyleSheet, Platform } from 'react-native';
import { WebView } from 'react-native-webview';

export type BlobState = 'idle' | 'listening' | 'processing' | 'responding';

interface AvaBlob3DEmbedProps {
  state?: BlobState;
  size?: number;
}

const BLOB_HTML_URL = '/ava-blob.html';

export function AvaBlob3DEmbed({ state = 'idle', size = 280 }: AvaBlob3DEmbedProps) {
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const webViewRef = useRef<WebView>(null);
  const [isLoaded, setIsLoaded] = useState(false);

  useEffect(() => {
    if (Platform.OS === 'web') {
      if (iframeRef.current?.contentWindow) {
        iframeRef.current.contentWindow.postMessage(
          { type: 'setState', state },
          '*'
        );
      }
    } else if (webViewRef.current && isLoaded) {
      webViewRef.current.postMessage(JSON.stringify({ type: 'setState', state }));
    }
  }, [state, isLoaded]);

  if (Platform.OS === 'web') {
    return (
      <View style={[styles.container, { width: size, height: size }]}>
        <iframe
          ref={iframeRef}
          src={BLOB_HTML_URL}
          style={{
            width: size,
            height: size,
            border: 'none',
            borderRadius: size / 2,
            overflow: 'hidden',
            background: 'transparent',
          }}
          title="Ava 3D Blob"
          allow="accelerometer"
        />
      </View>
    );
  }

  return (
    <View style={[styles.container, { width: size, height: size }]}>
      <WebView
        ref={webViewRef}
        source={{ uri: BLOB_HTML_URL }}
        style={{
          width: size,
          height: size,
          backgroundColor: 'transparent',
          borderRadius: size / 2,
          overflow: 'hidden',
        }}
        scrollEnabled={false}
        bounces={false}
        onLoad={() => setIsLoaded(true)}
        onMessage={(event) => {
          console.log('WebView message:', event.nativeEvent.data);
        }}
        javaScriptEnabled={true}
        domStorageEnabled={true}
        allowsInlineMediaPlayback={true}
        mediaPlaybackRequiresUserAction={false}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
    borderRadius: 1000,
  },
});

export default AvaBlob3DEmbed;
