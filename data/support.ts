import { FAQArticle, SupportTicket, Policy } from '@/types/support';
import { faqId, ticketId } from '@/lib/ids';

const now = new Date();
const hoursAgo = (h: number) => new Date(now.getTime() - h * 3600000).toISOString();
const daysAgo = (d: number) => new Date(now.getTime() - d * 86400000).toISOString();

export const faqArticles: FAQArticle[] = [
  {
    id: faqId(1),
    question: 'How do I approve an authority item?',
    answer: 'Navigate to the Authority Queue on your Home screen. Tap on any item to view its details. You can then choose to Approve, Deny, or Defer the item. Every action you take generates a receipt for your records.',
    category: 'Getting Started',
    helpful: 42,
    createdAt: daysAgo(90),
    updatedAt: daysAgo(30),
  },
  {
    id: faqId(2),
    question: 'What is a Receipt and why does it matter?',
    answer: 'A Receipt is an immutable audit trail entry that documents every action taken by AI staff on your behalf. Receipts include the intent, execution plan, evidence, and policy evaluation. They ensure complete accountability and transparency.',
    category: 'Core Concepts',
    helpful: 38,
    createdAt: daysAgo(90),
    updatedAt: daysAgo(15),
  },
  {
    id: faqId(3),
    question: 'How do I add a new AI staff member?',
    answer: 'Go to the Office Store from the More tab. Browse available staff members and tap "Enable Staff" on any member you want to add. You can configure their permissions and daily limits after enabling.',
    category: 'Staff Management',
    helpful: 35,
    createdAt: daysAgo(60),
    updatedAt: daysAgo(10),
  },
  {
    id: faqId(4),
    question: 'What happens if an AI action is blocked?',
    answer: 'When an action is blocked, it means the AI staff member attempted something that violated your configured policies or exceeded their permissions. The blocked action generates a receipt explaining why it was stopped, and no external action is taken.',
    category: 'Security',
    helpful: 45,
    createdAt: daysAgo(90),
    updatedAt: daysAgo(20),
  },
  {
    id: faqId(5),
    question: 'How do I connect external integrations?',
    answer: 'Navigate to Integrations from the More tab. Select the service you want to connect and follow the authentication flow. Once connected, the integration will sync automatically and appear in your health dashboard.',
    category: 'Integrations',
    helpful: 28,
    createdAt: daysAgo(45),
    updatedAt: daysAgo(5),
  },
  {
    id: faqId(6),
    question: 'Can I set spending limits for AI staff?',
    answer: 'Yes. Each AI staff member has configurable daily limits. Go to Team Members from the More tab, select a staff member, and adjust their Daily Limits settings. Changes are logged with a receipt.',
    category: 'Staff Management',
    helpful: 32,
    createdAt: daysAgo(60),
    updatedAt: daysAgo(8),
  },
  {
    id: faqId(7),
    question: 'How do I start a voice session with Ava?',
    answer: 'Tap the Mic tab at the bottom of your screen to open the voice interface. You can speak naturally, and Ava will respond. Any actions requiring approval will be added to your Authority Queue.',
    category: 'Getting Started',
    helpful: 55,
    createdAt: daysAgo(90),
    updatedAt: daysAgo(1),
  },
  {
    id: faqId(8),
    question: 'What does the Authority Queue prioritize?',
    answer: 'Items in the Authority Queue are sorted by priority (High, Medium, Low) and then by time. High-priority items that require your attention appear first. You can also filter by type (payment, contract, communication).',
    category: 'Core Concepts',
    helpful: 40,
    createdAt: daysAgo(75),
    updatedAt: daysAgo(12),
  },
  {
    id: faqId(9),
    question: 'How secure is my business data?',
    answer: 'All data is encrypted at rest and in transit. AI staff operate within strict sandboxes and cannot access data outside their permissions. Every action is logged, and you maintain full control over what each staff member can access.',
    category: 'Security',
    helpful: 62,
    createdAt: daysAgo(90),
    updatedAt: daysAgo(3),
  },
  {
    id: faqId(10),
    question: 'Can I undo an approved action?',
    answer: 'Once an action is approved and executed, it cannot be undone directly. However, you can create follow-up actions to reverse effects (like refunding a payment). All actions and their reversals are documented in receipts.',
    category: 'Core Concepts',
    helpful: 25,
    createdAt: daysAgo(45),
    updatedAt: daysAgo(25),
  },
  {
    id: faqId(11),
    question: 'How do I view my business analytics?',
    answer: 'The Home screen displays your Ops Snapshot with key metrics like Cash Position and Business Roadmap. For detailed analytics, tap on any metric card to expand it, or navigate to specific sections for full reports.',
    category: 'Analytics',
    helpful: 30,
    createdAt: daysAgo(30),
    updatedAt: daysAgo(7),
  },
  {
    id: faqId(12),
    question: 'What is the difference between Approve and Delegate?',
    answer: 'Approve means you personally authorize the action. Delegate assigns the decision to another team member or sets up conditional auto-approval for similar future actions within defined parameters.',
    category: 'Core Concepts',
    helpful: 22,
    createdAt: daysAgo(60),
    updatedAt: daysAgo(14),
  },
];

