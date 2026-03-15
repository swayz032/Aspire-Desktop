import React from 'react';
import TermsScreen from './more/terms';
import { ErrorBoundary } from '@/components/ErrorBoundary';

export default function TermsRedirect() {
  return (<ErrorBoundary routeName="TermsRedirect"><TermsScreen /></ErrorBoundary>);
}
