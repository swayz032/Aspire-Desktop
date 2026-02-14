import React, { useState, useEffect, useRef, useCallback } from 'react';
import { StyleSheet, View, ScrollView, TouchableOpacity, Text, Platform, Animated, TextInput, Image, ImageBackground, Alert, Pressable } from 'react-native';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Colors, Typography, Spacing, BorderRadius, Shadows } from '@/constants/tokens';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { formatRelativeTime, formatMaskedPhone } from '@/lib/formatters';
import { seedDatabase } from '@/lib/mockSeed';
import { mailApi } from '@/lib/mailApi';
import { getOfficeItems, getCalls, getMailThreads, getContacts } from '@/lib/mockDb';
import { OfficeItem } from '@/types/inbox';
import { CallItem } from '@/types/calls';
import { MailThread } from '@/types/mail';
import { Contact } from '@/types/contacts';
import { useDesktop } from '@/lib/useDesktop';
import { DesktopPageWrapper } from '@/components/desktop/DesktopPageWrapper';
import { useConversation } from '@elevenlabs/react';

const eliAvatar = require('@/assets/avatars/eli-avatar.png');
const inboxHero = require('@/assets/images/inbox-hero.jpg');

type TabType = 'office' | 'calls' | 'mail' | 'contacts';

function getMailBody(item: MailThread): string {
  const bodies: Record<string, string> = {
    'Lease Renewal Draft v2 — Review Required': 'Dear Founder,\n\nPlease find attached the revised lease renewal draft (Version 2) for your review and consideration. After careful deliberation with our legal team, we have incorporated the feedback from our previous discussion on January 15th and made several substantive amendments to the original terms.\n\nKey revisions in this draft include an extended lease term option from the original 3-year period to a 5-year commitment, which provides greater operational stability for your organization. The annual escalation clause has been adjusted from 3.2% to 2.5%, reflecting current market conditions and our long-standing partnership. Additionally, we have introduced an early termination flexibility clause that becomes effective after Year 2, subject to a 90-day written notice period and a termination fee equivalent to three months\' rent.\n\nWe have also updated the maintenance responsibility matrix in Exhibit B, clarifying the landlord\'s obligations regarding HVAC system maintenance, common area upkeep, and structural repairs. The tenant improvement allowance has been increased to $45 per square foot for the first year, acknowledging the planned office reconfiguration you discussed with our facilities team.\n\nPlease review the attached documents at your earliest convenience. We would appreciate your feedback by February 15th to ensure continuity of occupancy. Our legal counsel is available for a walkthrough of any specific clauses that require clarification.\n\nBest regards,\nJames Morrison\nProperty Management Director\nPropertyGroup International',
    'Vendor Onboarding Checklist — Zenith Supplies': 'Dear Operations Team,\n\nThank you for initiating the vendor onboarding process with Zenith Supplies. We are pleased to move forward with formalizing our partnership and have prepared the complete onboarding documentation package for your review.\n\nThe attached checklist contains all required documentation items that must be completed before we can activate your vendor account in our procurement system. This includes: (1) a completed W-9 tax identification form, (2) proof of general liability insurance with a minimum coverage of $2,000,000, (3) workers\' compensation certificate of insurance, (4) signed vendor code of conduct agreement, and (5) banking information for ACH payment setup.\n\nOur standard payment terms are Net-30 from invoice receipt date, with a 2% early payment discount available for settlements within 10 business days. All purchase orders will be processed through our centralized procurement platform, and you will receive login credentials upon account activation.\n\nPlease note that per our compliance requirements, all new vendors must complete a background verification process which typically takes 5-7 business days. We recommend submitting all documentation promptly to avoid any delays in activating your account for the upcoming Q1 procurement cycle.\n\nShould you have any questions about the onboarding requirements or need assistance completing any of the forms, please don\'t hesitate to reach out to our vendor relations team at vendors@zenithsolutions.com.\n\nWarm regards,\nPatricia Lane\nVendor Relations Manager\nZenith Supplies',
    'Invoice #2026-01-11 — Payment Confirmation': 'Dear Accounts Team,\n\nThis email serves as official confirmation that we have received and processed your payment for Invoice #2026-01-11 in the amount of $47,250.00. The payment was received via ACH transfer on February 5, 2026, and has been applied to your account effective immediately.\n\nPayment Details:\n• Invoice Number: 2026-01-11\n• Payment Amount: $47,250.00\n• Payment Method: ACH Bank Transfer\n• Transaction Reference: ACH-2026-0205-7842\n• Date Received: February 5, 2026\n• Account Balance: $0.00 (Paid in Full)\n\nYour account is now current with no outstanding balances. The next billing cycle begins on March 1, 2026, and you can expect your next invoice on approximately March 5, 2026. As a reminder, your contracted service level includes premium support with a 4-hour response time SLA and dedicated account management.\n\nWe appreciate your continued partnership and timely payment. A formal receipt has been attached to this email for your financial records. If you require any additional documentation for audit purposes or have questions regarding your billing history, please contact our billing department directly.\n\nThank you for your business.\n\nBest regards,\nBilling Department\nAcme Corporation\nbilling@acmecorp.com',
    'Security Audit Schedule — Q1 2026': 'Dear IT Security Team,\n\nWe are writing to confirm the scheduling of your quarterly security compliance audit for Q1 2026. Based on our agreed-upon audit calendar, the on-site assessment has been scheduled for the week of February 17-21, 2026.\n\nThe audit scope for this quarter will encompass the following areas: (1) Network infrastructure security assessment including firewall configurations, intrusion detection systems, and VPN access controls; (2) Application security review covering your production web applications, API endpoints, and mobile applications; (3) Data protection compliance verification including encryption standards, access logging, and data retention policies; (4) Physical security evaluation of server rooms, access control systems, and visitor management procedures; (5) Employee security awareness assessment through simulated phishing exercises and policy compliance checks.\n\nTo facilitate a smooth audit process, we request that the following be prepared in advance: current network topology diagrams, access control lists for all critical systems, incident response logs from the past quarter, and a list of any system changes or new deployments since the last audit.\n\nOur audit team will consist of three senior security analysts who will require temporary badge access to your facilities. Please coordinate with your facilities management team to arrange workspace and necessary access credentials.\n\nWe will provide a preliminary findings report within 5 business days of audit completion, followed by a comprehensive final report with remediation recommendations within 15 business days.\n\nPlease confirm the scheduled dates at your earliest convenience.\n\nRegards,\nSecurity Audit Team\nCompliance Partners International',
    'Partnership Proposal — TechStart Inc': 'Dear Founder,\n\nFollowing our productive conversation last week, I wanted to formalize our partnership proposal and outline the strategic collaboration framework we discussed. TechStart Inc. believes there is significant mutual value in establishing a formal partnership between our organizations.\n\nProposed Partnership Structure:\nWe envision a two-phase partnership beginning with a 6-month pilot program focused on joint go-to-market activities in the enterprise SaaS vertical. During Phase 1, TechStart would provide access to our proprietary customer intelligence platform valued at $120,000 annually, while Zenith Solutions would contribute operational consulting services for our portfolio companies.\n\nRevenue Sharing Model:\nFor joint client engagements, we propose a 60/40 revenue split favoring the originating partner, with a mutual referral fee of 15% on independently sourced opportunities. Our financial modeling suggests this partnership could generate an additional $500,000-$750,000 in annual revenue for each organization within the first 18 months.\n\nKey Deliverables:\n• Joint marketing collateral and co-branded case studies\n• Quarterly business reviews and pipeline alignment sessions\n• Shared booth presence at three major industry conferences\n• Cross-training sessions for sales and customer success teams\n• Integrated technology demo environment for prospect presentations\n\nI have attached the detailed partnership agreement draft for your legal team\'s review. We are flexible on the specific terms and welcome your input on structuring an arrangement that maximizes value for both parties.\n\nI would love to schedule a follow-up call this week to discuss next steps.\n\nBest regards,\nKevin Zhang\nVP of Strategic Partnerships\nTechStart Inc.',
    'Monthly Expense Report — December 2025': 'Dear Founder,\n\nPlease find attached the monthly expense report for December 2025 for your review and approval. This report consolidates all departmental expenditures and provides a comprehensive overview of operational spending for the final month of the fiscal year.\n\nExpense Summary — December 2025:\n• Total Operating Expenses: $186,432.17\n• Personnel Costs: $112,500.00 (60.3% of total)\n• Software & Technology: $28,750.00 (15.4% of total)\n• Office & Facilities: $18,200.00 (9.8% of total)\n• Travel & Entertainment: $12,480.00 (6.7% of total)\n• Professional Services: $8,950.00 (4.8% of total)\n• Miscellaneous: $5,552.17 (3.0% of total)\n\nNotable items requiring attention: The software and technology category reflects a 12% increase over November due to the annual renewal of our Salesforce Enterprise license ($14,400) and the addition of two new project management tool seats. Travel expenses decreased by 22% month-over-month as the holiday period reduced client-facing travel.\n\nAll expenses have been verified against submitted receipts and purchase orders. Three items totaling $2,340 are flagged for your review as they fall outside standard approval thresholds: a team dinner for 12 at $1,200, a conference registration at $890, and emergency office supplies at $250.\n\nPlease approve or flag any items by end of week so we can close the December books and proceed with year-end reconciliation.\n\nBest regards,\nFinance Team\nZenith Solutions',
    'Contract Signature Required — Vendor Services': 'Dear Founder,\n\nA DocuSign envelope has been prepared and is awaiting your signature for the Vendor Services Agreement between Zenith Solutions and Meridian Business Services. This contract formalizes the managed IT support services engagement that was approved by the operations team last month.\n\nContract Summary:\n• Agreement Type: Master Services Agreement (MSA)\n• Vendor: Meridian Business Services, LLC\n• Contract Value: $96,000 annually ($8,000/month)\n• Term: 24 months with automatic renewal\n• Start Date: March 1, 2026\n• Services: Managed IT helpdesk, network monitoring, cybersecurity operations\n\nThe agreement includes a 90-day termination clause with written notice and a Service Level Agreement (SLA) guaranteeing 99.9% uptime for critical systems and a 15-minute response time for Priority 1 incidents. Liability is capped at 12 months of service fees.\n\nOur legal team has reviewed the final draft and confirmed all previously negotiated amendments have been incorporated, including the data processing addendum required for GDPR compliance and the mutual non-disclosure provisions.\n\nPlease click the DocuSign link below to review and sign the agreement. The signing process takes approximately 5 minutes and can be completed from any device. The counter-party has already executed their signature.\n\nThis contract requires execution by February 15th to ensure services begin on the agreed start date.\n\nThank you,\nDocuSign on behalf of Meridian Business Services',
    'Client Feedback Survey Results — Q4': 'Dear Founder,\n\nThe Q4 2025 client satisfaction survey results are now compiled and ready for your review. This quarter we achieved a 78% response rate across our active client base of 42 accounts, representing our highest participation rate in the past four quarters.\n\nKey Findings:\n• Overall Satisfaction Score: 4.6/5.0 (up from 4.3 in Q3)\n• Net Promoter Score (NPS): 72 (Industry average: 45)\n• Client Retention Rate: 96.4%\n• Average Response Time Satisfaction: 4.8/5.0\n• Quality of Deliverables: 4.5/5.0\n• Communication & Transparency: 4.4/5.0\n• Value for Investment: 4.2/5.0\n\nTop Strengths Identified: Clients consistently praised our responsive communication, technical expertise, and proactive problem-solving approach. Several enterprise clients specifically highlighted the value of our dedicated account management model.\n\nAreas for Improvement: The survey identified three areas warranting attention: (1) onboarding process duration — clients suggested streamlining the initial setup phase from the current 3-week average to under 2 weeks; (2) self-service reporting capabilities — 34% of respondents expressed interest in real-time dashboard access; (3) after-hours support availability — 28% of clients requested extended support hours beyond the current 8am-6pm window.\n\nWe have prepared a detailed action plan addressing each improvement area with proposed timelines and resource requirements. The full survey data, individual client responses, and trend analysis are included in the attached report.\n\nBest regards,\nCustomer Success Team\nZenith Solutions',
    'Insurance Renewal Notice — Business Liability': 'Dear Operations Team,\n\nThis notice is to inform you that your business liability insurance policy (Policy #BLI-2025-48291) is approaching its annual renewal date of March 1, 2026. To ensure continuous coverage and avoid any lapse in protection, we require your renewal decision and payment by February 20, 2026.\n\nCurrent Policy Summary:\n• Policy Type: Commercial General Liability (CGL)\n• Current Premium: $18,400/year\n• Coverage Limit: $5,000,000 per occurrence / $10,000,000 aggregate\n• Deductible: $2,500 per claim\n• Professional Liability (E&O): $3,000,000 included\n• Cyber Liability Endorsement: $2,000,000 included\n\nRenewal Options:\nWe are pleased to present three renewal options for your consideration. Option A maintains your current coverage levels at a renewed premium of $19,320 (a 5% increase reflecting market adjustments). Option B enhances your cyber liability coverage to $5,000,000 and adds employment practices liability for a premium of $23,100. Option C provides a comprehensive package including directors & officers coverage at $27,500.\n\nGiven the evolving cyber threat landscape and your company\'s growth trajectory, we recommend Option B as the most appropriate coverage level. The additional cyber liability protection addresses the increased exposure from your expanded digital operations and remote workforce.\n\nPlease review the attached comparison matrix and contact our office to discuss your renewal preference. We are available for a consultation call at your convenience.\n\nSincerely,\nInsurance Broker\nPremier Insurance Solutions',
    'IT Infrastructure Quote — Cloud Migration': 'Dear IT Team,\n\nAs discussed during our discovery session on January 22nd, we are pleased to present our comprehensive proposal for your cloud migration project. This proposal outlines our recommended approach to transitioning your on-premises infrastructure to a hybrid cloud environment.\n\nProject Scope:\nThe migration encompasses your current on-premises infrastructure including 12 physical servers, 3 NAS storage arrays (48TB total), and associated networking equipment. We propose a phased migration to AWS with the following architecture: production workloads on EC2 with auto-scaling groups, database tier migration to RDS Multi-AZ, object storage migration to S3 with lifecycle policies, and a site-to-site VPN for hybrid connectivity during the transition period.\n\nCost Analysis:\n• Current Annual Infrastructure Cost: $142,000 (hardware, maintenance, power, cooling)\n• Projected Annual Cloud Cost: $98,400 (31% reduction)\n• Migration Project Fee: $65,000 (one-time)\n• Estimated ROI Timeline: 18 months\n• Projected 3-Year Savings: $65,800\n\nTimeline:\n• Phase 1 (Weeks 1-4): Assessment, architecture design, and staging environment setup\n• Phase 2 (Weeks 5-8): Non-production workload migration and testing\n• Phase 3 (Weeks 9-12): Production migration with zero-downtime cutover\n• Phase 4 (Weeks 13-16): Optimization, monitoring setup, and knowledge transfer\n\nThe proposal includes 24/7 managed services for the first 6 months post-migration and comprehensive documentation for your team. We guarantee zero data loss during migration with our proven methodology.\n\nPlease review the attached detailed proposal and let us schedule a technical deep-dive session.\n\nBest regards,\nCloud Solutions Architecture Team',
    'Marketing Campaign Review — Q1 Digital': 'Dear Marketing Team,\n\nPlease review the proposed Q1 2026 digital marketing campaign strategy outlined below. Our team has developed a comprehensive multi-channel approach designed to increase brand awareness by 35% and generate 200+ qualified leads during the quarter.\n\nCampaign Overview:\nThe Q1 strategy centers on a "Digital Transformation Leadership" theme, positioning Zenith Solutions as the premier partner for mid-market companies navigating operational modernization. The campaign leverages content marketing, paid digital advertising, social media engagement, and targeted email nurture sequences.\n\nBudget Allocation — Total: $45,000:\n• Content Marketing & SEO: $12,000 (26.7%) — 8 long-form articles, 2 whitepapers, 1 industry report\n• LinkedIn Advertising: $15,000 (33.3%) — Sponsored content, InMail campaigns, lead gen forms\n• Google Ads (Search + Display): $10,000 (22.2%) — Branded and non-branded keyword targeting\n• Email Marketing: $3,000 (6.7%) — 12-touch nurture sequence for 3,500 prospects\n• Social Media Management: $5,000 (11.1%) — Daily posting, community engagement, influencer outreach\n\nKey Performance Indicators:\n• Website traffic increase: 40% quarter-over-quarter\n• Marketing Qualified Leads (MQLs): 200+\n• Cost per Lead target: $225 or below\n• Email open rate target: 28%+\n• LinkedIn engagement rate: 4.5%+\n\nThe creative assets are in final production and we are prepared to launch on February 15th pending your approval. Please provide feedback on the strategy, budget allocation, and creative direction by February 10th.\n\nBest regards,\nAccount Strategy Team\nDigital Marketing Agency',
    'Compliance Training Reminder': 'Dear Team,\n\nThis is an important reminder that annual compliance training certifications for several team members are due for renewal within the next 30 days. Maintaining current certifications is a regulatory requirement and essential for our continued compliance status with industry standards.\n\nThe following training modules must be completed by February 28, 2026:\n\n1. Anti-Money Laundering (AML) Awareness — All staff (2 hours)\n2. Data Privacy & Protection (GDPR/CCPA) — All staff handling client data (3 hours)\n3. Workplace Safety & Harassment Prevention — All staff (1.5 hours)\n4. Information Security Best Practices — IT and operations teams (2.5 hours)\n5. Code of Business Conduct & Ethics — All staff (1 hour)\n\nCurrent Completion Status:\n• Completed: 18 of 26 team members (69%)\n• In Progress: 4 team members (15%)\n• Not Started: 4 team members (15%)\n\nAll training modules are accessible through our Learning Management System (LMS) at training.zenithsolutions.com. Each module includes video content, reading materials, and a certification quiz requiring a minimum score of 85% to pass. Certificates of completion are automatically generated and filed in your personnel record.\n\nPlease note that failure to complete required training by the deadline may result in temporary suspension of system access privileges until certifications are current. Managers are responsible for ensuring their direct reports complete all assigned modules on time.\n\nIf you experience any technical issues with the LMS platform or need schedule accommodations, please contact HR.\n\nBest regards,\nHR Department\nZenith Solutions',
    'Board Meeting Minutes — December': 'Dear Founder,\n\nAttached please find the official minutes from the Board of Directors meeting held on December 18, 2025. The meeting was called to order at 10:00 AM EST with all five board members present, constituting a quorum.\n\nAgenda items discussed and key resolutions include:\n\n1. Financial Review — The CFO presented Q4 preliminary financials showing revenue of $2.4M (8% above forecast) and EBITDA margin of 22%. The board approved the FY2026 operating budget of $9.8M with a capital expenditure allocation of $450K.\n\n2. Strategic Initiatives — The board reviewed and approved three strategic priorities for 2026: (a) expansion into the healthcare vertical with a target of 5 new enterprise clients, (b) launch of the managed services division by Q2, and (c) investment in AI-powered automation capabilities.\n\n3. Governance — The board ratified updates to the company\'s data retention policy and approved the appointment of an independent audit committee member. The annual conflict of interest disclosures were collected from all directors.\n\n4. Compensation — The compensation committee presented its annual review, approving a 4% merit increase pool for FY2026 and revised equity vesting schedules for senior leadership.\n\nThe next regularly scheduled board meeting is March 19, 2026. Please review the attached minutes and notify the corporate secretary of any corrections by January 15, 2026.\n\nRespectfully submitted,\nExecutive Assistant\nOffice of the CEO',
    'Quarterly Tax Filing Reminder': 'Dear Finance Team,\n\nThis is a formal reminder that Q4 2025 estimated tax payments and associated filings are due by January 31, 2026. Based on our preliminary review of your financial records, we have identified several action items that require your immediate attention.\n\nFiling Requirements:\n• Federal Estimated Tax Payment (Form 1040-ES): Due January 31, 2026\n• State Estimated Tax Payment: Due January 31, 2026\n• Annual Payroll Tax Returns (Form 940/941): Due January 31, 2026\n• W-2 Distribution to Employees: Due January 31, 2026\n• 1099-NEC Filing for Contractors: Due January 31, 2026\n• State Sales Tax Return (Q4): Due February 20, 2026\n\nPreliminary Tax Estimates:\nBased on the financial data available through November 30, 2025, we estimate your Q4 federal tax liability at approximately $38,500. We will finalize this figure once December financials are closed. State tax obligations are estimated at $12,200.\n\nTo ensure timely and accurate filing, we need the following from your team by January 20, 2026: (1) finalized December 2025 profit and loss statement, (2) updated contractor payment records for Q4, (3) confirmation of any year-end equipment purchases qualifying for Section 179 deduction, and (4) final payroll summaries including bonus payments.\n\nOur team is available for a year-end tax planning call to discuss any strategies for optimizing your tax position. Please don\'t hesitate to reach out with questions.\n\nSincerely,\nTax Advisory Team\nPremier Accounting Firm',
    'New Client Onboarding — Apex Industries': 'Dear Founder,\n\nWe are excited to welcome Apex Industries as our newest enterprise client. The onboarding team has prepared a comprehensive welcome packet and structured onboarding schedule to ensure a smooth transition and rapid time-to-value for the client.\n\nClient Profile:\n• Company: Apex Industries, LLC\n• Industry: Advanced Manufacturing\n• Annual Revenue: $28M\n• Employees: 180\n• Contract Value: $144,000/year (Tier 2 Enterprise)\n• Primary Contact: Rachel Torres, VP of Operations\n• Engagement Start Date: February 1, 2026\n\nOnboarding Timeline (4 weeks):\nWeek 1: Discovery & requirements gathering sessions with key stakeholders. We will conduct a comprehensive needs assessment across operations, finance, and IT departments.\nWeek 2: System configuration, data migration planning, and integration setup with their existing ERP (SAP Business One) and CRM (HubSpot Enterprise).\nWeek 3: User acceptance testing, training sessions for 25 primary users, and development of custom reporting dashboards.\nWeek 4: Go-live preparation, parallel processing validation, and formal handoff to the dedicated account management team.\n\nThe dedicated account team consists of Marcus Chen (Account Manager), Sarah Wells (Technical Lead), and Diana Park (Customer Success Manager). A kickoff call has been scheduled for February 3, 2026, at 2:00 PM EST.\n\nPlease review the attached welcome packet and onboarding plan. Your involvement in the Week 1 discovery sessions would be highly valuable.\n\nBest regards,\nClient Success Team\nZenith Solutions',
  };
  return bodies[item.subject] || item.preview;
}

