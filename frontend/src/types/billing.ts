export type RatePricingModel = 'FLAT' | 'DISTANCE_BASED' | 'WEIGHT_BASED' | 'ZONE_BASED' | 'HYBRID';
export type RateMatrixStatus = 'ACTIVE' | 'DRAFT' | 'ARCHIVED';

export interface RateAdditionalCharge {
  code: string;
  name: string;
  amountCents: number;
  chargeType: 'FLAT' | 'PER_UNIT' | 'PERCENTAGE';
  description?: string;
}

export interface RateTier {
  minDistanceKm?: number;
  maxDistanceKm?: number;
  minWeightKg?: number;
  maxWeightKg?: number;
  ratePerKmCents?: number;
  ratePerKgCents?: number;
  flatFeeCents?: number;
}

export interface RateMatrix {
  _id: string;
  organizationId: string;
  code: string;
  name: string;
  description?: string;
  customerId?: {
    _id: string;
    name: string;
    email: string;
  } | null;
  status: RateMatrixStatus;
  version: number;
  pricingModel: RatePricingModel;
  currency: string;
  vehicleCategory?: 'VAN' | 'BOX_TRUCK' | 'SEMI_TRUCK' | 'FLATBED' | 'REFRIGERATED' | 'TANKER' | 'OTHER' | string;
  vehicleType?: string;
  cargoCategory?: string;
  originZone?: string;
  destinationZone?: string;
  baseFeeCents: number;
  perKmRateCents: number;
  perKgRateCents: number;
  minimumChargeCents: number;
  waitingTimeRatePerHourCents?: number;
  fuelSurchargePercent?: number;
  fuelSurchargePercentage?: number;
  tiers?: RateTier[];
  additionalCharges?: RateAdditionalCharge[];
  effectiveFrom?: string;
  effectiveTo?: string | null;
  isActive?: boolean;
  isArchived?: boolean;
  createdAt: string;
  updatedAt: string;
}

export type InvoiceStatus = 'DRAFT' | 'ISSUED' | 'PARTIALLY_PAID' | 'PAID' | 'OVERDUE' | 'DISPUTED' | 'VOID';

export interface InvoiceLineItem {
  shipmentId?: string;
  description: string;
  quantity: number;
  unitPriceCents: number;
  taxRatePercent: number;
  taxAmountCents: number;
  discountAmountCents: number;
  fuelSurchargeCents: number;
  totalCents: number;
}

export interface RateSnapshot {
  rateMatrixId?: string;
  code: string;
  version: number;
  pricingModel: string;
  baseFeeCents: number;
  perKmRateCents: number;
  perKgRateCents: number;
  fuelSurchargePercent: number;
}

export interface Invoice {
  _id: string;
  organizationId: string;
  invoiceNumber: string;
  customerId: {
    _id: string;
    name: string;
    email: string;
    billingAddress?: {
      street?: string;
      city?: string;
      state?: string;
      postalCode?: string;
      country?: string;
    };
  };
  customer?: {
    _id: string;
    name: string;
    email: string;
    billingAddress?: {
      street?: string;
      city?: string;
      state?: string;
      postalCode?: string;
      country?: string;
    };
  };
  status: InvoiceStatus;
  issueDate?: string;
  dueDate: string;
  dueAt?: string;
  currency: string;
  lineItems: InvoiceLineItem[];
  subtotalCents: number;
  taxRatePercent: number;
  taxAmountCents: number;
  discountAmountCents: number;
  fuelSurchargeCents: number;
  totalAmountCents: number;
  amountPaidCents: number;
  balanceDueCents: number;
  rateSnapshot?: RateSnapshot;
  paymentTermsDays: number;
  notes?: string;
  billingAddress?: {
    street?: string;
    city?: string;
    state?: string;
    postalCode?: string;
    country?: string;
  };
  issuedAt?: string;
  paidAt?: string;
  voidedAt?: string;
  voidReason?: string;
  auditTrail: Array<{
    action: string;
    performedBy?: any;
    timestamp: string;
    note?: string;
  }>;
  createdAt: string;
  updatedAt: string;
}

export type PaymentMethod = 'BANK_TRANSFER' | 'CREDIT_CARD' | 'CHECK' | 'CASH' | 'ACH' | 'WIRE' | 'OTHER';
export type PaymentReceiptStatus = 'RECORDED' | 'RECONCILED' | 'REVERSED';

