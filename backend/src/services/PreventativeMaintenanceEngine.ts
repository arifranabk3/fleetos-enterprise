import { MaintenanceSchedule, IMaintenanceSchedule } from '../models/MaintenanceSchedule';
import { MaintenanceRecord } from '../models/MaintenanceRecord';
import { Vehicle } from '../models/Vehicle';
import { Notification } from '../models/Notification';

export class PreventiveMaintenanceEngine {
  /**
   * Recalculate and update schedule due metrics after a completed service record
   */
  public static async onServiceCompleted(
    scheduleId: string,
    completedDate: Date,
    completedOdometerKm: number
  ): Promise<void> {
    const schedule = await MaintenanceSchedule.findById(scheduleId);
    if (!schedule || !schedule.isActive) return;

    schedule.lastServiceDate = completedDate;
    schedule.lastServiceOdometerKm = completedOdometerKm;

    if (schedule.intervalDays) {
      schedule.nextDueDate = new Date(completedDate.getTime() + schedule.intervalDays * 24 * 60 * 60 * 1000);
    }
    if (schedule.intervalDistanceKm) {
      schedule.nextDueOdometerKm = completedOdometerKm + schedule.intervalDistanceKm;
    }

    await schedule.save();
  }

  /**
   * Scan all active schedules for a tenant and detect upcoming or overdue service triggers
   */
  public static async scanMaintenanceSchedules(organizationId: string): Promise<{
    dueCount: number;
    overdueCount: number;
  }> {
    const schedules = await MaintenanceSchedule.find({
      organizationId,
      isActive: true,
    }).populate('vehicleId', 'plateNumber odometerKm status');

    const now = new Date();
    let dueCount = 0;
    let overdueCount = 0;

    for (const sch of schedules) {
      const vehicle = sch.vehicleId as any;
      if (!vehicle) continue;

      let isOverdue = false;
      let isDue = false;

      // 1. Time-based check
      if (sch.nextDueDate) {
        if (now > sch.nextDueDate) {
          isOverdue = true;
        } else {
          const reminderDate = new Date(sch.nextDueDate.getTime() - sch.reminderDaysThreshold * 24 * 60 * 60 * 1000);
          if (now >= reminderDate) {
            isDue = true;
          }
        }
      }

      // 2. Distance-based check
      if (sch.nextDueOdometerKm && vehicle.odometerKm) {
        if (vehicle.odometerKm >= sch.nextDueOdometerKm) {
          isOverdue = true;
        } else if (vehicle.odometerKm >= sch.nextDueOdometerKm - sch.reminderKmThreshold) {
          isDue = true;
        }
      }

      if (isOverdue) {
        overdueCount++;
        // Idempotent Notification check (prevent duplicate notifications on repeated scans)
        const existingNotice = await Notification.findOne({
          organizationId,
          type: 'MAINTENANCE_DUE',
          'metadata.scheduleId': sch._id,
          createdAt: { $gte: new Date(Date.now() - 24 * 60 * 60 * 1000) }, // 24hr cooldown
        });

        if (!existingNotice) {
          await Notification.create({
            organizationId,
            userId: sch.organizationId, // Broadcast level
            type: 'MAINTENANCE_DUE',
            title: `OVERDUE Maintenance: ${sch.title}`,
            message: `Vehicle ${vehicle.plateNumber} is overdue for ${sch.title}. Current odometer: ${vehicle.odometerKm} km.`,
            metadata: {
              scheduleId: sch._id,
              vehicleId: vehicle._id,
              overdue: true,
            },
          });
        }
      } else if (isDue) {
        dueCount++;
      }
    }

    return { dueCount, overdueCount };
  }
}