function getCallSummary(item: CallItem): string {
  const summaries: Record<string, string> = {
    'Michael Chen': 'Call with Michael Chen regarding a new enterprise sales opportunity. Michael expressed strong interest in our Tier 2 managed services package for his 200-person organization. Key discussion points included pricing structure, implementation timeline, and integration requirements with their existing Salesforce instance.\n\n• Action Item: Send detailed proposal with custom pricing by end of week\n• Action Item: Schedule technical discovery session with their IT director\n• Action Item: Prepare case study from similar-sized manufacturing client\n• Follow-up: Michael will present our proposal to their executive committee on Thursday\n• Priority: High — potential $180K annual contract value',
    'David Martinez': 'Outbound call to David Martinez at Pinnacle Financial regarding their outstanding invoice #2025-12-08 ($23,400) and upcoming contract renewal. David confirmed payment has been processed via wire transfer and should clear within 2-3 business days.\n\n• Action Item: Verify payment receipt with accounting by Wednesday\n• Action Item: Send renewal proposal with updated pricing tiers\n• Discussion Point: David requested a 10% volume discount for 2026 given their increased usage\n• Follow-up: Schedule Q1 business review meeting for late February\n• Note: David mentioned potential expansion to their West Coast office (additional 45 users)',
    'Emily Watson': 'Voicemail from Emily Watson at Henderson & Associates law firm regarding the pending NDA review for the Meridian partnership agreement. Emily indicated her team has completed their legal review and has three minor redline items to discuss before finalizing.\n\n• Action Item: Return call to Emily before end of business today\n• Action Item: Forward redlined NDA draft to internal legal counsel for review\n• Action Item: Schedule 30-minute call to resolve remaining contract language items\n• Deadline: NDA must be executed by February 14th per partnership timeline\n• Priority: High — blocking item for TechStart partnership launch',
    'Robert Kim': 'Extended call with Robert Kim, COO of Vertex Operations, covering quarterly business review and strategic planning for 2026. Robert expressed high satisfaction with current service delivery (4.8/5.0 satisfaction score) and discussed expanding the engagement scope.\n\n• Action Item: Prepare SOW amendment for additional project management services\n• Action Item: Send revised capacity plan reflecting 30% scope increase\n• Action Item: Arrange meeting between Robert and our VP of Client Success\n• Discussion Point: Robert interested in our new AI-powered analytics dashboard (beta)\n• Revenue Impact: Potential upsell of $60K annually if expanded scope approved\n• Follow-up: Robert to provide final budget approval by February 20th',
    'Jennifer Lee': 'Outbound call to Jennifer Lee, CFO of NovaTech Solutions, regarding their annual financial services renewal and accounts receivable reconciliation. Jennifer confirmed approval of the 2026 service agreement and requested updated payment terms.\n\n• Action Item: Process contract renewal with Net-45 payment terms (approved exception)\n• Action Item: Send credit memo for $3,200 overpayment identified in December audit\n• Action Item: Update billing contact to Jennifer\'s new assistant, Mark Thompson\n• Discussion Point: Jennifer inquired about our fractional CFO advisory services\n• Follow-up: Send fractional CFO service brochure and schedule introductory call\n• Note: NovaTech planning Series B fundraise — may need enhanced financial reporting',
    'Thomas Brown': 'Inbound call from Thomas Brown at Cascade Logistics regarding an urgent operational issue with their shipment tracking integration. The API connection experienced intermittent failures over the weekend, resulting in approximately 40 missed tracking updates.\n\n• Action Item: Escalate API connectivity issue to engineering team immediately\n• Action Item: Provide Thomas with incident report within 24 hours\n• Action Item: Manually reconcile the 40 missed tracking updates by end of day\n• Root Cause: Preliminary assessment suggests SSL certificate rotation caused handshake failures\n• SLA Impact: This incident may trigger a service credit under their Tier 1 SLA terms\n• Follow-up: Thomas expects a resolution update by 3:00 PM today',
  };
  return summaries[item.callerName] || `Call with ${item.callerName} regarding ${item.tags.join(' & ').toLowerCase()} matters. Duration: ${item.duration}. Outcome: ${item.outcome}. Follow-up actions may be required based on discussion points.`;
}

const TAG_COLORS: Record<string, { bg: string; text: string }> = {
  Legal: { bg: 'rgba(139, 92, 246, 0.2)', text: '#A78BFA' },
  Finance: { bg: 'rgba(251, 191, 36, 0.2)', text: '#FBBF24' },
  Ops: { bg: 'rgba(59, 130, 246, 0.2)', text: '#60A5FA' },
  Security: { bg: 'rgba(239, 68, 68, 0.2)', text: '#F87171' },
  Sales: { bg: 'rgba(34, 197, 94, 0.2)', text: '#4ADE80' },
};

const PRIORITY_ACCENT: Record<string, string> = {
  High: Colors.semantic.error,
  Medium: Colors.semantic.warning,
  Low: Colors.accent.cyan,
};

const PRIORITY_PILL: Record<string, { bg: string; text: string }> = {
  High: { bg: Colors.semantic.errorLight, text: Colors.semantic.error },
  Medium: { bg: Colors.semantic.warningLight, text: Colors.semantic.warning },
  Low: { bg: Colors.accent.cyanLight, text: Colors.accent.cyan },
};

const ROLE_COLORS: Record<string, string> = {
  Client: Colors.semantic.success,
  Vendor: Colors.accent.cyan,
  Internal: '#A78BFA',
  Partner: Colors.accent.amber,
};

const TAB_CONFIG: { key: TabType; label: string; icon: keyof typeof Ionicons.glyphMap }[] = [
  { key: 'office', label: 'Office', icon: 'briefcase' },
  { key: 'calls', label: 'Calls', icon: 'call' },
  { key: 'mail', label: 'Mail', icon: 'mail' },
  { key: 'contacts', label: 'Contacts', icon: 'people' },
];

type FilterConfig = { label: string; icon: keyof typeof Ionicons.glyphMap };

