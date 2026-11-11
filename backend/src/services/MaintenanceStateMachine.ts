import { MaintenanceStatus } from '../models/MaintenanceRecord';

export interface MaintenanceTransitionContext {
  userId: string;
  userRole: string;
  reason?: string;
}

export const VALID_MAINTENANCE_TRANSITIONS: Record<MaintenanceStatus, MaintenanceStatus[]> = {
  SCHEDULED: ['DUE', 'IN_PROGRESS', 'CANCELLED'],
  DUE: ['IN_PROGRESS', 'OVERDUE', 'CANCELLED'],
  OVERDUE: ['IN_PROGRESS', 'CANCELLED'],
  IN_PROGRESS: ['COMPLETED', 'CANCELLED'],
  COMPLETED: [], // Terminal State
  CANCELLED: [], // Terminal State
};

export class MaintenanceStateMachine {
  public static validateTransition(
    currentStatus: MaintenanceStatus,
    nextStatus: MaintenanceStatus,
    context: MaintenanceTransitionContext
  ): { allowed: boolean; reason?: string } {
    if (currentStatus === nextStatus) {
      return { allowed: true };
    }

    const legalNext = VALID_MAINTENANCE_TRANSITIONS[currentStatus] || [];
    if (legalNext.length === 0) {
      return {
        allowed: false,
        reason: `Cannot transition from terminal maintenance status '${currentStatus}'.`,
      };
    }

    if (!legalNext.includes(nextStatus)) {
      return {
        allowed: false,
        reason: `Illegal maintenance status transition from '${currentStatus}' to '${nextStatus}'. Legal: [${legalNext.join(', ')}].`,
      };
    }

    if (nextStatus === 'CANCELLED' && (!context.reason || context.reason.trim().length < 5)) {
      return {
        allowed: false,
        reason: 'A documented cancellation reason (minimum 5 characters) is required.',
      };
    }

    return { allowed: true };
  }
}
