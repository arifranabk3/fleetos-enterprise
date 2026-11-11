export class FinancialStateMachine {
  private static readonly INVOICE_TRANSITIONS: Record<string, string[]> = {
    DRAFT: ['ISSUED', 'VOID'],
    ISSUED: ['PARTIALLY_PAID', 'PAID', 'OVERDUE', 'DISPUTED', 'VOID'],
    PARTIALLY_PAID: ['PAID', 'OVERDUE', 'DISPUTED', 'VOID'],
    PAID: ['DISPUTED'],
    OVERDUE: ['PARTIALLY_PAID', 'PAID', 'DISPUTED', 'VOID'],
    DISPUTED: ['ISSUED', 'PARTIALLY_PAID', 'PAID', 'VOID'],
    VOID: [], // Terminal state
  };

  private static readonly SETTLEMENT_TRANSITIONS: Record<string, string[]> = {
    DRAFT: ['CALCULATED', 'REJECTED'],
    CALCULATED: ['APPROVED', 'REJECTED', 'DRAFT'],
    APPROVED: ['PAID', 'REJECTED'],
    PAID: [], // Terminal state
    REJECTED: ['DRAFT'],
  };

  static isValidInvoiceTransition(currentStatus: string, nextStatus: string): boolean {
    const allowed = this.INVOICE_TRANSITIONS[currentStatus];
    if (!allowed) return false;
    return allowed.includes(nextStatus);
  }

  static validateInvoiceTransition(currentStatus: string, nextStatus: string): void {
    if (!this.isValidInvoiceTransition(currentStatus, nextStatus)) {
      throw new Error(
        `INVALID_INVOICE_TRANSITION: Cannot transition invoice from state '${currentStatus}' to '${nextStatus}'. Permitted transitions: [${(this.INVOICE_TRANSITIONS[currentStatus] || []).join(', ')}]`
      );
    }
  }

  static isValidSettlementTransition(currentStatus: string, nextStatus: string): boolean {
    const allowed = this.SETTLEMENT_TRANSITIONS[currentStatus];
    if (!allowed) return false;
    return allowed.includes(nextStatus);
  }

  static validateSettlementTransition(currentStatus: string, nextStatus: string): void {
    if (!this.isValidSettlementTransition(currentStatus, nextStatus)) {
      throw new Error(
        `INVALID_SETTLEMENT_TRANSITION: Cannot transition driver settlement from state '${currentStatus}' to '${nextStatus}'. Permitted transitions: [${(this.SETTLEMENT_TRANSITIONS[currentStatus] || []).join(', ')}]`
      );
    }
  }
}