const FILTERS: Record<TabType, FilterConfig[]> = {
  office: [
    { label: 'All', icon: 'grid' },
    { label: 'Unread', icon: 'mail-unread' },
    { label: 'Urgent', icon: 'alert-circle' },
    { label: 'Starred', icon: 'star' },
    { label: 'Archived', icon: 'archive' },
  ],
  calls: [
    { label: 'All', icon: 'grid' },
    { label: 'Inbound', icon: 'arrow-down' },
    { label: 'Outbound', icon: 'arrow-up' },
    { label: 'Missed', icon: 'close-circle' },
    { label: 'Voicemail', icon: 'recording' },
    { label: 'Blocked', icon: 'ban' },
  ],
  mail: [
    { label: 'All', icon: 'grid' },
    { label: 'Unread', icon: 'mail-unread' },
    { label: 'Starred', icon: 'star' },
    { label: 'Sent', icon: 'send' },
    { label: 'Drafts', icon: 'document-text' },
    { label: 'Junk', icon: 'trash' },
  ],
  contacts: [
    { label: 'All', icon: 'grid' },
    { label: 'Clients', icon: 'business' },
    { label: 'Vendors', icon: 'cube' },
    { label: 'Team', icon: 'people-circle' },
    { label: 'Starred', icon: 'star' },
    { label: 'Recent', icon: 'time' },
  ],
};

const EMPTY_STATE_MAP: Record<string, { icon: keyof typeof Ionicons.glyphMap; title: string; subtitle: string }> = {
  Archived: { icon: 'archive-outline', title: 'No Archived items', subtitle: 'Archived items will appear here' },
  Starred: { icon: 'star-outline', title: 'No Starred items', subtitle: 'Star important items for quick access' },
  Sent: { icon: 'send-outline', title: 'No Sent items', subtitle: 'Sent messages will appear here' },
  Drafts: { icon: 'document-text-outline', title: 'No Drafts', subtitle: 'Draft messages will appear here' },
  Junk: { icon: 'trash-outline', title: 'No Junk mail', subtitle: 'Junk mail will appear here' },
  Inbound: { icon: 'arrow-down-outline', title: 'No Inbound calls', subtitle: 'Inbound calls will appear here' },
  Outbound: { icon: 'arrow-up-outline', title: 'No Outbound calls', subtitle: 'Outbound calls will appear here' },
  Missed: { icon: 'close-circle-outline', title: 'No Missed calls', subtitle: 'Missed calls will appear here' },
  Voicemail: { icon: 'recording-outline', title: 'No Voicemails', subtitle: 'Voicemails will appear here' },
  Blocked: { icon: 'ban-outline', title: 'No Blocked calls', subtitle: 'Blocked calls will appear here' },
  Unread: { icon: 'mail-unread-outline', title: 'No Unread items', subtitle: 'All caught up!' },
  Urgent: { icon: 'alert-circle-outline', title: 'No Urgent items', subtitle: 'No urgent items at this time' },
  Clients: { icon: 'business-outline', title: 'No Clients', subtitle: 'Client contacts will appear here' },
  Vendors: { icon: 'cube-outline', title: 'No Vendors', subtitle: 'Vendor contacts will appear here' },
  Team: { icon: 'people-circle-outline', title: 'No Team contacts', subtitle: 'Team contacts will appear here' },
  Recent: { icon: 'time-outline', title: 'No Recent contacts', subtitle: 'Recently contacted people will appear here' },
  default: { icon: 'file-tray-outline', title: 'No items found', subtitle: 'Nothing to show for this filter' },
};

const isWeb = Platform.OS === 'web';

function OfficeItemCard({ item, selected, onPress }: { item: OfficeItem; selected: boolean; onPress: () => void }) {
  const [hovered, setHovered] = useState(false);
  const accentColor = PRIORITY_ACCENT[item.priority] || Colors.surface.cardBorder;
  const priorityPill = PRIORITY_PILL[item.priority];

  return (
    <TouchableOpacity
      style={[
        styles.card,
        { borderLeftWidth: 3, borderLeftColor: accentColor },
        selected && styles.cardSelected,
        hovered && isWeb && styles.cardHover,
      ]}
      onPress={onPress}
      activeOpacity={0.7}
      {...(isWeb ? { onMouseEnter: () => setHovered(true), onMouseLeave: () => setHovered(false) } : {})}
    >
      <View style={styles.cardRow}>
        <View style={styles.iconCircle}>
          <Ionicons name="briefcase" size={20} color={Colors.accent.cyan} />
        </View>
        <View style={{ flex: 1, marginLeft: Spacing.md }}>
          <View style={styles.titleRow}>
            {item.unread && <View style={styles.unreadDot} />}
            <Text style={styles.cardTitle} numberOfLines={1}>{item.title}</Text>
          </View>
          <Text style={styles.cardSubtitle}>{item.department} · {item.requestType}</Text>
        </View>
        <View style={styles.cardRight}>
          <Text style={styles.timeText}>{formatRelativeTime(item.timestamp)}</Text>
          {priorityPill && (
            <View style={[styles.priorityPill, { backgroundColor: priorityPill.bg }]}>
              <Text style={[styles.priorityPillText, { color: priorityPill.text }]}>{item.priority}</Text>
            </View>
          )}
        </View>
      </View>
      <Text style={styles.previewText} numberOfLines={1}>{item.preview}</Text>
      <View style={styles.tagsRow}>
        {item.tags.slice(0, 3).map((tag) => (
          <View key={tag} style={[styles.tag, { backgroundColor: TAG_COLORS[tag]?.bg || Colors.background.tertiary }]}>
            <Text style={[styles.tagText, { color: TAG_COLORS[tag]?.text || Colors.text.secondary }]}>{tag}</Text>
          </View>
        ))}
        <Text style={styles.assignedText}>Assigned to {item.assignedTo}</Text>
      </View>
    </TouchableOpacity>
  );
}

function CallItemCard({ item, selected, onPress }: { item: CallItem; selected: boolean; onPress: () => void }) {
  const [hovered, setHovered] = useState(false);
  const accentColor = PRIORITY_ACCENT[item.priority] || Colors.surface.cardBorder;

  const getCallIconAndColor = (): { icon: keyof typeof Ionicons.glyphMap; color: string; bg: string } => {
    switch (item.callType) {
      case 'inbound': return { icon: 'call', color: Colors.semantic.success, bg: Colors.semantic.successLight };
      case 'outbound': return { icon: 'call', color: Colors.semantic.success, bg: Colors.semantic.successLight };
      case 'missed': return { icon: 'call', color: Colors.semantic.error, bg: Colors.semantic.errorLight };
      case 'voicemail': return { icon: 'recording', color: Colors.semantic.warning, bg: Colors.semantic.warningLight };
      case 'blocked': return { icon: 'close-circle', color: Colors.semantic.error, bg: Colors.semantic.errorLight };
      default: return { icon: 'call', color: Colors.semantic.success, bg: Colors.semantic.successLight };
    }
  };

  const { icon, color, bg } = getCallIconAndColor();
  const outcomeColor = item.outcome === 'Completed' ? Colors.semantic.success : item.outcome === 'Missed' || item.outcome === 'Blocked' ? Colors.semantic.error : Colors.accent.amber;
  const outcomeBg = item.outcome === 'Completed' ? Colors.semantic.successLight : item.outcome === 'Missed' || item.outcome === 'Blocked' ? Colors.semantic.errorLight : Colors.accent.amberLight;

  return (
    <TouchableOpacity
      style={[
        styles.card,
        { borderLeftWidth: 3, borderLeftColor: accentColor },
        selected && styles.cardSelected,
        hovered && isWeb && styles.cardHover,
      ]}
      onPress={onPress}
      activeOpacity={0.7}
      {...(isWeb ? { onMouseEnter: () => setHovered(true), onMouseLeave: () => setHovered(false) } : {})}
    >
      <View style={styles.cardRow}>
        <View style={[styles.iconCircle, { backgroundColor: bg }]}>
          <Ionicons name={icon} size={20} color={color} />
        </View>
        <View style={{ flex: 1, marginLeft: Spacing.md }}>
          <Text style={styles.cardTitle}>{item.callerName}</Text>
          <Text style={styles.cardSubtitle}>{formatMaskedPhone(item.callerNumber)}</Text>
        </View>
        <View style={styles.cardRight}>
          <Text style={styles.timeText}>{formatRelativeTime(item.timestamp)}</Text>
          <Text style={styles.durationText}>{item.duration}</Text>
        </View>
      </View>
      <View style={styles.callMetaRow}>
        <View style={[styles.outcomePill, { backgroundColor: outcomeBg }]}>
          <Text style={[styles.outcomePillText, { color: outcomeColor }]}>{item.outcome}</Text>
        </View>
        {item.hasSummary && (
          <View style={styles.summaryBadge}>
            <Ionicons name="sparkles" size={12} color={Colors.accent.cyan} />
            <Text style={styles.summaryText}>Summary Ready</Text>
          </View>
        )}
      </View>
    </TouchableOpacity>
  );
}

function MailItemCard({ item, selected, onPress }: { item: MailThread; selected: boolean; onPress: () => void }) {
  const [hovered, setHovered] = useState(false);
  const accentColor = PRIORITY_ACCENT[item.priority] || Colors.surface.cardBorder;

  return (
    <TouchableOpacity
      style={[
        styles.card,
        { borderLeftWidth: 3, borderLeftColor: accentColor },
        selected && styles.cardSelected,
        hovered && isWeb && styles.cardHover,
      ]}
      onPress={onPress}
      activeOpacity={0.7}
      {...(isWeb ? { onMouseEnter: () => setHovered(true), onMouseLeave: () => setHovered(false) } : {})}
    >
      <View style={styles.cardRow}>
        <View style={styles.mailAvatar}>
          <Text style={styles.mailAvatarText}>{item.senderName.charAt(0)}</Text>
        </View>
        <View style={{ flex: 1, marginLeft: Spacing.md }}>
          <View style={styles.titleRow}>
            {item.unread && <View style={styles.unreadDot} />}
            <Text style={styles.cardTitle} numberOfLines={1}>{item.subject}</Text>
          </View>
          <Text style={styles.cardSubtitle}>{item.senderName}</Text>
        </View>
        <View style={styles.cardRight}>
          <Text style={styles.timeText}>{formatRelativeTime(item.timestamp)}</Text>
          {item.hasAttachments && <Ionicons name="attach" size={14} color={Colors.text.muted} style={{ marginTop: 4 }} />}
        </View>
      </View>
      <Text style={styles.previewText} numberOfLines={1}>{item.preview}</Text>
      <View style={styles.mailMetaRow}>
        <View style={styles.msgCountPill}>
          <Text style={styles.msgCountText}>{item.messageCount} messages</Text>
        </View>
        {item.tags.length > 0 && (
          <View style={styles.eliReviewBadge}>
            <Ionicons name="sparkles" size={10} color={Colors.accent.cyan} />
            <Text style={styles.eliReviewText}>Eli reviewed</Text>
          </View>
        )}
        {item.tags.slice(0, 2).map((tag) => (
          <View key={tag} style={[styles.tag, { backgroundColor: TAG_COLORS[tag]?.bg || Colors.background.tertiary }]}>
            <Text style={[styles.tagText, { color: TAG_COLORS[tag]?.text || Colors.text.secondary }]}>{tag}</Text>
          </View>
        ))}
      </View>
    </TouchableOpacity>
  );
}

function ContactItemCard({ item, selected, onPress }: { item: Contact; selected: boolean; onPress: () => void }) {
  const [hovered, setHovered] = useState(false);
  const roleColor = ROLE_COLORS[item.role] || Colors.text.secondary;

  return (
    <TouchableOpacity
      style={[
        styles.card,
        { borderLeftWidth: 3, borderLeftColor: Colors.surface.cardBorder },
        selected && styles.cardSelected,
        hovered && isWeb && styles.cardHover,
      ]}
      onPress={onPress}
      activeOpacity={0.7}
      {...(isWeb ? { onMouseEnter: () => setHovered(true), onMouseLeave: () => setHovered(false) } : {})}
    >
      <View style={styles.cardRow}>
        <View style={styles.contactAvatar}>
          <Text style={styles.contactAvatarText}>{item.name.charAt(0)}</Text>
        </View>
        <View style={{ flex: 1, marginLeft: Spacing.md }}>
          <Text style={styles.cardTitle}>{item.name}</Text>
          <Text style={styles.cardSubtitle}>{item.title}</Text>
          <Text style={styles.orgText}>{item.organization}</Text>
        </View>
        <View style={styles.cardRight}>
          <View style={[styles.rolePill, { borderColor: roleColor }]}>
            <Text style={[styles.rolePillText, { color: roleColor }]}>{item.role}</Text>
          </View>
        </View>
      </View>
      <View style={styles.contactMetaRow}>
        <Text style={styles.lastContactedText}>Last contacted {formatRelativeTime(item.lastContacted)}</Text>
      </View>
    </TouchableOpacity>
  );
}

function EmptyState({ filter }: { filter: string }) {
  const config = EMPTY_STATE_MAP[filter] || EMPTY_STATE_MAP.default;
  return (
    <View style={styles.emptyState}>
      <Ionicons name={config.icon} size={48} color={Colors.text.disabled} />
      <Text style={styles.emptyTitle}>{config.title}</Text>
      <Text style={styles.emptySubtitle}>{config.subtitle}</Text>
    </View>
  );
}


