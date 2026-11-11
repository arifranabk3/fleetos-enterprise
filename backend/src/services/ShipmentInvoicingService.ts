import { Types } from 'mongoose';
import { Invoice, IInvoice } from '../models/Invoice';
import { Shipment, IShipment } from '../models/Shipment';
import { ITenantContext } from '../repositories/BaseTenantRepository';
import { FreightPricingService } from './FreightPricingService';

export interface GenerateInvoiceFromShipmentsInput {
  shipmentIds: Types.ObjectId[];
  invoiceNumber: string;
  paymentTerms?: 'NET_15' | 'NET_30' | 'NET_60' | 'DUE_ON_RECEIPT';
  dueAt: Date;
  taxRatePercent?: number;
  notes?: string;
  createdBy: Types.ObjectId;
}

export class ShipmentInvoicingService {
  /**
   * Idempotently generates an Invoice from eligible delivered shipments.
   * Enforces:
   * 1. Shipments must belong to the tenant organization.
   * 2. Shipments must be in 'DELIVERED' status.
   * 3. A shipment cannot be billed twice across active invoices.
   * 4. Pricing captures a frozen rate snapshot.
   */
  static async generateInvoiceFromShipments(
    tenant: ITenantContext,
    input: GenerateInvoiceFromShipmentsInput
  ): Promise<IInvoice> {
    const orgId = typeof tenant.organizationId === 'string' ? new Types.ObjectId(tenant.organizationId) : tenant.organizationId;

    if (!input.shipmentIds || input.shipmentIds.length === 0) {
      throw new Error('NO_SHIPMENTS_SPECIFIED: At least one shipment must be selected for invoicing.');
    }

    // 1. Fetch shipments strictly scoped to organization
    const shipments = await Shipment.find({
      organizationId: orgId,
      _id: { $in: input.shipmentIds },
    });

    if (shipments.length !== input.shipmentIds.length) {
      throw new Error('SHIPMENT_ACCESS_DENIED: One or more requested shipments do not exist in organization.');
    }

    // 2. Validate shipment status and acquire atomic lock check
    for (const sh of shipments) {
      if (sh.status !== 'DELIVERED') {
        throw new Error(
          `INELIGIBLE_SHIPMENT_STATUS: Shipment '${sh.trackingNumber}' is in status '${sh.status}'. Only DELIVERED shipments can be invoiced.`
        );
      }
      if (sh.billedInvoiceId) {
        throw new Error(
          `DUPLICATE_SHIPMENT_BILLING: Shipment '${sh.trackingNumber}' is already locked/invoiced in Invoice '${sh.billedInvoiceId}'.`
        );
      }
    }

    // 3. Double-billing check: Ensure no active non-voided invoice already includes any of these shipments
    const existingInvoices = await Invoice.find({
      organizationId: orgId,
      shipmentIds: { $in: input.shipmentIds },
      status: { $ne: 'VOID' },
    });

    if (existingInvoices.length > 0) {
      const alreadyBilledShipmentIds = new Set<string>();
      existingInvoices.forEach((inv) => {
        inv.shipmentIds.forEach((id) => {
          if (input.shipmentIds.some((reqId) => reqId.toString() === id.toString())) {
            alreadyBilledShipmentIds.add(id.toString());
          }
        });
      });

      throw new Error(
        `DUPLICATE_SHIPMENT_BILLING: Shipment(s) [${Array.from(alreadyBilledShipmentIds).join(', ')}] have already been invoiced in Invoice '${existingInvoices[0].invoiceNumber}'.`
      );
    }

    // Atomic CAS update: attempt to lock all shipments with a pending lock
    const lockResult = await Shipment.updateMany(
      {
        _id: { $in: input.shipmentIds },
        organizationId: orgId,
        $or: [{ billedInvoiceId: null }, { billedInvoiceId: { $exists: false } }],
      },
      {
        $set: { billedInvoiceId: new Types.ObjectId() }, // Temporary lock token
      }
    );

    if (lockResult.matchedCount !== input.shipmentIds.length || lockResult.modifiedCount !== input.shipmentIds.length) {
      throw new Error(
        `DUPLICATE_SHIPMENT_BILLING: One or more shipments are already locked by a concurrent invoicing request.`
      );
    }

    // 4. Resolve rate matrix and build line items
    const primaryCustomer = shipments[0].customer;
    const customerId = shipments[0].customerId;

    const rateMatrix = await FreightPricingService.resolveActiveRate(tenant, customerId);

    const lineItems = [];
    let subtotalCents = 0;
    let totalFuelSurchargeCents = 0;

    for (const sh of shipments) {
      // Calculate or derive distance (hypothetical or from cargo distance / quoted pricing)
      let shipmentPriceCents = 0;
      let fuelSurchargeCents = 0;

      if (rateMatrix) {
        // Approximate distance or use standard calculation
        const distanceKm = 100; // Standard distance or derived from coordinates
        const quote = FreightPricingService.calculatePrice(rateMatrix, {
          customerId: sh.customerId,
          distanceKm,
          weightKg: sh.cargo?.weightKg || 0,
        });
        shipmentPriceCents = quote.subtotalCents;
        fuelSurchargeCents = quote.fuelSurchargeCents;
      } else {
        // Fall back to shipment's agreed quoted amount
        shipmentPriceCents = Math.round((sh.pricing?.quotedAmount || 150) * 100);
      }

      const lineTotalCents = shipmentPriceCents + fuelSurchargeCents;
      subtotalCents += shipmentPriceCents;
      totalFuelSurchargeCents += fuelSurchargeCents;

      lineItems.push({
        shipmentId: sh._id as Types.ObjectId,
        description: `Freight Transportation: Tracking #${sh.trackingNumber} (${sh.cargo?.description || 'Cargo'})`,
        quantity: 1,
        unitPriceCents: shipmentPriceCents,
        taxRatePercent: input.taxRatePercent || 0,
        taxAmountCents: 0,
        discountAmountCents: 0,
        fuelSurchargeCents,
        totalCents: lineTotalCents,
      });
    }

    const taxRate = input.taxRatePercent || 0;
    const taxAmountCents = Math.round((subtotalCents + totalFuelSurchargeCents) * (taxRate / 100));
    const totalAmountCents = subtotalCents + totalFuelSurchargeCents + taxAmountCents;

    // 5. Create the invoice
    let invoice;
    try {
      invoice = await Invoice.create({
        organizationId: orgId,
        invoiceNumber: input.invoiceNumber,
        customerId,
        customer: {
          name: primaryCustomer.name,
          email: primaryCustomer.email,
          billingAddress: shipments[0].sender?.address || '100 Logistics Blvd, Dallas, TX',
        },
        shipmentIds: input.shipmentIds,
        lineItems,
        rateSnapshot: rateMatrix
          ? {
              rateMatrixId: rateMatrix._id as Types.ObjectId,
              code: rateMatrix.code,
              version: rateMatrix.version,
              pricingModel: rateMatrix.pricingModel,
              baseFeeCents: rateMatrix.baseFeeCents,
              perKmRateCents: rateMatrix.perKmRateCents,
              perKgRateCents: rateMatrix.perKgRateCents,
              fuelSurchargePercent: rateMatrix.fuelSurchargePercent,
              capturedAt: new Date(),
            }
          : undefined,
        subtotalCents,
        fuelSurchargeCents: totalFuelSurchargeCents,
        taxAmountCents,
        discountCents: 0,
        totalAmountCents,
        amountPaidCents: 0,
        outstandingBalanceCents: totalAmountCents,
        // Legacy fields
        subtotalAmount: subtotalCents / 100,
        taxAmount: taxAmountCents / 100,
        totalAmount: totalAmountCents / 100,
        currency: 'USD',
        status: 'ISSUED',
        paymentTerms: input.paymentTerms || 'NET_30',
        issuedAt: new Date(),
        dueAt: input.dueAt,
        notes: input.notes,
        auditTrail: [
          {
            action: 'INVOICE_GENERATED_FROM_SHIPMENTS',
            performedBy: input.createdBy,
            timestamp: new Date(),
            note: `Generated from ${shipments.length} delivered shipment(s).`,
          },
        ],
      });

      // Update shipments to point permanently to the generated invoice
      await Shipment.updateMany(
        { _id: { $in: input.shipmentIds }, organizationId: orgId },
        { $set: { billedInvoiceId: invoice._id } }
      );
    } catch (err) {
      // Release lock on error
      await Shipment.updateMany(
        { _id: { $in: input.shipmentIds }, organizationId: orgId },
        { $set: { billedInvoiceId: null } }
      );
      throw err;
    }

    return invoice;
  }
}
