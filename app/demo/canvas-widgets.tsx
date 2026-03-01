/**
 * Canvas Widgets Demo — Live demonstration of QuoteWidget, ContractWidget, CalendarWidget
 *
 * This page showcases all three premium Canvas Mode widgets with live Supabase data:
 * - QuoteWidget: Quote Q-2024-001 with line items and send button
 * - ContractWidget: Contract C-2024-001 with parties and signature status
 * - CalendarWidget: Today's events with agent color-coding
 *
 * Access: http://localhost:8081/demo/canvas-widgets
 */

import React, { useState } from 'react';
import { View, Text, StyleSheet, ScrollView, Platform } from 'react-native';
import { WidgetContainer } from '@/components/canvas/WidgetContainer';
import { QuoteWidget } from '@/components/canvas/widgets/QuoteWidget';
import { ContractWidget } from '@/components/canvas/widgets/ContractWidget';
import { CalendarWidget } from '@/components/canvas/widgets/CalendarWidget';
import { CanvasTokens } from '@/constants/canvas.tokens';
import { Colors } from '@/constants/tokens';

export default function CanvasWidgetsDemo() {
  // Widget positions and sizes (stored in state for drag/resize)
  const [quotePosition, setQuotePosition] = useState({ x: 100, y: 100 });
  const [quoteSize, setQuoteSize] = useState({ width: 400, height: 500 });

  const [contractPosition, setContractPosition] = useState({ x: 550, y: 100 });
  const [contractSize, setContractSize] = useState({ width: 450, height: 520 });

  const [calendarPosition, setCalendarPosition] = useState({ x: 100, y: 650 });
  const [calendarSize, setCalendarSize] = useState({ width: 500, height: 450 });

  // Demo suite/office IDs (replace with real session IDs in production)
  const suiteId = 'demo-suite-123';
  const officeId = 'demo-office-456';

  // Demo quote ID (replace with real quote ID from Supabase)
  const quoteId = 'quote-demo-001';

  // Demo contract ID (replace with real contract ID from Supabase)
  const contractId = 'contract-demo-001';

  // Handlers
  const handleSendQuote = (quoteId: string) => {
    console.log('[Canvas Demo] Send quote:', quoteId);
    // TODO: Integrate with orchestrator for quote sending
  };

  const handleViewContract = (contractId: string) => {
    console.log('[Canvas Demo] View contract:', contractId);
    // TODO: Navigate to contract detail page
  };

  const handleSendReminder = (contractId: string) => {
    console.log('[Canvas Demo] Send reminder for contract:', contractId);
    // TODO: Integrate with orchestrator for reminder sending
  };

  const handleEventClick = (eventId: string) => {
    console.log('[Canvas Demo] Event clicked:', eventId);
    // TODO: Open event detail modal
  };

  const handleAddEvent = () => {
    console.log('[Canvas Demo] Add new event');
    // TODO: Open event creation modal
  };

  return (
    <View style={styles.container}>
      {/* Page Header */}
      <View style={styles.header}>
        <Text style={styles.title}>Canvas Widgets Demo</Text>
        <Text style={styles.subtitle}>
          Bloomberg Terminal-quality widgets with live Supabase data
        </Text>
      </View>

      {/* Canvas Area */}
      <ScrollView style={styles.canvas} contentContainerStyle={styles.canvasContent}>
        {/* Quote Widget */}
        <WidgetContainer
          title="Quote — Q-2024-001"
          position={quotePosition}
          size={quoteSize}
          onPositionChange={setQuotePosition}
          onSizeChange={setQuoteSize}
          onClose={() => console.log('[Canvas Demo] Close Quote widget')}
        >
          <QuoteWidget
            suiteId={suiteId}
            officeId={officeId}
            quoteId={quoteId}
            onSendClick={handleSendQuote}
          />
        </WidgetContainer>

        {/* Contract Widget */}
        <WidgetContainer
          title="Contract — C-2024-001"
          position={contractPosition}
          size={contractSize}
          onPositionChange={setContractPosition}
          onSizeChange={setContractSize}
          onClose={() => console.log('[Canvas Demo] Close Contract widget')}
        >
          <ContractWidget
            suiteId={suiteId}
            officeId={officeId}
            contractId={contractId}
            onViewClick={handleViewContract}
            onSendReminderClick={handleSendReminder}
          />
        </WidgetContainer>

        {/* Calendar Widget */}
        <WidgetContainer
          title="Today's Schedule"
          position={calendarPosition}
          size={calendarSize}
          onPositionChange={setCalendarPosition}
          onSizeChange={setCalendarSize}
          onClose={() => console.log('[Canvas Demo] Close Calendar widget')}
        >
          <CalendarWidget
            suiteId={suiteId}
            officeId={officeId}
            date={new Date()}
            onEventClick={handleEventClick}
            onAddEventClick={handleAddEvent}
          />
        </WidgetContainer>
      </ScrollView>

      {/* Instructions */}
      <View style={styles.instructions}>
        <Text style={styles.instructionTitle}>Widget Features:</Text>
        <Text style={styles.instructionText}>
          • Drag widgets by their header bars
        </Text>
        <Text style={styles.instructionText}>
          • Resize from corner handles (32px grid snap)
        </Text>
        <Text style={styles.instructionText}>
          • Real-time Supabase data with RLS scoping
        </Text>
        <Text style={styles.instructionText}>
          • Premium shadows, animations, typography
        </Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: CanvasTokens.background.base,
  },

  header: {
    padding: 24,
    borderBottomWidth: 1,
    borderBottomColor: CanvasTokens.border.subtle,
  },

  title: {
    color: Colors.text.primary,
    fontSize: 24,
    fontWeight: '700',
    letterSpacing: 0.3,
    marginBottom: 6,
  },

  subtitle: {
    color: Colors.text.secondary,
    fontSize: 14,
    fontWeight: '500',
  },

  canvas: {
    flex: 1,
  },

  canvasContent: {
    minHeight: 1200,
    position: 'relative',
  },

  instructions: {
    padding: 20,
    backgroundColor: CanvasTokens.background.elevated,
    borderTopWidth: 1,
    borderTopColor: CanvasTokens.border.subtle,
  },

  instructionTitle: {
    color: Colors.text.primary,
    fontSize: 14,
    fontWeight: '700',
    marginBottom: 10,
  },

  instructionText: {
    color: Colors.text.secondary,
    fontSize: 13,
    fontWeight: '500',
    marginBottom: 6,
  },
});
