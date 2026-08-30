import fs from 'fs';
import path from 'path';

const manifestPath = path.join(__dirname, '../src/http/endpointManifest.ts');
const manifestContent = fs.readFileSync(manifestPath, 'utf8');

const entryRegex =
  /\{\s*method:\s*'([^']+)',\s*path:\s*'([^']+)',\s*classification:\s*'([^']+)',\s*authorization:\s*([^}]+)\}/g;
let match;
const endpoints: Array<{
  method: string;
  path: string;
  classification: string;
  roles: string[];
  isPublic: boolean;
}> = [];

while ((match = entryRegex.exec(manifestContent)) !== null) {
  const method = match[1];
  const endpointPath = match[2];
  const classification = match[3];
  const authStr = match[4];

  let roles = ['Admin'];
  let isPublic = false;
  if (authStr.includes('publicAuth')) {
    roles = [];
    isPublic = true;
  } else if (authStr.includes('allAuthenticated')) {
    roles = ['Admin', 'Cashier', 'Delivery'];
  } else if (authStr.includes('adminOrCashier')) {
    roles = ['Admin', 'Cashier'];
  } else if (authStr.includes('adminOrDelivery')) {
    roles = ['Admin', 'Delivery'];
  }

  endpoints.push({ method, path: endpointPath, classification, roles, isPublic });
}

function getTag(p: string): string {
  if (p.startsWith('/api/v1/auth')) return 'Auth';
  if (p.startsWith('/api/v1/users')) return 'Users';
  if (p.startsWith('/api/v1/settings')) return 'Settings';
  if (p.startsWith('/api/v1/audit-log')) return 'Audit Log';
  if (p.startsWith('/api/v1/branches')) return 'Branches';
  if (p.startsWith('/api/v1/sales')) return 'POS Sales';
  if (p.startsWith('/api/v1/register')) return 'POS Register';
  if (p.startsWith('/api/v1/shifts')) return 'POS Shifts';
  if (p.startsWith('/api/v1/exchanges')) return 'POS Exchanges';
  if (p.startsWith('/api/v1/layaway')) return 'POS Layaway';
  if (p.startsWith('/api/v1/reservations')) return 'POS Reservations';
  if (p.startsWith('/api/v1/products')) return 'Products';
  if (p.startsWith('/api/v1/categories')) return 'Categories';
  if (p.startsWith('/api/v1/distributors')) return 'Distributors';
  if (p.startsWith('/api/v1/stock-counts')) return 'Stock Counts';
  if (p.startsWith('/api/v1/stock-adjustments')) return 'Stock Adjustments';
  if (p.startsWith('/api/v1/bundles')) return 'Bundles';
  if (p.startsWith('/api/v1/collections')) return 'Collections';
  if (p.startsWith('/api/v1/label-templates')) return 'Label Templates';
  if (p.startsWith('/api/v1/customers')) return 'Customers';
  if (p.startsWith('/api/v1/coupons')) return 'Coupons';
  if (p.startsWith('/api/v1/gift-cards')) return 'Gift Cards';
  if (p.startsWith('/api/v1/feedback')) return 'Customer Feedback';
  if (p.startsWith('/api/v1/segments')) return 'Customer Segments';
  if (p.startsWith('/api/v1/storefront')) return 'Storefront';
  if (p.startsWith('/api/v1/online-orders')) return 'Online Orders';
  if (p.startsWith('/api/v1/vendors')) return 'Vendors';
  if (p.startsWith('/api/v1/warranty')) return 'Warranty';
  if (p.startsWith('/api/v1/delivery')) return 'Delivery';
  if (p.startsWith('/api/v1/shipping-companies')) return 'Shipping Companies';
  if (p.startsWith('/api/v1/purchase-orders')) return 'Purchase Orders';
  if (p.startsWith('/api/v1/expenses')) return 'Expenses';
  if (p.startsWith('/api/v1/analytics')) return 'Analytics';
  if (p.startsWith('/api/v1/reports')) return 'Reports';
  if (p.startsWith('/api/v1/exports')) return 'Exports';
  if (p.startsWith('/api/v1/ai')) return 'AI Insights';
  if (p.startsWith('/api/v1/notifications')) return 'Notifications';
  return 'General';
}

