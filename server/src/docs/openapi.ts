export const openApiSpec = {
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
      User: {
        type: 'object',
        properties: {
          id: { type: 'integer', example: 1 },
          name: { type: 'string', example: 'Admin User' },
          email: { type: 'string', format: 'email', example: 'admin@moon.com' },
          role: { type: 'string', enum: ['Admin', 'Cashier', 'Delivery'], example: 'Admin' },
          created_at: { type: 'string', format: 'date-time' },
        },
      },
      Product: {
        type: 'object',
        properties: {
          id: { type: 'integer', example: 1 },
          name: { type: 'string', example: 'Classic Silk Shirt' },
          sku: { type: 'string', example: 'SHIRT-001' },
          barcode: { type: 'string', example: '890123456789' },
          category_id: { type: 'integer', example: 2 },
          price: { type: 'number', example: 49.99 },
          cost_price: { type: 'number', example: 25.0 },
          stock: { type: 'integer', example: 100 },
          min_stock: { type: 'integer', example: 10 },
          image_url: { type: 'string', nullable: true },
          status: {
            type: 'string',
            enum: ['active', 'inactive', 'discontinued'],
            example: 'active',
          },
        },
      },
      Sale: {
        type: 'object',
        properties: {
          id: { type: 'integer', example: 101 },
          sale_number: { type: 'string', example: 'SALE-2026-0001' },
          cashier_id: { type: 'integer', example: 2 },
          customer_id: { type: 'integer', nullable: true, example: 5 },
          subtotal: { type: 'number', example: 99.98 },
          discount_amount: { type: 'number', example: 10.0 },
          tax_amount: { type: 'number', example: 4.5 },
          total_amount: { type: 'number', example: 94.48 },
          payment_method: {
            type: 'string',
            enum: ['cash', 'card', 'gift_card', 'split'],
            example: 'card',
          },
          status: {
            type: 'string',
            enum: ['completed', 'refunded', 'partial_refund'],
            example: 'completed',
          },
          created_at: { type: 'string', format: 'date-time' },
        },
      },
    },
  },
  security: [
    {
      BearerAuth: [],
    },
  ],
  paths: {
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
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    success: { type: 'boolean', example: false },
                    error: { type: 'string', example: 'Database unreachable' },
                  },
                },
              },
            },
          },
        },
      },
    },
    '/api/v1/auth/login': {
      post: {
        tags: ['Auth'],
        summary: 'User Login',
        description:
          'Authenticates a user with email and password, returning an access token and setting a secure refresh cookie.',
        security: [],
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                required: ['email', 'password'],
                properties: {
                  email: { type: 'string', format: 'email', example: 'admin@moon.com' },
                  password: { type: 'string', format: 'password', example: 'admin123' },
                },
              },
            },
          },
        },
        responses: {
          200: {
            description: 'Successful login',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    success: { type: 'boolean', example: true },
                    data: {
                      type: 'object',
                      properties: {
                        accessToken: { type: 'string' },
                        user: { $ref: '#/components/schemas/User' },
                      },
                    },
                  },
                },
              },
            },
          },
          401: {
            description: 'Invalid credentials',
            content: { 'application/json': { schema: { $ref: '#/components/schemas/ApiError' } } },
          },
        },
      },
    },
    '/api/v1/auth/refresh': {
      post: {
        tags: ['Auth'],
        summary: 'Refresh Access Token',
        security: [],
        responses: {
          200: {
            description: 'Access token refreshed',
            content: {
              'application/json': { schema: { $ref: '#/components/schemas/ApiResponse' } },
            },
          },
        },
      },
    },
    '/api/v1/auth/logout': {
      post: {
        tags: ['Auth'],
        summary: 'Logout Current Session',
        responses: {
          204: { description: 'Logged out successfully' },
        },
      },
    },
    '/api/v1/auth/me': {
      get: {
        tags: ['Auth'],
        summary: 'Get Current Authenticated User',
        responses: {
          200: {
            description: 'User details',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    success: { type: 'boolean', example: true },
                    data: { $ref: '#/components/schemas/User' },
                  },
                },
              },
            },
          },
        },
      },
    },
    '/api/v1/users': {
      get: {
        tags: ['Users'],
        summary: 'List Users (Admin)',
        parameters: [
          { name: 'page', in: 'query', schema: { type: 'integer', default: 1 } },
          { name: 'limit', in: 'query', schema: { type: 'integer', default: 20 } },
          { name: 'search', in: 'query', schema: { type: 'string' } },
          {
            name: 'role',
            in: 'query',
            schema: { type: 'string', enum: ['Admin', 'Cashier', 'Delivery'] },
          },
        ],
        responses: {
          200: {
            description: 'Paginated user list',
            content: {
              'application/json': { schema: { $ref: '#/components/schemas/ApiResponse' } },
            },
          },
        },
      },
      post: {
        tags: ['Users'],
        summary: 'Create New User (Admin)',
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                required: ['name', 'email', 'password', 'role'],
                properties: {
                  name: { type: 'string' },
                  email: { type: 'string', format: 'email' },
                  password: { type: 'string' },
                  role: { type: 'string', enum: ['Admin', 'Cashier', 'Delivery'] },
                },
              },
            },
          },
        },
        responses: {
          201: { description: 'User created' },
        },
      },
    },
    '/api/v1/users/{id}': {
      put: {
        tags: ['Users'],
        summary: 'Update User (Admin)',
        parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'integer' } }],
        responses: { 200: { description: 'User updated' } },
      },
      delete: {
        tags: ['Users'],
        summary: 'Delete User (Admin)',
        parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'integer' } }],
        responses: { 200: { description: 'User deleted' } },
      },
    },
    '/api/v1/users/delivery': {
      get: {
        tags: ['Users'],
        summary: 'List Delivery Drivers',
        responses: { 200: { description: 'Delivery users list' } },
      },
    },
    '/api/v1/users/me/favorites': {
      get: {
        tags: ['Users'],
        summary: 'Get Current User Shortcut Favorites',
        responses: { 200: { description: 'Favorites list' } },
      },
      put: {
        tags: ['Users'],
        summary: 'Update Current User Shortcut Favorites',
        responses: { 200: { description: 'Updated favorites' } },
      },
    },
    '/api/v1/products': {
      get: {
        tags: ['Products'],
        summary: 'List Products with Filtering & Pagination',
        parameters: [
          { name: 'page', in: 'query', schema: { type: 'integer', default: 1 } },
          { name: 'limit', in: 'query', schema: { type: 'integer', default: 20 } },
          { name: 'search', in: 'query', schema: { type: 'string' } },
          { name: 'category_id', in: 'query', schema: { type: 'integer' } },
          { name: 'status', in: 'query', schema: { type: 'string' } },
          { name: 'low_stock', in: 'query', schema: { type: 'boolean' } },
        ],
        responses: {
          200: {
            description: 'Products list',
            content: {
              'application/json': { schema: { $ref: '#/components/schemas/ApiResponse' } },
            },
          },
        },
      },
      post: {
        tags: ['Products'],
        summary: 'Create Product (Admin)',
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: { $ref: '#/components/schemas/Product' },
            },
          },
        },
        responses: { 201: { description: 'Product created' } },
      },
    },
    '/api/v1/products/lookup': {
      get: {
        tags: ['Products'],
        summary: 'Quick Product Lookup for POS by query / barcode',
        parameters: [{ name: 'q', in: 'query', required: true, schema: { type: 'string' } }],
        responses: { 200: { description: 'Matching products' } },
      },
    },
    '/api/v1/products/barcode/{barcode}': {
      get: {
        tags: ['Products'],
        summary: 'Get Product by Barcode',
        parameters: [{ name: 'barcode', in: 'path', required: true, schema: { type: 'string' } }],
        responses: { 200: { description: 'Product details' } },
      },
    },
    '/api/v1/products/{id}': {
      get: {
        tags: ['Products'],
        summary: 'Get Product by ID',
        parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'integer' } }],
        responses: { 200: { description: 'Product details' } },
      },
      put: {
        tags: ['Products'],
        summary: 'Update Product (Admin)',
        parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'integer' } }],
        responses: { 200: { description: 'Product updated' } },
      },
      delete: {
        tags: ['Products'],
        summary: 'Discontinue Product (Admin)',
        parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'integer' } }],
        responses: { 200: { description: 'Product discontinued' } },
      },
    },
    '/api/v1/products/{id}/adjust-stock': {
      post: {
        tags: ['Products'],
        summary: 'Quick Stock Adjustment for Product (Admin)',
        parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'integer' } }],
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                required: ['adjustment', 'reason'],
                properties: {
                  adjustment: { type: 'integer', example: 5 },
                  reason: { type: 'string', example: 'Damaged items count correction' },
                },
              },
            },
          },
        },
        responses: { 200: { description: 'Stock adjusted' } },
      },
    },
    '/api/v1/products/{id}/variants': {
      get: {
        tags: ['Products'],
        summary: 'Get Product Color / Size Variants',
        parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'integer' } }],
        responses: { 200: { description: 'Product variants' } },
      },
      post: {
        tags: ['Products'],
        summary: 'Add Product Variant (Admin)',
        parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'integer' } }],
        responses: { 201: { description: 'Variant created' } },
      },
    },
    '/api/v1/sales': {
      get: {
        tags: ['POS Sales'],
        summary: 'List Sales History',
        parameters: [
          { name: 'page', in: 'query', schema: { type: 'integer', default: 1 } },
          { name: 'limit', in: 'query', schema: { type: 'integer', default: 20 } },
          { name: 'startDate', in: 'query', schema: { type: 'string', format: 'date' } },
          { name: 'endDate', in: 'query', schema: { type: 'string', format: 'date' } },
        ],
        responses: { 200: { description: 'List of sales transactions' } },
      },
      post: {
        tags: ['POS Sales'],
        summary: 'Process New POS Sale (Admin, Cashier)',
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                required: ['items', 'payment_method'],
                properties: {
                  customer_id: { type: 'integer', nullable: true },
                  items: {
                    type: 'array',
                    items: {
                      type: 'object',
                      required: ['product_id', 'quantity', 'unit_price'],
                      properties: {
                        product_id: { type: 'integer' },
                        quantity: { type: 'integer', example: 2 },
                        unit_price: { type: 'number', example: 29.99 },
                        discount: { type: 'number', default: 0 },
                      },
                    },
                  },
                  payment_method: { type: 'string', enum: ['cash', 'card', 'gift_card', 'split'] },
                  coupon_code: { type: 'string', nullable: true },
                  notes: { type: 'string', nullable: true },
                },
              },
            },
          },
        },
        responses: { 201: { description: 'Sale processed successfully' } },
      },
    },
    '/api/v1/sales/{id}': {
      get: {
        tags: ['POS Sales'],
        summary: 'Get Sale Details by ID',
        parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'integer' } }],
        responses: { 200: { description: 'Sale details and receipt data' } },
      },
    },
    '/api/v1/sales/{id}/refund': {
      post: {
        tags: ['POS Sales'],
        summary: 'Process Full / Partial Refund (Admin, Cashier)',
        parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'integer' } }],
        responses: { 200: { description: 'Refund processed' } },
      },
    },
    '/api/v1/register/current': {
      get: {
        tags: ['POS Register'],
        summary: 'Get Current Open Register Session',
        responses: { 200: { description: 'Current session status' } },
      },
    },
    '/api/v1/register/open': {
      post: {
        tags: ['POS Register'],
        summary: 'Open Register Drawer with Float / Opening Balance',
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                required: ['opening_float'],
                properties: {
                  opening_float: { type: 'number', example: 150.0 },
                  notes: { type: 'string' },
                },
              },
            },
          },
        },
        responses: { 201: { description: 'Register opened' } },
      },
    },
    '/api/v1/register/movement': {
      post: {
        tags: ['POS Register'],
        summary: 'Record Cash In / Cash Out Movement',
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                required: ['type', 'amount', 'reason'],
                properties: {
                  type: { type: 'string', enum: ['in', 'out'] },
                  amount: { type: 'number', example: 50.0 },
                  reason: { type: 'string', example: 'Bank deposit change' },
                },
              },
            },
          },
        },
        responses: { 201: { description: 'Movement recorded' } },
      },
    },
    '/api/v1/register/close': {
      post: {
        tags: ['POS Register'],
        summary: 'Close Register Session and Reconcile Drawer',
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                required: ['actual_cash'],
                properties: {
                  actual_cash: { type: 'number', example: 1240.5 },
                  notes: { type: 'string' },
                },
              },
            },
          },
        },
        responses: { 200: { description: 'Register closed with Z-report summary' } },
      },
    },
    '/api/v1/customers': {
      get: {
        tags: ['Customers'],
        summary: 'List Customers with Search & Tier Filters',
        responses: { 200: { description: 'Customers list' } },
      },
      post: {
        tags: ['Customers'],
        summary: 'Create Customer Profile',
        responses: { 201: { description: 'Customer created' } },
      },
    },
    '/api/v1/coupons': {
      get: {
        tags: ['Coupons'],
        summary: 'List Active & Inactive Coupons',
        responses: { 200: { description: 'Coupons list' } },
      },
      post: {
        tags: ['Coupons'],
        summary: 'Create Promotional Coupon (Admin)',
        responses: { 201: { description: 'Coupon created' } },
      },
    },
    '/api/v1/gift-cards': {
      get: {
        tags: ['Gift Cards'],
        summary: 'List Gift Cards & Check Balances',
        responses: { 200: { description: 'Gift cards list' } },
      },
      post: {
        tags: ['Gift Cards'],
        summary: 'Issue New Gift Card',
        responses: { 201: { description: 'Gift card issued' } },
      },
    },
    '/api/v1/categories': {
      get: {
        tags: ['Categories'],
        summary: 'List Product Categories Tree',
        responses: { 200: { description: 'Categories list' } },
      },
      post: {
        tags: ['Categories'],
        summary: 'Create Category (Admin)',
        responses: { 201: { description: 'Category created' } },
      },
    },
    '/api/v1/bundles': {
      get: {
        tags: ['Bundles'],
        summary: 'List Product Bundles',
        responses: { 200: { description: 'Bundles list' } },
      },
      post: {
        tags: ['Bundles'],
        summary: 'Create Product Bundle (Admin)',
        responses: { 201: { description: 'Bundle created' } },
      },
    },
    '/api/v1/branches': {
      get: {
        tags: ['Branches'],
        summary: 'List All Branches / Store Locations (Admin)',
        responses: { 200: { description: 'Branches list' } },
      },
      post: {
        tags: ['Branches'],
        summary: 'Create Branch Location (Admin)',
        responses: { 201: { description: 'Branch created' } },
      },
    },
    '/api/v1/branches/transfers': {
      get: {
        tags: ['Branches'],
        summary: 'List Inter-Branch Stock Transfers (Admin)',
        responses: { 200: { description: 'Transfers list' } },
      },
      post: {
        tags: ['Branches'],
        summary: 'Create Inter-Branch Stock Transfer (Admin)',
        responses: { 201: { description: 'Transfer initiated' } },
      },
    },
    '/api/v1/settings': {
      get: {
        tags: ['Settings'],
        summary: 'Get Global Store & POS Settings',
        responses: { 200: { description: 'Current settings' } },
      },
      put: {
        tags: ['Settings'],
        summary: 'Update Store Settings (Admin)',
        responses: { 200: { description: 'Settings updated' } },
      },
    },
    '/api/v1/audit-log': {
      get: {
        tags: ['Audit Log'],
        summary: 'Search & Query System Audit Logs (Admin)',
        responses: { 200: { description: 'Audit log events' } },
      },
    },
    '/api/v1/analytics/dashboard-all': {
      get: {
        tags: ['Analytics'],
        summary: 'Consolidated Executive Analytics Dashboard (Admin)',
        responses: { 200: { description: 'Dashboard metrics and charts data' } },
      },
    },
    '/api/v1/analytics/revenue': {
      get: {
        tags: ['Analytics'],
        summary: 'Revenue Time Series Analysis (Admin)',
        responses: { 200: { description: 'Revenue metrics' } },
      },
    },
    '/api/v1/analytics/dead-stock': {
      get: {
        tags: ['Analytics'],
        summary: 'Dead Stock / Non-Moving Inventory (Admin)',
        responses: { 200: { description: 'Dead stock list' } },
      },
    },
    '/api/v1/reports/sales': {
      get: {
        tags: ['Reports'],
        summary: 'Generate Sales Summary Report (Admin)',
        responses: { 200: { description: 'Sales report' } },
      },
    },
    '/api/v1/reports/inventory': {
      get: {
        tags: ['Reports'],
        summary: 'Generate Inventory Valuation Report (Admin)',
        responses: { 200: { description: 'Inventory valuation report' } },
      },
    },
    '/api/v1/ai/inventory-forecast': {
      get: {
        tags: ['AI Insights'],
        summary: 'AI Demand & Reorder Forecast (Admin)',
        responses: { 200: { description: 'AI forecast recommendations' } },
      },
    },
    '/api/v1/notifications': {
      get: {
        tags: ['Notifications'],
        summary: 'List Unread System Notifications',
        responses: { 200: { description: 'Notifications list' } },
      },
    },
    '/api/v1/delivery': {
      get: {
        tags: ['Delivery'],
        summary: 'List Deliveries & Statuses',
        responses: { 200: { description: 'Deliveries list' } },
      },
    },
    '/api/v1/purchase-orders': {
      get: {
        tags: ['Purchase Orders'],
        summary: 'List Supplier Purchase Orders (Admin)',
        responses: { 200: { description: 'Purchase orders list' } },
      },
    },
    '/api/v1/expenses': {
      get: {
        tags: ['Expenses'],
        summary: 'List Store Expenses & Operational Costs (Admin)',
        responses: { 200: { description: 'Expenses list' } },
      },
    },
  },
};
