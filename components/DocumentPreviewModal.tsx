import React from 'react';
import { View, Text, StyleSheet, Pressable, Platform, ScrollView, Modal } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Colors } from '@/constants/tokens';

interface DocumentPreviewModalProps {
  visible: boolean;
  onClose: () => void;
  type: 'invoice' | 'contract' | 'report' | 'email' | 'document' | 'recording';
  documentName?: string;
}

const TYPE_META: Record<string, { title: string; icon: keyof typeof Ionicons.glyphMap; accent: string }> = {
  invoice: { title: 'Invoice', icon: 'receipt-outline', accent: '#3B82F6' },
  contract: { title: 'Contract / NDA', icon: 'document-lock-outline', accent: '#8b5cf6' },
  report: { title: 'Financial Report', icon: 'bar-chart-outline', accent: '#06b6d4' },
  email: { title: 'Email', icon: 'mail-outline', accent: '#f59e0b' },
  document: { title: 'Document', icon: 'document-text-outline', accent: '#3B82F6' },
  recording: { title: 'Recording Transcript', icon: 'mic-outline', accent: '#22c55e' },
};

function InvoiceContent() {
  const items = [
    { desc: 'Strategic Consulting — Q4 Sprint', qty: 1, rate: '$4,200.00', total: '$4,200.00' },
    { desc: 'UX Audit & Redesign Package', qty: 1, rate: '$2,800.00', total: '$2,800.00' },
    { desc: 'Cloud Infrastructure Setup', qty: 1, rate: '$1,500.00', total: '$1,500.00' },
  ];
  return (
    <View>
      <View style={p.docHeader}>
        <View>
          <Text style={p.companyName}>Zenith Solutions</Text>
          <Text style={p.companyDetail}>Suite 1042 • 123 Innovation Drive</Text>
          <Text style={p.companyDetail}>San Francisco, CA 94105</Text>
        </View>
        <View style={p.invoiceMeta}>
          <Text style={p.invoiceNumber}>INV-2025-0847</Text>
          <Text style={p.invoiceDate}>Date: Feb 13, 2025</Text>
          <Text style={p.invoiceDate}>Due: Mar 13, 2025</Text>
          <View style={p.statusBadge}>
            <Text style={p.statusBadgeText}>PENDING</Text>
          </View>
        </View>
      </View>

      <View style={p.divider} />

      <View style={p.billTo}>
        <Text style={p.sectionLabel}>BILL TO</Text>
        <Text style={p.billToName}>Apex Corporation</Text>
        <Text style={p.billToDetail}>Attn: Finance Department</Text>
        <Text style={p.billToDetail}>456 Market Street, Suite 300</Text>
      </View>

      <View style={p.tableHeader}>
        <Text style={[p.tableHeaderCell, { flex: 3 }]}>Description</Text>
        <Text style={[p.tableHeaderCell, { flex: 0.5, textAlign: 'center' }]}>Qty</Text>
        <Text style={[p.tableHeaderCell, { flex: 1, textAlign: 'right' }]}>Rate</Text>
        <Text style={[p.tableHeaderCell, { flex: 1, textAlign: 'right' }]}>Amount</Text>
      </View>

      {items.map((item, i) => (
        <View key={i} style={[p.tableRow, i % 2 === 0 && p.tableRowAlt]}>
          <Text style={[p.tableCell, { flex: 3 }]}>{item.desc}</Text>
          <Text style={[p.tableCell, { flex: 0.5, textAlign: 'center' }]}>{item.qty}</Text>
          <Text style={[p.tableCell, { flex: 1, textAlign: 'right' }]}>{item.rate}</Text>
          <Text style={[p.tableCellBold, { flex: 1, textAlign: 'right' }]}>{item.total}</Text>
        </View>
      ))}

      <View style={p.totalSection}>
        <View style={p.totalRow}>
          <Text style={p.totalLabel}>Subtotal</Text>
          <Text style={p.totalValue}>$8,500.00</Text>
        </View>
        <View style={p.totalRow}>
          <Text style={p.totalLabel}>Tax (8.5%)</Text>
          <Text style={p.totalValue}>$722.50</Text>
        </View>
        <View style={[p.totalRow, p.grandTotal]}>
          <Text style={p.grandTotalLabel}>Total Due</Text>
          <Text style={p.grandTotalValue}>$9,222.50</Text>
        </View>
      </View>

      <View style={p.footer}>
        <Text style={p.footerText}>Payment Terms: Net 30 • Wire Transfer or ACH accepted</Text>
        <Text style={p.footerText}>Thank you for your business.</Text>
      </View>
    </View>
  );
}

