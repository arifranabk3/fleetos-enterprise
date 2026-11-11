import { Types } from 'mongoose';
import { Vehicle } from '../models/Vehicle';
import { MaintenanceRecord } from '../models/MaintenanceRecord';
import { VehicleStatus } from '../types/domain';

export class MaintenanceLockService {
  /**
   * Acquire a maintenance lock on a vehicle when a work order begins service.
   * If the vehicle is already in MAINTENANCE (e.g. from a concurrent work order),
   * increment the activeMaintenanceRecordCount without overwriting preMaintenanceStatus.
   * If the vehicle was not yet in MAINTENANCE, record its current status as preMaintenanceStatus,
   * set vehicle.status = 'MAINTENANCE', and store initialVehicleStatus on the record.
   */
  public static async acquireLock(
    vehicleId: Types.ObjectId | string,
    recordId: Types.ObjectId | string
  ): Promise<{ vehicleStatus: VehicleStatus; preStatus: VehicleStatus }> {
    const vehicle = await Vehicle.findById(vehicleId);
    if (!vehicle) {
      throw new Error(`Vehicle ${vehicleId} not found`);
    }

    const currentStatus = vehicle.status;
    let preStatus: VehicleStatus;

    if (currentStatus === 'MAINTENANCE') {
      // Vehicle is already under maintenance from another work order.
      // Retain the existing preMaintenanceStatus, just increment the counter.
      preStatus = vehicle.preMaintenanceStatus || 'AVAILABLE';
      await Vehicle.findByIdAndUpdate(vehicleId, {
        $inc: { activeMaintenanceRecordCount: 1 },
      });
    } else {
      // Vehicle is entering maintenance for the first time.
      preStatus = currentStatus;
      await Vehicle.findByIdAndUpdate(vehicleId, {
        status: 'MAINTENANCE',
        preMaintenanceStatus: preStatus,
        $inc: { activeMaintenanceRecordCount: 1 },
      });
    }

    // Persist on the maintenance record for historical auditability
    await MaintenanceRecord.findByIdAndUpdate(recordId, {
      initialVehicleStatus: preStatus,
    });

    return { vehicleStatus: 'MAINTENANCE', preStatus };
  }

  /**
   * Release a maintenance lock on a vehicle when a work order completes or cancels.
   * Checks for other active maintenance work orders for that vehicle.
   * If other active work orders exist, the vehicle remains in 'MAINTENANCE'.
   * If no other active work orders exist, restores the vehicle to its preMaintenanceStatus,
   * provided it is not RETIRED, OUT_OF_SERVICE, or INACTIVE.
   */
  public static async releaseLock(
    vehicleId: Types.ObjectId | string,
    completedRecordId: Types.ObjectId | string,
    completedOdometerKm?: number
  ): Promise<{ finalStatus: VehicleStatus; releasedToOriginal: boolean }> {
    // Count any remaining active maintenance records for this vehicle excluding the current one
    const remainingActiveCount = await MaintenanceRecord.countDocuments({
      _id: { $ne: completedRecordId },
      vehicleId,
      status: 'IN_PROGRESS',
    });

    const vehicle = await Vehicle.findById(vehicleId);
    if (!vehicle) {
      throw new Error(`Vehicle ${vehicleId} not found`);
    }

    const updateFields: any = {};
    if (completedOdometerKm !== undefined && completedOdometerKm > (vehicle.odometerKm || 0)) {
      updateFields.odometerKm = completedOdometerKm;
    }

    if (remainingActiveCount > 0) {
      // Another maintenance work order is still active! Vehicle must remain in MAINTENANCE.
      updateFields.status = 'MAINTENANCE';
      updateFields.activeMaintenanceRecordCount = remainingActiveCount;
      await Vehicle.findByIdAndUpdate(vehicleId, updateFields);
      return { finalStatus: 'MAINTENANCE', releasedToOriginal: false };
    }

    // No other active maintenance records remain. Restore original status safely.
    let targetStatus: VehicleStatus = vehicle.preMaintenanceStatus || 'AVAILABLE';

    // Safety guard: Never inadvertently convert RETIRED or OUT_OF_SERVICE into AVAILABLE
    if (targetStatus === 'RETIRED' || targetStatus === 'OUT_OF_SERVICE') {
      // Preserves original non-available status
    } else if (targetStatus === 'IN_TRANSIT' || targetStatus === 'ASSIGNED') {
      // If the vehicle was in transit or assigned before, but service took place,
      // it should be made AVAILABLE unless specific assignment is active.
      targetStatus = 'AVAILABLE';
    } else {
      targetStatus = 'AVAILABLE';
    }

    updateFields.status = targetStatus;
    updateFields.activeMaintenanceRecordCount = 0;
    updateFields.$unset = { preMaintenanceStatus: 1 };

    await Vehicle.findByIdAndUpdate(vehicleId, updateFields);

    return { finalStatus: targetStatus, releasedToOriginal: true };
  }
}
