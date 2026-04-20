/**
 * CBS Print & Export Utilities — Tier-1 branch operations.
 * @file src/utils/cbsPrint.ts
 *
 * CBS operators print passbooks, vouchers, statements, and reports
 * daily. This module provides:
 *   1. printScreen()    — Print current screen (respects cbs-no-print)
 *   2. printContent()   — Print a specific HTML element
 *   3. exportToCsv()    — Export tabular data as CSV download
 *   4. printVoucher()   — Generate and print a transaction voucher
 *
 * CSS convention: elements with class `cbs-no-print` are hidden
 * during printing (Header, Sidebar, action buttons). Elements with
 * class `cbs-print-only` are shown only during printing.
 *
 * CBS benchmark:
 *   Finacle: F9 triggers screen print; HPRTVCH prints vouchers
 *   T24: OFS.PRINT generates formatted output
 *   FLEXCUBE: CSTB_PRINT_SCREEN for passbook/voucher
 */

/* ── Screen Print ──────────────────────────────────────────────── */

/**
 * Print the current screen. Relies on `@media print` CSS rules
 * and the `cbs-no-print` class to hide navigation chrome.
 */
export function printScreen(): void {
  window.print();
}

/* ── Element Print ─────────────────────────────────────────────── */

/**
 * Print a specific HTML element by cloning it into a print iframe.
 * This allows printing a single section (e.g. statement table)
 * without the surrounding page layout.
 */
export function printContent(element: HTMLElement, title?: string): void {
  const iframe = document.createElement('iframe');
  iframe.style.position = 'fixed';
  iframe.style.right = '0';
  iframe.style.bottom = '0';
  iframe.style.width = '0';
  iframe.style.height = '0';
  iframe.style.border = 'none';
  document.body.appendChild(iframe);

  const doc = iframe.contentDocument || iframe.contentWindow?.document;
  if (!doc) {
    document.body.removeChild(iframe);
    return;
  }

  // Copy stylesheets for consistent rendering
  const styles = Array.from(document.querySelectorAll('link[rel="stylesheet"], style'))
    .map((el) => el.outerHTML)
    .join('\n');

  doc.open();
  doc.write(`
    <!DOCTYPE html>
    <html>
    <head>
      <title>${title || 'FINVANTA CBS — Print'}</title>
      ${styles}
      <style>
        @media print {
          body { margin: 0; padding: 16px; font-size: 11px; }
          .cbs-no-print { display: none !important; }
          .cbs-print-header { display: block !important; }
        }
        @page {
          size: A4;
          margin: 15mm;
        }
      </style>
    </head>
    <body>
      <div class="cbs-print-header" style="display:none; margin-bottom:16px; padding-bottom:8px; border-bottom:2px solid #1e3a5f;">
        <div style="font-size:14px; font-weight:bold; color:#1e3a5f;">FINVANTA CORE BANKING SYSTEM</div>
        <div style="font-size:10px; color:#6b7280;">Printed: ${new Date().toLocaleString('en-IN')} · ${title || 'Report'}</div>
      </div>
      ${element.outerHTML}
    </body>
    </html>
  `);
  doc.close();

  iframe.contentWindow?.focus();
  iframe.contentWindow?.print();

  // Clean up after print dialog closes
  setTimeout(() => {
    document.body.removeChild(iframe);
  }, 1000);
}

/* ── CSV Export ─────────────────────────────────────────────────── */

export interface CsvColumn<T> {
  header: string;
  accessor: (row: T) => string | number;
}

/**
 * Export tabular data as a CSV file download.
 *
 * @param data - Array of row objects
 * @param columns - Column definitions with header labels and accessors
 * @param filename - Download filename (without .csv extension)
 */