function ContractContent() {
  return (
    <View>
      <View style={p.docHeader}>
        <View style={{ flex: 1 }}>
          <Text style={p.contractTitle}>MUTUAL NON-DISCLOSURE AGREEMENT</Text>
          <Text style={p.companyDetail}>Agreement No. NDA-2025-0392</Text>
        </View>
        <View style={[p.statusBadge, { backgroundColor: 'rgba(245, 158, 11, 0.12)', borderColor: 'rgba(245, 158, 11, 0.25)' }]}>
          <Text style={[p.statusBadgeText, { color: '#f59e0b' }]}>AWAITING SIGNATURE</Text>
        </View>
      </View>

      <View style={p.divider} />

      <View style={p.contractParties}>
        <View style={p.partyBox}>
          <Text style={p.sectionLabel}>DISCLOSING PARTY</Text>
          <Text style={p.partyName}>Zenith Solutions, Inc.</Text>
          <Text style={p.billToDetail}>123 Innovation Drive, SF, CA 94105</Text>
        </View>
        <View style={p.partyBox}>
          <Text style={p.sectionLabel}>RECEIVING PARTY</Text>
          <Text style={p.partyName}>Apex Corporation</Text>
          <Text style={p.billToDetail}>456 Market Street, Suite 300</Text>
        </View>
      </View>

      <View style={p.divider} />

      <Text style={p.clauseTitle}>1. Definition of Confidential Information</Text>
      <Text style={p.clauseBody}>
        "Confidential Information" shall mean any and all non-public information, including but not limited to trade secrets, business plans, financial data, customer lists, technical specifications, and proprietary methodologies disclosed by either party during the course of business discussions and collaboration.
      </Text>

      <Text style={p.clauseTitle}>2. Obligations of the Receiving Party</Text>
      <Text style={p.clauseBody}>
        The Receiving Party agrees to hold all Confidential Information in strict confidence, not to disclose it to any third party without prior written consent, and to use it solely for the purpose of evaluating and engaging in business activities with the Disclosing Party.
      </Text>

      <Text style={p.clauseTitle}>3. Term and Duration</Text>
      <Text style={p.clauseBody}>
        This Agreement shall remain in effect for a period of two (2) years from the Effective Date. The obligations of confidentiality shall survive termination and continue for an additional three (3) years thereafter.
      </Text>

      <View style={p.signatureSection}>
        <View style={p.signatureBox}>
          <View style={p.signatureLine} />
          <Text style={p.signatureLabel}>Zenith Solutions, Inc.</Text>
          <Text style={p.signatureSub}>Authorized Representative</Text>
        </View>
        <View style={p.signatureBox}>
          <View style={p.signatureLine} />
          <Text style={p.signatureLabel}>Apex Corporation</Text>
          <Text style={p.signatureSub}>Authorized Representative</Text>
        </View>
      </View>
    </View>
  );
}

