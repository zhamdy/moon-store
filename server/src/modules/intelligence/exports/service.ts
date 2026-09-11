import { IExportsRepository, exportsRepository as defaultRepo } from './repository';
import { ExportSalesFilters, CsvExportResult } from './types';

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

  async exportSales(filters: ExportSalesFilters): Promise<CsvExportResult> {
    const { from, to } = filters;
    const where: string[] = [];
    const params: unknown[] = [];
    let paramIdx = 1;

    if (from) {
      where.push(`s.created_at >= $${paramIdx++}`);
      params.push(from);
    }
    if (to) {
      where.push(`s.created_at <= $${paramIdx++}`);
      params.push(to);
    }

    const whereClause = where.length > 0 ? `WHERE ${where.join(' AND ')}` : '';
    const rows = await this.repo.getSalesForExport(whereClause, params);

    const headers = [
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
    const csv = toCsv(headers, rows);
    const filename = `sales-${new Date().toISOString().split('T')[0]}.csv`;
    return { csv, filename };
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
