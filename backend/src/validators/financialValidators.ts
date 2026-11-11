import { z } from 'zod';

export const RateTierSchema = z.object({
  minDistanceKm: z.number().min(0).optional(),
  maxDistanceKm: z.number().min(0).optional(),
  minWeightKg: z.number().min(0).optional(),
  maxWeightKg: z.number().min(0).optional(),
  ratePerKmCents: z.number().min(0).optional(),
  ratePerKgCents: z.number().min(0).optional(),
  flatFeeCents: z.number().min(0).optional(),
});

export const RateAdditionalChargeSchema = z.object({
  code: z.string().min(1).max(50),
  name: z.string().min(1).max(100),
  amountCents: z.number().min(0),
  chargeType: z.enum(['FLAT', 'PER_UNIT', 'PERCENTAGE']),
  description: z.string().max(255).optional(),
});

export const CreateRateMatrixSchema = z.object({
  code: z.string().min(2).max(50),
  name: z.string().min(2).max(100),
  description: z.string().max(500).optional(),
  customerId: z.string().optional(),
  pricingModel: z.enum(['FLAT', 'DISTANCE_BASED', 'WEIGHT_BASED', 'ZONE_BASED', 'HYBRID']),
  currency: z.string().length(3).default('USD'),
  vehicleCategory: z.enum(['VAN', 'BOX_TRUCK', 'SEMI_TRUCK', 'FLATBED', 'REFRIGERATED', 'TANKER', 'OTHER']).optional(),
  cargoCategory: z.enum(['GENERAL', 'PERISHABLE', 'HAZARDOUS', 'ELECTRONICS', 'FRAGILE', 'HEAVY_EQUIPMENT']).optional(),
  originZone: z.string().max(100).optional(),
  destinationZone: z.string().max(100).optional(),
  baseFeeCents: z.number().min(0),
  perKmRateCents: z.number().min(0),
  perKgRateCents: z.number().min(0).default(0),
  minimumChargeCents: z.number().min(0).default(0),
  waitingTimeRatePerHourCents: z.number().min(0).default(0),
  fuelSurchargePercent: z.number().min(0).max(100).default(0),
  tiers: z.array(RateTierSchema).default([]),
  additionalCharges: z.array(RateAdditionalChargeSchema).default([]),
  effectiveFrom: z.string().or(z.date()).default(() => new Date()),
  effectiveTo: z.string().or(z.date()).nullable().optional(),
});

export const InvoiceLineItemSchema = z.object({
  shipmentId: z.string().optional(),
  description: z.string().min(1).max(255),
  quantity: z.number().min(1).default(1),
  unitPriceCents: z.number().min(0),
  taxRatePercent: z.number().min(0).max(100).default(0),
  taxAmountCents: z.number().min(0).default(0),
  discountAmountCents: z.number().min(0).default(0),
  fuelSurchargeCents: z.number().min(0).default(0),
  totalCents: z.number().min(0),
});

export const CreateInvoiceSchema = z.object({
  invoiceNumber: z.string().min(3).max(50),
  customerId: z.string().optional(),
  customer: z.object({
    name: z.string().min(1),
    email: z.string().email(),
    billingAddress: z.string().min(1),
    taxId: z.string().optional(),
  }),
  shipmentIds: z.array(z.string()).default([]),
  lineItems: z.array(InvoiceLineItemSchema).min(1),
  currency: z.string().length(3).default('USD'),
  paymentTerms: z.enum(['NET_15', 'NET_30', 'NET_60', 'DUE_ON_RECEIPT']).default('NET_30'),
  dueAt: z.string().or(z.date()),
  notes: z.string().max(1000).optional(),
});

export const RecordPaymentReceiptSchema = z.object({
  receiptNumber: z.string().min(3).max(50),
  customerId: z.string(),
  amountCents: z.number().int().min(1),
  currency: z.string().length(3).default('USD'),
  paymentDate: z.string().or(z.date()).default(() => new Date()),
  paymentMethod: z.enum(['BANK_TRANSFER', 'CREDIT_CARD', 'CHECK', 'CASH', 'ACH', 'WIRE', 'OTHER']),
  referenceNumber: z.string().min(1).max(100),
  allocations: z.array(
    z.object({
      invoiceId: z.string(),
      invoiceNumber: z.string(),
      allocatedAmountCents: z.number().int().min(1),
    })
  ).min(1),
  idempotencyKey: z.string().max(100).optional(),
  notes: z.string().max(500).optional(),
});

export const CreateDriverSettlementSchema = z.object({
  settlementNumber: z.string().min(3).max(50),
  driverId: z.string(),
  periodStart: z.string().or(z.date()),
  periodEnd: z.string().or(z.date()),
  basePayCents: z.number().int().min(0),
  mileagePayCents: z.number().int().min(0).default(0),
  overtimePayCents: z.number().int().min(0).default(0),
  bonuses: z.array(
    z.object({
      code: z.string().min(1),
      description: z.string().min(1),
      amountCents: z.number().int().min(0),
      metricType: z.enum(['SAFETY_SCORE', 'FUEL_EFFICIENCY', 'ON_TIME_DELIVERY', 'ATTENDANCE', 'MANUAL']).default('MANUAL'),
      referenceId: z.string().optional(),
    })
  ).default([]),
  deductions: z.array(
    z.object({
      code: z.string().min(1),
      description: z.string().min(1),
      amountCents: z.number().int().min(0),
      reasonCategory: z.enum(['INCIDENT_PENALTY', 'EQUIPMENT_DAMAGE', 'POLICY_VIOLATION', 'TAX_WITHHOLDING', 'ADVANCE', 'OTHER']),
      incidentId: z.string().optional(),
    })
  ).default([]),
  taxWithheldCents: z.number().int().min(0).default(0),
  dispatchesIncluded: z.array(z.string()).default([]),
  shiftsIncluded: z.array(z.string()).default([]),
  notes: z.string().max(1000).optional(),
});

export const JournalLineSchema = z.object({
  accountId: z.string(),
  accountNumber: z.string(),
  accountName: z.string(),
  entryType: z.enum(['DEBIT', 'CREDIT']),
  amountCents: z.number().int().min(1),
  description: z.string().max(255).optional(),
});

export const CreateJournalEntrySchema = z.object({
  entryNumber: z.string().min(3).max(50),
  postingDate: z.string().or(z.date()).default(() => new Date()),
  sourceType: z.enum([
    'INVOICE_ISSUED',
    'PAYMENT_RECEIVED',
    'PAYMENT_REVERSED',
    'DRIVER_SETTLEMENT',
    'EXPENSE_POSTED',
    'MANUAL_ADJUSTMENT',
    'REVERSAL_ENTRY',
  ]),
  sourceReferenceId: z.string(),
  sourceReferenceNumber: z.string().optional(),
  description: z.string().min(3).max(500),
  currency: z.string().length(3).default('USD'),
  lines: z.array(JournalLineSchema).min(2),
  idempotencyKey: z.string().max(100).optional(),
});