function ReportContent() {
  const metrics = [
    { label: 'Total Revenue', value: '$47,250', change: '+12.3%', up: true },
    { label: 'Operating Expenses', value: '$28,900', change: '+4.1%', up: true },
    { label: 'Net Profit', value: '$18,350', change: '+24.7%', up: true },
    { label: 'Profit Margin', value: '38.8%', change: '+3.2pp', up: true },
  ];
  const departments = [
    { name: 'Consulting', revenue: '$22,400', pct: '47.4%' },
    { name: 'Design Services', revenue: '$12,850', pct: '27.2%' },
    { name: 'Infrastructure', revenue: '$8,200', pct: '17.4%' },
    { name: 'Support & Maintenance', revenue: '$3,800', pct: '8.0%' },
  ];
  return (
    <View>
      <View style={p.docHeader}>
        <View>
          <Text style={p.companyName}>Zenith Solutions</Text>
          <Text style={p.reportTitle}>Q4 2024 Financial Report</Text>
          <Text style={p.companyDetail}>Period: October 1 — December 31, 2024</Text>
        </View>
        <View style={[p.statusBadge, { backgroundColor: 'rgba(59, 130, 246, 0.12)', borderColor: 'rgba(59, 130, 246, 0.25)' }]}>
          <Text style={[p.statusBadgeText, { color: '#3B82F6' }]}>FINAL</Text>
        </View>
      </View>

      <View style={p.divider} />

      <Text style={p.sectionLabel}>KEY METRICS</Text>
      <View style={p.metricsGrid}>
        {metrics.map((m, i) => (
          <View key={i} style={p.metricCard}>
            <Text style={p.metricLabel}>{m.label}</Text>
            <Text style={p.metricValue}>{m.value}</Text>
            <Text style={[p.metricChange, { color: m.up ? '#22c55e' : '#ef4444' }]}>
              {m.up ? '↑' : '↓'} {m.change}
            </Text>
          </View>
        ))}
      </View>

      <View style={p.divider} />

      <Text style={p.sectionLabel}>REVENUE BY DEPARTMENT</Text>
      <View style={p.tableHeader}>
        <Text style={[p.tableHeaderCell, { flex: 2 }]}>Department</Text>
        <Text style={[p.tableHeaderCell, { flex: 1, textAlign: 'right' }]}>Revenue</Text>
        <Text style={[p.tableHeaderCell, { flex: 0.7, textAlign: 'right' }]}>% of Total</Text>
      </View>
      {departments.map((d, i) => (
        <View key={i} style={[p.tableRow, i % 2 === 0 && p.tableRowAlt]}>
          <Text style={[p.tableCell, { flex: 2 }]}>{d.name}</Text>
          <Text style={[p.tableCellBold, { flex: 1, textAlign: 'right' }]}>{d.revenue}</Text>
          <Text style={[p.tableCell, { flex: 0.7, textAlign: 'right' }]}>{d.pct}</Text>
        </View>
      ))}

      <View style={p.footer}>
        <Text style={p.footerText}>Prepared by: Sarah Mitchell, CFO • Zenith Solutions</Text>
        <Text style={p.footerText}>This report is confidential and intended for internal use only.</Text>
      </View>
    </View>
  );
}

function EmailContent() {
  return (
    <View>
      <View style={p.emailHeader}>
        <View style={p.emailRow}>
          <Text style={p.emailLabel}>From:</Text>
          <Text style={p.emailValue}>jordan@zenithsolutions.com</Text>
        </View>
        <View style={p.emailRow}>
          <Text style={p.emailLabel}>To:</Text>
          <Text style={p.emailValue}>michael.ross@apexcorp.com</Text>
        </View>
        <View style={p.emailRow}>
          <Text style={p.emailLabel}>Date:</Text>
          <Text style={p.emailValue}>Feb 13, 2025 at 9:42 AM</Text>
        </View>
        <View style={p.emailRow}>
          <Text style={p.emailLabel}>Subject:</Text>
          <Text style={[p.emailValue, { fontWeight: '600', color: '#f2f2f2' }]}>Re: Partnership Proposal — Next Steps</Text>
        </View>
      </View>

      <View style={p.divider} />

      <View style={p.emailBody}>
        <Text style={p.emailBodyText}>Hi Michael,</Text>
        <Text style={p.emailBodyText}>
          Thank you for the productive meeting yesterday. I wanted to follow up on the key points we discussed regarding the strategic partnership between Zenith Solutions and Apex Corporation.
        </Text>
        <Text style={p.emailBodyText}>
          As agreed, I've attached the preliminary proposal outlining the scope of collaboration, revenue sharing model, and implementation timeline. Our team has incorporated the feedback from your VP of Engineering regarding the technical integration requirements.
        </Text>
        <Text style={p.emailBodyText}>
          Key next steps:
        </Text>
        <Text style={p.emailListItem}>  1. Legal review of the partnership terms (target: Feb 20)</Text>
        <Text style={p.emailListItem}>  2. Technical feasibility assessment (target: Feb 25)</Text>
        <Text style={p.emailListItem}>  3. Executive sign-off meeting (target: Mar 1)</Text>
        <Text style={p.emailBodyText}>
          Please let me know if you have any questions or would like to schedule a follow-up call this week.
        </Text>
        <Text style={p.emailBodyText}>Best regards,</Text>
        <Text style={[p.emailBodyText, { fontWeight: '600', color: '#d1d1d6' }]}>Jordan Mitchell</Text>
        <Text style={p.emailBodyText}>Founder & CEO, Zenith Solutions</Text>
      </View>

      <View style={p.divider} />
      <View style={p.emailAttachment}>
        <Ionicons name="attach" size={16} color="#6e6e73" />
        <Text style={p.emailAttachmentText}>Partnership_Proposal_v2.pdf (2.4 MB)</Text>
      </View>
    </View>
  );
}