function getSummary(method: string, p: string, tag: string): string {
  const parts = p.split('/').filter(Boolean);
  const last = parts[parts.length - 1];
  const isId = last.startsWith(':') || last.startsWith('{');
  const action = parts[parts.length - (isId ? 2 : 1)];
  const cleanTag = tag.replace(/^POS /, '');

  if (method === 'GET') {
    if (isId) return `Get ${cleanTag} by ID`;
    if (action === 'export' || p.includes('/export')) return `Export ${cleanTag} data`;
    if (p.includes('/stats') || p.includes('/metrics') || p.includes('/summary'))
      return `Get ${cleanTag} metrics and summary`;
    return `List / Query ${cleanTag}`;
  }
  if (method === 'POST') {
    if (action === 'login') return 'User Login';
    if (action === 'logout') return 'User Logout';
    if (action === 'refresh') return 'Refresh Access Token';
    return `Create / Submit ${cleanTag}`;
  }
  if (method === 'PUT') return `Update ${cleanTag}`;
  if (method === 'PATCH') return `Partially Update ${cleanTag}`;
  if (method === 'DELETE') return `Delete ${cleanTag}`;
  return `${method} ${p}`;
}

function formatOpenApiPath(p: string): string {
  return p.replace(/:([a-zA-Z0-9_]+)/g, '{$1}');
}

function extractParameters(p: string) {
  const matches = p.match(/:([a-zA-Z0-9_]+)/g);
  if (!matches) return [];
  return matches.map((m) => {
    const name = m.substring(1);
    return {
      name,
      in: 'path',
      required: true,
      schema: {
        type: name.toLowerCase().endsWith('id') ? 'integer' : 'string',
      },
      description: `Target ${name}`,
    };
  });
}

const openApiPaths: Record<string, Record<string, any>> = {
  '/api/health': {
    get: {
      tags: ['Health'],
      summary: 'Service & Database Health Check',
      security: [],
      responses: {
        200: {
          description: 'System is healthy',
          content: {
            'application/json': {
              schema: {
                type: 'object',
                properties: {
                  success: { type: 'boolean', example: true },
                  data: {
                    type: 'object',
                    properties: {
                      status: { type: 'string', example: 'ok' },
                      timestamp: { type: 'string', format: 'date-time' },
                    },
                  },
                },
              },
            },
          },
        },
        503: {
          description: 'Database or service unreachable',
        },
      },
    },
  },
};

for (const ep of endpoints) {
  const oasPath = formatOpenApiPath(ep.path);
  if (!openApiPaths[oasPath]) {
    openApiPaths[oasPath] = {};
  }

  const tag = getTag(ep.path);
  const methodLower = ep.method.toLowerCase();
  const baseSummary = getSummary(ep.method, ep.path, tag);
  const roleSuffix = ep.roles.length > 0 ? ` (${ep.roles.join(', ')})` : ' (Public)';
  const summary = `${baseSummary}${roleSuffix}`;
  const parameters = extractParameters(ep.path);

  const operation: Record<string, any> = {
    tags: [tag],
    summary,
    description: `Endpoint classification: ${ep.classification}. Allowed Roles: ${ep.isPublic ? 'Public' : ep.roles.join(', ')}.`,
    security: ep.isPublic ? [] : [{ BearerAuth: [] }],
  };

  if (parameters.length > 0) {
    operation.parameters = parameters;
  }

  if (['post', 'put', 'patch'].includes(methodLower)) {
    operation.requestBody = {
      required: true,
      content: {
        'application/json': {
          schema: {
            type: 'object',
            additionalProperties: true,
          },
        },
      },
    };
  }

  operation.responses = {
    200: {
      description: 'Successful operation',
      content: {
        'application/json': {
          schema: {
            type: 'object',
            properties: {
              success: { type: 'boolean', example: true },
              data: { type: 'object' },
            },
          },
        },
      },
    },
    400: { description: 'Validation error / Bad request' },
    401: { description: 'Unauthorized / Missing or invalid token' },
    403: { description: 'Forbidden / Insufficient role privileges' },
    404: { description: 'Resource not found' },
    500: { description: 'Internal server error' },
  };

  openApiPaths[oasPath][methodLower] = operation;
}

