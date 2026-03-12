import { logger } from './logger';

export type IncidentSeverity = 'sev1' | 'sev2' | 'sev3' | 'sev4';

export interface AdminIncidentReport {
  title: string;
  severity?: IncidentSeverity;
  suiteId?: string | null;
  correlationId: string;
  traceId?: string | null;
  source: string;
  component: string;
  fingerprint: string;
  state?: 'open' | 'investigating' | 'mitigated' | 'closed';
  agent?: string | null;
  errorCode?: string | null;
  statusCode?: number | null;
  message?: string | null;
  metadata?: Record<string, unknown>;
}

function trimEnv(value: string | undefined): string {
  return typeof value === 'string' ? value.trim() : '';
}

export function getIncidentReporterSecret(): string {
  return (
    trimEnv(process.env.ASPIRE_ADMIN_INCIDENT_S2S_SECRET) ||
    trimEnv(process.env.S2S_HMAC_SECRET_ACTIVE) ||
    trimEnv(process.env.DOMAIN_RAIL_HMAC_SECRET) ||
    trimEnv(process.env.S2S_HMAC_SECRET)
  );
}

export function resolveAdminIncidentUrl(orchestratorUrl: string): string {
  return `${orchestratorUrl.replace(/\/+$/, '')}/admin/ops/incidents/report`;
}

export async function reportAdminIncident(
  orchestratorUrl: string | null,
  incident: AdminIncidentReport,
): Promise<boolean> {
  const secret = getIncidentReporterSecret();
  if (!orchestratorUrl || !secret) {
    logger.warn('Admin incident reporter skipped', {
      component: incident.component,
      source: incident.source,
      reason: !orchestratorUrl ? 'missing_orchestrator_url' : 'missing_s2s_secret',
      correlation_id: incident.correlationId,
    });
    return false;
  }

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 1500);

  try {
    const response = await fetch(resolveAdminIncidentUrl(orchestratorUrl), {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${secret}`,
        'X-Correlation-Id': incident.correlationId,
        'X-Trace-Id': incident.traceId || incident.correlationId,
        'X-Actor-Id': 'aspire-desktop-server',
      },
      body: JSON.stringify({
        title: incident.title,
        severity: incident.severity || 'sev2',
        source: incident.source,
        component: incident.component,
        state: incident.state || 'open',
        suite_id: incident.suiteId || null,
        correlation_id: incident.correlationId,
        trace_id: incident.traceId || incident.correlationId,
        fingerprint: incident.fingerprint,
        agent: incident.agent || null,
        error_code: incident.errorCode || null,
        status_code: typeof incident.statusCode === 'number' ? incident.statusCode : null,
        message: incident.message || null,
        evidence_pack: {
          source: incident.source,
          component: incident.component,
          metadata: incident.metadata || {},
        },
      }),
      signal: controller.signal,
    });

    if (!response.ok) {
      logger.warn('Admin incident reporter rejected', {
        component: incident.component,
        source: incident.source,
        status: response.status,
        correlation_id: incident.correlationId,
      });
      return false;
    }

    return true;
  } catch (error) {
    logger.warn('Admin incident reporter failed', {
      component: incident.component,
      source: incident.source,
      correlation_id: incident.correlationId,
      error: error instanceof Error ? error.message : 'unknown',
    });
    return false;
  } finally {
    clearTimeout(timeoutId);
  }
}