function RecordingContent() {
  const entries = [
    { time: '00:00', speaker: 'Jordan Mitchell', text: 'Good morning everyone. Let\'s get started with the Q4 review. I want to cover three main areas today — financial performance, client pipeline, and our hiring plan for next quarter.' },
    { time: '01:24', speaker: 'Sarah Mitchell', text: 'Thanks, Jordan. Starting with financials — we closed Q4 at $47,250 in total revenue, which is a 12.3% increase over Q3. Our largest contributor was the Apex Corp engagement at $18,400.' },
    { time: '03:15', speaker: 'Marcus Chen', text: 'On the pipeline side, we have three major proposals outstanding. The BlueSky Digital project is looking very promising — they\'ve moved to final review stage.' },
    { time: '05:02', speaker: 'Jordan Mitchell', text: 'Excellent. What\'s the timeline for a decision on BlueSky?' },
    { time: '05:18', speaker: 'Marcus Chen', text: 'They indicated we should hear back by end of next week. If approved, it would be our largest engagement to date at approximately $35,000.' },
    { time: '06:45', speaker: 'Sarah Mitchell', text: 'From a hiring perspective, we\'re looking to bring on two additional consultants and a junior designer. Budget has been allocated from the Q4 surplus.' },
  ];
  return (
    <View>
      <View style={p.docHeader}>
        <View>
          <Text style={p.companyName}>Meeting Transcript</Text>
          <Text style={p.reportTitle}>Q4 Business Review — All Hands</Text>
          <Text style={p.companyDetail}>Feb 13, 2025 • 10:00 AM — 10:45 AM • Duration: 45 min</Text>
        </View>
        <View style={[p.statusBadge, { backgroundColor: 'rgba(34, 197, 94, 0.12)', borderColor: 'rgba(34, 197, 94, 0.25)' }]}>
          <Text style={[p.statusBadgeText, { color: '#22c55e' }]}>TRANSCRIBED</Text>
        </View>
      </View>

      <View style={p.divider} />

      <Text style={p.sectionLabel}>PARTICIPANTS</Text>
      <Text style={p.companyDetail}>Jordan Mitchell (Host), Sarah Mitchell, Marcus Chen</Text>

      <View style={{ marginTop: 16 }}>
        <Text style={p.sectionLabel}>TRANSCRIPT</Text>
        {entries.map((entry, i) => (
          <View key={i} style={p.transcriptEntry}>
            <View style={p.transcriptMeta}>
              <Text style={p.transcriptTime}>{entry.time}</Text>
              <Text style={p.transcriptSpeaker}>{entry.speaker}</Text>
            </View>
            <Text style={p.transcriptText}>{entry.text}</Text>
          </View>
        ))}
      </View>
    </View>
  );
}

