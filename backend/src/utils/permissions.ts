import { UserRole } from '../types/domain';

export const ROLE_PERMISSIONS: Record<UserRole, string[]> = {
  SUPER_ADMIN: ['*'], // Full platform governance

  ORGANIZATION_OWNER: [
    'ORGANIZATION:MANAGE',
    'USERS:MANAGE',
    'FLEET:MANAGE',
    'DRIVERS:MANAGE',
    'SHIPMENTS:MANAGE',
    'DISPATCH:MANAGE',
    'TRACKING:MANAGE',
    'MAINTENANCE:MANAGE',
    'EXPENSES:MANAGE',
    'BILLING:MANAGE',
    'REPORTS:MANAGE',
    'REPORTS:EXPORT',
    'NOTIFICATIONS:MANAGE',
    'AUDIT_LOGS:READ',
  ],

  ADMIN: [
    'ORGANIZATION:READ',
    'USERS:MANAGE',
    'FLEET:MANAGE',
    'DRIVERS:MANAGE',
    'SHIPMENTS:MANAGE',
    'DISPATCH:MANAGE',
    'TRACKING:READ',
    'MAINTENANCE:MANAGE',
    'EXPENSES:MANAGE',
    'BILLING:READ',
    'REPORTS:READ',
    'REPORTS:EXPORT',
    'NOTIFICATIONS:MANAGE',
    'AUDIT_LOGS:READ',
  ],

  FLEET_MANAGER: [
    'FLEET:MANAGE',
    'DRIVERS:MANAGE',
    'MAINTENANCE:MANAGE',
    'EXPENSES:CREATE',
    'EXPENSES:READ',
    'TRACKING:READ',
    'REPORTS:READ',
  ],

  DISPATCHER: [
    'SHIPMENTS:MANAGE',
    'DISPATCH:MANAGE',
    'TRACKING:MANAGE',
    'FLEET:READ',
    'DRIVERS:READ',
    'REPORTS:READ',
  ],

  DRIVER: [
    'FLEET:READ',
    'SHIPMENTS:READ',
    'SHIPMENTS:UPDATE', // Confirm delivery
    'TRACKING:CREATE', // Telemetry breadcrumbs
    'EXPENSES:CREATE',
    'NOTIFICATIONS:READ',
  ],

  ACCOUNTANT: [
    'BILLING:MANAGE',
    'EXPENSES:MANAGE',
    'REPORTS:READ',
    'REPORTS:EXPORT',
    'SHIPMENTS:READ',
  ],

  VIEWER: [
    'FLEET:READ',
    'SHIPMENTS:READ',
    'TRACKING:READ',
    'REPORTS:READ',
  ],
};

export const hasPermission = (userRole: UserRole, requiredPermission: string): boolean => {
  const permissions = ROLE_PERMISSIONS[userRole] || [];
  if (permissions.includes('*')) return true;
  return permissions.includes(requiredPermission);
};

