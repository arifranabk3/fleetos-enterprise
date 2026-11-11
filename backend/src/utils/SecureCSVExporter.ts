/**
 * Secure CSV Export Utility
 * 
 * Provides RFC 4180 compliant CSV serialization with mandatory formula injection mitigation.
 * Spreadsheet software (MS Excel, LibreOffice Calc, Google Sheets) interprets cells starting with
 * '=', '+', '-', '@', '\t', or '\r' as dynamic formulas or DDE macro triggers.
 * This sanitizer prefixes such values with a single quote (') to force text interpretation.
 */

export class SecureCSVExporter {
  /**
   * Sanitizes a single cell value against spreadsheet formula injection (CWE-1236).
   */
  static sanitizeCell(val: any): string {
    if (val === null || val === undefined) {
      return '';
    }

    let str = String(val);

    // Formula injection mitigation: if cell begins with =, +, -, @, tab, or carriage return, prefix with single quote
    const formulaTriggers = ['=', '+', '-', '@', '\t', '\r'];
    if (str.length > 0 && formulaTriggers.includes(str.charAt(0))) {
      str = `'${str}`;
    }

    // RFC 4180 escaping: wrap in quotes if contains comma, quote, or newline
    if (str.includes('"') || str.includes(',') || str.includes('\n') || str.includes('\r')) {
      str = `"${str.replace(/"/g, '""')}"`;
    }

    return str;
  }

  /**
   * Generates a complete CSV string from headers and object rows.
   */
  static generateCSV<T extends Record<string, any>>(
    headers: { key: keyof T | string; label: string; formatter?: (val: any, row: T) => string | number }[],
    data: T[]
  ): string {
    const headerRow = headers.map((h) => this.sanitizeCell(h.label)).join(',');

    const rows = data.map((row) => {
      return headers
        .map((h) => {
          const rawVal = (row as any)[h.key];
          const formattedVal = h.formatter ? h.formatter(rawVal, row) : rawVal;
          return this.sanitizeCell(formattedVal);
        })
        .join(',');
    });

    return [headerRow, ...rows].join('\r\n');
  }
}