function GenericDocContent() {
  return (
    <View>
      <View style={p.docHeader}>
        <View>
          <Text style={p.companyName}>Zenith Solutions</Text>
          <Text style={p.reportTitle}>Project Proposal — Phase 2</Text>
          <Text style={p.companyDetail}>Prepared: February 13, 2025 • Version 2.1</Text>
        </View>
        <View style={p.statusBadge}>
          <Text style={p.statusBadgeText}>DRAFT</Text>
        </View>
      </View>

      <View style={p.divider} />

      <Text style={p.clauseTitle}>Executive Summary</Text>
      <Text style={p.clauseBody}>
        This proposal outlines the Phase 2 expansion of the digital transformation initiative for Apex Corporation. Building on the successful completion of Phase 1, which delivered a 23% improvement in operational efficiency, Phase 2 focuses on advanced automation, AI-powered analytics, and cross-platform integration.
      </Text>

      <Text style={p.clauseTitle}>Scope of Work</Text>
      <Text style={p.clauseBody}>
        The proposed engagement covers three primary workstreams: (1) Implementation of AI-driven process automation across customer service and operations departments, (2) Development of a unified analytics dashboard consolidating data from 12 source systems, and (3) Migration of legacy infrastructure to a cloud-native architecture.
      </Text>

      <Text style={p.clauseTitle}>Timeline & Investment</Text>
      <Text style={p.clauseBody}>
        Estimated project duration is 16 weeks, commencing March 2025. The total investment is $142,000, structured as four milestone-based payments. This includes all consulting services, development resources, and post-launch support for 60 days.
      </Text>

      <View style={p.footer}>
        <Text style={p.footerText}>Confidential — For authorized recipients only</Text>
      </View>
    </View>
  );
}