function OfficePreview({ item }: { item: OfficeItem }) {
  const priorityPill = PRIORITY_PILL[item.priority];
  const timelineSteps = ['Received', 'In Review', 'Resolved'];
  const currentStep = item.status === 'resolved' ? 2 : item.status === 'in_progress' ? 1 : 0;
  return (
    <View style={fp.section}>
      <View style={fp.headerRow}>
        <View style={{ flex: 1 }}>
          <View style={fp.badgeRow}>
            {priorityPill && (
              <View style={[fp.badge, { backgroundColor: priorityPill.bg }]}>
                <Ionicons name="flag" size={11} color={priorityPill.text} />
                <Text style={[fp.badgeText, { color: priorityPill.text }]}>{item.priority} Priority</Text>
              </View>
            )}
            {item.unread && (
              <View style={[fp.badge, { backgroundColor: Colors.accent.cyanLight }]}>
                <Text style={[fp.badgeText, { color: Colors.accent.cyan }]}>Unread</Text>
              </View>
            )}
          </View>
          <Text style={fp.pageTitle}>{item.title}</Text>
          <Text style={fp.timestamp}>{formatRelativeTime(item.timestamp)}</Text>
        </View>
      </View>
      <View style={fp.divider} />
      <View style={fp.chipRow}>
        <View style={fp.contextChip}>
          <Ionicons name="business" size={14} color={Colors.accent.cyan} />
          <View>
            <Text style={fp.chipLabel}>Department</Text>
            <Text style={fp.chipValue}>{item.department}</Text>
          </View>
        </View>
        <View style={fp.contextChip}>
          <Ionicons name="document-text" size={14} color={Colors.accent.amber} />
          <View>
            <Text style={fp.chipLabel}>Request Type</Text>
            <Text style={fp.chipValue}>{item.requestType}</Text>
          </View>
        </View>
        <View style={fp.contextChip}>
          <Ionicons name="person" size={14} color={Colors.semantic.success} />
          <View>
            <Text style={fp.chipLabel}>Assigned To</Text>
            <Text style={fp.chipValue}>{item.assignedTo}</Text>
          </View>
        </View>
      </View>
      <View style={fp.divider} />
      <Text style={fp.sectionLabel}>Message</Text>
      <View style={fp.bodyCard}>
        <Text style={fp.bodyText}>{item.body || item.preview}</Text>
      </View>
      <View style={fp.divider} />
      <Text style={fp.sectionLabel}>Tags</Text>
      <View style={fp.tagsRow}>
        {item.tags.map((tag) => (
          <View key={tag} style={[styles.tag, { backgroundColor: TAG_COLORS[tag]?.bg || Colors.background.tertiary }]}>
            <Text style={[styles.tagText, { color: TAG_COLORS[tag]?.text || Colors.text.secondary }]}>{tag}</Text>
          </View>
        ))}
      </View>
      <View style={fp.divider} />
      <Text style={fp.sectionLabel}>Status Timeline</Text>
      <View style={fp.timelineRow}>
        {timelineSteps.map((step, idx) => {
          const isActive = idx <= currentStep;
          const isCurrent = idx === currentStep;
          return (
            <React.Fragment key={step}>
              {idx > 0 && <View style={[fp.timelineConnector, isActive && { backgroundColor: Colors.accent.cyan }]} />}
              <View style={fp.timelineStep}>
                <View style={[fp.timelineDot, isActive && { backgroundColor: Colors.accent.cyan, borderColor: Colors.accent.cyan }, isCurrent && { ...Shadows.glow(Colors.accent.cyan) }]}>
                  {isActive && <Ionicons name="checkmark" size={10} color="#fff" />}
                </View>
                <Text style={[fp.timelineLabel, isActive && { color: Colors.text.primary }]}>{step}</Text>
              </View>
            </React.Fragment>
          );
        })}
      </View>
      <View style={fp.divider} />
      <View style={fp.actionBar}>
        <TouchableOpacity style={[fp.actionBtn, { backgroundColor: Colors.semantic.successLight, borderColor: Colors.semantic.success + '44' }]} activeOpacity={0.7}>
          <Ionicons name="checkmark-circle" size={16} color={Colors.semantic.success} />
          <Text style={[fp.actionBtnText, { color: Colors.semantic.success }]}>Approve</Text>
        </TouchableOpacity>
        <TouchableOpacity style={[fp.actionBtn, { backgroundColor: Colors.accent.cyanLight, borderColor: Colors.accent.cyan + '44' }]} activeOpacity={0.7}>
          <Ionicons name="chatbubble" size={16} color={Colors.accent.cyan} />
          <Text style={[fp.actionBtnText, { color: Colors.accent.cyan }]}>Reply</Text>
        </TouchableOpacity>
        <TouchableOpacity style={fp.actionBtn} activeOpacity={0.7}>
          <Ionicons name="arrow-redo" size={16} color={Colors.text.tertiary} />
          <Text style={fp.actionBtnText}>Forward</Text>
        </TouchableOpacity>
        <TouchableOpacity style={fp.actionBtn} activeOpacity={0.7}>
          <Ionicons name="trending-up" size={16} color={Colors.semantic.warning} />
          <Text style={[fp.actionBtnText, { color: Colors.semantic.warning }]}>Escalate</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

function CallPreview({ item }: { item: CallItem }) {
  const outcomeColor = item.outcome === 'Completed' ? Colors.semantic.success : item.outcome === 'Missed' || item.outcome === 'Blocked' ? Colors.semantic.error : Colors.accent.amber;
  const typeColor = item.callType === 'missed' || item.callType === 'blocked' ? Colors.semantic.error : item.callType === 'voicemail' ? Colors.semantic.warning : Colors.semantic.success;
  const typeLabel = item.callType.charAt(0).toUpperCase() + item.callType.slice(1);
  const typeIcon: keyof typeof Ionicons.glyphMap = item.callType === 'inbound' ? 'arrow-down' : item.callType === 'outbound' ? 'arrow-up' : item.callType === 'missed' ? 'close' : item.callType === 'voicemail' ? 'recording' : 'close-circle';
  return (
    <View style={fp.section}>
      <View style={fp.headerRow}>
        <View style={[fp.callerAvatar, { backgroundColor: typeColor + '22', borderColor: typeColor + '44' }]}>
          <Ionicons name="call" size={28} color={typeColor} />
        </View>
        <View style={{ flex: 1, marginLeft: Spacing.lg }}>
          <Text style={fp.pageTitle}>{item.callerName}</Text>
          <Text style={fp.subtitleText}>{formatMaskedPhone(item.callerNumber)}</Text>
          <View style={[fp.badge, { backgroundColor: typeColor + '22', alignSelf: 'flex-start', marginTop: Spacing.xs }]}>
            <Ionicons name={typeIcon} size={11} color={typeColor} />
            <Text style={[fp.badgeText, { color: typeColor }]}>{typeLabel}</Text>
          </View>
        </View>
        <Text style={fp.timestamp}>{formatRelativeTime(item.timestamp)}</Text>
      </View>
      <View style={fp.divider} />
      <View style={fp.metricGrid}>
        <View style={fp.metricCard}>
          <Ionicons name="time-outline" size={20} color={Colors.accent.cyan} />
          <Text style={fp.metricLabel}>Duration</Text>
          <Text style={fp.metricValue}>{item.duration}</Text>
        </View>
        <View style={fp.metricCard}>
          <View style={[fp.metricDot, { backgroundColor: outcomeColor }]} />
          <Text style={fp.metricLabel}>Outcome</Text>
          <Text style={[fp.metricValue, { color: outcomeColor }]}>{item.outcome}</Text>
        </View>
        <View style={fp.metricCard}>
          <Ionicons name="calendar-outline" size={20} color={Colors.text.muted} />
          <Text style={fp.metricLabel}>Time</Text>
          <Text style={fp.metricValue}>{formatRelativeTime(item.timestamp)}</Text>
        </View>
      </View>
      <View style={fp.divider} />
      <Text style={fp.sectionLabel}>Recording</Text>
      <View style={fp.recordingCard}>
        <TouchableOpacity style={fp.playBtn} activeOpacity={0.7}>
          <Ionicons name="play" size={20} color="#fff" />
        </TouchableOpacity>
        <View style={{ flex: 1, marginLeft: Spacing.md }}>
          <View style={fp.waveformBar}>
            {Array.from({ length: 24 }).map((_, i) => (
              <View key={i} style={[fp.waveformLine, { height: 4 + Math.random() * 16, opacity: 0.4 + Math.random() * 0.6 }]} />
            ))}
          </View>
        </View>
        <Text style={fp.recordingDuration}>{item.duration}</Text>
      </View>
      {item.hasSummary && (
        <>
          <View style={fp.divider} />
          <Text style={fp.sectionLabel}>AI Summary</Text>
          <View style={fp.aiSummaryCard}>
            <View style={fp.aiSummaryHeader}>
              <Ionicons name="sparkles" size={16} color={Colors.accent.cyan} />
              <Text style={fp.aiSummaryLabel}>Sarah AI Summary</Text>
            </View>
            <Text style={fp.bodyText}>{getCallSummary(item)}</Text>
          </View>
        </>
      )}
      <View style={fp.divider} />
      <Text style={fp.sectionLabel}>Tags</Text>
      <View style={fp.tagsRow}>
        {item.tags.map((tag) => (
          <View key={tag} style={[styles.tag, { backgroundColor: TAG_COLORS[tag]?.bg || Colors.background.tertiary }]}>
            <Text style={[styles.tagText, { color: TAG_COLORS[tag]?.text || Colors.text.secondary }]}>{tag}</Text>
          </View>
        ))}
      </View>
      <View style={fp.divider} />
      <View style={fp.actionBar}>
        <TouchableOpacity style={[fp.actionBtn, { backgroundColor: Colors.semantic.successLight, borderColor: Colors.semantic.success + '44' }]} activeOpacity={0.7}>
          <Ionicons name="call" size={16} color={Colors.semantic.success} />
          <Text style={[fp.actionBtnText, { color: Colors.semantic.success }]}>Call Back</Text>
        </TouchableOpacity>
        <TouchableOpacity style={[fp.actionBtn, { backgroundColor: Colors.accent.cyanLight, borderColor: Colors.accent.cyan + '44' }]} activeOpacity={0.7}>
          <Ionicons name="chatbubble" size={16} color={Colors.accent.cyan} />
          <Text style={[fp.actionBtnText, { color: Colors.accent.cyan }]}>Message</Text>
        </TouchableOpacity>
        <TouchableOpacity style={fp.actionBtn} activeOpacity={0.7}>
          <Ionicons name="ban" size={16} color={Colors.semantic.error} />
          <Text style={[fp.actionBtnText, { color: Colors.semantic.error }]}>Block</Text>
        </TouchableOpacity>
        <TouchableOpacity style={fp.actionBtn} activeOpacity={0.7}>
          <Ionicons name="person-add" size={16} color={Colors.text.tertiary} />
          <Text style={fp.actionBtnText}>Add to Contacts</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

function MailPreview({ item }: { item: MailThread }) {
  return (
    <View style={fp.section}>
      <View style={fp.badgeRow}>
        {item.unread && (
          <View style={[fp.badge, { backgroundColor: Colors.accent.cyanLight }]}>
            <View style={{ width: 6, height: 6, borderRadius: 3, backgroundColor: Colors.accent.cyan }} />
            <Text style={[fp.badgeText, { color: Colors.accent.cyan }]}>Unread</Text>
          </View>
        )}
        {item.hasAttachments && (
          <View style={[fp.badge, { backgroundColor: Colors.background.tertiary }]}>
            <Ionicons name="attach" size={11} color={Colors.text.tertiary} />
            <Text style={[fp.badgeText, { color: Colors.text.tertiary }]}>Attachments</Text>
          </View>
        )}
      </View>
      <Text style={fp.mailSubject}>{item.subject}</Text>
      <View style={fp.divider} />
      <View style={fp.mailSenderRow}>
        <View style={fp.mailAvatarLg}>
          <Text style={fp.mailAvatarLgText}>{item.senderName.charAt(0)}</Text>
        </View>
        <View style={{ flex: 1, marginLeft: Spacing.md }}>
          <Text style={fp.mailSenderName}>{item.senderName}</Text>
          <Text style={fp.mailSenderEmail}>{item.senderEmail}</Text>
        </View>
        <Text style={fp.timestamp}>{formatRelativeTime(item.timestamp)}</Text>
      </View>
      <View style={fp.mailRecipientsBar}>
        <Text style={fp.mailRecipientsLabel}>To:</Text>
        <Text style={fp.mailRecipientsValue}>{item.recipients.join(', ')}</Text>
      </View>
      <View style={fp.divider} />
      <View style={fp.mailBodyArea}>
        <Text style={fp.mailBodyText}>{getMailBody(item)}</Text>
      </View>
      {item.hasAttachments && (
        <>
          <View style={fp.divider} />
          <Text style={fp.sectionLabel}>Attachments</Text>
          <View style={fp.attachmentsRow}>
            <View style={fp.attachmentItem}>
              <Ionicons name="document" size={20} color={Colors.accent.cyan} />
              <Text style={fp.attachmentName}>Document.pdf</Text>
              <Text style={fp.attachmentSize}>2.4 MB</Text>
            </View>
            <View style={fp.attachmentItem}>
              <Ionicons name="image" size={20} color={Colors.semantic.success} />
              <Text style={fp.attachmentName}>Screenshot.png</Text>
              <Text style={fp.attachmentSize}>1.1 MB</Text>
            </View>
          </View>
        </>
      )}
      <View style={fp.divider} />
      <Text style={fp.sectionLabel}>Tags</Text>
      <View style={fp.tagsRow}>
        {item.tags.map((tag) => (
          <View key={tag} style={[styles.tag, { backgroundColor: TAG_COLORS[tag]?.bg || Colors.background.tertiary }]}>
            <Text style={[styles.tagText, { color: TAG_COLORS[tag]?.text || Colors.text.secondary }]}>{tag}</Text>
          </View>
        ))}
        {item.tags.length > 0 && (
          <View style={[fp.badge, { backgroundColor: Colors.accent.cyanLight }]}>
            <Ionicons name="sparkles" size={10} color={Colors.accent.cyan} />
            <Text style={[fp.badgeText, { color: Colors.accent.cyan }]}>Eli reviewed</Text>
          </View>
        )}
      </View>
      <View style={fp.divider} />
      <View style={fp.actionBar}>
        <TouchableOpacity style={[fp.actionBtn, { backgroundColor: Colors.accent.cyanLight, borderColor: Colors.accent.cyan + '44' }]} activeOpacity={0.7}>
          <Ionicons name="arrow-undo" size={16} color={Colors.accent.cyan} />
          <Text style={[fp.actionBtnText, { color: Colors.accent.cyan }]}>Reply</Text>
        </TouchableOpacity>
        <TouchableOpacity style={fp.actionBtn} activeOpacity={0.7}>
          <Ionicons name="arrow-undo" size={16} color={Colors.text.tertiary} />
          <Text style={fp.actionBtnText}>Reply All</Text>
        </TouchableOpacity>
        <TouchableOpacity style={fp.actionBtn} activeOpacity={0.7}>
          <Ionicons name="arrow-redo" size={16} color={Colors.text.tertiary} />
          <Text style={fp.actionBtnText}>Forward</Text>
        </TouchableOpacity>
        <TouchableOpacity style={fp.actionBtn} activeOpacity={0.7}>
          <Ionicons name="archive" size={16} color={Colors.text.tertiary} />
          <Text style={fp.actionBtnText}>Archive</Text>
        </TouchableOpacity>
        <TouchableOpacity style={fp.actionBtn} activeOpacity={0.7}>
          <Ionicons name="star-outline" size={16} color={Colors.accent.amber} />
          <Text style={[fp.actionBtnText, { color: Colors.accent.amber }]}>Star</Text>
        </TouchableOpacity>
      </View>
      <View style={fp.divider} />
      <Text style={fp.sectionLabel}>Smart Replies</Text>
      <View style={styles.smartReplyRow}>
        {['Thanks, received!', "I'll review and respond shortly", 'Forward to team for review'].map((reply) => (
          <TouchableOpacity key={reply} style={styles.smartReplyPill} activeOpacity={0.7}>
            <Text style={styles.smartReplyText}>{reply}</Text>
          </TouchableOpacity>
        ))}
      </View>
    </View>
  );
}

function ContactPreview({ item }: { item: Contact }) {
  const roleColor = ROLE_COLORS[item.role] || Colors.text.secondary;
  const activityHistory = [
    { type: 'call' as const, icon: 'call' as keyof typeof Ionicons.glyphMap, desc: 'Phone call — 5 min', time: '2 days ago', color: Colors.semantic.success },
    { type: 'email' as const, icon: 'mail' as keyof typeof Ionicons.glyphMap, desc: `Email thread — RE: ${item.organization} update`, time: '5 days ago', color: Colors.accent.cyan },
    { type: 'meeting' as const, icon: 'videocam' as keyof typeof Ionicons.glyphMap, desc: 'Video meeting — Quarterly review', time: '2 weeks ago', color: '#A78BFA' },
  ];
  return (
    <View style={fp.section}>
      <View style={fp.headerRow}>
        <View style={fp.profileAvatarLg}>
          <Text style={fp.profileAvatarLgText}>{item.name.charAt(0)}</Text>
        </View>
        <View style={{ flex: 1, marginLeft: Spacing.xl }}>
          <Text style={fp.pageTitle}>{item.name}</Text>
          <Text style={fp.subtitleText}>{item.title}</Text>
          <Text style={[fp.subtitleText, { color: Colors.text.muted, marginTop: 2 }]}>{item.organization}</Text>
          <View style={[fp.badge, { backgroundColor: roleColor + '22', alignSelf: 'flex-start', marginTop: Spacing.sm }]}>
            <Text style={[fp.badgeText, { color: roleColor }]}>{item.role}</Text>
          </View>
        </View>
      </View>
      <View style={fp.divider} />
      <Text style={fp.sectionLabel}>Contact Information</Text>
      <View style={fp.contactGrid}>
        <View style={fp.contactGridItem}>
          <Ionicons name="mail-outline" size={18} color={Colors.accent.cyan} />
          <Text style={fp.contactGridLabel}>Email</Text>
          <Text style={fp.contactGridValue}>{item.email}</Text>
        </View>
        <View style={fp.contactGridItem}>
          <Ionicons name="call-outline" size={18} color={Colors.semantic.success} />
          <Text style={fp.contactGridLabel}>Phone</Text>
          <Text style={fp.contactGridValue}>{formatMaskedPhone(item.phone)}</Text>
        </View>
        <View style={fp.contactGridItem}>
          <Ionicons name="business-outline" size={18} color={Colors.accent.amber} />
          <Text style={fp.contactGridLabel}>Organization</Text>
          <Text style={fp.contactGridValue}>{item.organization}</Text>
        </View>
        <View style={fp.contactGridItem}>
          <Ionicons name="time-outline" size={18} color={Colors.text.muted} />
          <Text style={fp.contactGridLabel}>Last Contacted</Text>
          <Text style={fp.contactGridValue}>{formatRelativeTime(item.lastContacted)}</Text>
        </View>
      </View>
      <View style={fp.divider} />
      <Text style={fp.sectionLabel}>Notes</Text>
      <View style={fp.bodyCard}>
        <Text style={fp.bodyText}>{item.notes}</Text>
      </View>
      <View style={fp.divider} />
      <Text style={fp.sectionLabel}>Communication History</Text>
      <View style={fp.historyList}>
        {activityHistory.map((act, idx) => (
          <View key={idx} style={fp.historyItem}>
            <View style={[fp.historyDot, { backgroundColor: act.color + '22', borderColor: act.color + '44' }]}>
              <Ionicons name={act.icon} size={14} color={act.color} />
            </View>
            <View style={{ flex: 1, marginLeft: Spacing.md }}>
              <Text style={fp.historyDesc}>{act.desc}</Text>
              <Text style={fp.historyTime}>{act.time}</Text>
            </View>
          </View>
        ))}
      </View>
      <View style={fp.divider} />
      <Text style={fp.sectionLabel}>Tags</Text>
      <View style={fp.tagsRow}>
        {item.tags.map((tag) => (
          <View key={tag} style={[styles.tag, { backgroundColor: TAG_COLORS[tag]?.bg || Colors.background.tertiary }]}>
            <Text style={[styles.tagText, { color: TAG_COLORS[tag]?.text || Colors.text.secondary }]}>{tag}</Text>
          </View>
        ))}
      </View>
      <View style={fp.divider} />
      <View style={fp.actionBar}>
        <TouchableOpacity style={[fp.actionBtn, { backgroundColor: Colors.accent.cyanLight, borderColor: Colors.accent.cyan + '44' }]} activeOpacity={0.7}>
          <Ionicons name="mail" size={16} color={Colors.accent.cyan} />
          <Text style={[fp.actionBtnText, { color: Colors.accent.cyan }]}>Email</Text>
        </TouchableOpacity>
        <TouchableOpacity style={[fp.actionBtn, { backgroundColor: Colors.semantic.successLight, borderColor: Colors.semantic.success + '44' }]} activeOpacity={0.7}>
          <Ionicons name="call" size={16} color={Colors.semantic.success} />
          <Text style={[fp.actionBtnText, { color: Colors.semantic.success }]}>Call</Text>
        </TouchableOpacity>
        <TouchableOpacity style={fp.actionBtn} activeOpacity={0.7}>
          <Ionicons name="calendar" size={16} color={Colors.text.tertiary} />
          <Text style={fp.actionBtnText}>Schedule</Text>
        </TouchableOpacity>
        <TouchableOpacity style={fp.actionBtn} activeOpacity={0.7}>
          <Ionicons name="create" size={16} color={Colors.text.tertiary} />
          <Text style={fp.actionBtnText}>Edit Contact</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

export default function InboxScreen() {
  const insets = useSafeAreaInsets();
  const isDesktop = useDesktop();
  const router = useRouter();

  const [activeTab, setActiveTab] = useState<TabType>('office');
  const [activeFilter, setActiveFilter] = useState<Record<TabType, string>>({ office: 'All', calls: 'All', mail: 'All', contacts: 'All' });
  const [loading, setLoading] = useState(true);
  const [officeItems, setOfficeItems] = useState<OfficeItem[]>([]);
  const [calls, setCalls] = useState<CallItem[]>([]);
  const [mailThreads, setMailThreads] = useState<MailThread[]>([]);
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [eliOpen, setEliOpen] = useState(false);
  const [eliVoiceActive, setEliVoiceActive] = useState(false);
  const [eliTranscript, setEliTranscript] = useState('');
  const [showMailSetupModal, setShowMailSetupModal] = useState(false);
  const [mailSetupChecked, setMailSetupChecked] = useState(false);
  const [hasActiveMailbox, setHasActiveMailbox] = useState(false);
  const [mailAccounts, setMailAccounts] = useState<any[]>([]);
  const [selectedMailbox, setSelectedMailbox] = useState<string | null>(null);
  const [showMailboxDropdown, setShowMailboxDropdown] = useState(false);

  const eliConversation = useConversation({
    onConnect: () => {
      console.log('Eli connected');
      setEliVoiceActive(true);
    },
    onDisconnect: () => {
      console.log('Eli disconnected');
      setEliVoiceActive(false);
      setEliTranscript('');
    },
    onMessage: (message) => {
      console.log('Eli message:', message);
      if (message && typeof message === 'object' && 'message' in message) {
        setEliTranscript(String((message as any).message));
      }
    },
    onError: (error) => {
      console.error('Eli error:', error);
      setEliVoiceActive(false);
    },
  });

  const eliMicPulse = useRef(new Animated.Value(1)).current;

  const handleEliMicPress = useCallback(async () => {
    if (Platform.OS !== 'web') {
      Alert.alert('Voice Unavailable', 'Voice is only available on the web version.');
      return;
    }
    if (eliConversation.status === 'connected') {
      await eliConversation.endSession();
    } else {
      try {
        await navigator.mediaDevices.getUserMedia({ audio: true });
        const resp = await fetch('/api/elevenlabs/signed-url', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ agent: 'eli' }),
        });
        if (!resp.ok) {
          throw new Error(`Server error: ${resp.status}`);
        }
        const { signedUrl } = await resp.json();
        if (signedUrl) {
          await eliConversation.startSession({ signedUrl });
        } else {
          Alert.alert('Connection Error', 'Unable to connect to Eli. Please try again.');
        }
      } catch (error) {
        console.error('Failed to start Eli session:', error);
        Alert.alert('Connection Error', 'Unable to connect to Eli. Please try again.');
      }
    }
  }, [eliConversation]);

  const breathAnim = useRef(new Animated.Value(1)).current;
  const scrollRef = useRef<ScrollView>(null);

  useEffect(() => {
    seedDatabase();
    const timer = setTimeout(() => {
      setOfficeItems(getOfficeItems());
      setCalls(getCalls());
      setMailThreads(getMailThreads());
      setContacts(getContacts());
      setLoading(false);
    }, 100);
    return () => clearTimeout(timer);
  }, []);

  useEffect(() => {
    if (activeTab !== 'mail') {
      setMailSetupChecked(false);
    }
  }, [activeTab]);

  useEffect(() => {
    if (activeTab === 'mail' && !mailSetupChecked) {
      (async () => {
        try {
          const DEMO_USER_ID = '00000000-0000-0000-0000-000000000001';
          const data = await mailApi.getAccounts(DEMO_USER_ID);
          const accounts = data.accounts || [];
          setMailAccounts(accounts);
          const active = accounts.find((a: any) => a.status === 'ACTIVE');
          if (active) {
            setHasActiveMailbox(true);
            setSelectedMailbox(active.id);
          } else {
            setHasActiveMailbox(false);
            setShowMailSetupModal(true);
          }
        } catch (e) {
          console.error('Mail accounts check failed', e);
        }
        setMailSetupChecked(true);
      })();
    }
  }, [activeTab, mailSetupChecked]);

  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(breathAnim, { toValue: 1.03, duration: 1500, useNativeDriver: false }),
        Animated.timing(breathAnim, { toValue: 1, duration: 1500, useNativeDriver: false }),
      ])
    );
    loop.start();
    return () => loop.stop();
  }, [breathAnim]);

  useEffect(() => {
    if (eliVoiceActive) {
      const loop = Animated.loop(
        Animated.sequence([
          Animated.timing(eliMicPulse, { toValue: 1.15, duration: 600, useNativeDriver: false }),
          Animated.timing(eliMicPulse, { toValue: 1, duration: 600, useNativeDriver: false }),
        ])
      );
      loop.start();
      return () => loop.stop();
    } else {
      eliMicPulse.setValue(1);
    }
  }, [eliVoiceActive, eliMicPulse]);

  const currentFilter = activeFilter[activeTab];

  const getFilteredOffice = (): OfficeItem[] => {
    switch (currentFilter) {
      case 'Unread': return officeItems.filter(i => i.unread);
      case 'Urgent': return officeItems.filter(i => i.priority === 'High');
      case 'Starred': return officeItems.slice(0, 2);
      case 'Archived': return [];
      default: return officeItems;
    }
  };

  const getFilteredCalls = (): CallItem[] => {
    switch (currentFilter) {
      case 'Inbound': return calls.filter(i => i.callType === 'inbound');
      case 'Outbound': return calls.filter(i => i.callType === 'outbound');
      case 'Missed': return calls.filter(i => i.callType === 'missed');
      case 'Voicemail': return calls.filter(i => i.callType === 'voicemail');
      case 'Blocked': return calls.filter(i => i.callType === 'blocked');
      default: return calls;
    }
  };

  const getFilteredMail = (): MailThread[] => {
    switch (currentFilter) {
      case 'Unread': return mailThreads.filter(i => i.unread);
      case 'Starred': return mailThreads.slice(0, 1);
      case 'Sent': return [];
      case 'Drafts': return [];
      case 'Junk': return [];
      default: return mailThreads;
    }
  };

  const getFilteredContacts = (): Contact[] => {
    switch (currentFilter) {
      case 'Clients': return contacts.filter(i => i.role === 'Client');
      case 'Vendors': return contacts.filter(i => i.role === 'Vendor');
      case 'Team': return contacts.filter(i => i.role === 'Internal');
      case 'Starred': return contacts.slice(0, 2);
      case 'Recent': return [...contacts].sort((a, b) => new Date(b.lastContacted).getTime() - new Date(a.lastContacted).getTime());
      default: return contacts;
    }
  };

  const getFilteredItems = (): any[] => {
    switch (activeTab) {
      case 'office': return getFilteredOffice();
      case 'calls': return getFilteredCalls();
      case 'mail': return getFilteredMail();
      case 'contacts': return getFilteredContacts();
    }
  };

  const filteredItems = loading ? [] : getFilteredItems();

  const getSelectedItem = (): OfficeItem | CallItem | MailThread | Contact | null => {
    if (!selectedId) return null;
    switch (activeTab) {
      case 'office': return officeItems.find(i => i.id === selectedId) || null;
      case 'calls': return calls.find(i => i.id === selectedId) || null;
      case 'mail': return mailThreads.find(i => i.id === selectedId) || null;
      case 'contacts': return contacts.find(i => i.id === selectedId) || null;
    }
  };

  const selectedItem = getSelectedItem();

  const handleItemPress = (id: string) => {
    setSelectedId(id);
    scrollRef.current?.scrollTo({ y: 0, animated: true });
  };

  const handleTabChange = (tab: TabType) => {
    setActiveTab(tab);
    setSelectedId(null);
  };

  const handleFilterChange = (filter: string) => {
    setActiveFilter(prev => ({ ...prev, [activeTab]: filter }));
    setSelectedId(null);
  };

  const tabCounts = {
    office: officeItems.length,
    calls: calls.length,
    mail: mailThreads.length,
    contacts: contacts.length,
  };

  const eliTriagedCount = mailThreads.filter(i => i.tags.length > 0).length + officeItems.filter(i => i.unread).length;

  const renderListItems = () => {
    if (loading) {
      return Array.from({ length: 5 }).map((_, i) => (
        <View key={i} style={styles.skeletonCard}>
          <View style={styles.skeletonRow}>
            <View style={styles.skeletonCircle} />
            <View style={{ flex: 1, marginLeft: 12 }}>
              <View style={styles.skeletonTitle} />
              <View style={styles.skeletonSubtitle} />
            </View>
          </View>
        </View>
      ));
    }

    if (filteredItems.length === 0) {
      return <EmptyState filter={currentFilter} />;
    }

    switch (activeTab) {
      case 'office':
        return (filteredItems as OfficeItem[]).map(item => (
          <OfficeItemCard key={item.id} item={item} selected={selectedId === item.id} onPress={() => handleItemPress(item.id)} />
        ));
      case 'calls':
        return (filteredItems as CallItem[]).map(item => (
          <CallItemCard key={item.id} item={item} selected={selectedId === item.id} onPress={() => handleItemPress(item.id)} />
        ));
      case 'mail':
        return (filteredItems as MailThread[]).map(item => (
          <MailItemCard key={item.id} item={item} selected={selectedId === item.id} onPress={() => handleItemPress(item.id)} />
        ));
      case 'contacts':
        return (filteredItems as Contact[]).map(item => (
          <ContactItemCard key={item.id} item={item} selected={selectedId === item.id} onPress={() => handleItemPress(item.id)} />
        ));
    }
  };

  const content = (
    <View style={styles.container}>
      <ScrollView ref={scrollRef} style={{ flex: 1 }} contentContainerStyle={styles.pageScrollContent} showsVerticalScrollIndicator={false}>
        <ImageBackground source={inboxHero} style={styles.headerBanner} imageStyle={styles.headerBannerImage}>
          <LinearGradient
            colors={['rgba(10, 10, 10, 0.35)', 'rgba(10, 10, 10, 0.65)']}
            style={styles.headerOverlay}
          >
            <View style={styles.headerRow}>
              <View style={styles.headerLeft}>
                <LinearGradient colors={[Colors.accent.cyan, Colors.accent.cyanDark]} style={styles.headerIconWrap}>
                  <Ionicons name="mail" size={24} color="#fff" />
                </LinearGradient>
                <View style={{ marginLeft: Spacing.md }}>
                  <Text style={styles.headerTitle}>Inbox</Text>
                  <Text style={styles.headerSubtitle}>
                    {loading ? 'Loading...' : `${officeItems.length + calls.length + mailThreads.length + contacts.length} items across all channels`}
                  </Text>
                </View>
              </View>
            </View>
          </LinearGradient>
        </ImageBackground>

        <View style={styles.tabBar}>
          {TAB_CONFIG.map((tab) => {
            const isActive = activeTab === tab.key;
            const count = tabCounts[tab.key];
            return (
              <TouchableOpacity key={tab.key} onPress={() => handleTabChange(tab.key)} activeOpacity={0.7}>
                {isActive ? (
                  <LinearGradient colors={[Colors.accent.cyan, Colors.accent.cyanDark]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.tabActive}>
                    <Ionicons name={tab.icon} size={18} color="#fff" />
                    <Text style={styles.tabTextActive}>{tab.label}</Text>
                    {!loading && (
                      <View style={styles.tabBadgeActive}>
                        <Text style={styles.tabBadgeTextActive}>{count}</Text>
                      </View>
                    )}
                    <View style={styles.tabGlowBorder} />
                  </LinearGradient>
                ) : (
                  <View style={styles.tabInactive}>
                    <Ionicons name={tab.icon} size={18} color={Colors.text.tertiary} />
                    <Text style={styles.tabTextInactive}>{tab.label}</Text>
                    {!loading && (
                      <View style={styles.tabBadgeInactive}>
                        <Text style={styles.tabBadgeTextInactive}>{count}</Text>
                      </View>
                    )}
                  </View>
                )}
              </TouchableOpacity>
            );
          })}
        </View>

        {/* Mailbox Selector - Mail tab only */}
        {activeTab === 'mail' && hasActiveMailbox && mailAccounts.length > 0 && (
          <View style={styles.mailboxSelectorBar}>
            <Pressable 
              style={({ hovered }: any) => [styles.mailboxSelector, hovered && styles.mailboxSelectorHover]}
              onPress={() => setShowMailboxDropdown(!showMailboxDropdown)}
            >
              <View style={styles.mailboxSelectorLeft}>
                <View style={styles.mailboxProviderBadge}>
                  <Ionicons 
                    name={(mailAccounts.find((a: any) => a.id === selectedMailbox) || mailAccounts[0])?.provider === 'GOOGLE' ? 'logo-google' : 'shield-checkmark'} 
                    size={14} 
                    color={(mailAccounts.find((a: any) => a.id === selectedMailbox) || mailAccounts[0])?.provider === 'GOOGLE' ? '#EA4335' : '#3B82F6'} 
                  />
                </View>
                <View>
                  <Text style={styles.mailboxDisplayName}>{mailAccounts.find((a: any) => a.id === selectedMailbox)?.displayName || 'Business Email'}</Text>
                  <Text style={styles.mailboxEmail}>{mailAccounts.find((a: any) => a.id === selectedMailbox)?.email || ''}</Text>
                </View>
              </View>
              <Ionicons name={showMailboxDropdown ? 'chevron-up' : 'chevron-down'} size={16} color={Colors.text.muted} />
            </Pressable>

            {showMailboxDropdown && (
              <View style={styles.mailboxDropdown}>
                {mailAccounts.map((acct: any) => (
                  <Pressable
                    key={acct.id}
                    style={({ hovered }: any) => [styles.mailboxDropdownItem, selectedMailbox === acct.id && styles.mailboxDropdownItemActive, hovered && styles.mailboxDropdownItemHover]}
                    onPress={() => { setSelectedMailbox(acct.id); setShowMailboxDropdown(false); }}
                  >
                    <Ionicons name={acct.provider === 'GOOGLE' ? 'logo-google' : 'shield-checkmark'} size={14} color={acct.provider === 'GOOGLE' ? '#EA4335' : '#3B82F6'} />
                    <View style={{ flex: 1 }}>
                      <Text style={styles.mailboxDropdownName}>{acct.displayName}</Text>
                      <Text style={styles.mailboxDropdownEmail}>{acct.email}</Text>
                    </View>
                    {selectedMailbox === acct.id && <Ionicons name="checkmark" size={16} color={Colors.accent.cyan} />}
                  </Pressable>
                ))}
                <Pressable
                  style={({ hovered }: any) => [styles.mailboxDropdownItem, styles.mailboxAddItem, hovered && styles.mailboxDropdownItemHover]}
                  onPress={() => { setShowMailboxDropdown(false); router.push('/inbox/setup' as any); }}
                >
                  <Ionicons name="add-circle-outline" size={16} color={Colors.accent.cyan} />
                  <Text style={[styles.mailboxDropdownName, { color: Colors.accent.cyan }]}>Add mailbox</Text>
                </Pressable>
              </View>
            )}
          </View>
        )}

        <View style={styles.filterBar}>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.filterScroll}>
            {FILTERS[activeTab].map((f) => {
              const isActive = currentFilter === f.label;
              return (
                <TouchableOpacity
                  key={f.label}
                  style={[styles.filterPill, isActive && styles.filterPillActive]}
                  onPress={() => handleFilterChange(f.label)}
                  activeOpacity={0.7}
                >
                  <Ionicons name={f.icon} size={12} color={isActive ? '#fff' : Colors.text.secondary} style={{ marginRight: 4 }} />
                  <Text style={[styles.filterPillText, isActive && styles.filterPillTextActive]}>{f.label}</Text>
                </TouchableOpacity>
              );
            })}
          </ScrollView>
        </View>

        {/* Mail Setup Modal */}
        {showMailSetupModal && activeTab === 'mail' && (
          <View style={styles.mailSetupOverlay}>
            <View style={styles.mailSetupModal}>
              <View style={styles.mailSetupIconContainer}>
                <Ionicons name="mail-outline" size={48} color={Colors.accent.cyan} />
              </View>
              <Text style={styles.mailSetupTitle}>Set Up Your Mailbox</Text>
              <Text style={styles.mailSetupDescription}>
                Connect business email so Aspire Inbox can read, draft, and send messages with receipts.
              </Text>
              <View style={styles.mailSetupFeatures}>
                <View style={styles.mailSetupFeatureRow}>
                  <Ionicons name="checkmark-circle" size={20} color={Colors.accent.cyan} />
                  <Text style={styles.mailSetupFeatureText}>Mailbox selector + unified inbox</Text>
                </View>
                <View style={styles.mailSetupFeatureRow}>
                  <Ionicons name="checkmark-circle" size={20} color={Colors.accent.cyan} />
                  <Text style={styles.mailSetupFeatureText}>Verification checks and health status</Text>
                </View>
                <View style={styles.mailSetupFeatureRow}>
                  <Ionicons name="checkmark-circle" size={20} color={Colors.accent.cyan} />
                  <Text style={styles.mailSetupFeatureText}>Eli drafting with policy-gated sending</Text>
                </View>
              </View>
              <TouchableOpacity
                style={styles.mailSetupPrimaryButton}
                onPress={() => {
                  setShowMailSetupModal(false);
                  router.push('/inbox/setup' as any);
                }}
              >
                <Text style={styles.mailSetupPrimaryButtonText}>Set Up Mailbox</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.mailSetupSecondaryButton}
                onPress={() => setShowMailSetupModal(false)}
              >
                <Text style={styles.mailSetupSecondaryButtonText}>Maybe Later</Text>
              </TouchableOpacity>
            </View>
          </View>
        )}

        {/* Mail Setup Required Empty State */}
        {activeTab === 'mail' && mailSetupChecked && !hasActiveMailbox && !showMailSetupModal ? (
          <View style={styles.mailSetupEmptyState}>
            <View style={styles.mailSetupEmptyIcon}>
              <Ionicons name="mail-unread-outline" size={40} color={Colors.text.muted} />
            </View>
            <Text style={styles.mailSetupEmptyTitle}>Mailbox Not Connected</Text>
            <Text style={styles.mailSetupEmptyDesc}>Set up your business email to start receiving and managing mail in Aspire Inbox.</Text>
            <TouchableOpacity
              style={styles.mailSetupEmptyCTA}
              onPress={() => router.push('/inbox/setup' as any)}
            >
              <Ionicons name="settings-outline" size={16} color="#fff" />
              <Text style={styles.mailSetupEmptyCTAText}>Set Up Mailbox</Text>
            </TouchableOpacity>
          </View>
        ) : selectedItem ? (
          <View>
            <TouchableOpacity style={styles.backButton} onPress={() => setSelectedId(null)} activeOpacity={0.7}>
              <Ionicons name="arrow-back" size={20} color={Colors.accent.cyan} />
              <Text style={styles.backButtonText}>Back</Text>
            </TouchableOpacity>
            <View style={fp.detailContent}>
              {activeTab === 'office' && <OfficePreview item={selectedItem as OfficeItem} />}
              {activeTab === 'calls' && <CallPreview item={selectedItem as CallItem} />}
              {activeTab === 'mail' && <MailPreview item={selectedItem as MailThread} />}
              {activeTab === 'contacts' && <ContactPreview item={selectedItem as Contact} />}
            </View>
          </View>
        ) : (
          <View style={styles.listContent}>
            {renderListItems()}
          </View>
        )}
      </ScrollView>

      <Animated.View style={[styles.eliChipWrapper, { transform: [{ scale: breathAnim }] }]}>
        <TouchableOpacity onPress={() => setEliOpen(!eliOpen)} activeOpacity={0.8}>
          <View style={styles.eliChip}>
            <Image source={eliAvatar} style={styles.eliChipAvatar} />
            <Text style={styles.eliChipText}>Eli</Text>
          </View>
          <View style={styles.eliNotifDot} />
        </TouchableOpacity>
      </Animated.View>

      {eliOpen && (
        <View style={[styles.eliPanel, eliVoiceActive && { height: 280 }]}>
          <View style={styles.eliPanelHeader}>
            <View style={{ flexDirection: 'row', alignItems: 'center' }}>
              <Image source={eliAvatar} style={styles.eliPanelAvatar} />
              <Text style={styles.eliPanelTitle}>Eli · Voice & Chat Agent</Text>
              {eliVoiceActive && (
                <View style={styles.eliActiveBadge}>
                  <View style={styles.eliActiveDot} />
                  <Text style={styles.eliActiveText}>Live</Text>
                </View>
              )}
            </View>
            <TouchableOpacity onPress={() => { if (eliVoiceActive) { eliConversation.endSession(); } setEliOpen(false); }}>
              <Ionicons name="close" size={20} color={Colors.text.secondary} />
            </TouchableOpacity>
          </View>
          <Text style={styles.eliPanelStat}>{eliTriagedCount} items triaged today</Text>
          {eliVoiceActive && eliTranscript ? (
            <View style={styles.eliTranscriptBox}>
              <Ionicons name="chatbubble-ellipses" size={14} color={Colors.accent.cyan} />
              <Text style={styles.eliTranscriptText} numberOfLines={3}>{eliTranscript}</Text>
            </View>
          ) : null}
          <View style={styles.eliInputRow}>
            <View style={[styles.eliInputWrapper, { flex: 1 }]}>
              <TextInput
                style={styles.eliInput}
                placeholder="Ask Eli anything..."
                placeholderTextColor={Colors.text.muted}
                editable={false}
              />
            </View>
            <Animated.View style={{ transform: [{ scale: eliMicPulse }] }}>
              <TouchableOpacity
                onPress={handleEliMicPress}
                style={[
                  styles.eliMicButton,
                  eliVoiceActive && styles.eliMicButtonActive,
                ]}
                activeOpacity={0.7}
              >
                <Ionicons
                  name={eliVoiceActive ? 'mic' : 'mic-outline'}
                  size={20}
                  color={eliVoiceActive ? '#fff' : Colors.accent.cyan}
                />
              </TouchableOpacity>
            </Animated.View>
          </View>
        </View>
      )}
    </View>
  );

  if (isDesktop) {
    return (
      <DesktopPageWrapper scrollable={false} fullWidth>
        {content}
      </DesktopPageWrapper>
    );
  }

  return content;
}

