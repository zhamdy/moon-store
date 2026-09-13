import { IExportsRepository, exportsRepository as defaultRepo } from './repository';
import { ExportSalesFilters, CsvExportResult } from './types';

export function escapeCsv(val: unknown): string {
  if (val === null || val === undefined) return '';
  const str = String(val);
  if (str.includes(',') || str.includes('"') || str.includes('\n')) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
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
