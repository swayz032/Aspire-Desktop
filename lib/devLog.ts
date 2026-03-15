/**
 * Development-only logging utility for Desktop client code.
 *
 * In production builds, all log calls are no-ops — zero PII/token leakage.
 * Expo/React Native provides the __DEV__ global which is false in production.
 *
 * Server code should use `server/logger.ts` instead.
 */

/* eslint-disable no-console */
export const devLog = __DEV__ ? console.log.bind(console) : (() => {});
export const devWarn = __DEV__ ? console.warn.bind(console) : (() => {});
export const devError = __DEV__ ? console.error.bind(console) : (() => {});
/* eslint-enable no-console */