export function exportToCsv<T>(
  data: T[],
  columns: CsvColumn<T>[],
  filename: string,
): void {
  const header = columns.map((c) => escapeCsvField(c.header)).join(',');
  const rows = data.map((row) =>
    columns.map((c) => escapeCsvField(String(c.accessor(row)))).join(','),
  );
  const csv = [header, ...rows].join('\n');

  const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = `${filename}_${new Date().toISOString().slice(0, 10)}.csv`;
  link.style.display = 'none';
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

function escapeCsvField(value: string): string {
  if (value.includes(',') || value.includes('"') || value.includes('\n')) {
    return `"${value.replace(/"/g, '""')}"`;
  }
  return value;
}

/* ── Transaction Voucher ───────────────────────────────────────── */

export interface VoucherData {
  voucherNumber: string;
  transactionRef: string;
  transactionType: string;
  accountNumber: string;
  customerName?: string;
  amount: string;
  narration?: string;
  valueDate: string;
  branchCode: string;
  branchName?: string;
  operatorId: string;
}

/**
 * Generate and print a transaction voucher.
 * Per CBS convention: vouchers are printed on thermal/A5 paper
 * with bank header, transaction details, and operator stamp.
 */
export function printVoucher(data: VoucherData): void {
  const iframe = document.createElement('iframe');
  iframe.style.cssText = 'position:fixed;right:0;bottom:0;width:0;height:0;border:none;';
  document.body.appendChild(iframe);

  const doc = iframe.contentDocument || iframe.contentWindow?.document;
  if (!doc) {
    document.body.removeChild(iframe);
    return;
  }

  doc.open();
  doc.write(`
    <!DOCTYPE html>
    <html>
    <head>
      <title>Voucher ${data.voucherNumber}</title>
      <style>
        @page { size: A5 landscape; margin: 10mm; }
        body { font-family: 'Courier New', monospace; font-size: 11px; margin: 0; padding: 16px; }
        .header { text-align: center; border-bottom: 2px solid #000; padding-bottom: 8px; margin-bottom: 12px; }
        .header h1 { font-size: 14px; margin: 0; }
        .header p { font-size: 10px; margin: 2px 0 0; color: #555; }
        .field { display: flex; justify-content: space-between; padding: 3px 0; border-bottom: 1px dotted #ccc; }
        .field-label { font-weight: bold; color: #333; }
        .field-value { text-align: right; font-family: 'Courier New', monospace; }
        .amount { font-size: 16px; font-weight: bold; text-align: center; padding: 12px 0; border: 2px solid #000; margin: 12px 0; }
        .footer { margin-top: 20px; display: flex; justify-content: space-between; font-size: 9px; color: #666; }
        .stamp { border-top: 1px solid #000; padding-top: 4px; text-align: center; width: 120px; }
      </style>
    </head>
    <body>
      <div class="header">
        <h1>FINVANTA CORE BANKING SYSTEM</h1>
        <p>Transaction Voucher</p>
      </div>
      <div class="field"><span class="field-label">Voucher No:</span><span class="field-value">${data.voucherNumber}</span></div>
      <div class="field"><span class="field-label">Txn Ref:</span><span class="field-value">${data.transactionRef}</span></div>
      <div class="field"><span class="field-label">Type:</span><span class="field-value">${data.transactionType}</span></div>
      <div class="field"><span class="field-label">Account:</span><span class="field-value">${data.accountNumber}</span></div>
      ${data.customerName ? `<div class="field"><span class="field-label">Customer:</span><span class="field-value">${data.customerName}</span></div>` : ''}
      <div class="field"><span class="field-label">Value Date:</span><span class="field-value">${data.valueDate}</span></div>
      <div class="field"><span class="field-label">Branch:</span><span class="field-value">${data.branchCode}${data.branchName ? ` — ${data.branchName}` : ''}</span></div>
      ${data.narration ? `<div class="field"><span class="field-label">Narration:</span><span class="field-value">${data.narration}</span></div>` : ''}
      <div class="amount">${data.amount}</div>
      <div class="footer">
        <div>Printed: ${new Date().toLocaleString('en-IN')}</div>
        <div class="stamp">Operator: ${data.operatorId}</div>
        <div class="stamp">Authorised Signatory</div>
      </div>
    </body>
    </html>
  `);
  doc.close();

  iframe.contentWindow?.focus();
  iframe.contentWindow?.print();
  setTimeout(() => { document.body.removeChild(iframe); }, 1000);
}
