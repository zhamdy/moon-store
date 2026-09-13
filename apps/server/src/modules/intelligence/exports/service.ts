import { IExportsRepository, exportsRepository as defaultRepo } from './repository';
import { ExportSalesFilters, CsvExportResult, SalesExportCursor } from './types';

/** Rows per keyset page. Bounds one query's result set regardless of how large the export is. */
export const SALES_EXPORT_PAGE_SIZE = 1000;

/** Same BOM `sendCsv` prepends for the buffered exports — written by codepoint to avoid an
 * actual BOM byte sequence sitting in the source file, which some linters flag as stray
 * whitespace. */
const BOM = String.fromCharCode(0xfeff);

const SALES_EXPORT_HEADERS = [
  'receipt_number',
  'created_at',
  'cashier',
  'customer',
  'customer_phone',
  'subtotal',
  'discount',
  'tax',
  'total',
  'payment_method',
  'status',
  'notes',
];

// Excel skips leading whitespace before a formula, and a leading `|` opens a DDE call.
const FORMULA_TRIGGER = /^(?:[\t\r]|\s*[=+\-@|])/;
// node-postgres delivers NUMERIC columns as strings, so a plain decimal literal is still a number.
const DECIMAL_LITERAL = /^-?\d+(\.\d+)?$/;

export function escapeCsv(val: unknown): string {
  if (val === null || val === undefined) return '';
  let str = String(val);
  let quote = /[",\n\r]/.test(str);
  if (typeof val !== 'number' && FORMULA_TRIGGER.test(str) && !DECIMAL_LITERAL.test(str)) {
    str = `'${str}`;
    quote = true;
  }
  return quote ? `"${str.replace(/"/g, '""')}"` : str;
}

export function toCsv(headers: string[], rows: Record<string, unknown>[]): string {
  const headerLine = headers.join(',');
  const dataLines = rows.map((row) => headers.map((h) => escapeCsv(row[h])).join(','));
  return [headerLine, ...dataLines].join('\n');
}

export class ExportsService {
  constructor(private repo: IExportsRepository = defaultRepo) {}

  getRepository(): IExportsRepository {
    return this.repo;
  }

  async exportProducts(): Promise<CsvExportResult> {
    const rows = await this.repo.getProductsForExport();
    const headers = [
      'id',
      'name',
      'sku',
      'barcode',
      'price',
      'cost_price',
      'stock',
      'min_stock',
      'category',
      'distributor',
      'status',
      'created_at',
    ];
    const csv = toCsv(headers, rows);
    const filename = `products-${new Date().toISOString().split('T')[0]}.csv`;
    return { csv, filename };
  }

  salesExportFilename(): string {
    return `sales-${new Date().toISOString().split('T')[0]}.csv`;
  }

  /**
   * Streams the sales export as CSV chunks (BOM+header first, then one chunk per keyset
   * page) instead of building one in-memory string — a sales table has no natural upper
   * bound, and the old buffered `toCsv` held the whole export in memory at once and risked
   * a proxy timeout while it built. The generator holds only one page at a time.
   */
  async *exportSalesChunks(filters: ExportSalesFilters): AsyncGenerator<string> {
    yield BOM + SALES_EXPORT_HEADERS.join(',');

    let cursor: SalesExportCursor | null = null;
    for (;;) {
      const rows = await this.repo.getSalesForExportPage(filters, cursor, SALES_EXPORT_PAGE_SIZE);
      if (rows.length === 0) return;

      const lines = rows.map((row) => SALES_EXPORT_HEADERS.map((h) => escapeCsv(row[h])).join(','));
      yield `\n${lines.join('\n')}`;

      if (rows.length < SALES_EXPORT_PAGE_SIZE) return;
      const last = rows[rows.length - 1];
      cursor = { createdAt: last.created_at as string, id: last.id as number };
    }
  }

  async exportCustomers(): Promise<CsvExportResult> {
    const rows = await this.repo.getCustomersForExport();
    const headers = [
      'id',
      'name',
      'phone',
      'address',
      'notes',
      'loyalty_points',
      'total_spent',
      'total_orders',
      'created_at',
    ];
    const csv = toCsv(headers, rows);
    const filename = `customers-${new Date().toISOString().split('T')[0]}.csv`;
    return { csv, filename };
  }
}

export const exportsService = new ExportsService();
