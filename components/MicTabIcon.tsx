import React from 'react';
import { useMicState } from '@/providers';
import { AnimatedMicButton } from './AnimatedMicButton';
import { PageErrorBoundary } from '@/components/PageErrorBoundary';

function MicTabIconInner() {
  const { isListening, isAvaSpeaking } = useMicState();
  
  return (
    <AnimatedMicButton 
      isListening={isListening} 
      isAvaSpeaking={isAvaSpeaking} 
    />
  );
}

export function MicTabIcon() {
  return (
    <PageErrorBoundary pageName="mic-tab-icon">
      <MicTabIconInner />
    </PageErrorBoundary>
  );
}
