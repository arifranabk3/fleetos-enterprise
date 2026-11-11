/**
 * Currency & Monetary Precision Utility
 * 
 * Enforces integer-cent / micro-unit arithmetic to eliminate JavaScript floating-point
 * rounding errors (e.g., 0.1 + 0.2 !== 0.3).
 * Standard base currency precision is 2 decimal places (cents), represented in memory
 * and calculation as integer cents (e.g. $10.50 -> 1050 cents).
 */

export class MonetaryPrecision {
  /**
   * Converts a float/decimal currency amount to integer cents (e.g., 12.345 -> 1235 cents).
   * Uses half-up standard accounting rounding.
   */
  static toCents(amount: number): number {
    if (isNaN(amount) || !isFinite(amount)) return 0;
    return Math.round(amount * 100);
  }

  /**
   * Converts integer cents back to standard two-decimal float representation.
   */
  static fromCents(cents: number): number {
    if (isNaN(cents) || !isFinite(cents)) return 0;
    return Math.round(cents) / 100;
  }

  /**
   * Sums an array of amounts in cents safely.
   */
  static sumCents(centsArray: number[]): number {
    return centsArray.reduce((acc, curr) => acc + Math.round(curr || 0), 0);
  }

  /**
   * Safe multiplication of cents by a decimal factor (e.g., tax rate 0.0825, fuel surcharge percentage 0.05).
   * Returns rounded integer cents.
   */
  static multiplyCents(cents: number, rate: number): number {
    return Math.round(cents * rate);
  }

  /**
   * Formats cents as a two-decimal formatted string.
   */
  static formatCents(cents: number, currency = 'USD'): string {
    const val = this.fromCents(cents);
    return `${currency} ${val.toFixed(2)}`;
  }

  /**
   * Safe comparison: returns true if two amounts in cents are equal.
   */
  static areEqualCents(a: number, b: number): boolean {
    return Math.round(a) === Math.round(b);
  }
}
