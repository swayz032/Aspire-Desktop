import React from 'react';
import DataRetentionScreen from './more/data-retention';
import { ErrorBoundary } from '@/components/ErrorBoundary';

export default function DataRetentionRedirect() {
  return (<ErrorBoundary routeName="DataRetentionRedirect"><DataRetentionScreen /></ErrorBoundary>);
}