const fp = StyleSheet.create({
  detailContent: {
    width: '100%',
    paddingHorizontal: Spacing.xl,
    paddingBottom: 100,
  },
  section: {
    width: '100%',
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
  },
  badgeRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.sm,
    marginBottom: Spacing.md,
  },
  badge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: Spacing.sm + 2,
    paddingVertical: 3,
    borderRadius: BorderRadius.full,
  },
  badgeText: {
    ...Typography.micro,
    fontWeight: '700',
  },
  pageTitle: {
    ...Typography.title,
    color: Colors.text.primary,
    fontWeight: '700',
    marginBottom: Spacing.xs,
  },
  timestamp: {
    ...Typography.small,
    color: Colors.text.muted,
    marginTop: 2,
  },
  subtitleText: {
    ...Typography.caption,
    color: Colors.text.tertiary,
  },
  divider: {
    height: 1,
    backgroundColor: Colors.border.subtle,
    marginVertical: Spacing.lg,
  },
  sectionLabel: {
    ...Typography.smallMedium,
    color: Colors.text.muted,
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: 0.8,
    marginBottom: Spacing.md,
  },
  chipRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.sm,
  },
  contextChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm + 2,
    borderRadius: BorderRadius.lg,
    backgroundColor: Colors.surface.card,
    borderWidth: 1,
    borderColor: Colors.border.subtle,
    flex: 1,
    minWidth: 140,
  },
  chipLabel: {
    ...Typography.micro,
    color: Colors.text.muted,
    fontWeight: '500',
  },
  chipValue: {
    ...Typography.caption,
    color: Colors.text.primary,
    fontWeight: '600',
    marginTop: 1,
  },
  bodyCard: {
    backgroundColor: Colors.surface.card,
    borderRadius: BorderRadius.lg,
    padding: Spacing.xl,
    borderWidth: 1,
    borderColor: Colors.border.subtle,
  },
  bodyText: {
    ...Typography.body,
    color: Colors.text.secondary,
    lineHeight: 24,
  },
  tagsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.sm,
  },
  actionBar: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.sm,
  },
  actionBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.xs,
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.sm + 2,
    borderRadius: BorderRadius.md,
    backgroundColor: Colors.background.tertiary,
    borderWidth: 1,
    borderColor: Colors.border.subtle,
  },
  actionBtnText: {
    ...Typography.caption,
    color: Colors.text.tertiary,
    fontWeight: '500',
  },
  timelineRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: Spacing.md,
  },
  timelineStep: {
    alignItems: 'center',
    gap: Spacing.xs,
  },
  timelineDot: {
    width: 24,
    height: 24,
    borderRadius: 12,
    borderWidth: 2,
    borderColor: Colors.border.default,
    backgroundColor: Colors.background.tertiary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  timelineConnector: {
    flex: 1,
    height: 2,
    backgroundColor: Colors.border.default,
    marginHorizontal: Spacing.xs,
  },
  timelineLabel: {
    ...Typography.micro,
    color: Colors.text.muted,
    fontWeight: '500',
  },
  callerAvatar: {
    width: 64,
    height: 64,
    borderRadius: 32,
    borderWidth: 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  metricGrid: {
    flexDirection: 'row',
    gap: Spacing.sm,
  },
  metricCard: {
    flex: 1,
    backgroundColor: Colors.surface.card,
    borderRadius: BorderRadius.lg,
    padding: Spacing.lg,
    borderWidth: 1,
    borderColor: Colors.border.subtle,
    alignItems: 'center',
    gap: Spacing.xs,
  },
  metricDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    marginTop: 5,
  },
  metricLabel: {
    ...Typography.micro,
    color: Colors.text.muted,
    fontWeight: '500',
    textTransform: 'uppercase',
  },
  metricValue: {
    ...Typography.bodyMedium,
    color: Colors.text.primary,
    fontWeight: '700',
  },
  recordingCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.surface.card,
    borderRadius: BorderRadius.lg,
    padding: Spacing.lg,
    borderWidth: 1,
    borderColor: Colors.border.subtle,
  },
  playBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: Colors.accent.cyan,
    alignItems: 'center',
    justifyContent: 'center',
  },
  waveformBar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
    height: 24,
  },
  waveformLine: {
    width: 3,
    borderRadius: 2,
    backgroundColor: Colors.accent.cyan,
  },
  recordingDuration: {
    ...Typography.caption,
    color: Colors.text.muted,
    fontWeight: '600',
    marginLeft: Spacing.md,
  },
  aiSummaryCard: {
    backgroundColor: Colors.background.tertiary,
    borderRadius: BorderRadius.lg,
    padding: Spacing.xl,
    borderWidth: 1,
    borderColor: Colors.accent.cyanLight,
  },
  aiSummaryHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    marginBottom: Spacing.md,
  },
  aiSummaryLabel: {
    ...Typography.captionMedium,
    color: Colors.accent.cyan,
    fontWeight: '600',
  },
  mailSubject: {
    fontSize: 24,
    fontWeight: '700',
    color: Colors.text.primary,
    lineHeight: 32,
    marginBottom: Spacing.sm,
  },
  mailSenderRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  mailAvatarLg: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: Colors.accent.cyanDark,
    alignItems: 'center',
    justifyContent: 'center',
  },
  mailAvatarLgText: {
    fontSize: 20,
    fontWeight: '700',
    color: '#fff',
  },
  mailSenderName: {
    ...Typography.bodyMedium,
    color: Colors.text.primary,
    fontWeight: '600',
  },
  mailSenderEmail: {
    ...Typography.small,
    color: Colors.text.muted,
    marginTop: 1,
  },
  mailRecipientsBar: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: Spacing.md,
    paddingVertical: Spacing.sm,
    paddingHorizontal: Spacing.md,
    backgroundColor: Colors.background.tertiary,
    borderRadius: BorderRadius.md,
  },
  mailRecipientsLabel: {
    ...Typography.small,
    color: Colors.text.muted,
    fontWeight: '600',
    marginRight: Spacing.xs,
  },
  mailRecipientsValue: {
    ...Typography.small,
    color: Colors.text.secondary,
    flex: 1,
  },
  mailBodyArea: {
    paddingVertical: Spacing.md,
  },
  mailBodyText: {
    ...Typography.body,
    color: Colors.text.secondary,
    lineHeight: 26,
  },
  attachmentsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.sm,
  },
  attachmentItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    backgroundColor: Colors.surface.card,
    borderRadius: BorderRadius.md,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm + 2,
    borderWidth: 1,
    borderColor: Colors.border.subtle,
  },
  attachmentName: {
    ...Typography.caption,
    color: Colors.text.primary,
    fontWeight: '500',
  },
  attachmentSize: {
    ...Typography.small,
    color: Colors.text.muted,
  },
  profileAvatarLg: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: Colors.accent.cyanDark,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: Colors.accent.cyan + '44',
  },
  profileAvatarLgText: {
    fontSize: 26,
    fontWeight: '700',
    color: '#fff',
  },
  contactGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.sm,
  },
  contactGridItem: {
    width: '48%',
    backgroundColor: Colors.surface.card,
    borderRadius: BorderRadius.lg,
    padding: Spacing.lg,
    borderWidth: 1,
    borderColor: Colors.border.subtle,
    gap: Spacing.xs,
  },
  contactGridLabel: {
    ...Typography.micro,
    color: Colors.text.muted,
    fontWeight: '500',
    textTransform: 'uppercase',
    marginTop: Spacing.xs,
  },
  contactGridValue: {
    ...Typography.caption,
    color: Colors.text.primary,
    fontWeight: '600',
  },
  historyList: {
    gap: Spacing.md,
  },
  historyItem: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  historyDot: {
    width: 32,
    height: 32,
    borderRadius: 16,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  historyDesc: {
    ...Typography.caption,
    color: Colors.text.primary,
    fontWeight: '500',
  },
  historyTime: {
    ...Typography.small,
    color: Colors.text.muted,
    marginTop: 1,
  },
});

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background.primary,
  },
  pageScrollContent: {
    flexGrow: 1,
  },
  headerBanner: {
    height: 130,
    overflow: 'hidden',
  },
  headerBannerImage: {
    resizeMode: 'cover',
  },
  headerOverlay: {
    flex: 1,
    paddingHorizontal: Spacing.xl,
    justifyContent: 'center',
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  headerIconWrap: {
    width: 48,
    height: 48,
    borderRadius: BorderRadius.md,
    alignItems: 'center',
    justifyContent: 'center',
    ...Shadows.glow(Colors.accent.cyan),
  },
  headerTitle: {
    fontSize: 28,
    fontWeight: '800',
    color: '#fff',
    letterSpacing: 1,
  },
  headerSubtitle: {
    ...Typography.small,
    color: 'rgba(255,255,255,0.7)',
    marginTop: 2,
  },
  tabBar: {
    flexDirection: 'row',
    paddingHorizontal: Spacing.xl,
    paddingTop: Spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border.subtle,
    gap: Spacing.xs,
  },
  tabActive: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.sm + 2,
    borderRadius: BorderRadius.md,
    borderBottomLeftRadius: 0,
    borderBottomRightRadius: 0,
    position: 'relative',
    gap: Spacing.xs,
  },
  tabInactive: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.sm + 2,
    gap: Spacing.xs,
  },
  tabTextActive: {
    ...Typography.caption,
    color: '#fff',
    fontWeight: '600',
  },
  tabTextInactive: {
    ...Typography.caption,
    color: Colors.text.tertiary,
    fontWeight: '500',
  },
  tabBadgeActive: {
    backgroundColor: '#fff',
    borderRadius: BorderRadius.full,
    paddingHorizontal: 7,
    paddingVertical: 1,
    marginLeft: 2,
  },
  tabBadgeTextActive: {
    ...Typography.micro,
    color: Colors.accent.cyanDark,
    fontWeight: '700',
  },
  tabBadgeInactive: {
    backgroundColor: Colors.background.tertiary,
    borderRadius: BorderRadius.full,
    paddingHorizontal: 7,
    paddingVertical: 1,
    marginLeft: 2,
  },
  tabBadgeTextInactive: {
    ...Typography.micro,
    color: Colors.text.muted,
  },
  tabGlowBorder: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    height: 2,
    backgroundColor: Colors.accent.cyan,
    ...Shadows.glow(Colors.accent.cyan),
  },
  filterBar: {
    paddingVertical: Spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border.subtle,
  },
  filterScroll: {
    paddingHorizontal: Spacing.xl,
    gap: Spacing.sm,
    flexDirection: 'row',
  },
  filterPill: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.xs + 2,
    borderRadius: BorderRadius.full,
    backgroundColor: Colors.background.tertiary,
    borderWidth: 1,
    borderColor: Colors.border.default,
  },
  filterPillActive: {
    backgroundColor: Colors.accent.cyan,
    borderColor: Colors.accent.cyan,
  },
  filterPillText: {
    ...Typography.small,
    color: Colors.text.secondary,
    fontWeight: '500',
  },
  filterPillTextActive: {
    color: '#fff',
  },
  backButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: Spacing.xl,
    paddingVertical: Spacing.md,
    gap: Spacing.xs,
  },
  backButtonText: {
    ...Typography.caption,
    color: Colors.accent.cyan,
    fontWeight: '600',
  },
  detailScrollContent: {
    alignItems: 'center',
    paddingHorizontal: Spacing.xl,
    paddingBottom: 100,
  },
  detailCard: {
    width: '100%',
    maxWidth: 800,
    backgroundColor: Colors.surface.card,
    borderRadius: BorderRadius.xl,
    borderWidth: 1,
    borderColor: Colors.surface.cardBorder,
    padding: Spacing.xl,
  },
  listContent: {
    paddingHorizontal: Spacing.lg,
    paddingTop: Spacing.md,
    paddingBottom: 100,
  },
  card: {
    backgroundColor: Colors.surface.card,
    borderRadius: BorderRadius.lg,
    borderWidth: 1,
    borderColor: Colors.surface.cardBorder,
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.md,
    marginBottom: Spacing.sm,
  },
  cardSelected: {
    borderColor: Colors.accent.cyan,
    backgroundColor: Colors.background.elevated,
  },
  cardHover: {
    backgroundColor: Colors.surface.cardHover,
    ...(isWeb ? { transform: [{ translateY: -1 }] } : {}),
  },
  cardRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
  },
  iconCircle: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: Colors.background.tertiary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  unreadDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: Colors.accent.cyan,
    marginRight: Spacing.xs,
  },
  cardTitle: {
    ...Typography.body,
    color: Colors.text.primary,
    fontWeight: '700',
    flex: 1,
  },
  cardSubtitle: {
    ...Typography.small,
    color: Colors.text.tertiary,
    marginTop: 2,
  },
  cardRight: {
    alignItems: 'flex-end',
    marginLeft: Spacing.sm,
  },
  timeText: {
    ...Typography.small,
    color: Colors.text.tertiary,
  },
  previewText: {
    ...Typography.caption,
    color: Colors.text.secondary,
    marginTop: Spacing.sm,
    marginBottom: Spacing.sm,
  },
  tagsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: Spacing.xs,
  },
  tag: {
    paddingHorizontal: Spacing.sm,
    paddingVertical: 2,
    borderRadius: BorderRadius.xs,
  },
  tagText: {
    ...Typography.micro,
    fontWeight: '600',
  },
  assignedText: {
    ...Typography.small,
    color: Colors.text.muted,
    marginLeft: 'auto',
  },
  priorityPill: {
    paddingHorizontal: Spacing.sm,
    paddingVertical: 2,
    borderRadius: BorderRadius.xs,
    marginTop: 4,
  },
  priorityPillText: {
    ...Typography.micro,
    fontWeight: '700',
  },
  durationText: {
    ...Typography.small,
    color: Colors.text.muted,
    marginTop: 2,
  },
  callMetaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: Spacing.sm,
    gap: Spacing.md,
  },
  outcomePill: {
    paddingHorizontal: Spacing.sm,
    paddingVertical: 2,
    borderRadius: BorderRadius.xs,
  },
  outcomePillText: {
    ...Typography.micro,
    fontWeight: '600',
  },
  summaryBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  summaryText: {
    ...Typography.small,
    color: Colors.accent.cyan,
  },
  summaryBadgeLarge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginTop: Spacing.md,
    paddingVertical: Spacing.sm,
    paddingHorizontal: Spacing.md,
    backgroundColor: Colors.accent.cyanLight,
    borderRadius: BorderRadius.md,
  },
  mailAvatar: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: Colors.accent.cyanDark,
    alignItems: 'center',
    justifyContent: 'center',
  },
  mailAvatarText: {
    ...Typography.headline,
    color: '#fff',
    fontWeight: '600',
  },
  mailMetaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    flexWrap: 'wrap',
  },
  msgCountPill: {
    backgroundColor: Colors.background.tertiary,
    paddingHorizontal: Spacing.sm,
    paddingVertical: 2,
    borderRadius: BorderRadius.xs,
  },
  msgCountText: {
    ...Typography.micro,
    color: Colors.text.muted,
  },
  eliReviewBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
  },
  eliReviewText: {
    ...Typography.micro,
    color: Colors.accent.cyan,
  },
  contactAvatar: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: Colors.accent.cyanDark,
    alignItems: 'center',
    justifyContent: 'center',
  },
  contactAvatarText: {
    ...Typography.headline,
    color: Colors.accent.cyan,
    fontWeight: '600',
  },
  orgText: {
    ...Typography.small,
    color: Colors.text.muted,
    marginTop: 2,
  },
  rolePill: {
    paddingHorizontal: Spacing.sm,
    paddingVertical: 2,
    borderRadius: BorderRadius.xs,
    borderWidth: 1,
  },
  rolePillText: {
    ...Typography.micro,
    fontWeight: '600',
  },
  contactMetaRow: {
    marginTop: Spacing.sm,
    paddingTop: Spacing.sm,
    borderTopWidth: 1,
    borderTopColor: Colors.border.subtle,
  },
  lastContactedText: {
    ...Typography.small,
    color: Colors.text.muted,
  },
  previewHeader: {
    marginBottom: 0,
  },
  previewHeaderTop: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: Spacing.sm,
  },
  previewPriorityPill: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: Spacing.sm + 2,
    paddingVertical: 3,
    borderRadius: BorderRadius.full,
  },
  previewPriorityText: {
    ...Typography.micro,
    fontWeight: '700',
  },
  previewTime: {
    ...Typography.small,
    color: Colors.text.muted,
  },
  previewHeadline: {
    ...Typography.headline,
    color: Colors.text.primary,
    fontWeight: '700',
    marginBottom: Spacing.sm,
  },
  previewSubhead: {
    ...Typography.caption,
    color: Colors.text.tertiary,
    marginBottom: Spacing.sm,
  },
  previewChipRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.xs,
    marginTop: Spacing.xs,
  },
  previewChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: Spacing.sm,
    paddingVertical: 3,
    borderRadius: BorderRadius.full,
    borderWidth: 1,
    borderColor: Colors.border.subtle,
    backgroundColor: Colors.background.tertiary,
  },
  previewChipText: {
    ...Typography.micro,
    color: Colors.text.tertiary,
  },
  previewChipDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  previewSectionTitle: {
    ...Typography.small,
    color: Colors.text.muted,
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: Spacing.sm,
  },
  previewTagsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.xs,
    marginTop: Spacing.md,
  },
  previewDivider: {
    height: 1,
    backgroundColor: Colors.border.subtle,
    marginVertical: Spacing.md,
  },
  previewBody: {
    ...Typography.caption,
    color: Colors.text.secondary,
    lineHeight: 22,
  },
  previewActionsRow: {
    flexDirection: 'row',
    gap: Spacing.md,
  },
  previewActionBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.xs,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    borderRadius: BorderRadius.md,
    backgroundColor: Colors.background.tertiary,
    borderWidth: 1,
    borderColor: Colors.border.subtle,
  },
  previewActionText: {
    ...Typography.small,
    color: Colors.text.tertiary,
    fontWeight: '500',
  },
  previewAiSection: {
    backgroundColor: Colors.background.tertiary,
    borderRadius: BorderRadius.md,
    padding: Spacing.md,
    borderWidth: 1,
    borderColor: Colors.accent.cyanLight,
  },
  previewAiBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.xs,
    marginBottom: Spacing.sm,
  },
  previewAiLabel: {
    ...Typography.small,
    color: Colors.accent.cyan,
    fontWeight: '600',
  },
  previewUnreadBadge: {
    backgroundColor: Colors.accent.cyanLight,
    paddingHorizontal: Spacing.sm,
    paddingVertical: 2,
    borderRadius: BorderRadius.full,
  },
  previewUnreadText: {
    ...Typography.micro,
    color: Colors.accent.cyan,
    fontWeight: '700',
  },
  previewMailMeta: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: Spacing.md,
  },
  previewMailAvatar: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: Colors.accent.cyanDark,
    alignItems: 'center',
    justifyContent: 'center',
  },
  previewMailAvatarText: {
    fontSize: 16,
    fontWeight: '700',
    color: Colors.accent.cyan,
  },
  previewMailSender: {
    ...Typography.caption,
    color: Colors.text.primary,
    fontWeight: '600',
  },
  previewMailEmail: {
    ...Typography.micro,
    color: Colors.text.muted,
  },
  previewMailTo: {
    ...Typography.micro,
    color: Colors.text.muted,
    marginTop: Spacing.sm,
  },
  smartReplyRow: {
    flexDirection: 'row',
    gap: Spacing.sm,
    flexWrap: 'wrap',
  },
  smartReplyPill: {
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.xs + 2,
    borderRadius: BorderRadius.full,
    borderWidth: 1,
    borderColor: Colors.accent.cyan,
    backgroundColor: Colors.accent.cyanLight,
  },
  smartReplyText: {
    ...Typography.small,
    color: Colors.accent.cyan,
    fontWeight: '500',
  },
  contactPreviewHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: Spacing.md,
  },
  contactPreviewAvatar: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: Colors.accent.cyanDark,
    alignItems: 'center',
    justifyContent: 'center',
  },
  contactPreviewAvatarText: {
    fontSize: 24,
    fontWeight: '700',
    color: Colors.accent.cyan,
  },
  contactPreviewTitle: {
    ...Typography.caption,
    color: Colors.text.tertiary,
    marginTop: 2,
  },
  contactInfoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    paddingVertical: Spacing.sm,
  },
  contactInfoText: {
    ...Typography.caption,
    color: Colors.text.secondary,
  },
  emptyState: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingTop: 80,
    paddingHorizontal: Spacing.xl,
  },
  emptyTitle: {
    ...Typography.body,
    color: Colors.text.secondary,
    marginTop: Spacing.lg,
  },
  emptySubtitle: {
    ...Typography.small,
    color: Colors.text.muted,
    marginTop: Spacing.xs,
    textAlign: 'center',
  },
  eliChipWrapper: {
    position: 'absolute',
    bottom: 24,
    right: 24,
    zIndex: 100,
  },
  eliChip: {
    flexDirection: 'row',
    alignItems: 'center',
    height: 48,
    paddingLeft: 4,
    paddingRight: Spacing.lg,
    borderRadius: BorderRadius.full,
    gap: Spacing.sm,
    backgroundColor: Colors.surface.card,
    borderWidth: 1,
    borderColor: Colors.surface.cardBorder,
  },
  eliChipAvatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
  },
  eliChipText: {
    ...Typography.caption,
    color: Colors.text.primary,
    fontWeight: '700',
  },
  eliNotifDot: {
    position: 'absolute',
    top: -2,
    right: -2,
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: Colors.semantic.success,
  },
  eliPanel: {
    position: 'absolute',
    bottom: 80,
    right: 24,
    width: 320,
    height: 200,
    backgroundColor: Colors.surface.card,
    borderRadius: BorderRadius.xl,
    borderWidth: 1,
    borderColor: Colors.surface.cardBorder,
    padding: Spacing.lg,
    zIndex: 101,
    ...Shadows.lg,
  },
  eliPanelHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: Spacing.md,
  },
  eliPanelAvatar: {
    width: 28,
    height: 28,
    borderRadius: 14,
    marginRight: Spacing.sm,
  },
  eliPanelTitle: {
    ...Typography.headline,
    color: Colors.text.primary,
    fontWeight: '600',
    marginLeft: Spacing.sm,
  },
  eliPanelStat: {
    ...Typography.caption,
    color: Colors.text.secondary,
    marginBottom: Spacing.lg,
  },
  eliInputWrapper: {
    backgroundColor: Colors.surface.input,
    borderRadius: BorderRadius.md,
    borderWidth: 1,
    borderColor: Colors.surface.inputBorder,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
  },
  eliInput: {
    ...Typography.caption,
    color: Colors.text.primary,
  },
  eliInputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
  },
  eliMicButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: Colors.surface.input,
    borderWidth: 1,
    borderColor: Colors.accent.cyan,
    alignItems: 'center',
    justifyContent: 'center',
  },
  eliMicButtonActive: {
    backgroundColor: Colors.accent.cyan,
    borderColor: Colors.accent.cyan,
  },
  eliActiveBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginLeft: Spacing.sm,
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: BorderRadius.full,
    backgroundColor: Colors.accent.cyanLight,
  },
  eliActiveDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: Colors.accent.cyan,
  },
  eliActiveText: {
    ...Typography.micro,
    color: Colors.accent.cyan,
    fontWeight: '700',
  },
  eliTranscriptBox: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: Spacing.sm,
    backgroundColor: Colors.background.tertiary,
    borderRadius: BorderRadius.md,
    padding: Spacing.sm,
    marginBottom: Spacing.md,
  },
  eliTranscriptText: {
    ...Typography.small,
    color: Colors.text.secondary,
    flex: 1,
    lineHeight: 18,
  },
  skeletonCard: {
    backgroundColor: Colors.surface.card,
    borderRadius: BorderRadius.lg,
    padding: Spacing.lg,
    marginBottom: Spacing.sm,
    borderWidth: 1,
    borderColor: Colors.surface.cardBorder,
  },
  skeletonRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  skeletonCircle: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: Colors.background.tertiary,
  },
  skeletonTitle: {
    width: '70%',
    height: 14,
    backgroundColor: Colors.background.tertiary,
    borderRadius: 4,
    marginBottom: Spacing.sm,
  },
  skeletonSubtitle: {
    width: '40%',
    height: 10,
    backgroundColor: Colors.background.tertiary,
    borderRadius: 4,
  },
  mailboxSelectorBar: {
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border.subtle,
    position: 'relative' as const,
    zIndex: 100,
  },
  mailboxSelector: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    justifyContent: 'space-between' as const,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    borderRadius: BorderRadius.md,
    borderWidth: 1,
    borderColor: Colors.border.subtle,
    backgroundColor: Colors.background.secondary,
  },
  mailboxSelectorHover: {
    backgroundColor: Colors.background.tertiary,
  },
  mailboxSelectorLeft: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    gap: Spacing.sm,
  },
  mailboxProviderBadge: {
    width: 28,
    height: 28,
    borderRadius: 6,
    backgroundColor: Colors.background.tertiary,
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
  },
  mailboxDisplayName: {
    ...Typography.smallMedium,
    color: Colors.text.primary,
    fontWeight: '600' as const,
  },
  mailboxEmail: {
    ...Typography.small,
    color: Colors.text.muted,
  },
  mailboxDropdown: {
    position: 'absolute' as const,
    top: '100%' as unknown as number,
    left: Spacing.lg,
    right: Spacing.lg,
    backgroundColor: Colors.background.card,
    borderWidth: 1,
    borderColor: Colors.border.subtle,
    borderRadius: BorderRadius.md,
    ...Shadows.md,
    zIndex: 200,
    overflow: 'hidden' as const,
  },
  mailboxDropdownItem: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    gap: Spacing.sm,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm + 2,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border.subtle,
  },
  mailboxDropdownItemActive: {
    backgroundColor: Colors.accent.cyan + '0D',
  },
  mailboxDropdownItemHover: {
    backgroundColor: Colors.background.tertiary,
  },
  mailboxDropdownName: {
    ...Typography.smallMedium,
    color: Colors.text.primary,
    fontWeight: '500' as const,
  },
  mailboxDropdownEmail: {
    ...Typography.small,
    color: Colors.text.muted,
  },
  mailboxAddItem: {
    borderBottomWidth: 0,
  },
  mailSetupOverlay: {
    position: 'absolute' as const,
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0,0,0,0.65)',
    justifyContent: 'center' as const,
    alignItems: 'center' as const,
    zIndex: 500,
    paddingHorizontal: Spacing.xl,
  },
  mailSetupModal: {
    width: '100%' as unknown as number,
    maxWidth: 480,
    backgroundColor: Colors.background.card,
    borderRadius: BorderRadius.xl,
    borderWidth: 1,
    borderColor: Colors.border.subtle,
    padding: Spacing.xl + Spacing.sm,
    alignItems: 'center' as const,
    ...Shadows.lg,
  },
  mailSetupIconContainer: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: Colors.accent.cyan + '18',
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
    marginBottom: Spacing.lg,
  },
  mailSetupTitle: {
    ...Typography.heading,
    color: Colors.text.primary,
    fontWeight: '700' as const,
    textAlign: 'center' as const,
    marginBottom: Spacing.sm,
  },
  mailSetupDescription: {
    ...Typography.body,
    color: Colors.text.secondary,
    textAlign: 'center' as const,
    lineHeight: 22,
    marginBottom: Spacing.lg,
  },
  mailSetupFeatures: {
    width: '100%' as unknown as number,
    gap: Spacing.md,
    marginBottom: Spacing.xl,
  },
  mailSetupFeatureRow: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    gap: Spacing.sm,
  },
  mailSetupFeatureText: {
    ...Typography.body,
    color: Colors.text.primary,
  },
  mailSetupPrimaryButton: {
    width: '100%' as unknown as number,
    paddingVertical: Spacing.md,
    backgroundColor: Colors.accent.cyan,
    borderRadius: BorderRadius.md,
    alignItems: 'center' as const,
    marginBottom: Spacing.sm,
  },
  mailSetupPrimaryButtonText: {
    ...Typography.bodyMedium,
    color: '#fff',
    fontWeight: '600' as const,
  },
  mailSetupSecondaryButton: {
    width: '100%' as unknown as number,
    paddingVertical: Spacing.md,
    alignItems: 'center' as const,
  },
  mailSetupSecondaryButtonText: {
    ...Typography.body,
    color: Colors.text.muted,
  },
  mailSetupEmptyState: {
    flex: 1,
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
    paddingVertical: Spacing.xl * 3,
    paddingHorizontal: Spacing.xl,
  },
  mailSetupEmptyIcon: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: Colors.background.tertiary,
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
    marginBottom: Spacing.lg,
  },
  mailSetupEmptyTitle: {
    ...Typography.heading,
    color: Colors.text.secondary,
    fontWeight: '600' as const,
    marginBottom: Spacing.sm,
  },
  mailSetupEmptyDesc: {
    ...Typography.body,
    color: Colors.text.muted,
    textAlign: 'center' as const,
    lineHeight: 22,
    maxWidth: 380,
    marginBottom: Spacing.lg,
  },
  mailSetupEmptyCTA: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    gap: Spacing.sm,
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.md,
    backgroundColor: Colors.accent.cyan,
    borderRadius: BorderRadius.md,
  },
  mailSetupEmptyCTAText: {
    ...Typography.bodyMedium,
    color: '#fff',
    fontWeight: '600' as const,
  },
});
