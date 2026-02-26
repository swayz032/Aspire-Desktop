/**
 * Structured Logger — Enterprise Remediation Wave 5 (D-C13).
 *
 * Replaces raw console.log/warn/error across the Desktop server with
 * a structured logger that:
 *   1. JSON-formats in production (machine-readable)
 *   2. Pretty-prints in development (human-readable)
 *   3. Never logs PII (Law #9) — callers must redact before passing
 *   4. Includes correlation_id and suite_id when available
 *
 * Usage:
 *   import { logger } from './logger';
 *   logger.info('Invoice created', { suite_id, invoice_id });
 *   logger.warn('Retry needed', { provider: 'stripe', attempt: 2 });
 *   logger.error('Payment failed', { error: err.message });
 */

const IS_PROD = process.env.NODE_ENV === 'production';

type LogLevel = 'debug' | 'info' | 'warn' | 'error';

interface LogEntry {
  level: LogLevel;
  message: string;
  timestamp: string;
  service: string;
  [key: string]: unknown;
}

function formatEntry(level: LogLevel, message: string, meta?: Record<string, unknown>): LogEntry {
  return {
    level,
    message,
    timestamp: new Date().toISOString(),
    service: 'aspire-desktop',
    ...meta,
  };
}

function emit(entry: LogEntry): void {
  const output = IS_PROD ? JSON.stringify(entry) : `[${entry.level.toUpperCase()}] ${entry.message}${Object.keys(entry).length > 4 ? ' ' + JSON.stringify(entry, null, 0) : ''}`;

  switch (entry.level) {
    case 'error':
      // eslint-disable-next-line no-console
      console.error(output);
      break;
    case 'warn':
      // eslint-disable-next-line no-console
      console.warn(output);
      break;
    default:
      // eslint-disable-next-line no-console
      console.log(output);
      break;
  }
}

export const logger = {
  debug(message: string, meta?: Record<string, unknown>): void {
    if (!IS_PROD) emit(formatEntry('debug', message, meta));
  },
  info(message: string, meta?: Record<string, unknown>): void {
    emit(formatEntry('info', message, meta));
  },
  warn(message: string, meta?: Record<string, unknown>): void {
    emit(formatEntry('warn', message, meta));
  },
  error(message: string, meta?: Record<string, unknown>): void {
    emit(formatEntry('error', message, meta));
  },
};
