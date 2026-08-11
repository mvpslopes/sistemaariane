import type { Role } from '../services/apiService';

export interface UserPermissions {
  canCreate: boolean;
  canUpdate: boolean;
  canDelete: boolean;
  canManageUsers: boolean;
  canViewAudit: boolean;
}

export function permissionsFromRole(role: Role): UserPermissions {
  const isStaff = role === 'root' || role === 'admin' || role === 'user';
  const isAdmin = role === 'root' || role === 'admin';
  return {
    canCreate: isStaff,
    canUpdate: isAdmin,
    canDelete: isAdmin,
    canManageUsers: isAdmin,
    canViewAudit: isAdmin,
  };
}
