import React from 'react';
import { DesktopHome } from '@/components/desktop/DesktopHome';
import { ErrorBoundary } from '@/components/ErrorBoundary';

export default function HomeScreen() {
  return (<ErrorBoundary routeName="HomeScreen"><DesktopHome /></ErrorBoundary>);
}