export const supportTickets: SupportTicket[] = [
  {
    id: ticketId(1),
    subject: 'Integration sync issue with QuickBooks',
    description: 'QuickBooks integration is not syncing transactions from the last 24 hours.',
    status: 'In Progress',
    priority: 'High',
    category: 'Integrations',
    receiptId: 'RCP_0050',
    createdAt: daysAgo(1),
    updatedAt: hoursAgo(4),
  },
  {
    id: ticketId(2),
    subject: 'Request for new staff capability',
    description: 'Would like Quinn to be able to generate custom invoice templates.',
    status: 'Open',
    priority: 'Medium',
    category: 'Feature Request',
    createdAt: daysAgo(3),
    updatedAt: daysAgo(3),
  },
  {
    id: ticketId(3),
    subject: 'Voice recognition accuracy',
    description: 'Ava sometimes misinterprets company names during calls.',
    status: 'Resolved',
    priority: 'Low',
    category: 'Technical',
    receiptId: 'RCP_0051',
    createdAt: daysAgo(7),
    updatedAt: daysAgo(2),
  },
];

export const policies: Policy[] = [
  {
    id: 'POL_0001',
    title: 'Terms of Service',
    content: `ASPIRE FOUNDER CONSOLE - TERMS OF SERVICE

Last Updated: January 1, 2026

1. ACCEPTANCE OF TERMS
By accessing or using the Aspire Founder Console ("Service"), you agree to be bound by these Terms of Service. If you do not agree to these terms, do not use the Service.

2. DESCRIPTION OF SERVICE
Aspire provides Deal Execution Infrastructure that enables AI-powered business operations through a human governance layer. The Service includes AI staff members that perform business tasks subject to your approval and oversight.

3. USER RESPONSIBILITIES
- You are responsible for all actions taken through your account
- You must maintain accurate business and contact information
- You agree to review and approve authority items in a timely manner
- You will not use the Service for illegal or unauthorized purposes

4. AI STAFF OPERATIONS
- All AI staff actions require explicit or conditional approval
- Every action generates an immutable audit receipt
- You maintain full control over AI staff permissions and limits
- Blocked actions indicate policy violations and are logged

5. DATA AND PRIVACY
- Your business data is encrypted and stored securely
- AI staff access only data necessary for their functions
- We do not sell or share your data with third parties
- You can export your data at any time

6. LIMITATION OF LIABILITY
Aspire shall not be liable for any indirect, incidental, or consequential damages arising from your use of the Service.

7. MODIFICATIONS
We reserve the right to modify these terms at any time. Continued use of the Service constitutes acceptance of modified terms.`,
    version: '2.1',
    effectiveDate: daysAgo(180),
    createdAt: daysAgo(365),
    updatedAt: daysAgo(180),
  },
  {
    id: 'POL_0002',
    title: 'Privacy Policy',
    content: `ASPIRE FOUNDER CONSOLE - PRIVACY POLICY

Last Updated: January 1, 2026

1. INFORMATION WE COLLECT
- Account information (name, email, business details)
- Business data you upload or create
- Usage patterns and interaction logs
- Voice and call recordings (with consent)

2. HOW WE USE YOUR INFORMATION
- To provide and improve the Service
- To process your business operations
- To generate receipts and audit trails
- To communicate important updates

3. DATA SECURITY
- All data encrypted at rest (AES-256)
- All transmissions encrypted in transit (TLS 1.3)
- Regular security audits and penetration testing
- SOC 2 Type II compliant infrastructure

4. AI STAFF DATA ACCESS
- AI staff operate in sandboxed environments
- Access limited to explicitly granted permissions
- All data access logged in receipts
- No data retained after task completion

5. DATA RETENTION
- Active account data retained indefinitely
- Receipts retained for 7 years (compliance)
- Deleted data purged within 30 days
- Export available upon request

6. YOUR RIGHTS
- Access your data at any time
- Correct inaccurate information
- Delete your account and data
- Export data in standard formats

7. CONTACT US
For privacy inquiries: security@aspireos.app`,
    version: '1.8',
    effectiveDate: daysAgo(90),
    createdAt: daysAgo(365),
    updatedAt: daysAgo(90),
  },
  {
    id: 'POL_0003',
    title: 'AI Governance Policy',
    content: `ASPIRE FOUNDER CONSOLE - AI GOVERNANCE POLICY

Last Updated: January 1, 2026

1. GOVERNANCE PRINCIPLES
The Aspire Founder Console operates on a governance-first approach where every AI action follows the pattern: Intent → Approval → Execute → Receipt.

2. HUMAN OVERSIGHT
- All significant actions require human approval
- Founders maintain ultimate authority over all operations
- AI staff cannot override human decisions
- Emergency stop capabilities available at all times

3. TRANSPARENCY REQUIREMENTS
- Every AI action generates a detailed receipt
- Receipts include intent, plan, execution, and evidence
- Policy evaluations explain why actions were allowed or blocked
- Full audit trail accessible at any time

4. PERMISSION FRAMEWORK
- AI staff permissions explicitly configured by founder
- Daily limits prevent runaway operations
- Sensitive actions always require manual approval
- Permission changes logged with receipts

5. ACCOUNTABILITY CHAIN
- Each receipt identifies the responsible AI staff
- Human approvals linked to specific authority items
- Complete chain of custody for all actions
- External actions traceable to internal decisions

6. POLICY ENFORCEMENT
- Automated policy evaluation before execution
- Actions blocked if policies violated
- Blocked actions generate explanation receipts
- No silent failures or hidden operations

7. CONTINUOUS IMPROVEMENT
- Regular policy review and updates
- Feedback mechanisms for policy refinement
- Transparent change management
- Version history maintained`,
    version: '1.5',
    effectiveDate: daysAgo(45),
    createdAt: daysAgo(180),
    updatedAt: daysAgo(45),
  },
];
