export interface ExportSalesFilters {
  from?: unknown;
  to?: unknown;
}

export interface ExportProductRow extends Record<string, unknown> {
  id: number;
  name: string;
  sku: string;
  barcode: string;
  price: number | string;
  cost_price: number | string;
  stock: number;
  min_stock: number;
  category: string;
  distributor: string;
  status: string;
  created_at: string;
}

export interface ExportSalesRow extends Record<string, unknown> {
  receipt_number: string;
  created_at: string;
  cashier: string;
  customer: string;
  customer_phone: string;
  subtotal: number | string;
  discount: number | string;
  tax: number | string;
  total: number | string;
  payment_method: string;
  status: string;
  notes: string;
}

export interface ExportCustomerRow extends Record<string, unknown> {
  id: number;
  name: string;
  phone: string;
  address: string;
  notes: string;
  loyalty_points: number;
  total_spent: number | string;
  total_orders: number;
  created_at: string;
}

export interface CsvExportResult {
  csv: string;
  filename: string;
}
