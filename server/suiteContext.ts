// Shared suite/office context — set at startup, used by all modules
// This avoids circular dependencies between index.ts and other modules

let _defaultSuiteId = '';
let _defaultOfficeId = '';

export function setDefaultSuiteId(id: string) {
  _defaultSuiteId = id;
}

export function setDefaultOfficeId(id: string) {
  _defaultOfficeId = id;
}

export function getDefaultSuiteId(): string {
  return _defaultSuiteId;
}

export function getDefaultOfficeId(): string {
  return _defaultOfficeId;
}
