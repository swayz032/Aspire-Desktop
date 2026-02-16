// Permissions System for Team Workspace
// Enterprise-grade role-based access control

// Types inlined from teamWorkspace (no mock data dependency)
export type RoleType = 'owner' | 'admin' | 'member' | 'viewer' | 'external';

export type PermissionKey =
  | 'team.invite'
  | 'team.manage_roles'
  | 'team.manage_members'
  | 'suite.switch'
  | 'approvals.view'
  | 'approvals.approve_low_risk'
  | 'approvals.approve_high_risk'
  | 'receipts.view_all'
  | 'receipts.export'
  | 'queues.assign'
  | 'billing.view_usage';

export interface Member {
  id: string;
  name: string;
  email: string;
  roleId: RoleType;
  status: 'active' | 'pending' | 'suspended';
  suiteAccessIds: string[];
  extension?: string;
  lastActiveAt: string;
  avatarUrl?: string;
}

// Static role name mapping (no mock data needed)
const roleNames: Record<RoleType, string> = {
  owner: 'Owner',
  admin: 'Admin',
  member: 'Member',
  viewer: 'Viewer',
  external: 'External',
};

// Role to permissions mapping
export const rolePermissionMap: Record<RoleType, PermissionKey[]> = {
  owner: [
    'team.invite',
    'team.manage_roles',
    'team.manage_members',
    'suite.switch',
    'approvals.view',
    'approvals.approve_low_risk',
    'approvals.approve_high_risk',
    'receipts.view_all',
    'receipts.export',
    'queues.assign',
    'billing.view_usage',
  ],
  admin: [
    'team.invite',
    'team.manage_members',
    'suite.switch',
    'approvals.view',
    'approvals.approve_low_risk',
    'receipts.view_all',
    'queues.assign',
    'billing.view_usage',
  ],
  member: [
    'approvals.view',
    'receipts.view_all',
    'queues.assign',
  ],
  viewer: [
    'approvals.view',
    'receipts.view_all',
  ],
  external: [],
};

// Check if a user has a specific permission
export function hasPermission(user: Member | null, permission: PermissionKey): boolean {
  if (!user) return false;
  const permissions = rolePermissionMap[user.roleId] || [];
  return permissions.includes(permission);
}

// Check if user has any of the given permissions
export function hasAnyPermission(user: Member | null, permissions: PermissionKey[]): boolean {
  if (!user) return false;
  return permissions.some(p => hasPermission(user, p));
}

// Check if user has all of the given permissions
export function hasAllPermissions(user: Member | null, permissions: PermissionKey[]): boolean {
  if (!user) return false;
  return permissions.every(p => hasPermission(user, p));
}

// Check if user is Owner or Admin
export function isOwnerOrAdmin(user: Member | null): boolean {
  if (!user) return false;
  return user.roleId === 'owner' || user.roleId === 'admin';
}

// Check if user is Owner
export function isOwner(user: Member | null): boolean {
  if (!user) return false;
  return user.roleId === 'owner';
}

// Get role display name
export function getRoleName(roleId: RoleType): string {
  return roleNames[roleId] || roleId;
}

// Check if Team Workspace should be visible
export function canAccessTeamWorkspace(user: Member | null, seatsPurchased: number = 0): boolean {
  if (!user) return false;
  // Show if user is Owner/Admin OR if account has purchased seats
  return isOwnerOrAdmin(user) || seatsPurchased > 0;
}

// Permission descriptions for UI
export const permissionDescriptions: Record<PermissionKey, string> = {
  'team.invite': 'Invite new team members',
  'team.manage_roles': 'Change member roles',
  'team.manage_members': 'Suspend or remove members',
  'suite.switch': 'Switch between company suites',
  'approvals.view': 'View pending approvals',
  'approvals.approve_low_risk': 'Approve low-risk actions',
  'approvals.approve_high_risk': 'Approve high-risk actions',
  'receipts.view_all': 'View all receipts',
  'receipts.export': 'Export receipts',
  'queues.assign': 'Assign queue items',
  'billing.view_usage': 'View billing and usage',
};
