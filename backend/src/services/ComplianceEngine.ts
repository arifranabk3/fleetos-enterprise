import { VehicleComplianceDocument, IVehicleComplianceDocument, ComplianceStatus } from '../models/VehicleComplianceDocument';
import { Notification } from '../models/Notification';

export class ComplianceEngine {
  /**
   * Evaluate compliance status based on expiry date and configured reminder days
   */
  public static calculateStatus(expiryDate: Date, reminderDays: number = 30): ComplianceStatus {
    const now = new Date();
    const expiry = new Date(expiryDate);

    if (now > expiry) {
      return 'EXPIRED';
    }

    const reminderThreshold = new Date(expiry.getTime() - reminderDays * 24 * 60 * 60 * 1000);
    if (now >= reminderThreshold) {
      return 'EXPIRING_SOON';
    }

    return 'VALID';
  }

  /**
   * Scan all vehicle compliance documents for an organization and update statuses
   */
  public static async scanOrganizationDocuments(organizationId: string): Promise<{
    validCount: number;
    expiringSoonCount: number;
    expiredCount: number;
  }> {
    const documents = await VehicleComplianceDocument.find({
      organizationId,
      isArchived: false,
    }).populate('vehicleId', 'plateNumber');

    let validCount = 0;
    let expiringSoonCount = 0;
    let expiredCount = 0;

    for (const doc of documents) {
      const calculatedStatus = ComplianceEngine.calculateStatus(doc.expiryDate, doc.reminderDays);

      if (doc.status !== calculatedStatus) {
        doc.status = calculatedStatus;
        await doc.save();
      }

      if (calculatedStatus === 'VALID') validCount++;
      if (calculatedStatus === 'EXPIRING_SOON') {
        expiringSoonCount++;
        // Idempotent notification check
        const vehicle = doc.vehicleId as any;
        const recentNotice = await Notification.findOne({
          organizationId,
          type: 'COMPLIANCE_EXPIRING',
          'metadata.documentId': doc._id,
          createdAt: { $gte: new Date(Date.now() - 48 * 60 * 60 * 1000) },
        });

        if (!recentNotice && vehicle) {
          await Notification.create({
            organizationId,
            userId: organizationId as any,
            type: 'COMPLIANCE_EXPIRING',
            title: `Document Expiring Soon: ${doc.documentType}`,
            message: `Document ${doc.documentNumber} for vehicle ${vehicle.plateNumber} expires on ${doc.expiryDate.toISOString().split('T')[0]}.`,
            metadata: { documentId: doc._id, vehicleId: vehicle._id },
          });
        }
      }
      if (calculatedStatus === 'EXPIRED') expiredCount++;
    }

    return { validCount, expiringSoonCount, expiredCount };
  }
}
