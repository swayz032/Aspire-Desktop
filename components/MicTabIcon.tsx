import React from 'react';
import { useMicState } from '@/providers';
import { AnimatedMicButton } from './AnimatedMicButton';

export function MicTabIcon() {
  const { isListening, isAvaSpeaking } = useMicState();
  
  return (
    <AnimatedMicButton 
      isListening={isListening} 
      isAvaSpeaking={isAvaSpeaking} 
    />
  );
}
