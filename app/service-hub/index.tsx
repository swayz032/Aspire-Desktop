import React from 'react';
import { ServiceHubShell } from '@/components/service-hub/ServiceHubShell';
import { ComingSoonStub } from '@/components/service-hub/ComingSoonStub';

export default function ServiceHubOverview() {
  return (
    <ServiceHubShell>
      <ComingSoonStub
        title="Overview"
        subtitle="Office health, active work, approvals, receipts, and Tim's recommendations."
        icon="grid-outline"
      />
    </ServiceHubShell>
  );
}
