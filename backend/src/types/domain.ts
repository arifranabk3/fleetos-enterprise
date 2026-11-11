export type UserRole = 
  | 'SUPER_ADMIN'
  | 'ORGANIZATION_OWNER'
  | 'ADMIN'
  | 'FLEET_MANAGER'
  | 'DISPATCHER'
  | 'DRIVER'
  | 'ACCOUNTANT'
  | 'VIEWER';

export type PermissionDomain =
  | 'ORGANIZATION'
  | 'USERS'
  | 'FLEET'
  | 'DRIVERS'
  | 'SHIPMENTS'
  | 'DISPATCH'
  | 'CUSTOMERS'
  | 'TRACKING'
  | 'MAINTENANCE'
  | 'COMPLIANCE'
  | 'EXPENSES'
  | 'BILLING'
  | 'REPORTS'
  | 'NOTIFICATIONS'
  | 'AUDIT_LOGS';

export type PermissionAction =
  | 'CREATE'
  | 'READ'
  | 'UPDATE'
  | 'DELETE'
  | 'MANAGE'
  | 'EXPORT';

export interface TenantContext {
  organizationId: string;
  name?: string;
  slug?: string;
  role: UserRole;
  permissions: string[];
}

export type VehicleStatus = 
  | 'AVAILABLE' 
  | 'ASSIGNED' 
  | 'IN_TRANSIT' 
  | 'MAINTENANCE' 
  | 'OUT_OF_SERVICE'
  | 'RETIRED';

export type DriverStatus =
  | 'AVAILABLE'
  | 'ASSIGNED'
  | 'ON_DUTY'
  | 'OFF_DUTY'
  | 'ON_LEAVE'
  | 'SUSPENDED'
  | 'INACTIVE';

export type ShipmentStatus = 
  | 'DRAFT'
  | 'PENDING_DISPATCH'
  | 'CONFIRMED'
  | 'READY_FOR_DISPATCH'
  | 'DISPATCHED'
  | 'IN_TRANSIT'
  | 'ARRIVED_AT_DESTINATION'
  | 'OUT_FOR_DELIVERY'
  | 'DELIVERED'
  | 'ON_HOLD'
  | 'DELAYED'
  | 'FAILED_DELIVERY'
  | 'CANCELLED'
  | 'RETURNED';

export interface GeoLocation {
  latitude: number;
  longitude: number;
  heading?: number;
  speed?: number;
  timestamp: string;
}