export interface InvoiceAllocation {
  invoiceId: string;
  invoiceNumber?: string;
  allocatedAmountCents?: number;
  invoice?: string | { _id: string; invoiceNumber: string };
  amountCents?: number;
}

export interface PaymentReceipt {
  _id: string;
  organizationId: string;
  receiptNumber: string;
  customerId: {
    _id: string;
    name: string;
    email: string;
  };
  customer?: {
    _id: string;
    name: string;
    email: string;
  };
  amountCents: number;
  currency: string;
  paymentDate: string;
  paymentMethod: PaymentMethod;
  referenceNumber: string;
  allocations?: InvoiceAllocation[];
  invoiceAllocations?: InvoiceAllocation[];
  status: PaymentReceiptStatus | string;
  recordedBy?: {
    _id: string;
    firstName: string;
    lastName: string;
    email: string;
  };
  reversalReason?: string;
  reversedAt?: string;
  notes?: string;
  auditTrail?: Array<{
    action: string;
    performedBy?: any;
    timestamp: string;
    note?: string;
  }>;
  createdAt: string;
  updatedAt: string;
}

export type DriverSettlementStatus = 'DRAFT' | 'CALCULATED' | 'APPROVED' | 'PAID' | 'REJECTED' | 'UNDER_REVIEW' | 'REVERSED';

export interface SettlementBonus {
  code: string;
  description: string;
  amountCents: number;
  authorizedBy?: any;
  metricType?: 'SAFETY_SCORE' | 'FUEL_EFFICIENCY' | 'ON_TIME_DELIVERY' | 'ATTENDANCE' | 'MANUAL' | string;
  referenceId?: string;
}

export interface SettlementDeduction {
  code: string;
  description: string;
  amountCents: number;
  authorizedBy?: any;
  reasonCategory?: string;
  type?: string;
  incidentId?: string;
}

export interface DriverSettlement {
  _id: string;
  organizationId: string;
  settlementNumber: string;
  driverId: {
    _id: string;
    name: string;
    email?: string;
    phone?: string;
    driverLicenseNumber?: string;
  };
  driver?: {
    _id: string;
    name: string;
    email?: string;
    phone?: string;
    driverLicenseNumber?: string;
  };
  periodStart?: string;
  periodEnd?: string;
  periodStartDate?: string;
  periodEndDate?: string;
  status: DriverSettlementStatus;
  currency: string;
  totalDispatches?: number;
  totalDistanceKm?: number;
  totalHoursWorked?: number;
  totalOvertimeHours?: number;
  basePayCents?: number;
  mileagePayCents?: number;
  overtimePayCents?: number;
  bonuses?: SettlementBonus[];
  safetyBonusCents?: number;
  totalBonusCents?: number;
  deductions?: SettlementDeduction[];
  totalDeductionsCents?: number;
  totalDeductionCents?: number;
  grossPayCents: number;
  taxWithheldCents?: number;
  netPayCents: number;
  dispatchesIncluded?: any[];
  shiftsIncluded?: any[];
  shiftBreakdown?: Array<{
    shiftDate: string;
    hoursWorked: number;
    hourlyRateCents: number;
    payCents: number;
  }>;
  mileageBreakdown?: Array<{
    dispatchNumber?: string;
    distanceKm: number;
    perKmRateCents: number;
    payCents: number;
  }>;
  safetyScoreSnapshot?: string;
  calculatedAt?: string;
  approvedBy?: {
    _id: string;
    firstName: string;
    lastName: string;
    email: string;
  };
  approvedAt?: string;
  paidAt?: string;
  paymentReference?: string;
  paymentMethod?: string;
  rejectionReason?: string;
  notes?: string;
  auditTrail?: Array<{
    action: string;
    performedBy?: any;
    timestamp: string;
    note?: string;
  }>;
  createdAt: string;
  updatedAt?: string;
}

export interface AgingBucketCurrency {
  currentCents: number;
  days1To30Cents: number;
  days31To60Cents: number;
  days61To90Cents: number;
  over90DaysCents: number;
  totalOutstandingCents: number;
  invoiceCount: number;
  customers: Record<
    string,
    {
      customerId?: string;
      customerName: string;
      outstandingBalanceCents: number;
      invoices: Array<{
        id: string;
        invoiceNumber: string;
        dueAt: string;
        daysOverdue: number;
        amountCents: number;
        bucket: string;
      }>;
    }
  >;
}

export interface AgingReportResponse {
  asOfDate: string;
  byCurrency: Record<string, AgingBucketCurrency>;
}
