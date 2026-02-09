import React, { useState, useEffect } from 'react';
import { StyleSheet, View, ScrollView, Text, TouchableOpacity, Modal } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { Colors, Typography, Spacing, BorderRadius } from '@/constants/tokens';
import { PageHeader } from '@/components/PageHeader';
import { formatDate } from '@/lib/formatters';
import { seedDatabase } from '@/lib/mockSeed';
import { getPolicies } from '@/lib/mockDb';
import { Policy } from '@/types/support';

function PolicyModal({ policy, visible, onClose }: { policy: Policy | null; visible: boolean; onClose: () => void }) {
  if (!policy) return null;

  return (
    <Modal animationType="slide" transparent={true} visible={visible} onRequestClose={onClose}>
      <View style={styles.modalOverlay}>
        <View style={styles.modalContent}>
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>{policy.title}</Text>
            <TouchableOpacity onPress={onClose}>
              <Ionicons name="close" size={24} color={Colors.text.secondary} />
            </TouchableOpacity>
          </View>
          <View style={styles.modalMeta}>
            <Text style={styles.metaText}>Version {policy.version}</Text>
            <Text style={styles.metaSeparator}>•</Text>
            <Text style={styles.metaText}>Effective {formatDate(policy.effectiveDate)}</Text>
          </View>
          <ScrollView style={styles.modalScroll} showsVerticalScrollIndicator={false}>
            <Text style={styles.policyContent}>{policy.content}</Text>
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
}

export default function PoliciesScreen() {
  const insets = useSafeAreaInsets();
  const headerHeight = insets.top + 60;

  const [loading, setLoading] = useState(true);
  const [policies, setPolicies] = useState<Policy[]>([]);
  const [selectedPolicy, setSelectedPolicy] = useState<Policy | null>(null);
  const [modalVisible, setModalVisible] = useState(false);

  useEffect(() => {
    seedDatabase();
    const timer = setTimeout(() => {
      setPolicies(getPolicies());
      setLoading(false);
    }, 700);
    return () => clearTimeout(timer);
  }, []);

  const handlePolicyPress = (policy: Policy) => {
    setSelectedPolicy(policy);
    setModalVisible(true);
  };

  return (
    <View style={styles.container}>
      <PageHeader title="Terms & Policies" showBackButton />
      
      <ScrollView style={[styles.scrollView, { paddingTop: headerHeight }]} contentContainerStyle={styles.scrollContent}>
        <Text style={styles.subtitle}>
          Review our legal documents and policies governing your use of Aspire Founder Console.
        </Text>

        {policies.map((policy) => (
          <TouchableOpacity 
            key={policy.id} 
            style={styles.policyCard} 
            onPress={() => handlePolicyPress(policy)}
            activeOpacity={0.7}
          >
            <View style={styles.policyIcon}>
              <Ionicons name="document-text" size={24} color={Colors.accent.cyan} />
            </View>
            <View style={styles.policyInfo}>
              <Text style={styles.policyTitle}>{policy.title}</Text>
              <Text style={styles.policyMeta}>Version {policy.version} • {formatDate(policy.effectiveDate)}</Text>
            </View>
            <Ionicons name="chevron-forward" size={20} color={Colors.text.muted} />
          </TouchableOpacity>
        ))}

        <View style={styles.footerNote}>
          <Ionicons name="information-circle" size={16} color={Colors.text.muted} />
          <Text style={styles.footerText}>
            By using Aspire Founder Console, you agree to these terms and policies. Please review them carefully.
          </Text>
        </View>
      </ScrollView>

      <PolicyModal 
        policy={selectedPolicy} 
        visible={modalVisible} 
        onClose={() => setModalVisible(false)} 
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background.primary,
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    padding: Spacing.lg,
    paddingBottom: 100,
  },
  subtitle: {
    ...Typography.body,
    color: Colors.text.muted,
    marginBottom: Spacing.xl,
    lineHeight: 22,
  },
  policyCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.background.secondary,
    borderRadius: BorderRadius.lg,
    padding: Spacing.lg,
    marginBottom: Spacing.md,
    borderWidth: 1,
    borderColor: Colors.border.default,
  },
  policyIcon: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: Colors.accent.cyanDark,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: Spacing.md,
  },
  policyInfo: {
    flex: 1,
  },
  policyTitle: {
    ...Typography.body,
    color: Colors.text.primary,
    fontWeight: '600',
  },
  policyMeta: {
    ...Typography.small,
    color: Colors.text.muted,
    marginTop: 2,
  },
  footerNote: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginTop: Spacing.lg,
    padding: Spacing.md,
    backgroundColor: Colors.background.secondary,
    borderRadius: BorderRadius.md,
  },
  footerText: {
    ...Typography.small,
    color: Colors.text.muted,
    marginLeft: Spacing.sm,
    flex: 1,
    lineHeight: 18,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    backgroundColor: Colors.background.primary,
    borderTopLeftRadius: BorderRadius.xl,
    borderTopRightRadius: BorderRadius.xl,
    maxHeight: '90%',
    padding: Spacing.lg,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: Spacing.sm,
  },
  modalTitle: {
    ...Typography.title,
    color: Colors.text.primary,
  },
  modalMeta: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: Spacing.lg,
  },
  metaText: {
    ...Typography.small,
    color: Colors.text.muted,
  },
  metaSeparator: {
    ...Typography.small,
    color: Colors.text.muted,
    marginHorizontal: Spacing.xs,
  },
  modalScroll: {
    maxHeight: 500,
  },
  policyContent: {
    ...Typography.body,
    color: Colors.text.secondary,
    lineHeight: 24,
  },
});
