import React from 'react';
import { ServiceHubShell } from '@/components/service-hub/ServiceHubShell';
import { ComingSoonStub } from '@/components/service-hub/ComingSoonStub';

export default function Jobs() {
  return (
    <ServiceHubShell>
      <ComingSoonStub
        title="Jobs"
        subtitle="Job lifecycle, board, calendar, clients, archive. Coming soon."
        icon="briefcase-outline"
      />
    </ServiceHubShell>
  );
}
