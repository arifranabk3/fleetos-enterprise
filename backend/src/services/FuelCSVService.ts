import { FuelTransaction, IFuelTransaction } from '../models/FuelTransaction';
import { Vehicle } from '../models/Vehicle';
import { Driver } from '../models/Driver';
import { FuelVendor } from '../models/FuelVendor';
import { FuelEfficiencyEngine } from './FuelEfficiencyEngine';
import { FuelAnomalyDetectionEngine } from './FuelAnomalyDetectionEngine';
import { FuelExpenseSyncService } from './FuelExpenseSyncService';
import { AuditLog } from '../models/AuditLog';

export interface CSVRow {
  transactionReference: string;
  vehiclePlate: string;
  driverLicense?: string;
  vendorName?: string;
  transactionDate: string;
  fuelType: string;
  quantityLiters: string;
  pricePerLiter: string;
  totalCost?: string;
  odometerReading: string;
  paymentMethod?: string;
  isFullTank?: string;
  receiptReference?: string;
  notes?: string;
}

export interface CSVParseResult {
  validRows: any[];
  invalidRows: Array<{ rowNumber: number; data: any; errors: string[] }>;
  summary: {
    totalRows: number;
    validCount: number;
    invalidCount: number;
  };
}

export class FuelCSVService {
  /**
   * Parse a raw CSV text string into structured rows with formula injection protection
   */
  public static parseCSVText(csvContent: string): { headers: string[]; rows: Record<string, string>[] } {
    const lines = csvContent
      .split(/\r?\n/)
      .map((l) => l.trim())
      .filter((l) => l.length > 0);

    if (lines.length === 0) {
      throw new Error('CSV file is empty');
    }

    // Header extraction
    const rawHeaders = lines[0].split(',').map((h) => h.trim().replace(/^["']|["']$/g, ''));
    const rows: Record<string, string>[] = [];

    for (let i = 1; i < lines.length; i++) {
      const line = lines[i];
      const values = line.split(',').map((v) => v.trim().replace(/^["']|["']$/g, ''));
      const row: Record<string, string> = {};

      for (let j = 0; j < rawHeaders.length; j++) {
        const header = rawHeaders[j];
        let val = values[j] !== undefined ? values[j] : '';
        // Formula injection protection: prepend apostrophe if string begins with =, +, -, @
        if (/^[=+\-@\t\r]/.test(val)) {
          val = `'${val}`;
        }
        row[header] = val;
      }
      rows.push(row);
    }

    return { headers: rawHeaders, rows };
  }

  /**
   * Preview and validate CSV fuel transactions against organization entities without writing to database
   */
  public static async previewAndValidate(
    organizationId: string,
    rows: Record<string, string>[]
  ): Promise<CSVParseResult> {
    const validRows: any[] = [];
    const invalidRows: Array<{ rowNumber: number; data: any; errors: string[] }> = [];

    // Pre-cache organization vehicles, drivers, and vendors
    const vehicles = await Vehicle.find({ organizationId, isArchived: false }).lean();
    const vehicleMap = new Map<string, any>(vehicles.map((v) => [v.plateNumber.toUpperCase(), v]));

    const drivers = await Driver.find({ organizationId }).lean();
    const driverMap = new Map<string, any>(drivers.map((d) => [d.licenseNumber.toUpperCase(), d]));

    const vendors = await FuelVendor.find({ organizationId, isActive: true }).lean();
    const vendorMap = new Map<string, any>(vendors.map((vn) => [vn.name.toLowerCase(), vn]));

    for (let i = 0; i < rows.length; i++) {
      const r = rows[i];
      const rowErrors: string[] = [];
      const rowNumber = i + 2; // account for header line + 1-based index

      // 1. Reference validation
      const ref = r.transactionReference || r.reference || r['Transaction Reference'];
      if (!ref || ref.trim().length === 0) {
        rowErrors.push('Missing transaction reference');
      }

      // 2. Vehicle Plate validation
      const plate = (r.vehiclePlate || r.plateNumber || r['Plate Number'] || '').toUpperCase();
      const vehicle = vehicleMap.get(plate);
      if (!vehicle) {
        rowErrors.push(`Vehicle with plate '${plate}' not found in this organization`);
      }

      // 3. Numbers & Types
      const q = parseFloat(r.quantityLiters || r.quantity || r['Quantity'] || '0');
      const price = parseFloat(r.pricePerLiter || r.price || r['Price'] || '0');
      const odo = parseFloat(r.odometerReading || r.odometer || r['Odometer'] || '0');
      const fuelType = (r.fuelType || r['Fuel Type'] || 'DIESEL').toUpperCase();

      if (isNaN(q) || q <= 0) rowErrors.push('Quantity must be a positive number');
      if (isNaN(price) || price <= 0) rowErrors.push('Price must be a positive number');
      if (isNaN(odo) || odo < 0) rowErrors.push('Odometer reading must be a non-negative number');
      if (!['DIESEL', 'PETROL', 'CNG', 'ELECTRIC', 'OTHER'].includes(fuelType)) {
        rowErrors.push(`Invalid fuel type '${fuelType}'`);
      }

      // 4. Date validation
      const dateStr = r.transactionDate || r.date || r['Date'];
      const txDate = new Date(dateStr);
      if (isNaN(txDate.getTime())) {
        rowErrors.push(`Invalid transaction date '${dateStr}'`);
      }

      // 5. Driver / Vendor mapping (optional)
      let matchedDriverId: any = undefined;
      const license = (r.driverLicense || r['Driver License'] || '').toUpperCase();
      if (license) {
        const matchedDriver = driverMap.get(license);
        if (matchedDriver) matchedDriverId = matchedDriver._id;
      }

      let matchedVendorId: any = undefined;
      const vName = (r.vendorName || r['Vendor Name'] || '').toLowerCase();
      if (vName) {
        const matchedVendor = vendorMap.get(vName);
        if (matchedVendor) matchedVendorId = matchedVendor._id;
      }

      const isFullTank = r.isFullTank !== undefined ? r.isFullTank.toLowerCase() === 'true' : true;
      const totalCost = parseFloat(r.totalCost || '0') || Math.round(q * price * 100) / 100;

      if (rowErrors.length > 0) {
        invalidRows.push({ rowNumber, data: r, errors: rowErrors });
      } else {
        validRows.push({
          organizationId,
          vehicleId: vehicle._id,
          vehiclePlate: vehicle.plateNumber,
          driverId: matchedDriverId,
          fuelVendorId: matchedVendorId,
          transactionReference: ref.trim(),
          transactionDate: txDate,
          fuelType,
          quantityLiters: q,
          pricePerLiter: price,
          totalCost,
          odometerReading: odo,
          isFullTank,
          paymentMethod: r.paymentMethod || 'COMPANY_ACCOUNT',
          receiptReference: r.receiptReference,
          notes: r.notes || 'Imported via CSV',
          source: 'IMPORT',
        });
      }
    }

    return {
      validRows,
      invalidRows,
      summary: {
        totalRows: rows.length,
        validCount: validRows.length,
        invalidCount: invalidRows.length,
      },
    };
  }

  /**
   * Commit valid CSV rows to database idempotently
   */
  public static async executeImport(
    organizationId: string,
    userId: string,
    validRows: any[]
  ): Promise<{ insertedCount: number; duplicateCount: number }> {
    let insertedCount = 0;
    let duplicateCount = 0;

    for (const row of validRows) {
      // Check existing reference
      const existing = await FuelTransaction.findOne({
        organizationId,
        transactionReference: row.transactionReference,
      });

      if (existing) {
        duplicateCount++;
        continue;
      }

      // Calculate efficiency
      const eff = await FuelEfficiencyEngine.calculateTransactionEfficiency(
        organizationId,
        row.vehicleId.toString(),
        row.odometerReading,
        row.quantityLiters,
        row.fuelType,
        row.transactionDate,
        row.isFullTank
      );

      // Anomaly detection
      const anomaly = await FuelAnomalyDetectionEngine.evaluateTransaction(
        organizationId,
        row.vehicleId.toString(),
        row.quantityLiters,
        row.totalCost,
        row.odometerReading,
        eff.fuelEfficiency,
        row.transactionDate
      );

      const createdTx = await FuelTransaction.create({
        ...row,
        previousOdometerReading: eff.previousOdometer,
        distanceSinceLastRefuel: eff.distanceTravelled,
        fuelEfficiency: eff.fuelEfficiency,
        efficiencyStatus: eff.efficiencyStatus,
        calculationMethod: eff.calculationMethod,
        verificationStatus: anomaly.verificationStatus,
        anomalyFlags: anomaly.flags,
        createdBy: userId,
      });

      // Sync to Expense
      await FuelExpenseSyncService.syncFuelExpense(createdTx, userId);

      // Update vehicle odometer if newer
      const vehicle = await Vehicle.findById(row.vehicleId);
      if (vehicle && row.odometerReading > (vehicle.odometerKm || 0)) {
        await Vehicle.findByIdAndUpdate(row.vehicleId, { odometerKm: row.odometerReading });
      }

      insertedCount++;
    }

    await AuditLog.create({
      organizationId,
      actorId: userId as any,
      actorEmail: 'operator@fleetos.com',
      action: 'FUEL_CSV_IMPORTED',
      entity: 'FUEL_TRANSACTION',
      details: { insertedCount, duplicateCount, totalSubmitted: validRows.length },
    });

    return { insertedCount, duplicateCount };
  }

  /**
   * Generate safe organization-scoped CSV export
   */
  public static generateCSVExport(transactions: any[]): string {
    const headers = [
      'Transaction Reference',
      'Date',
      'Vehicle Plate',
      'Driver Name',
      'Fuel Vendor',
      'Fuel Type',
      'Quantity (L/kWh)',
      'Price Per Unit',
      'Total Cost ($)',
      'Odometer (km)',
      'Distance (km)',
      'Efficiency',
      'Efficiency Status',
      'Calculation Method',
      'Full Tank',
      'Audit Status',
      'Notes',
    ];

    const escapeField = (val: any): string => {
      if (val === undefined || val === null) return '""';
      let str = String(val).replace(/"/g, '""');
      // Anti-CSV formula injection guard
      if (/^[=+\-@\t\r]/.test(str)) {
        str = `'${str}`;
      }
      return `"${str}"`;
    };

    const lines = [headers.join(',')];

    for (const t of transactions) {
      const vPlate = t.vehicleId?.plateNumber || '';
      const dName = t.driverId ? `${t.driverId.firstName || ''} ${t.driverId.lastName || ''}`.trim() : '';
      const vVendor = t.fuelVendorId?.name || '';
      const effUnit = t.fuelType === 'ELECTRIC' ? 'km/kWh' : 'km/L';
      const effDisplay = t.fuelEfficiency ? `${t.fuelEfficiency} ${effUnit}` : 'N/A';

      const row = [
        escapeField(t.transactionReference),
        escapeField(new Date(t.transactionDate).toISOString().split('T')[0]),
        escapeField(vPlate),
        escapeField(dName),
        escapeField(vVendor),
        escapeField(t.fuelType),
        escapeField(t.quantityLiters),
        escapeField(t.pricePerLiter),
        escapeField(t.totalCost),
        escapeField(t.odometerReading),
        escapeField(t.distanceSinceLastRefuel || 0),
        escapeField(effDisplay),
        escapeField(t.efficiencyStatus),
        escapeField(t.calculationMethod || 'FULL_TO_FULL'),
        escapeField(t.isFullTank ? 'TRUE' : 'FALSE'),
        escapeField(t.verificationStatus),
        escapeField(t.notes || ''),
      ];
      lines.push(row.join(','));
    }

    return lines.join('\r\n');
  }
}
