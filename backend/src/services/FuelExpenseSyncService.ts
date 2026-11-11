import { Types } from 'mongoose';
import { Expense } from '../models/Expense';
import { FuelTransaction, IFuelTransaction } from '../models/FuelTransaction';
import { FuelVendor } from '../models/FuelVendor';

export class FuelExpenseSyncService {
  /**
   * Sync a created FuelTransaction to the financial Expense ledger.
   * Ensures idempotency: prevents duplicate expense creation for the same transaction.
   */
  public static async syncFuelExpense(
    transaction: IFuelTransaction,
    actorId: Types.ObjectId | string
  ): Promise<Types.ObjectId> {
    // 1. Idempotency check: if expense already exists for this fuel transaction
    let existingExpense = await Expense.findOne({
      organizationId: transaction.organizationId,
      fuelTransactionId: transaction._id,
    });

    const vendor = transaction.fuelVendorId
      ? await FuelVendor.findById(transaction.fuelVendorId).lean()
      : null;

    if (existingExpense) {
      // Update existing expense if amount/quantity was edited
      existingExpense.amount = transaction.totalCost;
      existingExpense.litersFuel = transaction.quantityLiters;
      existingExpense.odometerReadingKm = transaction.odometerReading;
      existingExpense.incurredAt = transaction.transactionDate;
      existingExpense.notes = `Fuel refuel: ${transaction.transactionReference}`;
      if (vendor) existingExpense.fuelStation = vendor.name;
      await existingExpense.save();
      return existingExpense._id as Types.ObjectId;
    }

    // 2. Create new Expense record linked directly to this FuelTransaction
    const newExpense = await Expense.create({
      organizationId: transaction.organizationId,
      vehicleId: transaction.vehicleId,
      driverId: transaction.driverId,
      category: 'FUEL',
      amount: transaction.totalCost,
      currency: 'USD',
      litersFuel: transaction.quantityLiters,
      fuelStation: vendor ? vendor.name : 'Commercial Station',
      odometerReadingKm: transaction.odometerReading,
      receiptUrl: transaction.receiptReference,
      incurredAt: transaction.transactionDate,
      fuelTransactionId: transaction._id,
      notes: `Fuel transaction reference: ${transaction.transactionReference}`,
    });

    // Backlink on transaction
    transaction.expenseId = newExpense._id as Types.ObjectId;
    await transaction.save();

    return newExpense._id as Types.ObjectId;
  }

  /**
   * Mark linked Expense as voided when a FuelTransaction is voided
   */
  public static async voidFuelExpense(
    fuelTransactionId: Types.ObjectId | string,
    reason: string
  ): Promise<void> {
    await Expense.updateMany(
      { fuelTransactionId },
      {
        isVoided: true,
        voidReason: reason,
        notes: `VOIDED: ${reason}`,
      }
    );
  }
}
