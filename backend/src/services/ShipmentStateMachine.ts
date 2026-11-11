import { ShipmentStatus } from '../types/domain';

export interface TransitionContext {
  userId: string;
  userRole: string;
  reason?: string;
  metadata?: Record<string, any>;
}

export interface TransitionResult {
  allowed: boolean;
  reason?: string;
}

/**
 * Enterprise Shipment State Transition Matrix
 * Defines strict deterministic legal state transitions.
 */
export const VALID_SHIPMENT_TRANSITIONS: Record<ShipmentStatus, ShipmentStatus[]> = {
  DRAFT: ['PENDING_DISPATCH', 'CONFIRMED', 'CANCELLED'],
  PENDING_DISPATCH: ['CONFIRMED', 'READY_FOR_DISPATCH', 'CANCELLED', 'ON_HOLD'],
  CONFIRMED: ['READY_FOR_DISPATCH', 'DISPATCHED', 'CANCELLED', 'ON_HOLD'],
  READY_FOR_DISPATCH: ['DISPATCHED', 'CANCELLED', 'ON_HOLD'],
  DISPATCHED: ['IN_TRANSIT', 'DELAYED', 'CANCELLED', 'ON_HOLD'],
  IN_TRANSIT: ['ARRIVED_AT_DESTINATION', 'OUT_FOR_DELIVERY', 'DELIVERED', 'DELAYED', 'FAILED_DELIVERY', 'ON_HOLD'],
  ARRIVED_AT_DESTINATION: ['OUT_FOR_DELIVERY', 'DELIVERED', 'DELAYED', 'ON_HOLD', 'RETURNED'],
  OUT_FOR_DELIVERY: ['DELIVERED', 'FAILED_DELIVERY', 'DELAYED', 'ON_HOLD'],
  DELIVERED: [], // Terminal State
  ON_HOLD: ['PENDING_DISPATCH', 'CONFIRMED', 'READY_FOR_DISPATCH', 'DISPATCHED', 'IN_TRANSIT', 'CANCELLED'],
  DELAYED: ['IN_TRANSIT', 'OUT_FOR_DELIVERY', 'DELIVERED', 'FAILED_DELIVERY', 'ON_HOLD'],
  FAILED_DELIVERY: ['OUT_FOR_DELIVERY', 'RETURNED', 'CANCELLED', 'ON_HOLD'],
  CANCELLED: [], // Terminal State
  RETURNED: [], // Terminal State
};

/**
 * Roles permitted to perform specific transitions
 */
export const EXCEPTIONAL_STATUSES: ShipmentStatus[] = [
  'ON_HOLD',
  'DELAYED',
  'FAILED_DELIVERY',
  'CANCELLED',
  'RETURNED',
];

export class ShipmentStateMachine {
  /**
   * Validate whether a proposed transition from currentStatus to nextStatus is allowed
   */
  public static validateTransition(
    currentStatus: ShipmentStatus,
    nextStatus: ShipmentStatus,
    context: TransitionContext
  ): TransitionResult {
    if (currentStatus === nextStatus) {
      return { allowed: true };
    }

    // 1. Check if current state is terminal
    const allowedNextStates = VALID_SHIPMENT_TRANSITIONS[currentStatus] || [];
    if (allowedNextStates.length === 0) {
      return {
        allowed: false,
        reason: `Cannot transition from terminal status '${currentStatus}' to '${nextStatus}'.`,
      };
    }

    // 2. Check if next status is in legal transitions
    if (!allowedNextStates.includes(nextStatus)) {
      return {
        allowed: false,
        reason: `Illegal state transition from '${currentStatus}' to '${nextStatus}'. Allowed transitions: [${allowedNextStates.join(', ')}].`,
      };
    }

    // 3. Check exceptional transitions requiring justification
    if (EXCEPTIONAL_STATUSES.includes(nextStatus) && !context.reason) {
      return {
        allowed: false,
        reason: `A documented reason is mandatory when transitioning to exceptional status '${nextStatus}'.`,
      };
    }

    // 4. Role restrictions for cancellation
    if (nextStatus === 'CANCELLED') {
      const cancellationRoles = ['SUPER_ADMIN', 'ORGANIZATION_OWNER', 'ADMIN', 'DISPATCHER'];
      if (!cancellationRoles.includes(context.userRole)) {
        return {
          allowed: false,
          reason: `Role '${context.userRole}' is not authorized to cancel shipments.`,
        };
      }
    }

    return { allowed: true };
  }
}
