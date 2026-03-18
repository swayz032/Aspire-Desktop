import { Href, Link } from 'expo-router';
import { openBrowserAsync } from 'expo-web-browser';
import { type ComponentProps } from 'react';
import { Platform } from 'react-native';
import { PageErrorBoundary } from '@/components/PageErrorBoundary';

type Props = Omit<ComponentProps<typeof Link>, 'href'> & { href: Href & string };

function ExternalLinkInner({ href, ...rest }: Props) {
  return (
    <Link
      target="_blank"
      {...rest}
      href={href}
      onPress={async (event) => {
        if (Platform.OS !== 'web') {
          // Prevent the default behavior of linking to the default browser on native.
          event.preventDefault();
          // Open the link in an in-app browser.
          await openBrowserAsync(href);
        }
      }}
    />
  );
}

export function ExternalLink(props: any) {
  return (
    <PageErrorBoundary pageName="external-link">
      <ExternalLinkInner {...props} />
    </PageErrorBoundary>
  );
}
