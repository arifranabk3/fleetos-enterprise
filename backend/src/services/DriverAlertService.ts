import { Types } from 'mongoose';
import { Driver, DriverDocument, DriverShift, DriverIncident, Notification } from '../models';

export class DriverAlertService {
  /**
   * Scans expiring driver licenses and documents for an organization and produces alerts.
   * Deduplicates alerts created within a 24-hour window.
   */
  static async checkExpiringDocuments(organizationId: string | Types.ObjectId, reminderDays: number = 30) {
    const orgId = typeof organizationId === 'string' ? new Types.ObjectId(organizationId) : organizationId;
    const now = new Date();
    const threshold = new Date();
    threshold.setDate(threshold.getDate() + reminderDays);

    const yesterday = new Date();
    yesterday.setHours(yesterday.getHours() - 24);

    // 1. Check Driver Licenses on Driver model
    const drivers = await Driver.find({
      organizationId: orgId,
      isArchived: false,
      licenseExpiry: { $lte: threshold },
    });

    const notificationsCreated = [];

    for (const drv of drivers) {
      const isExpired = drv.licenseExpiry < now;
      const type = 'DRIVER_LICENSE_EXPIRING';
      const title = isExpired
        ? `Driver License EXPIRED: ${drv.fullName}`
        : `Driver License Expiring Soon: ${drv.fullName}`;
      const message = isExpired
        ? `Driver ${drv.fullName}'s driving license ${drv.licenseNumber} expired on ${drv.licenseExpiry.toISOString().split('T')[0]}.`
        : `Driver ${drv.fullName}'s driving license ${drv.licenseNumber} expires in less than ${reminderDays} days on ${drv.licenseExpiry.toISOString().split('T')[0]}.`;

      // Check duplicate within 24h
      const existing = await Notification.findOne({
        organizationId: orgId,
        type,
        'metadata.driverId': drv._id.toString(),
        createdAt: { $gte: yesterday },
      });

      if (!existing) {
        const notif = await Notification.create({
          organizationId: orgId,
          type,
          title,
          message,
          metadata: {
            driverId: drv._id.toString(),
            driverName: drv.fullName,
            licenseNumber: drv.licenseNumber,
            licenseExpiry: drv.licenseExpiry,
            isExpired,
          },
        });
        notificationsCreated.push(notif);
      }
    }

    // 2. Check DriverDocument collection
    const docs = await DriverDocument.find({
      organizationId: orgId,
      isArchived: false,
      expiryDate: { $lte: threshold },
    }).populate('driverId', 'fullName');

    for (const doc of docs) {
      if (!doc.expiryDate) continue;
      const isExpired = doc.expiryDate < now;
      const type = 'DRIVER_DOCUMENT_EXPIRING';
      const drvName = (doc.driverId as any)?.fullName || 'Driver';
      const title = isExpired
        ? `Driver Document EXPIRED: ${doc.documentType} (${drvName})`
        : `Driver Document Expiring Soon: ${doc.documentType} (${drvName})`;
      const message = isExpired
        ? `${doc.documentType} #${doc.documentNumber} for ${drvName} expired on ${doc.expiryDate.toISOString().split('T')[0]}.`
        : `${doc.documentType} #${doc.documentNumber} for ${drvName} expires on ${doc.expiryDate.toISOString().split('T')[0]}.`;

      const existing = await Notification.findOne({
        organizationId: orgId,
        type,
        'metadata.documentId': doc._id.toString(),
        createdAt: { $gte: yesterday },
      });

      if (!existing) {
        const notif = await Notification.create({
          organizationId: orgId,
          type,
          title,
          message,
          metadata: {
            documentId: doc._id.toString(),
            driverId: doc.driverId._id?.toString() || doc.driverId.toString(),
            documentType: doc.documentType,
            documentNumber: doc.documentNumber,
            isExpired,
          },
        });
        notificationsCreated.push(notif);
      }
    }

    return notificationsCreated;
  }

  /**
   * Generates instant alert for critical safety incident
   */
  static async triggerIncidentAlert(incident: any) {
    if (incident.severity === 'CRITICAL' || incident.severity === 'HIGH') {
      await Notification.create({
        organizationId: incident.organizationId,
        type: 'DRIVER_INCIDENT_ALERT',
        title: `CRITICAL SAFETY INCIDENT: ${incident.incidentNumber}`,
        message: `A ${incident.severity} severity safety incident (${incident.category}) was reported. Immediate management review required.`,
        metadata: {
          incidentId: incident._id.toString(),
          incidentNumber: incident.incidentNumber,
          category: incident.category,
          severity: incident.severity,
          driverId: incident.driverId.toString(),
        },
      });
    }
  }

  /**
   * Generates alert for missed shift
   */
  static async triggerMissedShiftAlert(shift: any) {
    await Notification.create({
      organizationId: shift.organizationId,
      type: 'DRIVER_SHIFT_ALERT',
      title: `MISSED SHIFT: Driver ID ${shift.driverId}`,
      message: `Scheduled shift on ${shift.shiftDate} was not started and has been marked MISSED.`,
      metadata: {
        shiftId: shift._id.toString(),
        driverId: shift.driverId.toString(),
        shiftDate: shift.shiftDate,
      },
    });
  }
}