const fullSpec = {
  openapi: '3.1.0',
  info: {
    title: 'MOON Fashion & Style API',
    version: '1.0.0',
    description: `
**MOON Fashion & Style POS & Management System REST API**

Built with Node.js, Express, TypeScript, and PostgreSQL.

### Authentication
- JWT Bearer Authentication is required for most endpoints.
- Provide the token in the \`Authorization\` header: \`Bearer <your_token>\`.
- Obtain tokens via \`POST /api/v1/auth/login\`.

### Standard Roles
- **Admin**: Full system access
- **Cashier**: POS, sales, orders, and customer operations
- **Delivery**: Fulfillment and delivery status updates
    `,
  },
  servers: [
    {
      url: 'http://localhost:3001',
      description: 'Local Development Server',
    },
  ],
  tags: [
    { name: 'Auth', description: 'Authentication & session management' },
    { name: 'Users', description: 'User account management & favorites' },
    { name: 'Branches', description: 'Multi-branch locations & stock transfers' },
    { name: 'Settings', description: 'System and store configuration' },
    { name: 'Audit Log', description: 'Security audit trail & activity logs' },
    { name: 'POS Register', description: 'Cash drawer sessions, shifts, & cash movements' },
    { name: 'POS Sales', description: 'Sales transactions & refunds' },
    { name: 'POS Shifts', description: 'Cashier shifts & time clock' },
    { name: 'POS Exchanges', description: 'Product exchanges & returns' },
    { name: 'POS Layaway', description: 'Layaway plans & installments' },
    { name: 'POS Reservations', description: 'Hold carts & product reservations' },
    {
      name: 'Products',
      description: 'Product catalog, variants, pricing, barcodes, and inventory',
    },
    { name: 'Categories', description: 'Hierarchical product categories' },
    { name: 'Bundles', description: 'Product bundles & kit deals' },
    { name: 'Collections', description: 'Seasonal and curated product collections' },
    { name: 'Stock Counts', description: 'Physical inventory stock counts & audits' },
    { name: 'Stock Adjustments', description: 'Manual stock corrections and adjustments' },
    { name: 'Label Templates', description: 'Barcode & price label printing templates' },
    { name: 'Customers', description: 'Customer profiles, loyalty, & purchase history' },
    { name: 'Coupons', description: 'Discounts & promotional coupons' },
    { name: 'Gift Cards', description: 'Digital and physical gift card balances' },
    { name: 'Customer Feedback', description: 'Customer reviews, ratings, & surveys' },
    { name: 'Customer Segments', description: 'Audience segmentation & targeted campaigns' },
    { name: 'Storefront', description: 'Public catalog & storefront settings' },
    { name: 'Online Orders', description: 'E-commerce orders & status tracking' },
    { name: 'Vendors', description: 'Brand vendors & suppliers' },
    { name: 'Warranty', description: 'Item warranty tracking & claims' },
    { name: 'Delivery', description: 'Order delivery dispatch & tracking' },
    { name: 'Shipping Companies', description: 'Carrier integrations & shipping rates' },
    { name: 'Purchase Orders', description: 'Supplier purchase orders & receiving' },
    { name: 'Expenses', description: 'Store expense tracking & petty cash' },
    { name: 'Distributors', description: 'Wholesale distributors & supply lines' },
    { name: 'Analytics', description: 'Executive dashboard, LTV, dead stock, & metrics' },
    { name: 'Reports', description: 'Financial, inventory, and sales reports' },
    { name: 'Exports', description: 'Data export in CSV / Excel formats' },
    { name: 'AI Insights', description: 'AI inventory and revenue predictions' },
    { name: 'Notifications', description: 'In-app and system alerts' },
    { name: 'Health', description: 'Server and database health check' },
  ],
  components: {
    securitySchemes: {
      BearerAuth: {
        type: 'http',
        scheme: 'bearer',
        bearerFormat: 'JWT',
        description: 'Provide JWT token in Authorization header: Bearer <token>',
      },
    },
    schemas: {
      ApiResponse: {
        type: 'object',
        properties: {
          success: { type: 'boolean' },
          data: { type: 'object' },
        },
      },
      ApiError: {
        type: 'object',
        properties: {
          success: { type: 'boolean', example: false },
          error: {
            type: 'object',
            properties: {
              code: { type: 'string', example: 'VALIDATION_ERROR' },
              message: { type: 'string', example: 'Invalid input data' },
            },
          },
        },
      },
    },
  },
  security: [
    {
      BearerAuth: [],
    },
  ],
  paths: openApiPaths,
};

const outputContent = `// Auto-generated Comprehensive OpenAPI 3.1.0 Specification
// Covers all 200 system endpoints across all 38 modules for Scalar API Reference

export const openApiSpec = ${JSON.stringify(fullSpec, null, 2)} as const;
`;

const outputPath = path.join(__dirname, '../src/docs/openapi.ts');
fs.writeFileSync(outputPath, outputContent, 'utf8');
console.log(
  'Successfully generated full openapi.ts with paths count:',
  Object.keys(openApiPaths).length
);
