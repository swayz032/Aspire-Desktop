/**
 * Onboarding Setup Tasks — Maps services_needed → setup tasks in approval_requests
 *
 * When a user completes onboarding, this generates setup tasks that appear
 * in the Authority Queue, guiding them to connect integrations for each
 * selected service.
 *
 * Risk Tier: GREEN (informational setup prompts, no state changes)
 */

export interface SetupTask {
  service: string;
  title: string;
  description: string;
  agent: string;
  icon: string;
  priority: 'high' | 'medium' | 'low';
}

const SERVICE_TASK_MAP: Record<string, SetupTask> = {
  'Invoicing & Payments': {
    service: 'invoicing',
    title: 'Connect your Stripe account',
    description: 'Link Stripe to send invoices and accept payments directly through Aspire.',
    agent: 'quinn',
    icon: 'card-outline',
    priority: 'high',
  },
  'Bookkeeping': {
    service: 'bookkeeping',
    title: 'Connect QuickBooks Online',
    description: 'Sync your books with QuickBooks for automated bookkeeping.',
    agent: 'teressa',
    icon: 'calculator-outline',
    priority: 'high',
  },
  'Email Management': {
    service: 'email',
    title: 'Set up your business email domain',
    description: 'Configure your custom domain for professional email management.',
    agent: 'eli',
    icon: 'mail-outline',
    priority: 'medium',
  },
  'Scheduling & Calendar': {
    service: 'scheduling',
    title: 'Connect Google Calendar',
    description: 'Sync your calendar for smart scheduling and meeting management.',
    agent: 'nora',
    icon: 'calendar-outline',
    priority: 'medium',
  },
  'Contract Management': {
    service: 'contracts',
    title: 'Upload contract templates',
    description: 'Add your contract templates for Clara to manage and send.',
    agent: 'clara',
    icon: 'document-text-outline',
    priority: 'medium',
  },
  'Payroll': {
    service: 'payroll',
    title: 'Connect Gusto payroll',
    description: 'Link Gusto for automated payroll processing.',
    agent: 'milo',
    icon: 'people-outline',
    priority: 'high',
  },
  'Document Generation': {
    service: 'documents',
    title: 'Upload your logo and letterhead',
    description: 'Add your branding for professional document generation.',
    agent: 'tec',
    icon: 'image-outline',
    priority: 'low',
  },
  'Research & Intelligence': {
    service: 'research',
    title: 'Review your first industry brief',
    description: 'Adam has prepared your personalized industry intelligence.',
    agent: 'adam',
    icon: 'bulb-outline',
    priority: 'low',
  },
  'Front Desk & Calls': {
    service: 'frontdesk',
    title: 'Set up your business phone line',
    description: 'Configure Sarah to handle your incoming calls professionally.',
    agent: 'sarah',
    icon: 'call-outline',
    priority: 'medium',
  },
  'Expense Tracking': {
    service: 'expenses',
    title: 'Connect your bank accounts',
    description: 'Link your bank for automatic expense categorization.',
    agent: 'finn',
    icon: 'wallet-outline',
    priority: 'high',
  },
  'Tax Preparation': {
    service: 'tax',
    title: 'Set up tax year preferences',
    description: 'Configure your fiscal year and tax filing preferences.',
    agent: 'teressa',
    icon: 'receipt-outline',
    priority: 'medium',
  },
  'Client Communication': {
    service: 'communication',
    title: 'Configure client messaging',
    description: 'Set up automated client communication preferences.',
    agent: 'eli',
    icon: 'chatbubble-outline',
    priority: 'low',
  },
};

/**
 * Generate setup tasks based on selected services.
 * Returns tasks sorted by priority (high → medium → low).
 */
export function generateSetupTasks(servicesNeeded: string[]): SetupTask[] {
  const tasks: SetupTask[] = [];

  for (const service of servicesNeeded) {
    const task = SERVICE_TASK_MAP[service];
    if (task) {
      tasks.push(task);
    }
  }

  const priorityOrder = { high: 0, medium: 1, low: 2 };
  tasks.sort((a, b) => priorityOrder[a.priority] - priorityOrder[b.priority]);

  return tasks;
}

/**
 * Build approval_requests rows from setup tasks for DB insertion.
 */
export function buildSetupTaskRows(suiteId: string, tasks: SetupTask[]) {
  return tasks.map((task) => ({
    suite_id: suiteId,
    tool: 'onboarding',
    operation: `setup.${task.service}`,
    risk_tier: 'green',
    status: 'pending',
    payload_redacted: {
      title: task.title,
      description: task.description,
      agent: task.agent,
      icon: task.icon,
      priority: task.priority,
    },
    created_by_user_id: null,
  }));
}