export function DocumentPreviewModal({ visible, onClose, type, documentName }: DocumentPreviewModalProps) {
  const meta = TYPE_META[type] || TYPE_META.document;

  const renderContent = () => {
    switch (type) {
      case 'invoice': return <InvoiceContent />;
      case 'contract': return <ContractContent />;
      case 'report': return <ReportContent />;
      case 'email': return <EmailContent />;
      case 'recording': return <RecordingContent />;
      default: return <GenericDocContent />;
    }
  };

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <Pressable style={p.backdrop} onPress={onClose}>
        <Pressable style={p.modalContainer} onPress={(e) => e.stopPropagation()}>
          <View style={p.modalHeader}>
            <View style={p.modalHeaderLeft}>
              <View style={[p.modalIcon, { backgroundColor: `${meta.accent}15` }]}>
                <Ionicons name={meta.icon} size={18} color={meta.accent} />
              </View>
              <View>
                <Text style={p.modalTitle}>{documentName || meta.title}</Text>
                <Text style={p.modalSubtitle}>{meta.title} Preview</Text>
              </View>
            </View>
            <View style={p.modalHeaderRight}>
              <Pressable style={({ hovered }: any) => [p.modalActionBtn, hovered && p.modalActionBtnHover]}>
                <Ionicons name="download-outline" size={16} color="#a1a1a6" />
              </Pressable>
              <Pressable style={({ hovered }: any) => [p.modalActionBtn, hovered && p.modalActionBtnHover]}>
                <Ionicons name="share-outline" size={16} color="#a1a1a6" />
              </Pressable>
              <Pressable onPress={onClose} style={({ hovered }: any) => [p.modalCloseBtn, hovered && p.modalCloseBtnHover]}>
                <Ionicons name="close" size={18} color="#a1a1a6" />
              </Pressable>
            </View>
          </View>

          <ScrollView style={p.modalBody} showsVerticalScrollIndicator={false} contentContainerStyle={p.modalBodyContent}>
            <View style={p.documentPage}>
              {renderContent()}
            </View>
          </ScrollView>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

const p = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.75)',
    justifyContent: 'center',
    alignItems: 'center',
    ...(Platform.OS === 'web' ? {
      backdropFilter: 'blur(8px)',
    } : {}),
  } as any,
  modalContainer: {
    width: '90%',
    maxWidth: 720,
    maxHeight: '88%',
    backgroundColor: '#111113',
    borderRadius: 20,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
    overflow: 'hidden',
    ...(Platform.OS === 'web' ? {
      boxShadow: '0 24px 80px rgba(0,0,0,0.7), 0 0 0 1px rgba(255,255,255,0.04)',
    } : {}),
  } as any,
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 24,
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,255,255,0.06)',
    backgroundColor: '#0d0d0f',
  },
  modalHeaderLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    flex: 1,
  },
  modalIcon: {
    width: 38,
    height: 38,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  modalTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: '#f2f2f2',
    letterSpacing: -0.2,
  },
  modalSubtitle: {
    fontSize: 12,
    color: '#6e6e73',
    marginTop: 2,
  },
  modalHeaderRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  modalActionBtn: {
    width: 34,
    height: 34,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255,255,255,0.04)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.06)',
    ...(Platform.OS === 'web' ? { transition: 'all 0.15s ease-out', cursor: 'pointer' } : {}),
  } as any,
  modalActionBtnHover: {
    backgroundColor: 'rgba(255,255,255,0.08)',
    borderColor: 'rgba(255,255,255,0.12)',
  },
  modalCloseBtn: {
    width: 34,
    height: 34,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255,255,255,0.04)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.06)',
    marginLeft: 4,
    ...(Platform.OS === 'web' ? { transition: 'all 0.15s ease-out', cursor: 'pointer' } : {}),
  } as any,
  modalCloseBtnHover: {
    backgroundColor: 'rgba(239, 68, 68, 0.12)',
    borderColor: 'rgba(239, 68, 68, 0.2)',
  },
  modalBody: {
    flex: 1,
  },
  modalBodyContent: {
    padding: 28,
  },
  documentPage: {
    backgroundColor: '#0f0f11',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.06)',
    padding: 32,
    ...(Platform.OS === 'web' ? {
      boxShadow: '0 2px 12px rgba(0,0,0,0.3)',
    } : {}),
  } as any,

  docHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 20,
  },
  companyName: {
    fontSize: 18,
    fontWeight: '700',
    color: '#f2f2f2',
    letterSpacing: -0.3,
  },
  companyDetail: {
    fontSize: 12,
    color: '#6e6e73',
    marginTop: 3,
  },
  invoiceMeta: {
    alignItems: 'flex-end',
  },
  invoiceNumber: {
    fontSize: 14,
    fontWeight: '700',
    color: '#3B82F6',
    letterSpacing: 0.5,
  },
  invoiceDate: {
    fontSize: 12,
    color: '#6e6e73',
    marginTop: 3,
  },
  statusBadge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 6,
    backgroundColor: 'rgba(245, 158, 11, 0.12)',
    borderWidth: 1,
    borderColor: 'rgba(245, 158, 11, 0.25)',
    marginTop: 8,
  },
  statusBadgeText: {
    fontSize: 10,
    fontWeight: '700',
    color: '#f59e0b',
    letterSpacing: 0.8,
  },

  divider: {
    height: 1,
    backgroundColor: 'rgba(255,255,255,0.06)',
    marginVertical: 18,
  },

  billTo: {
    marginBottom: 20,
  },
  sectionLabel: {
    fontSize: 10,
    fontWeight: '700',
    color: '#48484a',
    letterSpacing: 1,
    marginBottom: 6,
    textTransform: 'uppercase',
  },
  billToName: {
    fontSize: 14,
    fontWeight: '600',
    color: '#d1d1d6',
  },
  billToDetail: {
    fontSize: 12,
    color: '#6e6e73',
    marginTop: 2,
  },

  tableHeader: {
    flexDirection: 'row',
    paddingVertical: 10,
    paddingHorizontal: 12,
    backgroundColor: 'rgba(255,255,255,0.03)',
    borderRadius: 6,
    marginBottom: 2,
  },
  tableHeaderCell: {
    fontSize: 10,
    fontWeight: '700',
    color: '#48484a',
    letterSpacing: 0.8,
    textTransform: 'uppercase',
  },
  tableRow: {
    flexDirection: 'row',
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderRadius: 4,
  },
  tableRowAlt: {
    backgroundColor: 'rgba(255,255,255,0.015)',
  },
  tableCell: {
    fontSize: 13,
    color: '#a1a1a6',
  },
  tableCellBold: {
    fontSize: 13,
    color: '#d1d1d6',
    fontWeight: '600',
  },

  totalSection: {
    marginTop: 16,
    borderTopWidth: 1,
    borderTopColor: 'rgba(255,255,255,0.06)',
    paddingTop: 12,
    alignItems: 'flex-end',
  },
  totalRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    width: 220,
    paddingVertical: 4,
  },
  totalLabel: {
    fontSize: 13,
    color: '#6e6e73',
  },
  totalValue: {
    fontSize: 13,
    color: '#d1d1d6',
    fontWeight: '500',
  },
  grandTotal: {
    borderTopWidth: 1,
    borderTopColor: 'rgba(59, 130, 246, 0.2)',
    marginTop: 8,
    paddingTop: 10,
  },
  grandTotalLabel: {
    fontSize: 15,
    fontWeight: '700',
    color: '#f2f2f2',
  },
  grandTotalValue: {
    fontSize: 15,
    fontWeight: '700',
    color: '#3B82F6',
  },

  footer: {
    marginTop: 24,
    paddingTop: 16,
    borderTopWidth: 1,
    borderTopColor: 'rgba(255,255,255,0.04)',
  },
  footerText: {
    fontSize: 11,
    color: '#48484a',
    textAlign: 'center',
    marginBottom: 4,
  },

  contractTitle: {
    fontSize: 17,
    fontWeight: '700',
    color: '#f2f2f2',
    letterSpacing: 0.5,
  },
  contractParties: {
    flexDirection: 'row',
    gap: 24,
    marginBottom: 4,
  },
  partyBox: {
    flex: 1,
    backgroundColor: 'rgba(255,255,255,0.02)',
    borderRadius: 8,
    padding: 14,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.04)',
  },
  partyName: {
    fontSize: 14,
    fontWeight: '600',
    color: '#d1d1d6',
    marginBottom: 2,
  },
  clauseTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: '#d1d1d6',
    marginTop: 18,
    marginBottom: 8,
  },
  clauseBody: {
    fontSize: 13,
    color: '#8e8e93',
    lineHeight: 21,
  },
  signatureSection: {
    flexDirection: 'row',
    gap: 32,
    marginTop: 32,
  },
  signatureBox: {
    flex: 1,
    alignItems: 'center',
  },
  signatureLine: {
    width: '80%',
    height: 1,
    backgroundColor: 'rgba(255,255,255,0.15)',
    marginBottom: 10,
  },
  signatureLabel: {
    fontSize: 13,
    fontWeight: '600',
    color: '#a1a1a6',
  },
  signatureSub: {
    fontSize: 11,
    color: '#48484a',
    marginTop: 2,
  },

  reportTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#d1d1d6',
    marginTop: 4,
  },
  metricsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
    marginTop: 8,
  },
  metricCard: {
    flex: 1,
    minWidth: 140,
    backgroundColor: 'rgba(255,255,255,0.02)',
    borderRadius: 10,
    padding: 14,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.04)',
  },
  metricLabel: {
    fontSize: 11,
    color: '#6e6e73',
    fontWeight: '500',
    marginBottom: 6,
  },
  metricValue: {
    fontSize: 18,
    fontWeight: '700',
    color: '#f2f2f2',
    letterSpacing: -0.3,
  },
  metricChange: {
    fontSize: 12,
    fontWeight: '600',
    marginTop: 4,
  },

  emailHeader: {
    marginBottom: 4,
  },
  emailRow: {
    flexDirection: 'row',
    paddingVertical: 5,
    gap: 10,
  },
  emailLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: '#48484a',
    width: 55,
  },
  emailValue: {
    fontSize: 12,
    color: '#a1a1a6',
    flex: 1,
  },
  emailBody: {
    gap: 12,
  },
  emailBodyText: {
    fontSize: 13,
    color: '#8e8e93',
    lineHeight: 21,
  },
  emailListItem: {
    fontSize: 13,
    color: '#a1a1a6',
    lineHeight: 22,
    paddingLeft: 8,
  },
  emailAttachment: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingVertical: 10,
    paddingHorizontal: 12,
    backgroundColor: 'rgba(255,255,255,0.02)',
    borderRadius: 8,
    marginTop: 4,
  },
  emailAttachmentText: {
    fontSize: 12,
    color: '#6e6e73',
  },

  transcriptEntry: {
    marginBottom: 16,
    paddingLeft: 12,
    borderLeftWidth: 2,
    borderLeftColor: 'rgba(59, 130, 246, 0.2)',
  },
  transcriptMeta: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginBottom: 4,
  },
  transcriptTime: {
    fontSize: 11,
    fontWeight: '600',
    color: '#3B82F6',
    fontVariant: ['tabular-nums'],
  } as any,
  transcriptSpeaker: {
    fontSize: 12,
    fontWeight: '600',
    color: '#d1d1d6',
  },
  transcriptText: {
    fontSize: 13,
    color: '#8e8e93',
    lineHeight: 20,
  },
});
