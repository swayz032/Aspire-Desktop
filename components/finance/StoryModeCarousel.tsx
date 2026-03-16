import React, { useState, useCallback, useEffect, useRef } from 'react';
import { View, Text, StyleSheet, Platform } from 'react-native';
import ThreeDCarousel from '@/components/ThreeDCarousel';
import type { ThreeDCarouselItem } from '@/components/ThreeDCarousel';

export type StoryModeId =
  | 'cash-truth'
  | 'what-changed'
  | 'invoice-pressure'
  | 'tax-review'
  | 'cleanup-sprint'
  | 'books-vs-bank'
  | 'money-memory';

export interface StoryModeConfig {
  id: StoryModeId;
  name: string;
  tagline: string;
  accent: string;
  photo: string;
  tags?: string[];
}

export const STORY_MODES: StoryModeConfig[] = [
  {
    id: 'cash-truth',
    name: 'Cash Truth',
    tagline: 'Real-time liquidity at a glance',
    accent: '#38BDF8',
    photo: '/images/story-modes/cash-truth.jpeg',
    tags: ['Liquidity', 'Runway'],
  },
  {
    id: 'what-changed',
    name: 'What Changed',
    tagline: 'Deltas since your last look',
    accent: '#A78BFA',
    photo: '/images/story-modes/what-changed.jpeg',
    tags: ['Deltas', 'Trends'],
  },
  {
    id: 'invoice-pressure',
    name: 'Invoice Pressure',
    tagline: 'What is owed and overdue',
    accent: '#EA580C',
    photo: '/images/story-modes/invoice-pressure.jpeg',
    tags: ['AR', 'Collections'],
  },
  {
    id: 'tax-review',
    name: 'Tax Review',
    tagline: 'Stay ahead of obligations',
    accent: '#10B981',
    photo: '/images/story-modes/tax-review.jpeg',
    tags: ['Compliance', 'Reserves'],
  },
  {
    id: 'cleanup-sprint',
    name: 'Cleanup Sprint',
    tagline: 'Unresolved items need attention',
    accent: '#F87171',
    photo: '/images/story-modes/cleanup-sprint.jpeg',
    tags: ['Reconcile', 'Action'],
  },
  {
    id: 'books-vs-bank',
    name: 'Books vs Bank',
    tagline: 'Reconciliation at a glance',
    accent: '#F59E0B',
    photo: '/images/story-modes/books-vs-bank.jpeg',
    tags: ['Matching', 'Ledger'],
  },
  {
    id: 'money-memory',
    name: 'Money Memory',
    tagline: 'Your financial timeline',
    accent: '#E879F9',
    photo: '/images/story-modes/money-memory.jpeg',
    tags: ['History', 'Patterns'],
  },
];

interface StoryModeCarouselProps {
  activeMode?: StoryModeId;
  onSelectMode?: (mode: StoryModeConfig) => void;
}

export function StoryModeCarousel({ activeMode, onSelectMode }: StoryModeCarouselProps) {
  if (Platform.OS !== 'web') {
    return (
      <View style={nativeStyles.container}>
        <Text style={nativeStyles.title}>Story Modes</Text>
      </View>
    );
  }

  const items: ThreeDCarouselItem[] = STORY_MODES.map(m => ({
    id: m.id,
    title: m.name,
    brand: m.name,
    description: m.tagline,
    tags: m.tags ?? [],
    imageUrl: m.photo,
    link: '#',
    accent: m.accent,
  }));

  return (
    <div
      style={{
        width: '100%',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        height: '100%',
      }}
    >
      <ThreeDCarousel
        items={items}
        autoRotate={true}
        rotateInterval={4000}
        cardHeight={380}
      />
    </div>
  );
}

const nativeStyles = StyleSheet.create({
  container: {
    padding: 16,
    alignItems: 'center',
  },
  title: {
    fontSize: 16,
    fontWeight: '600',
    color: '#ffffff',
  },
});
