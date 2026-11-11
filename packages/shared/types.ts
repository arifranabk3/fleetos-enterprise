export type UserRole = 
  | 'PLATFORM_SUPER_ADMIN'
  | 'ORGANIZATION_ADMIN'
  | 'DISPATCH_MANAGER'
  | 'FLEET_MANAGER'
  | 'SAFETY_OFFICER'
  | 'DRIVER'
  | 'CUSTOMER';

export interface TenantContext {
  organizationId: string;
  name: string;
  slug: string;
  plan: 'STARTER' | 'GROWTH' | 'ENTERPRISE';
}

export type VehicleStatus = 
  | 'AVAILABLE' 
  | 'ASSIGNED' 
  | 'IN_TRANSIT' 
  | 'MAINTENANCE' 
  | 'OUT_OF_SERVICE';

export type ShipmentStatus = 
  | 'DRAFT'
  | 'PENDING_DISPATCH'
  | 'DISPATCHED'
  | 'IN_TRANSIT'
  | 'OUT_FOR_DELIVERY'
  | 'DELIVERED'
  | 'EXCEPTION'
  | 'CANCELLED';

export interface GeoLocation {
  latitude: number;
  longitude: number;
  heading?: number;
  speed?: number;
  timestamp: string;
}
