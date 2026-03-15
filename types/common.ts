/**
 * Extended Pressable state for Expo Web — adds hovered to the standard pressed/focused.
 */
export interface PressableState {
  pressed: boolean;
  hovered?: boolean;
  focused?: boolean;
}

export type Tag = 'Legal' | 'Finance' | 'Ops' | 'Security' | 'Sales';
export type Priority = 'Low' | 'Medium' | 'High';
export type ItemStatus = 'Open' | 'Waiting' | 'Resolved' | 'resolved' | 'in_progress';

// Identity values are populated from the intake form (suite_profiles via useTenant hook).
// No hardcoded constants — use useTenant() or useSupabase() in components.

export interface SuiteContext {
  suiteId: string;
  officeId: string;
  businessName: string;
}

export interface BaseEntity {
  id: string;
  createdAt: string;
  updatedAt: string;
}

export type Actor = 'Ava' | 'Quinn' | 'Eli' | 'Clara' | 'Cole' | 'Nova' | 'Piper' | 'Nara' | 'Human';

export interface ActionButton {
  label: string;
  icon: string;
  action: string;
}
