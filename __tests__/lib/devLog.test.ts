/**
 * devLog Tests
 *
 * Validates the development-only logging utility exports exist and are callable.
 * In test environment (__DEV__ is true via jest-expo), these should delegate to console.
 */

describe('devLog module', () => {
  test('should export devLog, devWarn, devError', () => {
    const mod = require('../../lib/devLog');
    expect(mod.devLog).toBeDefined();
    expect(mod.devWarn).toBeDefined();
    expect(mod.devError).toBeDefined();
    expect(typeof mod.devLog).toBe('function');
    expect(typeof mod.devWarn).toBe('function');
    expect(typeof mod.devError).toBe('function');
  });

  test('devLog should be callable without throwing', () => {
    const { devLog } = require('../../lib/devLog');
    expect(() => devLog('test message')).not.toThrow();
  });

  test('devWarn should be callable without throwing', () => {
    const { devWarn } = require('../../lib/devLog');
    expect(() => devWarn('test warning')).not.toThrow();
  });

  test('devError should be callable without throwing', () => {
    const { devError } = require('../../lib/devLog');
    expect(() => devError('test error')).not.toThrow();
  });
});
