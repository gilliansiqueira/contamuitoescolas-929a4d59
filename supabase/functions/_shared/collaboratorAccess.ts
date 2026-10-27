// Shared authorization: delegated managers never administer owner accounts.
export function canManageCollaborator(roles: string[], permissions: string[], targetRoles: string[]) {
  return roles.includes('super_admin') || (
    roles.includes('admin') && permissions.includes('collaborators_manage') &&
    targetRoles.includes('admin') && !targetRoles.includes('super_admin')
  );
}

export function canCreateCollaborator(roles: string[], permissions: string[]) {
  return roles.includes('super_admin') || (
    roles.includes('admin') && permissions.includes('collaborators_manage')
  );
}