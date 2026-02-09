import { 
  setOfficeItems, 
  setCalls, 
  setMailThreads, 
  setContacts, 
  setReceipts, 
  setIntegrations, 
  setTeamMembers, 
  setFAQArticles, 
  setPolicies, 
  setTenant,
  setSecuritySettings,
} from './mockDb';

import { officeItems } from '@/data/inbox';
import { calls } from '@/data/calls';
import { mailThreads } from '@/data/mail';
import { contacts } from '@/data/contacts';
import { receipts } from '@/data/receipts';
import { integrations } from '@/data/integrations';
import { teamMembers } from '@/data/team';
import { faqArticles, policies } from '@/data/support';
import { tenant, defaultSecuritySettings } from '@/data/tenant';

let isSeeded = false;

export function seedDatabase(): void {
  if (isSeeded) return;
  
  setOfficeItems(officeItems);
  setCalls(calls);
  setMailThreads(mailThreads);
  setContacts(contacts);
  setReceipts(receipts);
  setIntegrations(integrations);
  setTeamMembers(teamMembers);
  setFAQArticles(faqArticles);
  setPolicies(policies);
  setTenant(tenant);
  setSecuritySettings(defaultSecuritySettings);
  
  isSeeded = true;
}

export function isDbSeeded(): boolean {
  return isSeeded;
}
