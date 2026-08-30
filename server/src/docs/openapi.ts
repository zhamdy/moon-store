// Auto-generated Comprehensive OpenAPI 3.1.0 Specification
// Covers all 200 system endpoints across all 38 modules for Scalar API Reference

export const openApiSpec = {
  openapi: '3.1.0',
  info: {
    title: 'MOON Fashion & Style API',
    version: '1.0.0',
    description:
      '\n**MOON Fashion & Style POS & Management System REST API**\n\nBuilt with Node.js, Express, TypeScript, and PostgreSQL.\n\n### Authentication\n- JWT Bearer Authentication is required for most endpoints.\n- Provide the token in the `Authorization` header: `Bearer <your_token>`.\n- Obtain tokens via `POST /api/v1/auth/login`.\n\n### Standard Roles\n- **Admin**: Full system access\n- **Cashier**: POS, sales, orders, and customer operations\n- **Delivery**: Fulfillment and delivery status updates\n    ',
  },
  servers: [
    {
      url: 'http://localhost:3001',
      description: 'Local Development Server',
    },
  ],
  tags: [
    {
      name: 'Auth',
      description: 'Authentication & session management',
    },
    {
      name: 'Users',
      description: 'User account management & favorites',
    },
    {
      name: 'Branches',
      description: 'Multi-branch locations & stock transfers',
    },
    {
      name: 'Settings',
      description: 'System and store configuration',
    },
    {
      name: 'Audit Log',
      description: 'Security audit trail & activity logs',
    },
    {
      name: 'POS Register',
      description: 'Cash drawer sessions, shifts, & cash movements',
    },
    {
      name: 'POS Sales',
      description: 'Sales transactions & refunds',
    },
    {
      name: 'POS Shifts',
      description: 'Cashier shifts & time clock',
    },
    {
      name: 'POS Exchanges',
      description: 'Product exchanges & returns',
    },
    {
      name: 'POS Layaway',
      description: 'Layaway plans & installments',
    },
    {
      name: 'POS Reservations',
      description: 'Hold carts & product reservations',
    },
    {
      name: 'Products',
      description: 'Product catalog, variants, pricing, barcodes, and inventory',
    },
    {
      name: 'Categories',
      description: 'Hierarchical product categories',
    },
    {
      name: 'Bundles',
      description: 'Product bundles & kit deals',
    },
    {
      name: 'Collections',
      description: 'Seasonal and curated product collections',
    },
    {
      name: 'Stock Counts',
      description: 'Physical inventory stock counts & audits',
    },
    {
      name: 'Stock Adjustments',
      description: 'Manual stock corrections and adjustments',
    },
    {
      name: 'Label Templates',
      description: 'Barcode & price label printing templates',
    },
    {
      name: 'Customers',
      description: 'Customer profiles, loyalty, & purchase history',
    },
    {
      name: 'Coupons',
      description: 'Discounts & promotional coupons',
    },
    {
      name: 'Gift Cards',
      description: 'Digital and physical gift card balances',
    },
    {
      name: 'Customer Feedback',
      description: 'Customer reviews, ratings, & surveys',
    },
    {
      name: 'Customer Segments',
      description: 'Audience segmentation & targeted campaigns',
    },
    {
      name: 'Storefront',
      description: 'Public catalog & storefront settings',
    },
    {
      name: 'Online Orders',
      description: 'E-commerce orders & status tracking',
    },
    {
      name: 'Vendors',
      description: 'Brand vendors & suppliers',
    },
    {
      name: 'Warranty',
      description: 'Item warranty tracking & claims',
    },
    {
      name: 'Delivery',
      description: 'Order delivery dispatch & tracking',
    },
    {
      name: 'Shipping Companies',
      description: 'Carrier integrations & shipping rates',
    },
    {
      name: 'Purchase Orders',
      description: 'Supplier purchase orders & receiving',
    },
    {
      name: 'Expenses',
      description: 'Store expense tracking & petty cash',
    },
    {
      name: 'Distributors',
      description: 'Wholesale distributors & supply lines',
    },
    {
      name: 'Analytics',
      description: 'Executive dashboard, LTV, dead stock, & metrics',
    },
    {
      name: 'Reports',
      description: 'Financial, inventory, and sales reports',
    },
    {
      name: 'Exports',
      description: 'Data export in CSV / Excel formats',
    },
    {
      name: 'AI Insights',
      description: 'AI inventory and revenue predictions',
    },
    {
      name: 'Notifications',
      description: 'In-app and system alerts',
    },
    {
      name: 'Health',
      description: 'Server and database health check',
    },
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
      SaleCalculationSnapshot: {
        type: 'object',
        description:
          'Immutable, confirmed financial breakdown for one sale (checkout total-parity plan, Unit 2 ' +
          'snapshot / Unit 4 additive response). All monetary fields are EGP major units.',
        properties: {
          contractVersion: { type: 'string', example: 'v1' },
          subtotal: { type: 'number' },
          manualDiscount: { type: 'number' },
          couponId: { type: 'integer', nullable: true },
          couponDiscount: { type: 'number' },
          pointsRedeemed: { type: 'integer' },
          pointsDiscount: { type: 'number' },
          taxableBase: { type: 'number' },
          taxMode: { type: 'string', enum: ['inclusive', 'exclusive'] },
          taxRatePercent: { type: 'number' },
          taxAmount: { type: 'number' },
          tipAmount: { type: 'number' },
          amountDue: { type: 'number' },
          earnedPoints: { type: 'integer' },
        },
      },
      ApiResponse: {
        type: 'object',
        properties: {
          success: {
            type: 'boolean',
          },
          data: {
            type: 'object',
          },
        },
      },
      ApiError: {
        type: 'object',
        properties: {
          success: {
            type: 'boolean',
            example: false,
          },
          error: {
            type: 'object',
            properties: {
              code: {
                type: 'string',
                example: 'VALIDATION_ERROR',
              },
              message: {
                type: 'string',
                example: 'Invalid input data',
              },
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
  paths: {
    '/api/health': {
      get: {
        tags: ['Health'],
        summary: 'Service & Database Health Check',
        security: [],
        responses: {
          '200': {
            description: 'System is healthy',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    success: {
                      type: 'boolean',
                      example: true,
                    },
                    data: {
                      type: 'object',
                      properties: {
                        status: {
                          type: 'string',
                          example: 'ok',
                        },
                        timestamp: {
                          type: 'string',
                          format: 'date-time',
                        },
                      },
                    },
                  },
                },
              },
            },
          },
          '503': {
            description: 'Database or service unreachable',
          },
        },
      },
    },
    '/api/v1/auth/login': {
      post: {
        tags: ['Auth'],
        summary: 'User Login (Public)',
        description: 'Endpoint classification: M. Allowed Roles: Public.',
        security: [],
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                additionalProperties: true,
              },
            },
          },
        },
        responses: {
          '200': {
            description: 'Successful operation',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    success: {
                      type: 'boolean',
                      example: true,
                    },
                    data: {
                      type: 'object',
                    },
                  },
                },
              },
            },
          },
          '400': {
            description: 'Validation error / Bad request',
          },
          '401': {
            description: 'Unauthorized / Missing or invalid token',
          },
          '403': {
            description: 'Forbidden / Insufficient role privileges',
          },
          '404': {
            description: 'Resource not found',
          },
          '500': {
            description: 'Internal server error',
          },
        },
      },
    },
    '/api/v1/auth/refresh': {
      post: {
        tags: ['Auth'],
        summary: 'Refresh Access Token (Public)',
        description: 'Endpoint classification: M. Allowed Roles: Public.',
        security: [],
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                additionalProperties: true,
              },
            },
          },
        },
        responses: {
          '200': {
            description: 'Successful operation',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    success: {
                      type: 'boolean',
                      example: true,
                    },
                    data: {
                      type: 'object',
                    },
                  },
                },
              },
            },
          },
          '400': {
            description: 'Validation error / Bad request',
          },
          '401': {
            description: 'Unauthorized / Missing or invalid token',
          },
          '403': {
            description: 'Forbidden / Insufficient role privileges',
          },
          '404': {
            description: 'Resource not found',
          },
          '500': {
            description: 'Internal server error',
          },
        },
      },
    },
    '/api/v1/auth/logout': {
      post: {
        tags: ['Auth'],
        summary: 'User Logout (Admin, Cashier, Delivery)',
        description: 'Endpoint classification: M. Allowed Roles: Admin, Cashier, Delivery.',
        security: [
          {
            BearerAuth: [],
          },
        ],
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                additionalProperties: true,
              },
            },
          },
        },
        responses: {
          '200': {
            description: 'Successful operation',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    success: {
                      type: 'boolean',
                      example: true,
                    },
                    data: {
                      type: 'object',
                    },
                  },
                },
              },
            },
          },
          '400': {
            description: 'Validation error / Bad request',
          },
          '401': {
            description: 'Unauthorized / Missing or invalid token',
          },
          '403': {
            description: 'Forbidden / Insufficient role privileges',
          },
          '404': {
            description: 'Resource not found',
          },
          '500': {
            description: 'Internal server error',
          },
        },
      },
    },
    '/api/v1/auth/me': {
      get: {
        tags: ['Auth'],
        summary: 'List / Query Auth (Admin, Cashier, Delivery)',
        description: 'Endpoint classification: S. Allowed Roles: Admin, Cashier, Delivery.',
        security: [
          {
            BearerAuth: [],
          },
        ],
        responses: {
          '200': {
            description: 'Successful operation',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    success: {
                      type: 'boolean',
                      example: true,
                    },
                    data: {
                      type: 'object',
                    },
                  },
                },
              },
            },
          },
          '400': {
            description: 'Validation error / Bad request',
          },
          '401': {
            description: 'Unauthorized / Missing or invalid token',
          },
          '403': {
            description: 'Forbidden / Insufficient role privileges',
          },
          '404': {
            description: 'Resource not found',
          },
          '500': {
            description: 'Internal server error',
          },
        },
      },
    },
    '/api/v1/users': {
      get: {
        tags: ['Users'],
        summary: 'List / Query Users (Admin)',
        description: 'Endpoint classification: P. Allowed Roles: Admin.',
        security: [
          {
            BearerAuth: [],
          },
        ],
        responses: {
          '200': {
            description: 'Successful operation',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    success: {
                      type: 'boolean',
                      example: true,
                    },
                    data: {
                      type: 'object',
                    },
                  },
                },
              },
            },
          },
          '400': {
            description: 'Validation error / Bad request',
          },
          '401': {
            description: 'Unauthorized / Missing or invalid token',
          },
          '403': {
            description: 'Forbidden / Insufficient role privileges',
          },
          '404': {
            description: 'Resource not found',
          },
          '500': {
            description: 'Internal server error',
          },
        },
      },
      post: {
        tags: ['Users'],
        summary: 'Create / Submit Users (Admin)',
        description: 'Endpoint classification: M. Allowed Roles: Admin.',
        security: [
          {
            BearerAuth: [],
          },
        ],
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                additionalProperties: true,
              },
            },
          },
        },
        responses: {
          '200': {
            description: 'Successful operation',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    success: {
                      type: 'boolean',
                      example: true,
                    },
                    data: {
                      type: 'object',
                    },
                  },
                },
              },
            },
          },
          '400': {
            description: 'Validation error / Bad request',
          },
          '401': {
            description: 'Unauthorized / Missing or invalid token',
          },
          '403': {
            description: 'Forbidden / Insufficient role privileges',
          },
          '404': {
            description: 'Resource not found',
          },
          '500': {
            description: 'Internal server error',
          },
        },
      },
    },
    '/api/v1/users/delivery': {
      get: {
        tags: ['Users'],
        summary: 'List / Query Users (Admin)',
        description: 'Endpoint classification: B. Allowed Roles: Admin.',
        security: [
          {
            BearerAuth: [],
          },
        ],
        responses: {
          '200': {
            description: 'Successful operation',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    success: {
                      type: 'boolean',
                      example: true,
                    },
                    data: {
                      type: 'object',
                    },
                  },
                },
              },
            },
          },
          '400': {
            description: 'Validation error / Bad request',
          },
          '401': {
            description: 'Unauthorized / Missing or invalid token',
          },
          '403': {
            description: 'Forbidden / Insufficient role privileges',
          },
          '404': {
            description: 'Resource not found',
          },
          '500': {
            description: 'Internal server error',
          },
        },
      },
    },
    '/api/v1/users/me/favorites': {
      get: {
        tags: ['Users'],
        summary: 'List / Query Users (Admin, Cashier, Delivery)',
        description: 'Endpoint classification: B. Allowed Roles: Admin, Cashier, Delivery.',
        security: [
          {
            BearerAuth: [],
          },
        ],
        responses: {
          '200': {
            description: 'Successful operation',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    success: {
                      type: 'boolean',
                      example: true,
                    },
                    data: {
                      type: 'object',
                    },
                  },
                },
              },
            },
          },
          '400': {
            description: 'Validation error / Bad request',
          },
          '401': {
            description: 'Unauthorized / Missing or invalid token',
          },
          '403': {
            description: 'Forbidden / Insufficient role privileges',
          },
          '404': {
            description: 'Resource not found',
          },
          '500': {
            description: 'Internal server error',
          },
        },
      },
      put: {
        tags: ['Users'],
        summary: 'Update Users (Admin, Cashier, Delivery)',
        description: 'Endpoint classification: M. Allowed Roles: Admin, Cashier, Delivery.',
        security: [
          {
            BearerAuth: [],
          },
        ],
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                additionalProperties: true,
              },
            },
          },
        },
        responses: {
          '200': {
            description: 'Successful operation',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    success: {
                      type: 'boolean',
                      example: true,
                    },
                    data: {
                      type: 'object',
                    },
                  },
                },
              },
            },
          },
          '400': {
            description: 'Validation error / Bad request',
          },
          '401': {
            description: 'Unauthorized / Missing or invalid token',
          },
          '403': {
            description: 'Forbidden / Insufficient role privileges',
          },
          '404': {
            description: 'Resource not found',
          },
          '500': {
            description: 'Internal server error',
          },
        },
      },
    },
    '/api/v1/users/{id}': {
      put: {
        tags: ['Users'],
        summary: 'Update Users (Admin)',
        description: 'Endpoint classification: M. Allowed Roles: Admin.',
        security: [
          {
            BearerAuth: [],
          },
        ],
        parameters: [
          {
            name: 'id',
            in: 'path',
            required: true,
            schema: {
              type: 'integer',
            },
            description: 'Target id',
          },
        ],
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                additionalProperties: true,
              },
            },
          },
        },
        responses: {
          '200': {
            description: 'Successful operation',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    success: {
                      type: 'boolean',
                      example: true,
                    },
                    data: {
                      type: 'object',
                    },
                  },
                },
              },
            },
          },
          '400': {
            description: 'Validation error / Bad request',
          },
          '401': {
            description: 'Unauthorized / Missing or invalid token',
          },
          '403': {
            description: 'Forbidden / Insufficient role privileges',
          },
          '404': {
            description: 'Resource not found',
          },
          '500': {
            description: 'Internal server error',
          },
        },
      },
      delete: {
        tags: ['Users'],
        summary: 'Delete Users (Admin)',
        description: 'Endpoint classification: M. Allowed Roles: Admin.',
        security: [
          {
            BearerAuth: [],
          },
        ],
        parameters: [
          {
            name: 'id',
            in: 'path',
            required: true,
            schema: {
              type: 'integer',
            },
            description: 'Target id',
          },
        ],
        responses: {
          '200': {
            description: 'Successful operation',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    success: {
                      type: 'boolean',
                      example: true,
                    },
                    data: {
                      type: 'object',
                    },
                  },
                },
              },
            },
          },
          '400': {
            description: 'Validation error / Bad request',
          },
          '401': {
            description: 'Unauthorized / Missing or invalid token',
          },
          '403': {
            description: 'Forbidden / Insufficient role privileges',
          },
          '404': {
            description: 'Resource not found',
          },
          '500': {
            description: 'Internal server error',
          },
        },
      },
    },
    '/api/v1/settings': {
      get: {
        tags: ['Settings'],
        summary: 'List / Query Settings (Admin)',
        description: 'Endpoint classification: S. Allowed Roles: Admin.',
        security: [
          {
            BearerAuth: [],
          },
        ],
        responses: {
          '200': {
            description: 'Successful operation',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    success: {
                      type: 'boolean',
                      example: true,
                    },
                    data: {
                      type: 'object',
                    },
                  },
                },
              },
            },
          },
          '400': {
            description: 'Validation error / Bad request',
          },
          '401': {
            description: 'Unauthorized / Missing or invalid token',
          },
          '403': {
            description: 'Forbidden / Insufficient role privileges',
          },
          '404': {
            description: 'Resource not found',
          },
          '500': {
            description: 'Internal server error',
          },
        },
      },
      put: {
        tags: ['Settings'],
        summary: 'Update Settings (Admin)',
        description: 'Endpoint classification: M. Allowed Roles: Admin.',
        security: [
          {
            BearerAuth: [],
          },
        ],
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                additionalProperties: true,
              },
            },
          },
        },
        responses: {
          '200': {
            description: 'Successful operation',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    success: {
                      type: 'boolean',
                      example: true,
                    },
                    data: {
                      type: 'object',
                    },
                  },
                },
              },
            },
          },
          '400': {
            description: 'Validation error / Bad request',
          },
          '401': {
            description: 'Unauthorized / Missing or invalid token',
          },
          '403': {
            description: 'Forbidden / Insufficient role privileges',
          },
          '404': {
            description: 'Resource not found',
          },
          '500': {
            description: 'Internal server error',
          },
        },
      },
    },
    '/api/v1/audit-log': {
      get: {
        tags: ['Audit Log'],
        summary: 'List / Query Audit Log (Admin)',
        description: 'Endpoint classification: P. Allowed Roles: Admin.',
        security: [
          {
            BearerAuth: [],
          },
        ],
        responses: {
          '200': {
            description: 'Successful operation',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    success: {
                      type: 'boolean',
                      example: true,
                    },
                    data: {
                      type: 'object',
                    },
                  },
                },
              },
            },
          },
          '400': {
            description: 'Validation error / Bad request',
          },
          '401': {
            description: 'Unauthorized / Missing or invalid token',
          },
          '403': {
            description: 'Forbidden / Insufficient role privileges',
          },
          '404': {
            description: 'Resource not found',
          },
          '500': {
            description: 'Internal server error',
          },
        },
      },
    },
    '/api/v1/audit-log/actions': {
      get: {
        tags: ['Audit Log'],
        summary: 'List / Query Audit Log (Admin)',
        description: 'Endpoint classification: B. Allowed Roles: Admin.',
        security: [
          {
            BearerAuth: [],
          },
        ],
        responses: {
          '200': {
            description: 'Successful operation',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    success: {
                      type: 'boolean',
                      example: true,
                    },
                    data: {
                      type: 'object',
                    },
                  },
                },
              },
            },
          },
          '400': {
            description: 'Validation error / Bad request',
          },
          '401': {
            description: 'Unauthorized / Missing or invalid token',
          },
          '403': {
            description: 'Forbidden / Insufficient role privileges',
          },
          '404': {
            description: 'Resource not found',
          },
          '500': {
            description: 'Internal server error',
          },
        },
      },
    },
    '/api/v1/audit-log/entity-types': {
      get: {
        tags: ['Audit Log'],
        summary: 'List / Query Audit Log (Admin)',
        description: 'Endpoint classification: B. Allowed Roles: Admin.',
        security: [
          {
            BearerAuth: [],
          },
        ],
        responses: {
          '200': {
            description: 'Successful operation',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    success: {
                      type: 'boolean',
                      example: true,
                    },
                    data: {
                      type: 'object',
                    },
                  },
                },
              },
            },
          },
          '400': {
            description: 'Validation error / Bad request',
          },
          '401': {
            description: 'Unauthorized / Missing or invalid token',
          },
          '403': {
            description: 'Forbidden / Insufficient role privileges',
          },
          '404': {
            description: 'Resource not found',
          },
          '500': {
            description: 'Internal server error',
          },
        },
      },
    },
    '/api/v1/branches': {
      get: {
        tags: ['Branches'],
        summary: 'List / Query Branches (Admin, Cashier, Delivery)',
        description: 'Endpoint classification: B. Allowed Roles: Admin, Cashier, Delivery.',
        security: [
          {
            BearerAuth: [],
          },
        ],
        responses: {
          '200': {
            description: 'Successful operation',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    success: {
                      type: 'boolean',
                      example: true,
                    },
                    data: {
                      type: 'object',
                    },
                  },
                },
              },
            },
          },
          '400': {
            description: 'Validation error / Bad request',
          },
          '401': {
            description: 'Unauthorized / Missing or invalid token',
          },
          '403': {
            description: 'Forbidden / Insufficient role privileges',
          },
          '404': {
            description: 'Resource not found',
          },
          '500': {
            description: 'Internal server error',
          },
        },
      },
      post: {
        tags: ['Branches'],
        summary: 'Create / Submit Branches (Admin)',
        description: 'Endpoint classification: M. Allowed Roles: Admin.',
        security: [
          {
            BearerAuth: [],
          },
        ],
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                additionalProperties: true,
              },
            },
          },
        },
        responses: {
          '200': {
            description: 'Successful operation',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    success: {
                      type: 'boolean',
                      example: true,
                    },
                    data: {
                      type: 'object',
                    },
                  },
                },
              },
            },
          },
          '400': {
            description: 'Validation error / Bad request',
          },
          '401': {
            description: 'Unauthorized / Missing or invalid token',
          },
          '403': {
            description: 'Forbidden / Insufficient role privileges',
          },
          '404': {
            description: 'Resource not found',
          },
          '500': {
            description: 'Internal server error',
          },
        },
      },
    },
    '/api/v1/branches/consolidated': {
      get: {
        tags: ['Branches'],
        summary: 'List / Query Branches (Admin)',
        description: 'Endpoint classification: S. Allowed Roles: Admin.',
        security: [
          {
            BearerAuth: [],
          },
        ],
        responses: {
          '200': {
            description: 'Successful operation',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    success: {
                      type: 'boolean',
                      example: true,
                    },
                    data: {
                      type: 'object',
                    },
                  },
                },
              },
            },
          },
          '400': {
            description: 'Validation error / Bad request',
          },
          '401': {
            description: 'Unauthorized / Missing or invalid token',
          },
          '403': {
            description: 'Forbidden / Insufficient role privileges',
          },
          '404': {
            description: 'Resource not found',
          },
          '500': {
            description: 'Internal server error',
          },
        },
      },
    },
    '/api/v1/branches/transfers': {
      get: {
        tags: ['Branches'],
        summary: 'List / Query Branches (Admin)',
        description: 'Endpoint classification: P. Allowed Roles: Admin.',
        security: [
          {
            BearerAuth: [],
          },
        ],
        responses: {
          '200': {
            description: 'Successful operation',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    success: {
                      type: 'boolean',
                      example: true,
                    },
                    data: {
                      type: 'object',
                    },
                  },
                },
              },
            },
          },
          '400': {
            description: 'Validation error / Bad request',
          },
          '401': {
            description: 'Unauthorized / Missing or invalid token',
          },
          '403': {
            description: 'Forbidden / Insufficient role privileges',
          },
          '404': {
            description: 'Resource not found',
          },
          '500': {
            description: 'Internal server error',
          },
        },
      },
      post: {
        tags: ['Branches'],
        summary: 'Create / Submit Branches (Admin)',
        description: 'Endpoint classification: M. Allowed Roles: Admin.',
        security: [
          {
            BearerAuth: [],
          },
        ],
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                additionalProperties: true,
              },
            },
          },
        },
        responses: {
          '200': {
            description: 'Successful operation',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    success: {
                      type: 'boolean',
                      example: true,
                    },
                    data: {
                      type: 'object',
                    },
                  },
                },
              },
            },
          },
          '400': {
            description: 'Validation error / Bad request',
          },
          '401': {
            description: 'Unauthorized / Missing or invalid token',
          },
          '403': {
            description: 'Forbidden / Insufficient role privileges',
          },
          '404': {
            description: 'Resource not found',
          },
          '500': {
            description: 'Internal server error',
          },
        },
      },
    },
    '/api/v1/branches/transfers/{id}/status': {
      put: {
        tags: ['Branches'],
        summary: 'Update Branches (Admin)',
        description: 'Endpoint classification: M. Allowed Roles: Admin.',
        security: [
          {
            BearerAuth: [],
          },
        ],
        parameters: [
          {
            name: 'id',
            in: 'path',
            required: true,
            schema: {
              type: 'integer',
            },
            description: 'Target id',
          },
        ],
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                additionalProperties: true,
              },
            },
          },
        },
        responses: {
          '200': {
            description: 'Successful operation',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    success: {
                      type: 'boolean',
                      example: true,
                    },
                    data: {
                      type: 'object',
                    },
                  },
                },
              },
            },
          },
          '400': {
            description: 'Validation error / Bad request',
          },
          '401': {
            description: 'Unauthorized / Missing or invalid token',
          },
          '403': {
            description: 'Forbidden / Insufficient role privileges',
          },
          '404': {
            description: 'Resource not found',
          },
          '500': {
            description: 'Internal server error',
          },
        },
      },
    },
    '/api/v1/branches/{id}': {
      put: {
        tags: ['Branches'],
        summary: 'Update Branches (Admin)',
        description: 'Endpoint classification: M. Allowed Roles: Admin.',
        security: [
          {
            BearerAuth: [],
          },
        ],
        parameters: [
          {
            name: 'id',
            in: 'path',
            required: true,
            schema: {
              type: 'integer',
            },
            description: 'Target id',
          },
        ],
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                additionalProperties: true,
              },
            },
          },
        },
        responses: {
          '200': {
            description: 'Successful operation',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    success: {
                      type: 'boolean',
                      example: true,
                    },
                    data: {
                      type: 'object',
                    },
                  },
                },
              },
            },
          },
          '400': {
            description: 'Validation error / Bad request',
          },
          '401': {
            description: 'Unauthorized / Missing or invalid token',
          },
          '403': {
            description: 'Forbidden / Insufficient role privileges',
          },
          '404': {
            description: 'Resource not found',
          },
          '500': {
            description: 'Internal server error',
          },
        },
      },
    },
    '/api/v1/sales': {
      get: {
        tags: ['POS Sales'],
        summary: 'List / Query Sales (Admin, Cashier)',
        description: 'Endpoint classification: P. Allowed Roles: Admin, Cashier.',
        security: [
          {
            BearerAuth: [],
          },
        ],
        responses: {
          '200': {
            description: 'Successful operation',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    success: {
                      type: 'boolean',
                      example: true,
                    },
                    data: {
                      type: 'object',
                    },
                  },
                },
              },
            },
          },
          '400': {
            description: 'Validation error / Bad request',
          },
          '401': {
            description: 'Unauthorized / Missing or invalid token',
          },
          '403': {
            description: 'Forbidden / Insufficient role privileges',
          },
          '404': {
            description: 'Resource not found',
          },
          '500': {
            description: 'Internal server error',
          },
        },
      },
      post: {
        tags: ['POS Sales'],
        summary: 'Create / Submit Sales (Admin, Cashier)',
        description:
          'Endpoint classification: M. Allowed Roles: Admin, Cashier.\n\n' +
          '**Split-payment integrity (checkout total-parity plan, Unit 4):** when `payments` is provided, ' +
          'it is the sole source of truth for the tender and its entries must sum, in exact minor units ' +
          '(no float tolerance), to the server-authoritative amount due. `payment_method` is never ' +
          'cross-checked against `payments` when both are present. Duplicate methods (e.g. two `Cash` ' +
          'entries) are allowed. Omitting `payments` is the unchanged single-tender compatibility path: ' +
          'no `sale_payments` rows are created and no sum check applies. A mismatched/invalid split is ' +
          'rejected with `400 VALIDATION_ERROR` and a `details[].code` of `SPLIT_PAYMENT_MISMATCH`, and ' +
          'persists nothing (no sale, items, payments, or register movement).',
        security: [
          {
            BearerAuth: [],
          },
        ],
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                additionalProperties: true,
                properties: {
                  items: { type: 'array', items: { type: 'object' } },
                  payment_method: {
                    type: 'string',
                    enum: ['Cash', 'Card', 'Other'],
                  },
                  payments: {
                    type: 'array',
                    description:
                      'Split-tender entries. When present, sole source of truth for the tender; ' +
                      'must sum in minor units to the authoritative amount due.',
                    items: {
                      type: 'object',
                      properties: {
                        method: {
                          type: 'string',
                          enum: ['Cash', 'Card', 'Other', 'Gift Card'],
                        },
                        amount: { type: 'number', minimum: 0 },
                      },
                    },
                  },
                },
              },
            },
          },
        },
        responses: {
          '200': {
            description: 'Successful operation',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    success: {
                      type: 'boolean',
                      example: true,
                    },
                    data: {
                      type: 'object',
                      description:
                        'The persisted sale row, additively extended with the confirmed calculation, ' +
                        'authoritative items, and validated payments used to persist it. Every field ' +
                        'present before Unit 4 is unchanged.',
                      properties: {
                        calculation: { $ref: '#/components/schemas/SaleCalculationSnapshot' },
                        items: {
                          type: 'array',
                          description:
                            'Authoritative, server-resolved line prices exactly as persisted.',
                          items: { type: 'object' },
                        },
                        payments: {
                          type: 'array',
                          description:
                            'Validated payment entries exactly as persisted (empty for a non-split sale).',
                          items: {
                            type: 'object',
                            properties: {
                              method: { type: 'string' },
                              amount: { type: 'number' },
                            },
                          },
                        },
                      },
                    },
                  },
                },
              },
            },
          },
          '400': {
            description:
              'Validation error / Bad request. A split-payment mismatch is reported here with ' +
              '`details[].code === "SPLIT_PAYMENT_MISMATCH"`.',
          },
          '401': {
            description: 'Unauthorized / Missing or invalid token',
          },
          '403': {
            description: 'Forbidden / Insufficient role privileges',
          },
          '404': {
            description: 'Resource not found',
          },
          '500': {
            description: 'Internal server error',
          },
        },
      },
    },
    '/api/v1/sales/{id}': {
      get: {
        tags: ['POS Sales'],
        summary: 'Get Sales by ID (Admin, Cashier)',
        description:
          'Endpoint classification: S. Allowed Roles: Admin, Cashier.\n\n' +
          '`data.calculation` is the immutable snapshot persisted at sale time (checkout total-parity ' +
          'plan, Unit 2/4) -- it never depends on settings changed after the sale.',
        security: [
          {
            BearerAuth: [],
          },
        ],
        parameters: [
          {
            name: 'id',
            in: 'path',
            required: true,
            schema: {
              type: 'integer',
            },
            description: 'Target id',
          },
        ],
        responses: {
          '200': {
            description: 'Successful operation',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    success: {
                      type: 'boolean',
                      example: true,
                    },
                    data: {
                      type: 'object',
                      properties: {
                        calculation: { $ref: '#/components/schemas/SaleCalculationSnapshot' },
                        items: { type: 'array', items: { type: 'object' } },
                        payments: { type: 'array', items: { type: 'object' } },
                        refunds: { type: 'array', items: { type: 'object' } },
                      },
                    },
                  },
                },
              },
            },
          },
          '400': {
            description: 'Validation error / Bad request',
          },
          '401': {
            description: 'Unauthorized / Missing or invalid token',
          },
          '403': {
            description: 'Forbidden / Insufficient role privileges',
          },
          '404': {
            description: 'Resource not found',
          },
          '500': {
            description: 'Internal server error',
          },
        },
      },
    },
    '/api/v1/sales/{id}/refund': {
      post: {
        tags: ['POS Sales'],
        summary: 'Create / Submit Sales (Admin, Cashier)',
        description: 'Endpoint classification: M. Allowed Roles: Admin, Cashier.',
        security: [
          {
            BearerAuth: [],
          },
        ],
        parameters: [
          {
            name: 'id',
            in: 'path',
            required: true,
            schema: {
              type: 'integer',
            },
            description: 'Target id',
          },
        ],
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                additionalProperties: true,
              },
            },
          },
        },
        responses: {
          '200': {
            description: 'Successful operation',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    success: {
                      type: 'boolean',
                      example: true,
                    },
                    data: {
                      type: 'object',
                    },
                  },
                },
              },
            },
          },
          '400': {
            description: 'Validation error / Bad request',
          },
          '401': {
            description: 'Unauthorized / Missing or invalid token',
          },
          '403': {
            description: 'Forbidden / Insufficient role privileges',
          },
          '404': {
            description: 'Resource not found',
          },
          '500': {
            description: 'Internal server error',
          },
        },
      },
    },
    '/api/v1/register/current': {
      get: {
        tags: ['POS Register'],
        summary: 'List / Query Register (Admin, Cashier)',
        description: 'Endpoint classification: S. Allowed Roles: Admin, Cashier.',
        security: [
          {
            BearerAuth: [],
          },
        ],
        responses: {
          '200': {
            description: 'Successful operation',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    success: {
                      type: 'boolean',
                      example: true,
                    },
                    data: {
                      type: 'object',
                    },
                  },
                },
              },
            },
          },
          '400': {
            description: 'Validation error / Bad request',
          },
          '401': {
            description: 'Unauthorized / Missing or invalid token',
          },
          '403': {
            description: 'Forbidden / Insufficient role privileges',
          },
          '404': {
            description: 'Resource not found',
          },
          '500': {
            description: 'Internal server error',
          },
        },
      },
    },
    '/api/v1/register/open': {
      post: {
        tags: ['POS Register'],
        summary: 'Create / Submit Register (Admin, Cashier)',
        description: 'Endpoint classification: M. Allowed Roles: Admin, Cashier.',
        security: [
          {
            BearerAuth: [],
          },
        ],
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                additionalProperties: true,
              },
            },
          },
        },
        responses: {
          '200': {
            description: 'Successful operation',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    success: {
                      type: 'boolean',
                      example: true,
                    },
                    data: {
                      type: 'object',
                    },
                  },
                },
              },
            },
          },
          '400': {
            description: 'Validation error / Bad request',
          },
          '401': {
            description: 'Unauthorized / Missing or invalid token',
          },
          '403': {
            description: 'Forbidden / Insufficient role privileges',
          },
          '404': {
            description: 'Resource not found',
          },
          '500': {
            description: 'Internal server error',
          },
        },
      },
    },
    '/api/v1/register/movement': {
      post: {
        tags: ['POS Register'],
        summary: 'Create / Submit Register (Admin, Cashier)',
        description: 'Endpoint classification: M. Allowed Roles: Admin, Cashier.',
        security: [
          {
            BearerAuth: [],
          },
        ],
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                additionalProperties: true,
              },
            },
          },
        },
        responses: {
          '200': {
            description: 'Successful operation',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    success: {
                      type: 'boolean',
                      example: true,
                    },
                    data: {
                      type: 'object',
                    },
                  },
                },
              },
            },
          },
          '400': {
            description: 'Validation error / Bad request',
          },
          '401': {
            description: 'Unauthorized / Missing or invalid token',
          },
          '403': {
            description: 'Forbidden / Insufficient role privileges',
          },
          '404': {
            description: 'Resource not found',
          },
          '500': {
            description: 'Internal server error',
          },
        },
      },
    },
    '/api/v1/register/close': {
      post: {
        tags: ['POS Register'],
        summary: 'Create / Submit Register (Admin, Cashier)',
        description: 'Endpoint classification: M. Allowed Roles: Admin, Cashier.',
        security: [
          {
            BearerAuth: [],
          },
        ],
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                additionalProperties: true,
              },
            },
          },
        },
        responses: {
          '200': {
            description: 'Successful operation',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    success: {
                      type: 'boolean',
                      example: true,
                    },
                    data: {
                      type: 'object',
                    },
                  },
                },
              },
            },
          },
          '400': {
            description: 'Validation error / Bad request',
          },
          '401': {
            description: 'Unauthorized / Missing or invalid token',
          },
          '403': {
            description: 'Forbidden / Insufficient role privileges',
          },
          '404': {
            description: 'Resource not found',
          },
          '500': {
            description: 'Internal server error',
          },
        },
      },
    },
    '/api/v1/register/history': {
      get: {
        tags: ['POS Register'],
        summary: 'List / Query Register (Admin, Cashier)',
        description: 'Endpoint classification: P. Allowed Roles: Admin, Cashier.',
        security: [
          {
            BearerAuth: [],
          },
        ],
        responses: {
          '200': {
            description: 'Successful operation',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    success: {
                      type: 'boolean',
                      example: true,
                    },
                    data: {
                      type: 'object',
                    },
                  },
                },
              },
            },
          },
          '400': {
            description: 'Validation error / Bad request',
          },
          '401': {
            description: 'Unauthorized / Missing or invalid token',
          },
          '403': {
            description: 'Forbidden / Insufficient role privileges',
          },
          '404': {
            description: 'Resource not found',
          },
          '500': {
            description: 'Internal server error',
          },
        },
      },
    },
    '/api/v1/register/{id}/report': {
      get: {
        tags: ['POS Register'],
        summary: 'List / Query Register (Admin, Cashier)',
        description: 'Endpoint classification: S. Allowed Roles: Admin, Cashier.',
        security: [
          {
            BearerAuth: [],
          },
        ],
        parameters: [
          {
            name: 'id',
            in: 'path',
            required: true,
            schema: {
              type: 'integer',
            },
            description: 'Target id',
          },
        ],
        responses: {
          '200': {
            description: 'Successful operation',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    success: {
                      type: 'boolean',
                      example: true,
                    },
                    data: {
                      type: 'object',
                    },
                  },
                },
              },
            },
          },
          '400': {
            description: 'Validation error / Bad request',
          },
          '401': {
            description: 'Unauthorized / Missing or invalid token',
          },
          '403': {
            description: 'Forbidden / Insufficient role privileges',
          },
          '404': {
            description: 'Resource not found',
          },
          '500': {
            description: 'Internal server error',
          },
        },
      },
    },
    '/api/v1/register/{id}/force-close': {
      post: {
        tags: ['POS Register'],
        summary: 'Create / Submit Register (Admin)',
        description: 'Endpoint classification: M. Allowed Roles: Admin.',
        security: [
          {
            BearerAuth: [],
          },
        ],
        parameters: [
          {
            name: 'id',
            in: 'path',
            required: true,
            schema: {
              type: 'integer',
            },
            description: 'Target id',
          },
        ],
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                additionalProperties: true,
              },
            },
          },
        },
        responses: {
          '200': {
            description: 'Successful operation',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    success: {
                      type: 'boolean',
                      example: true,
                    },
                    data: {
                      type: 'object',
                    },
                  },
                },
              },
            },
          },
          '400': {
            description: 'Validation error / Bad request',
          },
          '401': {
            description: 'Unauthorized / Missing or invalid token',
          },
          '403': {
            description: 'Forbidden / Insufficient role privileges',
          },
          '404': {
            description: 'Resource not found',
          },
          '500': {
            description: 'Internal server error',
          },
        },
      },
    },
    '/api/v1/shifts/current': {
      get: {
        tags: ['POS Shifts'],
        summary: 'List / Query Shifts (Admin, Cashier, Delivery)',
        description: 'Endpoint classification: S. Allowed Roles: Admin, Cashier, Delivery.',
        security: [
          {
            BearerAuth: [],
          },
        ],
        responses: {
          '200': {
            description: 'Successful operation',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    success: {
                      type: 'boolean',
                      example: true,
                    },
                    data: {
                      type: 'object',
                    },
                  },
                },
              },
            },
          },
          '400': {
            description: 'Validation error / Bad request',
          },
          '401': {
            description: 'Unauthorized / Missing or invalid token',
          },
          '403': {
            description: 'Forbidden / Insufficient role privileges',
          },
          '404': {
            description: 'Resource not found',
          },
          '500': {
            description: 'Internal server error',
          },
        },
      },
    },
    '/api/v1/shifts/clock-in': {
      post: {
        tags: ['POS Shifts'],
        summary: 'Create / Submit Shifts (Admin, Cashier, Delivery)',
        description: 'Endpoint classification: M. Allowed Roles: Admin, Cashier, Delivery.',
        security: [
          {
            BearerAuth: [],
          },
        ],
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                additionalProperties: true,
              },
            },
          },
        },
        responses: {
          '200': {
            description: 'Successful operation',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    success: {
                      type: 'boolean',
                      example: true,
                    },
                    data: {
                      type: 'object',
                    },
                  },
                },
              },
            },
          },
          '400': {
            description: 'Validation error / Bad request',
          },
          '401': {
            description: 'Unauthorized / Missing or invalid token',
          },
          '403': {
            description: 'Forbidden / Insufficient role privileges',
          },
          '404': {
            description: 'Resource not found',
          },
          '500': {
            description: 'Internal server error',
          },
        },
      },
    },
    '/api/v1/shifts/clock-out': {
      post: {
        tags: ['POS Shifts'],
        summary: 'Create / Submit Shifts (Admin, Cashier, Delivery)',
        description: 'Endpoint classification: M. Allowed Roles: Admin, Cashier, Delivery.',
        security: [
          {
            BearerAuth: [],
          },
        ],
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                additionalProperties: true,
              },
            },
          },
        },
        responses: {
          '200': {
            description: 'Successful operation',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    success: {
                      type: 'boolean',
                      example: true,
                    },
                    data: {
                      type: 'object',
                    },
                  },
                },
              },
            },
          },
          '400': {
            description: 'Validation error / Bad request',
          },
          '401': {
            description: 'Unauthorized / Missing or invalid token',
          },
          '403': {
            description: 'Forbidden / Insufficient role privileges',
          },
          '404': {
            description: 'Resource not found',
          },
          '500': {
            description: 'Internal server error',
          },
        },
      },
    },
    '/api/v1/shifts/break/start': {
      post: {
        tags: ['POS Shifts'],
        summary: 'Create / Submit Shifts (Admin, Cashier, Delivery)',
        description: 'Endpoint classification: M. Allowed Roles: Admin, Cashier, Delivery.',
        security: [
          {
            BearerAuth: [],
          },
        ],
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                additionalProperties: true,
              },
            },
          },
        },
        responses: {
          '200': {
            description: 'Successful operation',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    success: {
                      type: 'boolean',
                      example: true,
                    },
                    data: {
                      type: 'object',
                    },
                  },
                },
              },
            },
          },
          '400': {
            description: 'Validation error / Bad request',
          },
          '401': {
            description: 'Unauthorized / Missing or invalid token',
          },
          '403': {
            description: 'Forbidden / Insufficient role privileges',
          },
          '404': {
            description: 'Resource not found',
          },
          '500': {
            description: 'Internal server error',
          },
        },
      },
    },
    '/api/v1/shifts/break/end': {
      post: {
        tags: ['POS Shifts'],
        summary: 'Create / Submit Shifts (Admin, Cashier, Delivery)',
        description: 'Endpoint classification: M. Allowed Roles: Admin, Cashier, Delivery.',
        security: [
          {
            BearerAuth: [],
          },
        ],
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                additionalProperties: true,
              },
            },
          },
        },
        responses: {
          '200': {
            description: 'Successful operation',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    success: {
                      type: 'boolean',
                      example: true,
                    },
                    data: {
                      type: 'object',
                    },
                  },
                },
              },
            },
          },
          '400': {
            description: 'Validation error / Bad request',
          },
          '401': {
            description: 'Unauthorized / Missing or invalid token',
          },
          '403': {
            description: 'Forbidden / Insufficient role privileges',
          },
          '404': {
            description: 'Resource not found',
          },
          '500': {
            description: 'Internal server error',
          },
        },
      },
    },
    '/api/v1/shifts': {
      get: {
        tags: ['POS Shifts'],
        summary: 'List / Query Shifts (Admin, Cashier)',
        description: 'Endpoint classification: P. Allowed Roles: Admin, Cashier.',
        security: [
          {
            BearerAuth: [],
          },
        ],
        responses: {
          '200': {
            description: 'Successful operation',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    success: {
                      type: 'boolean',
                      example: true,
                    },
                    data: {
                      type: 'object',
                    },
                  },
                },
              },
            },
          },
          '400': {
            description: 'Validation error / Bad request',
          },
          '401': {
            description: 'Unauthorized / Missing or invalid token',
          },
          '403': {
            description: 'Forbidden / Insufficient role privileges',
          },
          '404': {
            description: 'Resource not found',
          },
          '500': {
            description: 'Internal server error',
          },
        },
      },
    },
    '/api/v1/exchanges': {
      post: {
        tags: ['POS Exchanges'],
        summary: 'Create / Submit Exchanges (Admin, Cashier)',
        description: 'Endpoint classification: M. Allowed Roles: Admin, Cashier.',
        security: [
          {
            BearerAuth: [],
          },
        ],
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                additionalProperties: true,
              },
            },
          },
        },
        responses: {
          '200': {
            description: 'Successful operation',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    success: {
                      type: 'boolean',
                      example: true,
                    },
                    data: {
                      type: 'object',
                    },
                  },
                },
              },
            },
          },
          '400': {
            description: 'Validation error / Bad request',
          },
          '401': {
            description: 'Unauthorized / Missing or invalid token',
          },
          '403': {
            description: 'Forbidden / Insufficient role privileges',
          },
          '404': {
            description: 'Resource not found',
          },
          '500': {
            description: 'Internal server error',
          },
        },
      },
      get: {
        tags: ['POS Exchanges'],
        summary: 'List / Query Exchanges (Admin, Cashier)',
        description: 'Endpoint classification: P. Allowed Roles: Admin, Cashier.',
        security: [
          {
            BearerAuth: [],
          },
        ],
        responses: {
          '200': {
            description: 'Successful operation',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    success: {
                      type: 'boolean',
                      example: true,
                    },
                    data: {
                      type: 'object',
                    },
                  },
                },
              },
            },
          },
          '400': {
            description: 'Validation error / Bad request',
          },
          '401': {
            description: 'Unauthorized / Missing or invalid token',
          },
          '403': {
            description: 'Forbidden / Insufficient role privileges',
          },
          '404': {
            description: 'Resource not found',
          },
          '500': {
            description: 'Internal server error',
          },
        },
      },
    },
    '/api/v1/exchanges/{id}': {
      get: {
        tags: ['POS Exchanges'],
        summary: 'Get Exchanges by ID (Admin, Cashier)',
        description: 'Endpoint classification: S. Allowed Roles: Admin, Cashier.',
        security: [
          {
            BearerAuth: [],
          },
        ],
        parameters: [
          {
            name: 'id',
            in: 'path',
            required: true,
            schema: {
              type: 'integer',
            },
            description: 'Target id',
          },
        ],
        responses: {
          '200': {
            description: 'Successful operation',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    success: {
                      type: 'boolean',
                      example: true,
                    },
                    data: {
                      type: 'object',
                    },
                  },
                },
              },
            },
          },
          '400': {
            description: 'Validation error / Bad request',
          },
          '401': {
            description: 'Unauthorized / Missing or invalid token',
          },
          '403': {
            description: 'Forbidden / Insufficient role privileges',
          },
          '404': {
            description: 'Resource not found',
          },
          '500': {
            description: 'Internal server error',
          },
        },
      },
    },
    '/api/v1/layaway': {
      post: {
        tags: ['POS Layaway'],
        summary: 'Create / Submit Layaway (Admin, Cashier)',
        description: 'Endpoint classification: M. Allowed Roles: Admin, Cashier.',
        security: [
          {
            BearerAuth: [],
          },
        ],
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                additionalProperties: true,
              },
            },
          },
        },
        responses: {
          '200': {
            description: 'Successful operation',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    success: {
                      type: 'boolean',
                      example: true,
                    },
                    data: {
                      type: 'object',
                    },
                  },
                },
              },
            },
          },
          '400': {
            description: 'Validation error / Bad request',
          },
          '401': {
            description: 'Unauthorized / Missing or invalid token',
          },
          '403': {
            description: 'Forbidden / Insufficient role privileges',
          },
          '404': {
            description: 'Resource not found',
          },
          '500': {
            description: 'Internal server error',
          },
        },
      },
      get: {
        tags: ['POS Layaway'],
        summary: 'List / Query Layaway (Admin, Cashier)',
        description: 'Endpoint classification: P. Allowed Roles: Admin, Cashier.',
        security: [
          {
            BearerAuth: [],
          },
        ],
        responses: {
          '200': {
            description: 'Successful operation',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    success: {
                      type: 'boolean',
                      example: true,
                    },
                    data: {
                      type: 'object',
                    },
                  },
                },
              },
            },
          },
          '400': {
            description: 'Validation error / Bad request',
          },
          '401': {
            description: 'Unauthorized / Missing or invalid token',
          },
          '403': {
            description: 'Forbidden / Insufficient role privileges',
          },
          '404': {
            description: 'Resource not found',
          },
          '500': {
            description: 'Internal server error',
          },
        },
      },
    },
    '/api/v1/layaway/{id}': {
      get: {
        tags: ['POS Layaway'],
        summary: 'Get Layaway by ID (Admin, Cashier)',
        description: 'Endpoint classification: S. Allowed Roles: Admin, Cashier.',
        security: [
          {
            BearerAuth: [],
          },
        ],
        parameters: [
          {
            name: 'id',
            in: 'path',
            required: true,
            schema: {
              type: 'integer',
            },
            description: 'Target id',
          },
        ],
        responses: {
          '200': {
            description: 'Successful operation',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    success: {
                      type: 'boolean',
                      example: true,
                    },
                    data: {
                      type: 'object',
                    },
                  },
                },
              },
            },
          },
          '400': {
            description: 'Validation error / Bad request',
          },
          '401': {
            description: 'Unauthorized / Missing or invalid token',
          },
          '403': {
            description: 'Forbidden / Insufficient role privileges',
          },
          '404': {
            description: 'Resource not found',
          },
          '500': {
            description: 'Internal server error',
          },
        },
      },
    },
    '/api/v1/layaway/{id}/pay': {
      post: {
        tags: ['POS Layaway'],
        summary: 'Create / Submit Layaway (Admin, Cashier)',
        description: 'Endpoint classification: M. Allowed Roles: Admin, Cashier.',
        security: [
          {
            BearerAuth: [],
          },
        ],
        parameters: [
          {
            name: 'id',
            in: 'path',
            required: true,
            schema: {
              type: 'integer',
            },
            description: 'Target id',
          },
        ],
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                additionalProperties: true,
              },
            },
          },
        },
        responses: {
          '200': {
            description: 'Successful operation',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    success: {
                      type: 'boolean',
                      example: true,
                    },
                    data: {
                      type: 'object',
                    },
                  },
                },
              },
            },
          },
          '400': {
            description: 'Validation error / Bad request',
          },
          '401': {
            description: 'Unauthorized / Missing or invalid token',
          },
          '403': {
            description: 'Forbidden / Insufficient role privileges',
          },
          '404': {
            description: 'Resource not found',
          },
          '500': {
            description: 'Internal server error',
          },
        },
      },
    },
    '/api/v1/layaway/{id}/cancel': {
      post: {
        tags: ['POS Layaway'],
        summary: 'Create / Submit Layaway (Admin, Cashier)',
        description: 'Endpoint classification: M. Allowed Roles: Admin, Cashier.',
        security: [
          {
            BearerAuth: [],
          },
        ],
        parameters: [
          {
            name: 'id',
            in: 'path',
            required: true,
            schema: {
              type: 'integer',
            },
            description: 'Target id',
          },
        ],
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                additionalProperties: true,
              },
            },
          },
        },
        responses: {
          '200': {
            description: 'Successful operation',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    success: {
                      type: 'boolean',
                      example: true,
                    },
                    data: {
                      type: 'object',
                    },
                  },
                },
              },
            },
          },
          '400': {
            description: 'Validation error / Bad request',
          },
          '401': {
            description: 'Unauthorized / Missing or invalid token',
          },
          '403': {
            description: 'Forbidden / Insufficient role privileges',
          },
          '404': {
            description: 'Resource not found',
          },
          '500': {
            description: 'Internal server error',
          },
        },
      },
    },
    '/api/v1/reservations': {
      post: {
        tags: ['POS Reservations'],
        summary: 'Create / Submit Reservations (Admin, Cashier)',
        description: 'Endpoint classification: M. Allowed Roles: Admin, Cashier.',
        security: [
          {
            BearerAuth: [],
          },
        ],
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                additionalProperties: true,
              },
            },
          },
        },
        responses: {
          '200': {
            description: 'Successful operation',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    success: {
                      type: 'boolean',
                      example: true,
                    },
                    data: {
                      type: 'object',
                    },
                  },
                },
              },
            },
          },
          '400': {
            description: 'Validation error / Bad request',
          },
          '401': {
            description: 'Unauthorized / Missing or invalid token',
          },
          '403': {
            description: 'Forbidden / Insufficient role privileges',
          },
          '404': {
            description: 'Resource not found',
          },
          '500': {
            description: 'Internal server error',
          },
        },
      },
    },
    '/api/v1/reservations/{id}': {
      delete: {
        tags: ['POS Reservations'],
        summary: 'Delete Reservations (Admin, Cashier)',
        description: 'Endpoint classification: M. Allowed Roles: Admin, Cashier.',
        security: [
          {
            BearerAuth: [],
          },
        ],
        parameters: [
          {
            name: 'id',
            in: 'path',
            required: true,
            schema: {
              type: 'integer',
            },
            description: 'Target id',
          },
        ],
        responses: {
          '200': {
            description: 'Successful operation',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    success: {
                      type: 'boolean',
                      example: true,
                    },
                    data: {
                      type: 'object',
                    },
                  },
                },
              },
            },
          },
          '400': {
            description: 'Validation error / Bad request',
          },
          '401': {
            description: 'Unauthorized / Missing or invalid token',
          },
          '403': {
            description: 'Forbidden / Insufficient role privileges',
          },
          '404': {
            description: 'Resource not found',
          },
          '500': {
            description: 'Internal server error',
          },
        },
      },
    },
    '/api/v1/reservations/source/{sourceId}': {
      delete: {
        tags: ['POS Reservations'],
        summary: 'Delete Reservations (Admin, Cashier)',
        description: 'Endpoint classification: M. Allowed Roles: Admin, Cashier.',
        security: [
          {
            BearerAuth: [],
          },
        ],
        parameters: [
          {
            name: 'sourceId',
            in: 'path',
            required: true,
            schema: {
              type: 'integer',
            },
            description: 'Target sourceId',
          },
        ],
        responses: {
          '200': {
            description: 'Successful operation',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    success: {
                      type: 'boolean',
                      example: true,
                    },
                    data: {
                      type: 'object',
                    },
                  },
                },
              },
            },
          },
          '400': {
            description: 'Validation error / Bad request',
          },
          '401': {
            description: 'Unauthorized / Missing or invalid token',
          },
          '403': {
            description: 'Forbidden / Insufficient role privileges',
          },
          '404': {
            description: 'Resource not found',
          },
          '500': {
            description: 'Internal server error',
          },
        },
      },
    },
    '/api/v1/products': {
      get: {
        tags: ['Products'],
        summary: 'List / Query Products (Admin, Cashier, Delivery)',
        description: 'Endpoint classification: P. Allowed Roles: Admin, Cashier, Delivery.',
        security: [
          {
            BearerAuth: [],
          },
        ],
        responses: {
          '200': {
            description: 'Successful operation',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    success: {
                      type: 'boolean',
                      example: true,
                    },
                    data: {
                      type: 'object',
                    },
                  },
                },
              },
            },
          },
          '400': {
            description: 'Validation error / Bad request',
          },
          '401': {
            description: 'Unauthorized / Missing or invalid token',
          },
          '403': {
            description: 'Forbidden / Insufficient role privileges',
          },
          '404': {
            description: 'Resource not found',
          },
          '500': {
            description: 'Internal server error',
          },
        },
      },
      post: {
        tags: ['Products'],
        summary: 'Create / Submit Products (Admin)',
        description: 'Endpoint classification: M. Allowed Roles: Admin.',
        security: [
          {
            BearerAuth: [],
          },
        ],
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                additionalProperties: true,
              },
            },
          },
        },
        responses: {
          '200': {
            description: 'Successful operation',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    success: {
                      type: 'boolean',
                      example: true,
                    },
                    data: {
                      type: 'object',
                    },
                  },
                },
              },
            },
          },
          '400': {
            description: 'Validation error / Bad request',
          },
          '401': {
            description: 'Unauthorized / Missing or invalid token',
          },
          '403': {
            description: 'Forbidden / Insufficient role privileges',
          },
          '404': {
            description: 'Resource not found',
          },
          '500': {
            description: 'Internal server error',
          },
        },
      },
    },
    '/api/v1/products/categories': {
      get: {
        tags: ['Products'],
        summary: 'List / Query Products (Admin, Cashier, Delivery)',
        description: 'Endpoint classification: B. Allowed Roles: Admin, Cashier, Delivery.',
        security: [
          {
            BearerAuth: [],
          },
        ],
        responses: {
          '200': {
            description: 'Successful operation',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    success: {
                      type: 'boolean',
                      example: true,
                    },
                    data: {
                      type: 'object',
                    },
                  },
                },
              },
            },
          },
          '400': {
            description: 'Validation error / Bad request',
          },
          '401': {
            description: 'Unauthorized / Missing or invalid token',
          },
          '403': {
            description: 'Forbidden / Insufficient role privileges',
          },
          '404': {
            description: 'Resource not found',
          },
          '500': {
            description: 'Internal server error',
          },
        },
      },
    },
    '/api/v1/products/lookup': {
      get: {
        tags: ['Products'],
        summary: 'List / Query Products (Admin, Cashier, Delivery)',
        description: 'Endpoint classification: B. Allowed Roles: Admin, Cashier, Delivery.',
        security: [
          {
            BearerAuth: [],
          },
        ],
        responses: {
          '200': {
            description: 'Successful operation',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    success: {
                      type: 'boolean',
                      example: true,
                    },
                    data: {
                      type: 'object',
                    },
                  },
                },
              },
            },
          },
          '400': {
            description: 'Validation error / Bad request',
          },
          '401': {
            description: 'Unauthorized / Missing or invalid token',
          },
          '403': {
            description: 'Forbidden / Insufficient role privileges',
          },
          '404': {
            description: 'Resource not found',
          },
          '500': {
            description: 'Internal server error',
          },
        },
      },
    },
    '/api/v1/products/generate-sku/{categoryId}': {
      get: {
        tags: ['Products'],
        summary: 'Get Products by ID (Admin)',
        description: 'Endpoint classification: S. Allowed Roles: Admin.',
        security: [
          {
            BearerAuth: [],
          },
        ],
        parameters: [
          {
            name: 'categoryId',
            in: 'path',
            required: true,
            schema: {
              type: 'integer',
            },
            description: 'Target categoryId',
          },
        ],
        responses: {
          '200': {
            description: 'Successful operation',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    success: {
                      type: 'boolean',
                      example: true,
                    },
                    data: {
                      type: 'object',
                    },
                  },
                },
              },
            },
          },
          '400': {
            description: 'Validation error / Bad request',
          },
          '401': {
            description: 'Unauthorized / Missing or invalid token',
          },
          '403': {
            description: 'Forbidden / Insufficient role privileges',
          },
          '404': {
            description: 'Resource not found',
          },
          '500': {
            description: 'Internal server error',
          },
        },
      },
    },
    '/api/v1/products/generate-barcode': {
      get: {
        tags: ['Products'],
        summary: 'List / Query Products (Admin)',
        description: 'Endpoint classification: S. Allowed Roles: Admin.',
        security: [
          {
            BearerAuth: [],
          },
        ],
        responses: {
          '200': {
            description: 'Successful operation',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    success: {
                      type: 'boolean',
                      example: true,
                    },
                    data: {
                      type: 'object',
                    },
                  },
                },
              },
            },
          },
          '400': {
            description: 'Validation error / Bad request',
          },
          '401': {
            description: 'Unauthorized / Missing or invalid token',
          },
          '403': {
            description: 'Forbidden / Insufficient role privileges',
          },
          '404': {
            description: 'Resource not found',
          },
          '500': {
            description: 'Internal server error',
          },
        },
      },
    },
    '/api/v1/products/barcode/{barcode}': {
      get: {
        tags: ['Products'],
        summary: 'Get Products by ID (Admin, Cashier, Delivery)',
        description: 'Endpoint classification: S. Allowed Roles: Admin, Cashier, Delivery.',
        security: [
          {
            BearerAuth: [],
          },
        ],
        parameters: [
          {
            name: 'barcode',
            in: 'path',
            required: true,
            schema: {
              type: 'string',
            },
            description: 'Target barcode',
          },
        ],
        responses: {
          '200': {
            description: 'Successful operation',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    success: {
                      type: 'boolean',
                      example: true,
                    },
                    data: {
                      type: 'object',
                    },
                  },
                },
              },
            },
          },
          '400': {
            description: 'Validation error / Bad request',
          },
          '401': {
            description: 'Unauthorized / Missing or invalid token',
          },
          '403': {
            description: 'Forbidden / Insufficient role privileges',
          },
          '404': {
            description: 'Resource not found',
          },
          '500': {
            description: 'Internal server error',
          },
        },
      },
    },
    '/api/v1/products/batch-generate-barcodes': {
      post: {
        tags: ['Products'],
        summary: 'Create / Submit Products (Admin)',
        description: 'Endpoint classification: M. Allowed Roles: Admin.',
        security: [
          {
            BearerAuth: [],
          },
        ],
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                additionalProperties: true,
              },
            },
          },
        },
        responses: {
          '200': {
            description: 'Successful operation',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    success: {
                      type: 'boolean',
                      example: true,
                    },
                    data: {
                      type: 'object',
                    },
                  },
                },
              },
            },
          },
          '400': {
            description: 'Validation error / Bad request',
          },
          '401': {
            description: 'Unauthorized / Missing or invalid token',
          },
          '403': {
            description: 'Forbidden / Insufficient role privileges',
          },
          '404': {
            description: 'Resource not found',
          },
          '500': {
            description: 'Internal server error',
          },
        },
      },
    },
    '/api/v1/products/bulk-update': {
      put: {
        tags: ['Products'],
        summary: 'Update Products (Admin)',
        description: 'Endpoint classification: M. Allowed Roles: Admin.',
        security: [
          {
            BearerAuth: [],
          },
        ],
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                additionalProperties: true,
              },
            },
          },
        },
        responses: {
          '200': {
            description: 'Successful operation',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    success: {
                      type: 'boolean',
                      example: true,
                    },
                    data: {
                      type: 'object',
                    },
                  },
                },
              },
            },
          },
          '400': {
            description: 'Validation error / Bad request',
          },
          '401': {
            description: 'Unauthorized / Missing or invalid token',
          },
          '403': {
            description: 'Forbidden / Insufficient role privileges',
          },
          '404': {
            description: 'Resource not found',
          },
          '500': {
            description: 'Internal server error',
          },
        },
      },
    },
    '/api/v1/products/bulk-delete': {
      post: {
        tags: ['Products'],
        summary: 'Create / Submit Products (Admin)',
        description: 'Endpoint classification: M. Allowed Roles: Admin.',
        security: [
          {
            BearerAuth: [],
          },
        ],
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                additionalProperties: true,
              },
            },
          },
        },
        responses: {
          '200': {
            description: 'Successful operation',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    success: {
                      type: 'boolean',
                      example: true,
                    },
                    data: {
                      type: 'object',
                    },
                  },
                },
              },
            },
          },
          '400': {
            description: 'Validation error / Bad request',
          },
          '401': {
            description: 'Unauthorized / Missing or invalid token',
          },
          '403': {
            description: 'Forbidden / Insufficient role privileges',
          },
          '404': {
            description: 'Resource not found',
          },
          '500': {
            description: 'Internal server error',
          },
        },
      },
    },
    '/api/v1/products/import': {
      post: {
        tags: ['Products'],
        summary: 'Create / Submit Products (Admin)',
        description: 'Endpoint classification: M. Allowed Roles: Admin.',
        security: [
          {
            BearerAuth: [],
          },
        ],
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                additionalProperties: true,
              },
            },
          },
        },
        responses: {
          '200': {
            description: 'Successful operation',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    success: {
                      type: 'boolean',
                      example: true,
                    },
                    data: {
                      type: 'object',
                    },
                  },
                },
              },
            },
          },
          '400': {
            description: 'Validation error / Bad request',
          },
          '401': {
            description: 'Unauthorized / Missing or invalid token',
          },
          '403': {
            description: 'Forbidden / Insufficient role privileges',
          },
          '404': {
            description: 'Resource not found',
          },
          '500': {
            description: 'Internal server error',
          },
        },
      },
    },
    '/api/v1/products/{id}': {
      get: {
        tags: ['Products'],
        summary: 'Get Products by ID (Admin, Cashier, Delivery)',
        description: 'Endpoint classification: S. Allowed Roles: Admin, Cashier, Delivery.',
        security: [
          {
            BearerAuth: [],
          },
        ],
        parameters: [
          {
            name: 'id',
            in: 'path',
            required: true,
            schema: {
              type: 'integer',
            },
            description: 'Target id',
          },
        ],
        responses: {
          '200': {
            description: 'Successful operation',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    success: {
                      type: 'boolean',
                      example: true,
                    },
                    data: {
                      type: 'object',
                    },
                  },
                },
              },
            },
          },
          '400': {
            description: 'Validation error / Bad request',
          },
          '401': {
            description: 'Unauthorized / Missing or invalid token',
          },
          '403': {
            description: 'Forbidden / Insufficient role privileges',
          },
          '404': {
            description: 'Resource not found',
          },
          '500': {
            description: 'Internal server error',
          },
        },
      },
      put: {
        tags: ['Products'],
        summary: 'Update Products (Admin)',
        description: 'Endpoint classification: M. Allowed Roles: Admin.',
        security: [
          {
            BearerAuth: [],
          },
        ],
        parameters: [
          {
            name: 'id',
            in: 'path',
            required: true,
            schema: {
              type: 'integer',
            },
            description: 'Target id',
          },
        ],
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                additionalProperties: true,
              },
            },
          },
        },
        responses: {
          '200': {
            description: 'Successful operation',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    success: {
                      type: 'boolean',
                      example: true,
                    },
                    data: {
                      type: 'object',
                    },
                  },
                },
              },
            },
          },
          '400': {
            description: 'Validation error / Bad request',
          },
          '401': {
            description: 'Unauthorized / Missing or invalid token',
          },
          '403': {
            description: 'Forbidden / Insufficient role privileges',
          },
          '404': {
            description: 'Resource not found',
          },
          '500': {
            description: 'Internal server error',
          },
        },
      },
      delete: {
        tags: ['Products'],
        summary: 'Delete Products (Admin)',
        description: 'Endpoint classification: M. Allowed Roles: Admin.',
        security: [
          {
            BearerAuth: [],
          },
        ],
        parameters: [
          {
            name: 'id',
            in: 'path',
            required: true,
            schema: {
              type: 'integer',
            },
            description: 'Target id',
          },
        ],
        responses: {
          '200': {
            description: 'Successful operation',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    success: {
                      type: 'boolean',
                      example: true,
                    },
                    data: {
                      type: 'object',
                    },
                  },
                },
              },
            },
          },
          '400': {
            description: 'Validation error / Bad request',
          },
          '401': {
            description: 'Unauthorized / Missing or invalid token',
          },
          '403': {
            description: 'Forbidden / Insufficient role privileges',
          },
          '404': {
            description: 'Resource not found',
          },
          '500': {
            description: 'Internal server error',
          },
        },
      },
    },
    '/api/v1/products/{id}/status': {
      put: {
        tags: ['Products'],
        summary: 'Update Products (Admin)',
        description: 'Endpoint classification: M. Allowed Roles: Admin.',
        security: [
          {
            BearerAuth: [],
          },
        ],
        parameters: [
          {
            name: 'id',
            in: 'path',
            required: true,
            schema: {
              type: 'integer',
            },
            description: 'Target id',
          },
        ],
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                additionalProperties: true,
              },
            },
          },
        },
        responses: {
          '200': {
            description: 'Successful operation',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    success: {
                      type: 'boolean',
                      example: true,
                    },
                    data: {
                      type: 'object',
                    },
                  },
                },
              },
            },
          },
          '400': {
            description: 'Validation error / Bad request',
          },
          '401': {
            description: 'Unauthorized / Missing or invalid token',
          },
          '403': {
            description: 'Forbidden / Insufficient role privileges',
          },
          '404': {
            description: 'Resource not found',
          },
          '500': {
            description: 'Internal server error',
          },
        },
      },
    },
    '/api/v1/products/{id}/adjust-stock': {
      post: {
        tags: ['Products'],
        summary: 'Create / Submit Products (Admin)',
        description: 'Endpoint classification: M. Allowed Roles: Admin.',
        security: [
          {
            BearerAuth: [],
          },
        ],
        parameters: [
          {
            name: 'id',
            in: 'path',
            required: true,
            schema: {
              type: 'integer',
            },
            description: 'Target id',
          },
        ],
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                additionalProperties: true,
              },
            },
          },
        },
        responses: {
          '200': {
            description: 'Successful operation',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    success: {
                      type: 'boolean',
                      example: true,
                    },
                    data: {
                      type: 'object',
                    },
                  },
                },
              },
            },
          },
          '400': {
            description: 'Validation error / Bad request',
          },
          '401': {
            description: 'Unauthorized / Missing or invalid token',
          },
          '403': {
            description: 'Forbidden / Insufficient role privileges',
          },
          '404': {
            description: 'Resource not found',
          },
          '500': {
            description: 'Internal server error',
          },
        },
      },
    },
    '/api/v1/products/{id}/stock-history': {
      get: {
        tags: ['Products'],
        summary: 'List / Query Products (Admin)',
        description: 'Endpoint classification: P. Allowed Roles: Admin.',
        security: [
          {
            BearerAuth: [],
          },
        ],
        parameters: [
          {
            name: 'id',
            in: 'path',
            required: true,
            schema: {
              type: 'integer',
            },
            description: 'Target id',
          },
        ],
        responses: {
          '200': {
            description: 'Successful operation',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    success: {
                      type: 'boolean',
                      example: true,
                    },
                    data: {
                      type: 'object',
                    },
                  },
                },
              },
            },
          },
          '400': {
            description: 'Validation error / Bad request',
          },
          '401': {
            description: 'Unauthorized / Missing or invalid token',
          },
          '403': {
            description: 'Forbidden / Insufficient role privileges',
          },
          '404': {
            description: 'Resource not found',
          },
          '500': {
            description: 'Internal server error',
          },
        },
      },
    },
    '/api/v1/products/{id}/image': {
      post: {
        tags: ['Products'],
        summary: 'Create / Submit Products (Admin)',
        description: 'Endpoint classification: M. Allowed Roles: Admin.',
        security: [
          {
            BearerAuth: [],
          },
        ],
        parameters: [
          {
            name: 'id',
            in: 'path',
            required: true,
            schema: {
              type: 'integer',
            },
            description: 'Target id',
          },
        ],
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                additionalProperties: true,
              },
            },
          },
        },
        responses: {
          '200': {
            description: 'Successful operation',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    success: {
                      type: 'boolean',
                      example: true,
                    },
                    data: {
                      type: 'object',
                    },
                  },
                },
              },
            },
          },
          '400': {
            description: 'Validation error / Bad request',
          },
          '401': {
            description: 'Unauthorized / Missing or invalid token',
          },
          '403': {
            description: 'Forbidden / Insufficient role privileges',
          },
          '404': {
            description: 'Resource not found',
          },
          '500': {
            description: 'Internal server error',
          },
        },
      },
      delete: {
        tags: ['Products'],
        summary: 'Delete Products (Admin)',
        description: 'Endpoint classification: M. Allowed Roles: Admin.',
        security: [
          {
            BearerAuth: [],
          },
        ],
        parameters: [
          {
            name: 'id',
            in: 'path',
            required: true,
            schema: {
              type: 'integer',
            },
            description: 'Target id',
          },
        ],
        responses: {
          '200': {
            description: 'Successful operation',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    success: {
                      type: 'boolean',
                      example: true,
                    },
                    data: {
                      type: 'object',
                    },
                  },
                },
              },
            },
          },
          '400': {
            description: 'Validation error / Bad request',
          },
          '401': {
            description: 'Unauthorized / Missing or invalid token',
          },
          '403': {
            description: 'Forbidden / Insufficient role privileges',
          },
          '404': {
            description: 'Resource not found',
          },
          '500': {
            description: 'Internal server error',
          },
        },
      },
    },
    '/api/v1/products/{id}/variants': {
      get: {
        tags: ['Products'],
        summary: 'List / Query Products (Admin, Cashier, Delivery)',
        description: 'Endpoint classification: B. Allowed Roles: Admin, Cashier, Delivery.',
        security: [
          {
            BearerAuth: [],
          },
        ],
        parameters: [
          {
            name: 'id',
            in: 'path',
            required: true,
            schema: {
              type: 'integer',
            },
            description: 'Target id',
          },
        ],
        responses: {
          '200': {
            description: 'Successful operation',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    success: {
                      type: 'boolean',
                      example: true,
                    },
                    data: {
                      type: 'object',
                    },
                  },
                },
              },
            },
          },
          '400': {
            description: 'Validation error / Bad request',
          },
          '401': {
            description: 'Unauthorized / Missing or invalid token',
          },
          '403': {
            description: 'Forbidden / Insufficient role privileges',
          },
          '404': {
            description: 'Resource not found',
          },
          '500': {
            description: 'Internal server error',
          },
        },
      },
      post: {
        tags: ['Products'],
        summary: 'Create / Submit Products (Admin)',
        description: 'Endpoint classification: M. Allowed Roles: Admin.',
        security: [
          {
            BearerAuth: [],
          },
        ],
        parameters: [
          {
            name: 'id',
            in: 'path',
            required: true,
            schema: {
              type: 'integer',
            },
            description: 'Target id',
          },
        ],
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                additionalProperties: true,
              },
            },
          },
        },
        responses: {
          '200': {
            description: 'Successful operation',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    success: {
                      type: 'boolean',
                      example: true,
                    },
                    data: {
                      type: 'object',
                    },
                  },
                },
              },
            },
          },
          '400': {
            description: 'Validation error / Bad request',
          },
          '401': {
            description: 'Unauthorized / Missing or invalid token',
          },
          '403': {
            description: 'Forbidden / Insufficient role privileges',
          },
          '404': {
            description: 'Resource not found',
          },
          '500': {
            description: 'Internal server error',
          },
        },
      },
    },
    '/api/v1/products/{id}/variants/{variantId}': {
      put: {
        tags: ['Products'],
        summary: 'Update Products (Admin)',
        description: 'Endpoint classification: M. Allowed Roles: Admin.',
        security: [
          {
            BearerAuth: [],
          },
        ],
        parameters: [
          {
            name: 'id',
            in: 'path',
            required: true,
            schema: {
              type: 'integer',
            },
            description: 'Target id',
          },
          {
            name: 'variantId',
            in: 'path',
            required: true,
            schema: {
              type: 'integer',
            },
            description: 'Target variantId',
          },
        ],
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                additionalProperties: true,
              },
            },
          },
        },
        responses: {
          '200': {
            description: 'Successful operation',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    success: {
                      type: 'boolean',
                      example: true,
                    },
                    data: {
                      type: 'object',
                    },
                  },
                },
              },
            },
          },
          '400': {
            description: 'Validation error / Bad request',
          },
          '401': {
            description: 'Unauthorized / Missing or invalid token',
          },
          '403': {
            description: 'Forbidden / Insufficient role privileges',
          },
          '404': {
            description: 'Resource not found',
          },
          '500': {
            description: 'Internal server error',
          },
        },
      },
      delete: {
        tags: ['Products'],
        summary: 'Delete Products (Admin)',
        description: 'Endpoint classification: M. Allowed Roles: Admin.',
        security: [
          {
            BearerAuth: [],
          },
        ],
        parameters: [
          {
            name: 'id',
            in: 'path',
            required: true,
            schema: {
              type: 'integer',
            },
            description: 'Target id',
          },
          {
            name: 'variantId',
            in: 'path',
            required: true,
            schema: {
              type: 'integer',
            },
            description: 'Target variantId',
          },
        ],
        responses: {
          '200': {
            description: 'Successful operation',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    success: {
                      type: 'boolean',
                      example: true,
                    },
                    data: {
                      type: 'object',
                    },
                  },
                },
              },
            },
          },
          '400': {
            description: 'Validation error / Bad request',
          },
          '401': {
            description: 'Unauthorized / Missing or invalid token',
          },
          '403': {
            description: 'Forbidden / Insufficient role privileges',
          },
          '404': {
            description: 'Resource not found',
          },
          '500': {
            description: 'Internal server error',
          },
        },
      },
    },
    '/api/v1/products/{id}/price-history': {
      get: {
        tags: ['Products'],
        summary: 'List / Query Products (Admin)',
        description: 'Endpoint classification: P. Allowed Roles: Admin.',
        security: [
          {
            BearerAuth: [],
          },
        ],
        parameters: [
          {
            name: 'id',
            in: 'path',
            required: true,
            schema: {
              type: 'integer',
            },
            description: 'Target id',
          },
        ],
        responses: {
          '200': {
            description: 'Successful operation',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    success: {
                      type: 'boolean',
                      example: true,
                    },
                    data: {
                      type: 'object',
                    },
                  },
                },
              },
            },
          },
          '400': {
            description: 'Validation error / Bad request',
          },
          '401': {
            description: 'Unauthorized / Missing or invalid token',
          },
          '403': {
            description: 'Forbidden / Insufficient role privileges',
          },
          '404': {
            description: 'Resource not found',
          },
          '500': {
            description: 'Internal server error',
          },
        },
      },
    },
    '/api/v1/categories': {
      get: {
        tags: ['Categories'],
        summary: 'List / Query Categories (Admin, Cashier, Delivery)',
        description: 'Endpoint classification: B. Allowed Roles: Admin, Cashier, Delivery.',
        security: [
          {
            BearerAuth: [],
          },
        ],
        responses: {
          '200': {
            description: 'Successful operation',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    success: {
                      type: 'boolean',
                      example: true,
                    },
                    data: {
                      type: 'object',
                    },
                  },
                },
              },
            },
          },
          '400': {
            description: 'Validation error / Bad request',
          },
          '401': {
            description: 'Unauthorized / Missing or invalid token',
          },
          '403': {
            description: 'Forbidden / Insufficient role privileges',
          },
          '404': {
            description: 'Resource not found',
          },
          '500': {
            description: 'Internal server error',
          },
        },
      },
      post: {
        tags: ['Categories'],
        summary: 'Create / Submit Categories (Admin)',
        description: 'Endpoint classification: M. Allowed Roles: Admin.',
        security: [
          {
            BearerAuth: [],
          },
        ],
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                additionalProperties: true,
              },
            },
          },
        },
        responses: {
          '200': {
            description: 'Successful operation',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    success: {
                      type: 'boolean',
                      example: true,
                    },
                    data: {
                      type: 'object',
                    },
                  },
                },
              },
            },
          },
          '400': {
            description: 'Validation error / Bad request',
          },
          '401': {
            description: 'Unauthorized / Missing or invalid token',
          },
          '403': {
            description: 'Forbidden / Insufficient role privileges',
          },
          '404': {
            description: 'Resource not found',
          },
          '500': {
            description: 'Internal server error',
          },
        },
      },
    },
    '/api/v1/categories/{id}': {
      put: {
        tags: ['Categories'],
        summary: 'Update Categories (Admin)',
        description: 'Endpoint classification: M. Allowed Roles: Admin.',
        security: [
          {
            BearerAuth: [],
          },
        ],
        parameters: [
          {
            name: 'id',
            in: 'path',
            required: true,
            schema: {
              type: 'integer',
            },
            description: 'Target id',
          },
        ],
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                additionalProperties: true,
              },
            },
          },
        },
        responses: {
          '200': {
            description: 'Successful operation',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    success: {
                      type: 'boolean',
                      example: true,
                    },
                    data: {
                      type: 'object',
                    },
                  },
                },
              },
            },
          },
          '400': {
            description: 'Validation error / Bad request',
          },
          '401': {
            description: 'Unauthorized / Missing or invalid token',
          },
          '403': {
            description: 'Forbidden / Insufficient role privileges',
          },
          '404': {
            description: 'Resource not found',
          },
          '500': {
            description: 'Internal server error',
          },
        },
      },
      delete: {
        tags: ['Categories'],
        summary: 'Delete Categories (Admin)',
        description: 'Endpoint classification: M. Allowed Roles: Admin.',
        security: [
          {
            BearerAuth: [],
          },
        ],
        parameters: [
          {
            name: 'id',
            in: 'path',
            required: true,
            schema: {
              type: 'integer',
            },
            description: 'Target id',
          },
        ],
        responses: {
          '200': {
            description: 'Successful operation',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    success: {
                      type: 'boolean',
                      example: true,
                    },
                    data: {
                      type: 'object',
                    },
                  },
                },
              },
            },
          },
          '400': {
            description: 'Validation error / Bad request',
          },
          '401': {
            description: 'Unauthorized / Missing or invalid token',
          },
          '403': {
            description: 'Forbidden / Insufficient role privileges',
          },
          '404': {
            description: 'Resource not found',
          },
          '500': {
            description: 'Internal server error',
          },
        },
      },
    },
    '/api/v1/distributors': {
      get: {
        tags: ['Distributors'],
        summary: 'List / Query Distributors (Admin, Cashier, Delivery)',
        description: 'Endpoint classification: B. Allowed Roles: Admin, Cashier, Delivery.',
        security: [
          {
            BearerAuth: [],
          },
        ],
        responses: {
          '200': {
            description: 'Successful operation',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    success: {
                      type: 'boolean',
                      example: true,
                    },
                    data: {
                      type: 'object',
                    },
                  },
                },
              },
            },
          },
          '400': {
            description: 'Validation error / Bad request',
          },
          '401': {
            description: 'Unauthorized / Missing or invalid token',
          },
          '403': {
            description: 'Forbidden / Insufficient role privileges',
          },
          '404': {
            description: 'Resource not found',
          },
          '500': {
            description: 'Internal server error',
          },
        },
      },
      post: {
        tags: ['Distributors'],
        summary: 'Create / Submit Distributors (Admin)',
        description: 'Endpoint classification: M. Allowed Roles: Admin.',
        security: [
          {
            BearerAuth: [],
          },
        ],
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                additionalProperties: true,
              },
            },
          },
        },
        responses: {
          '200': {
            description: 'Successful operation',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    success: {
                      type: 'boolean',
                      example: true,
                    },
                    data: {
                      type: 'object',
                    },
                  },
                },
              },
            },
          },
          '400': {
            description: 'Validation error / Bad request',
          },
          '401': {
            description: 'Unauthorized / Missing or invalid token',
          },
          '403': {
            description: 'Forbidden / Insufficient role privileges',
          },
          '404': {
            description: 'Resource not found',
          },
          '500': {
            description: 'Internal server error',
          },
        },
      },
    },
    '/api/v1/distributors/{id}': {
      put: {
        tags: ['Distributors'],
        summary: 'Update Distributors (Admin)',
        description: 'Endpoint classification: M. Allowed Roles: Admin.',
        security: [
          {
            BearerAuth: [],
          },
        ],
        parameters: [
          {
            name: 'id',
            in: 'path',
            required: true,
            schema: {
              type: 'integer',
            },
            description: 'Target id',
          },
        ],
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                additionalProperties: true,
              },
            },
          },
        },
        responses: {
          '200': {
            description: 'Successful operation',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    success: {
                      type: 'boolean',
                      example: true,
                    },
                    data: {
                      type: 'object',
                    },
                  },
                },
              },
            },
          },
          '400': {
            description: 'Validation error / Bad request',
          },
          '401': {
            description: 'Unauthorized / Missing or invalid token',
          },
          '403': {
            description: 'Forbidden / Insufficient role privileges',
          },
          '404': {
            description: 'Resource not found',
          },
          '500': {
            description: 'Internal server error',
          },
        },
      },
      delete: {
        tags: ['Distributors'],
        summary: 'Delete Distributors (Admin)',
        description: 'Endpoint classification: M. Allowed Roles: Admin.',
        security: [
          {
            BearerAuth: [],
          },
        ],
        parameters: [
          {
            name: 'id',
            in: 'path',
            required: true,
            schema: {
              type: 'integer',
            },
            description: 'Target id',
          },
        ],
        responses: {
          '200': {
            description: 'Successful operation',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    success: {
                      type: 'boolean',
                      example: true,
                    },
                    data: {
                      type: 'object',
                    },
                  },
                },
              },
            },
          },
          '400': {
            description: 'Validation error / Bad request',
          },
          '401': {
            description: 'Unauthorized / Missing or invalid token',
          },
          '403': {
            description: 'Forbidden / Insufficient role privileges',
          },
          '404': {
            description: 'Resource not found',
          },
          '500': {
            description: 'Internal server error',
          },
        },
      },
    },
    '/api/v1/stock-counts': {
      get: {
        tags: ['Stock Counts'],
        summary: 'List / Query Stock Counts (Admin)',
        description: 'Endpoint classification: P. Allowed Roles: Admin.',
        security: [
          {
            BearerAuth: [],
          },
        ],
        responses: {
          '200': {
            description: 'Successful operation',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    success: {
                      type: 'boolean',
                      example: true,
                    },
                    data: {
                      type: 'object',
                    },
                  },
                },
              },
            },
          },
          '400': {
            description: 'Validation error / Bad request',
          },
          '401': {
            description: 'Unauthorized / Missing or invalid token',
          },
          '403': {
            description: 'Forbidden / Insufficient role privileges',
          },
          '404': {
            description: 'Resource not found',
          },
          '500': {
            description: 'Internal server error',
          },
        },
      },
      post: {
        tags: ['Stock Counts'],
        summary: 'Create / Submit Stock Counts (Admin)',
        description: 'Endpoint classification: M. Allowed Roles: Admin.',
        security: [
          {
            BearerAuth: [],
          },
        ],
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                additionalProperties: true,
              },
            },
          },
        },
        responses: {
          '200': {
            description: 'Successful operation',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    success: {
                      type: 'boolean',
                      example: true,
                    },
                    data: {
                      type: 'object',
                    },
                  },
                },
              },
            },
          },
          '400': {
            description: 'Validation error / Bad request',
          },
          '401': {
            description: 'Unauthorized / Missing or invalid token',
          },
          '403': {
            description: 'Forbidden / Insufficient role privileges',
          },
          '404': {
            description: 'Resource not found',
          },
          '500': {
            description: 'Internal server error',
          },
        },
      },
    },
    '/api/v1/stock-counts/{id}': {
      get: {
        tags: ['Stock Counts'],
        summary: 'Get Stock Counts by ID (Admin)',
        description: 'Endpoint classification: S. Allowed Roles: Admin.',
        security: [
          {
            BearerAuth: [],
          },
        ],
        parameters: [
          {
            name: 'id',
            in: 'path',
            required: true,
            schema: {
              type: 'integer',
            },
            description: 'Target id',
          },
        ],
        responses: {
          '200': {
            description: 'Successful operation',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    success: {
                      type: 'boolean',
                      example: true,
                    },
                    data: {
                      type: 'object',
                    },
                  },
                },
              },
            },
          },
          '400': {
            description: 'Validation error / Bad request',
          },
          '401': {
            description: 'Unauthorized / Missing or invalid token',
          },
          '403': {
            description: 'Forbidden / Insufficient role privileges',
          },
          '404': {
            description: 'Resource not found',
          },
          '500': {
            description: 'Internal server error',
          },
        },
      },
    },
    '/api/v1/stock-counts/{id}/items/{itemId}': {
      put: {
        tags: ['Stock Counts'],
        summary: 'Update Stock Counts (Admin)',
        description: 'Endpoint classification: M. Allowed Roles: Admin.',
        security: [
          {
            BearerAuth: [],
          },
        ],
        parameters: [
          {
            name: 'id',
            in: 'path',
            required: true,
            schema: {
              type: 'integer',
            },
            description: 'Target id',
          },
          {
            name: 'itemId',
            in: 'path',
            required: true,
            schema: {
              type: 'integer',
            },
            description: 'Target itemId',
          },
        ],
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                additionalProperties: true,
              },
            },
          },
        },
        responses: {
          '200': {
            description: 'Successful operation',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    success: {
                      type: 'boolean',
                      example: true,
                    },
                    data: {
                      type: 'object',
                    },
                  },
                },
              },
            },
          },
          '400': {
            description: 'Validation error / Bad request',
          },
          '401': {
            description: 'Unauthorized / Missing or invalid token',
          },
          '403': {
            description: 'Forbidden / Insufficient role privileges',
          },
          '404': {
            description: 'Resource not found',
          },
          '500': {
            description: 'Internal server error',
          },
        },
      },
    },
    '/api/v1/stock-counts/{id}/complete': {
      post: {
        tags: ['Stock Counts'],
        summary: 'Create / Submit Stock Counts (Admin)',
        description: 'Endpoint classification: M. Allowed Roles: Admin.',
        security: [
          {
            BearerAuth: [],
          },
        ],
        parameters: [
          {
            name: 'id',
            in: 'path',
            required: true,
            schema: {
              type: 'integer',
            },
            description: 'Target id',
          },
        ],
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                additionalProperties: true,
              },
            },
          },
        },
        responses: {
          '200': {
            description: 'Successful operation',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    success: {
                      type: 'boolean',
                      example: true,
                    },
                    data: {
                      type: 'object',
                    },
                  },
                },
              },
            },
          },
          '400': {
            description: 'Validation error / Bad request',
          },
          '401': {
            description: 'Unauthorized / Missing or invalid token',
          },
          '403': {
            description: 'Forbidden / Insufficient role privileges',
          },
          '404': {
            description: 'Resource not found',
          },
          '500': {
            description: 'Internal server error',
          },
        },
      },
    },
    '/api/v1/stock-counts/{id}/cancel': {
      post: {
        tags: ['Stock Counts'],
        summary: 'Create / Submit Stock Counts (Admin)',
        description: 'Endpoint classification: M. Allowed Roles: Admin.',
        security: [
          {
            BearerAuth: [],
          },
        ],
        parameters: [
          {
            name: 'id',
            in: 'path',
            required: true,
            schema: {
              type: 'integer',
            },
            description: 'Target id',
          },
        ],
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                additionalProperties: true,
              },
            },
          },
        },
        responses: {
          '200': {
            description: 'Successful operation',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    success: {
                      type: 'boolean',
                      example: true,
                    },
                    data: {
                      type: 'object',
                    },
                  },
                },
              },
            },
          },
          '400': {
            description: 'Validation error / Bad request',
          },
          '401': {
            description: 'Unauthorized / Missing or invalid token',
          },
          '403': {
            description: 'Forbidden / Insufficient role privileges',
          },
          '404': {
            description: 'Resource not found',
          },
          '500': {
            description: 'Internal server error',
          },
        },
      },
    },
    '/api/v1/stock-adjustments': {
      get: {
        tags: ['Stock Adjustments'],
        summary: 'List / Query Stock Adjustments (Admin)',
        description: 'Endpoint classification: P. Allowed Roles: Admin.',
        security: [
          {
            BearerAuth: [],
          },
        ],
        responses: {
          '200': {
            description: 'Successful operation',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    success: {
                      type: 'boolean',
                      example: true,
                    },
                    data: {
                      type: 'object',
                    },
                  },
                },
              },
            },
          },
          '400': {
            description: 'Validation error / Bad request',
          },
          '401': {
            description: 'Unauthorized / Missing or invalid token',
          },
          '403': {
            description: 'Forbidden / Insufficient role privileges',
          },
          '404': {
            description: 'Resource not found',
          },
          '500': {
            description: 'Internal server error',
          },
        },
      },
    },
    '/api/v1/bundles': {
      get: {
        tags: ['Bundles'],
        summary: 'List / Query Bundles (Admin, Cashier, Delivery)',
        description: 'Endpoint classification: P. Allowed Roles: Admin, Cashier, Delivery.',
        security: [
          {
            BearerAuth: [],
          },
        ],
        responses: {
          '200': {
            description: 'Successful operation',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    success: {
                      type: 'boolean',
                      example: true,
                    },
                    data: {
                      type: 'object',
                    },
                  },
                },
              },
            },
          },
          '400': {
            description: 'Validation error / Bad request',
          },
          '401': {
            description: 'Unauthorized / Missing or invalid token',
          },
          '403': {
            description: 'Forbidden / Insufficient role privileges',
          },
          '404': {
            description: 'Resource not found',
          },
          '500': {
            description: 'Internal server error',
          },
        },
      },
      post: {
        tags: ['Bundles'],
        summary: 'Create / Submit Bundles (Admin)',
        description: 'Endpoint classification: M. Allowed Roles: Admin.',
        security: [
          {
            BearerAuth: [],
          },
        ],
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                additionalProperties: true,
              },
            },
          },
        },
        responses: {
          '200': {
            description: 'Successful operation',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    success: {
                      type: 'boolean',
                      example: true,
                    },
                    data: {
                      type: 'object',
                    },
                  },
                },
              },
            },
          },
          '400': {
            description: 'Validation error / Bad request',
          },
          '401': {
            description: 'Unauthorized / Missing or invalid token',
          },
          '403': {
            description: 'Forbidden / Insufficient role privileges',
          },
          '404': {
            description: 'Resource not found',
          },
          '500': {
            description: 'Internal server error',
          },
        },
      },
    },
    '/api/v1/bundles/{id}': {
      get: {
        tags: ['Bundles'],
        summary: 'Get Bundles by ID (Admin, Cashier, Delivery)',
        description: 'Endpoint classification: S. Allowed Roles: Admin, Cashier, Delivery.',
        security: [
          {
            BearerAuth: [],
          },
        ],
        parameters: [
          {
            name: 'id',
            in: 'path',
            required: true,
            schema: {
              type: 'integer',
            },
            description: 'Target id',
          },
        ],
        responses: {
          '200': {
            description: 'Successful operation',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    success: {
                      type: 'boolean',
                      example: true,
                    },
                    data: {
                      type: 'object',
                    },
                  },
                },
              },
            },
          },
          '400': {
            description: 'Validation error / Bad request',
          },
          '401': {
            description: 'Unauthorized / Missing or invalid token',
          },
          '403': {
            description: 'Forbidden / Insufficient role privileges',
          },
          '404': {
            description: 'Resource not found',
          },
          '500': {
            description: 'Internal server error',
          },
        },
      },
      put: {
        tags: ['Bundles'],
        summary: 'Update Bundles (Admin)',
        description: 'Endpoint classification: M. Allowed Roles: Admin.',
        security: [
          {
            BearerAuth: [],
          },
        ],
        parameters: [
          {
            name: 'id',
            in: 'path',
            required: true,
            schema: {
              type: 'integer',
            },
            description: 'Target id',
          },
        ],
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                additionalProperties: true,
              },
            },
          },
        },
        responses: {
          '200': {
            description: 'Successful operation',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    success: {
                      type: 'boolean',
                      example: true,
                    },
                    data: {
                      type: 'object',
                    },
                  },
                },
              },
            },
          },
          '400': {
            description: 'Validation error / Bad request',
          },
          '401': {
            description: 'Unauthorized / Missing or invalid token',
          },
          '403': {
            description: 'Forbidden / Insufficient role privileges',
          },
          '404': {
            description: 'Resource not found',
          },
          '500': {
            description: 'Internal server error',
          },
        },
      },
      delete: {
        tags: ['Bundles'],
        summary: 'Delete Bundles (Admin)',
        description: 'Endpoint classification: M. Allowed Roles: Admin.',
        security: [
          {
            BearerAuth: [],
          },
        ],
        parameters: [
          {
            name: 'id',
            in: 'path',
            required: true,
            schema: {
              type: 'integer',
            },
            description: 'Target id',
          },
        ],
        responses: {
          '200': {
            description: 'Successful operation',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    success: {
                      type: 'boolean',
                      example: true,
                    },
                    data: {
                      type: 'object',
                    },
                  },
                },
              },
            },
          },
          '400': {
            description: 'Validation error / Bad request',
          },
          '401': {
            description: 'Unauthorized / Missing or invalid token',
          },
          '403': {
            description: 'Forbidden / Insufficient role privileges',
          },
          '404': {
            description: 'Resource not found',
          },
          '500': {
            description: 'Internal server error',
          },
        },
      },
    },
    '/api/v1/collections': {
      get: {
        tags: ['Collections'],
        summary: 'List / Query Collections (Admin, Cashier, Delivery)',
        description: 'Endpoint classification: P. Allowed Roles: Admin, Cashier, Delivery.',
        security: [
          {
            BearerAuth: [],
          },
        ],
        responses: {
          '200': {
            description: 'Successful operation',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    success: {
                      type: 'boolean',
                      example: true,
                    },
                    data: {
                      type: 'object',
                    },
                  },
                },
              },
            },
          },
          '400': {
            description: 'Validation error / Bad request',
          },
          '401': {
            description: 'Unauthorized / Missing or invalid token',
          },
          '403': {
            description: 'Forbidden / Insufficient role privileges',
          },
          '404': {
            description: 'Resource not found',
          },
          '500': {
            description: 'Internal server error',
          },
        },
      },
      post: {
        tags: ['Collections'],
        summary: 'Create / Submit Collections (Admin)',
        description: 'Endpoint classification: M. Allowed Roles: Admin.',
        security: [
          {
            BearerAuth: [],
          },
        ],
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                additionalProperties: true,
              },
            },
          },
        },
        responses: {
          '200': {
            description: 'Successful operation',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    success: {
                      type: 'boolean',
                      example: true,
                    },
                    data: {
                      type: 'object',
                    },
                  },
                },
              },
            },
          },
          '400': {
            description: 'Validation error / Bad request',
          },
          '401': {
            description: 'Unauthorized / Missing or invalid token',
          },
          '403': {
            description: 'Forbidden / Insufficient role privileges',
          },
          '404': {
            description: 'Resource not found',
          },
          '500': {
            description: 'Internal server error',
          },
        },
      },
    },
    '/api/v1/collections/{id}': {
      get: {
        tags: ['Collections'],
        summary: 'Get Collections by ID (Admin, Cashier, Delivery)',
        description: 'Endpoint classification: S. Allowed Roles: Admin, Cashier, Delivery.',
        security: [
          {
            BearerAuth: [],
          },
        ],
        parameters: [
          {
            name: 'id',
            in: 'path',
            required: true,
            schema: {
              type: 'integer',
            },
            description: 'Target id',
          },
        ],
        responses: {
          '200': {
            description: 'Successful operation',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    success: {
                      type: 'boolean',
                      example: true,
                    },
                    data: {
                      type: 'object',
                    },
                  },
                },
              },
            },
          },
          '400': {
            description: 'Validation error / Bad request',
          },
          '401': {
            description: 'Unauthorized / Missing or invalid token',
          },
          '403': {
            description: 'Forbidden / Insufficient role privileges',
          },
          '404': {
            description: 'Resource not found',
          },
          '500': {
            description: 'Internal server error',
          },
        },
      },
      put: {
        tags: ['Collections'],
        summary: 'Update Collections (Admin)',
        description: 'Endpoint classification: M. Allowed Roles: Admin.',
        security: [
          {
            BearerAuth: [],
          },
        ],
        parameters: [
          {
            name: 'id',
            in: 'path',
            required: true,
            schema: {
              type: 'integer',
            },
            description: 'Target id',
          },
        ],
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                additionalProperties: true,
              },
            },
          },
        },
        responses: {
          '200': {
            description: 'Successful operation',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    success: {
                      type: 'boolean',
                      example: true,
                    },
                    data: {
                      type: 'object',
                    },
                  },
                },
              },
            },
          },
          '400': {
            description: 'Validation error / Bad request',
          },
          '401': {
            description: 'Unauthorized / Missing or invalid token',
          },
          '403': {
            description: 'Forbidden / Insufficient role privileges',
          },
          '404': {
            description: 'Resource not found',
          },
          '500': {
            description: 'Internal server error',
          },
        },
      },
      delete: {
        tags: ['Collections'],
        summary: 'Delete Collections (Admin)',
        description: 'Endpoint classification: M. Allowed Roles: Admin.',
        security: [
          {
            BearerAuth: [],
          },
        ],
        parameters: [
          {
            name: 'id',
            in: 'path',
            required: true,
            schema: {
              type: 'integer',
            },
            description: 'Target id',
          },
        ],
        responses: {
          '200': {
            description: 'Successful operation',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    success: {
                      type: 'boolean',
                      example: true,
                    },
                    data: {
                      type: 'object',
                    },
                  },
                },
              },
            },
          },
          '400': {
            description: 'Validation error / Bad request',
          },
          '401': {
            description: 'Unauthorized / Missing or invalid token',
          },
          '403': {
            description: 'Forbidden / Insufficient role privileges',
          },
          '404': {
            description: 'Resource not found',
          },
          '500': {
            description: 'Internal server error',
          },
        },
      },
    },
    '/api/v1/label-templates': {
      get: {
        tags: ['Label Templates'],
        summary: 'List / Query Label Templates (Admin)',
        description: 'Endpoint classification: B. Allowed Roles: Admin.',
        security: [
          {
            BearerAuth: [],
          },
        ],
        responses: {
          '200': {
            description: 'Successful operation',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    success: {
                      type: 'boolean',
                      example: true,
                    },
                    data: {
                      type: 'object',
                    },
                  },
                },
              },
            },
          },
          '400': {
            description: 'Validation error / Bad request',
          },
          '401': {
            description: 'Unauthorized / Missing or invalid token',
          },
          '403': {
            description: 'Forbidden / Insufficient role privileges',
          },
          '404': {
            description: 'Resource not found',
          },
          '500': {
            description: 'Internal server error',
          },
        },
      },
      post: {
        tags: ['Label Templates'],
        summary: 'Create / Submit Label Templates (Admin)',
        description: 'Endpoint classification: M. Allowed Roles: Admin.',
        security: [
          {
            BearerAuth: [],
          },
        ],
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                additionalProperties: true,
              },
            },
          },
        },
        responses: {
          '200': {
            description: 'Successful operation',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    success: {
                      type: 'boolean',
                      example: true,
                    },
                    data: {
                      type: 'object',
                    },
                  },
                },
              },
            },
          },
          '400': {
            description: 'Validation error / Bad request',
          },
          '401': {
            description: 'Unauthorized / Missing or invalid token',
          },
          '403': {
            description: 'Forbidden / Insufficient role privileges',
          },
          '404': {
            description: 'Resource not found',
          },
          '500': {
            description: 'Internal server error',
          },
        },
      },
    },
    '/api/v1/label-templates/{id}': {
      put: {
        tags: ['Label Templates'],
        summary: 'Update Label Templates (Admin)',
        description: 'Endpoint classification: M. Allowed Roles: Admin.',
        security: [
          {
            BearerAuth: [],
          },
        ],
        parameters: [
          {
            name: 'id',
            in: 'path',
            required: true,
            schema: {
              type: 'integer',
            },
            description: 'Target id',
          },
        ],
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                additionalProperties: true,
              },
            },
          },
        },
        responses: {
          '200': {
            description: 'Successful operation',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    success: {
                      type: 'boolean',
                      example: true,
                    },
                    data: {
                      type: 'object',
                    },
                  },
                },
              },
            },
          },
          '400': {
            description: 'Validation error / Bad request',
          },
          '401': {
            description: 'Unauthorized / Missing or invalid token',
          },
          '403': {
            description: 'Forbidden / Insufficient role privileges',
          },
          '404': {
            description: 'Resource not found',
          },
          '500': {
            description: 'Internal server error',
          },
        },
      },
      delete: {
        tags: ['Label Templates'],
        summary: 'Delete Label Templates (Admin)',
        description: 'Endpoint classification: M. Allowed Roles: Admin.',
        security: [
          {
            BearerAuth: [],
          },
        ],
        parameters: [
          {
            name: 'id',
            in: 'path',
            required: true,
            schema: {
              type: 'integer',
            },
            description: 'Target id',
          },
        ],
        responses: {
          '200': {
            description: 'Successful operation',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    success: {
                      type: 'boolean',
                      example: true,
                    },
                    data: {
                      type: 'object',
                    },
                  },
                },
              },
            },
          },
          '400': {
            description: 'Validation error / Bad request',
          },
          '401': {
            description: 'Unauthorized / Missing or invalid token',
          },
          '403': {
            description: 'Forbidden / Insufficient role privileges',
          },
          '404': {
            description: 'Resource not found',
          },
          '500': {
            description: 'Internal server error',
          },
        },
      },
    },
    '/api/v1/customers': {
      get: {
        tags: ['Customers'],
        summary: 'List / Query Customers (Admin, Cashier, Delivery)',
        description: 'Endpoint classification: P. Allowed Roles: Admin, Cashier, Delivery.',
        security: [
          {
            BearerAuth: [],
          },
        ],
        responses: {
          '200': {
            description: 'Successful operation',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    success: {
                      type: 'boolean',
                      example: true,
                    },
                    data: {
                      type: 'object',
                    },
                  },
                },
              },
            },
          },
          '400': {
            description: 'Validation error / Bad request',
          },
          '401': {
            description: 'Unauthorized / Missing or invalid token',
          },
          '403': {
            description: 'Forbidden / Insufficient role privileges',
          },
          '404': {
            description: 'Resource not found',
          },
          '500': {
            description: 'Internal server error',
          },
        },
      },
      post: {
        tags: ['Customers'],
        summary: 'Create / Submit Customers (Admin, Cashier, Delivery)',
        description: 'Endpoint classification: M. Allowed Roles: Admin, Cashier, Delivery.',
        security: [
          {
            BearerAuth: [],
          },
        ],
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                additionalProperties: true,
              },
            },
          },
        },
        responses: {
          '200': {
            description: 'Successful operation',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    success: {
                      type: 'boolean',
                      example: true,
                    },
                    data: {
                      type: 'object',
                    },
                  },
                },
              },
            },
          },
          '400': {
            description: 'Validation error / Bad request',
          },
          '401': {
            description: 'Unauthorized / Missing or invalid token',
          },
          '403': {
            description: 'Forbidden / Insufficient role privileges',
          },
          '404': {
            description: 'Resource not found',
          },
          '500': {
            description: 'Internal server error',
          },
        },
      },
    },
    '/api/v1/customers/{id}': {
      get: {
        tags: ['Customers'],
        summary: 'Get Customers by ID (Admin, Cashier, Delivery)',
        description: 'Endpoint classification: S. Allowed Roles: Admin, Cashier, Delivery.',
        security: [
          {
            BearerAuth: [],
          },
        ],
        parameters: [
          {
            name: 'id',
            in: 'path',
            required: true,
            schema: {
              type: 'integer',
            },
            description: 'Target id',
          },
        ],
        responses: {
          '200': {
            description: 'Successful operation',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    success: {
                      type: 'boolean',
                      example: true,
                    },
                    data: {
                      type: 'object',
                    },
                  },
                },
              },
            },
          },
          '400': {
            description: 'Validation error / Bad request',
          },
          '401': {
            description: 'Unauthorized / Missing or invalid token',
          },
          '403': {
            description: 'Forbidden / Insufficient role privileges',
          },
          '404': {
            description: 'Resource not found',
          },
          '500': {
            description: 'Internal server error',
          },
        },
      },
      put: {
        tags: ['Customers'],
        summary: 'Update Customers (Admin, Cashier, Delivery)',
        description: 'Endpoint classification: M. Allowed Roles: Admin, Cashier, Delivery.',
        security: [
          {
            BearerAuth: [],
          },
        ],
        parameters: [
          {
            name: 'id',
            in: 'path',
            required: true,
            schema: {
              type: 'integer',
            },
            description: 'Target id',
          },
        ],
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                additionalProperties: true,
              },
            },
          },
        },
        responses: {
          '200': {
            description: 'Successful operation',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    success: {
                      type: 'boolean',
                      example: true,
                    },
                    data: {
                      type: 'object',
                    },
                  },
                },
              },
            },
          },
          '400': {
            description: 'Validation error / Bad request',
          },
          '401': {
            description: 'Unauthorized / Missing or invalid token',
          },
          '403': {
            description: 'Forbidden / Insufficient role privileges',
          },
          '404': {
            description: 'Resource not found',
          },
          '500': {
            description: 'Internal server error',
          },
        },
      },
      delete: {
        tags: ['Customers'],
        summary: 'Delete Customers (Admin)',
        description: 'Endpoint classification: M. Allowed Roles: Admin.',
        security: [
          {
            BearerAuth: [],
          },
        ],
        parameters: [
          {
            name: 'id',
            in: 'path',
            required: true,
            schema: {
              type: 'integer',
            },
            description: 'Target id',
          },
        ],
        responses: {
          '200': {
            description: 'Successful operation',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    success: {
                      type: 'boolean',
                      example: true,
                    },
                    data: {
                      type: 'object',
                    },
                  },
                },
              },
            },
          },
          '400': {
            description: 'Validation error / Bad request',
          },
          '401': {
            description: 'Unauthorized / Missing or invalid token',
          },
          '403': {
            description: 'Forbidden / Insufficient role privileges',
          },
          '404': {
            description: 'Resource not found',
          },
          '500': {
            description: 'Internal server error',
          },
        },
      },
    },
    '/api/v1/customers/{id}/stats': {
      get: {
        tags: ['Customers'],
        summary: 'Get Customers metrics and summary (Admin, Cashier, Delivery)',
        description: 'Endpoint classification: S. Allowed Roles: Admin, Cashier, Delivery.',
        security: [
          {
            BearerAuth: [],
          },
        ],
        parameters: [
          {
            name: 'id',
            in: 'path',
            required: true,
            schema: {
              type: 'integer',
            },
            description: 'Target id',
          },
        ],
        responses: {
          '200': {
            description: 'Successful operation',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    success: {
                      type: 'boolean',
                      example: true,
                    },
                    data: {
                      type: 'object',
                    },
                  },
                },
              },
            },
          },
          '400': {
            description: 'Validation error / Bad request',
          },
          '401': {
            description: 'Unauthorized / Missing or invalid token',
          },
          '403': {
            description: 'Forbidden / Insufficient role privileges',
          },
          '404': {
            description: 'Resource not found',
          },
          '500': {
            description: 'Internal server error',
          },
        },
      },
    },
    '/api/v1/customers/{id}/sales': {
      get: {
        tags: ['Customers'],
        summary: 'List / Query Customers (Admin, Cashier, Delivery)',
        description: 'Endpoint classification: P. Allowed Roles: Admin, Cashier, Delivery.',
        security: [
          {
            BearerAuth: [],
          },
        ],
        parameters: [
          {
            name: 'id',
            in: 'path',
            required: true,
            schema: {
              type: 'integer',
            },
            description: 'Target id',
          },
        ],
        responses: {
          '200': {
            description: 'Successful operation',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    success: {
                      type: 'boolean',
                      example: true,
                    },
                    data: {
                      type: 'object',
                    },
                  },
                },
              },
            },
          },
          '400': {
            description: 'Validation error / Bad request',
          },
          '401': {
            description: 'Unauthorized / Missing or invalid token',
          },
          '403': {
            description: 'Forbidden / Insufficient role privileges',
          },
          '404': {
            description: 'Resource not found',
          },
          '500': {
            description: 'Internal server error',
          },
        },
      },
    },
    '/api/v1/customers/{id}/loyalty': {
      get: {
        tags: ['Customers'],
        summary: 'List / Query Customers (Admin, Cashier, Delivery)',
        description: 'Endpoint classification: S. Allowed Roles: Admin, Cashier, Delivery.',
        security: [
          {
            BearerAuth: [],
          },
        ],
        parameters: [
          {
            name: 'id',
            in: 'path',
            required: true,
            schema: {
              type: 'integer',
            },
            description: 'Target id',
          },
        ],
        responses: {
          '200': {
            description: 'Successful operation',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    success: {
                      type: 'boolean',
                      example: true,
                    },
                    data: {
                      type: 'object',
                    },
                  },
                },
              },
            },
          },
          '400': {
            description: 'Validation error / Bad request',
          },
          '401': {
            description: 'Unauthorized / Missing or invalid token',
          },
          '403': {
            description: 'Forbidden / Insufficient role privileges',
          },
          '404': {
            description: 'Resource not found',
          },
          '500': {
            description: 'Internal server error',
          },
        },
      },
    },
    '/api/v1/customers/{id}/loyalty/adjust': {
      post: {
        tags: ['Customers'],
        summary: 'Create / Submit Customers (Admin)',
        description: 'Endpoint classification: M. Allowed Roles: Admin.',
        security: [
          {
            BearerAuth: [],
          },
        ],
        parameters: [
          {
            name: 'id',
            in: 'path',
            required: true,
            schema: {
              type: 'integer',
            },
            description: 'Target id',
          },
        ],
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                additionalProperties: true,
              },
            },
          },
        },
        responses: {
          '200': {
            description: 'Successful operation',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    success: {
                      type: 'boolean',
                      example: true,
                    },
                    data: {
                      type: 'object',
                    },
                  },
                },
              },
            },
          },
          '400': {
            description: 'Validation error / Bad request',
          },
          '401': {
            description: 'Unauthorized / Missing or invalid token',
          },
          '403': {
            description: 'Forbidden / Insufficient role privileges',
          },
          '404': {
            description: 'Resource not found',
          },
          '500': {
            description: 'Internal server error',
          },
        },
      },
    },
    '/api/v1/coupons': {
      get: {
        tags: ['Coupons'],
        summary: 'List / Query Coupons (Admin, Cashier, Delivery)',
        description: 'Endpoint classification: P. Allowed Roles: Admin, Cashier, Delivery.',
        security: [
          {
            BearerAuth: [],
          },
        ],
        responses: {
          '200': {
            description: 'Successful operation',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    success: {
                      type: 'boolean',
                      example: true,
                    },
                    data: {
                      type: 'object',
                    },
                  },
                },
              },
            },
          },
          '400': {
            description: 'Validation error / Bad request',
          },
          '401': {
            description: 'Unauthorized / Missing or invalid token',
          },
          '403': {
            description: 'Forbidden / Insufficient role privileges',
          },
          '404': {
            description: 'Resource not found',
          },
          '500': {
            description: 'Internal server error',
          },
        },
      },
      post: {
        tags: ['Coupons'],
        summary: 'Create / Submit Coupons (Admin)',
        description: 'Endpoint classification: M. Allowed Roles: Admin.',
        security: [
          {
            BearerAuth: [],
          },
        ],
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                additionalProperties: true,
              },
            },
          },
        },
        responses: {
          '200': {
            description: 'Successful operation',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    success: {
                      type: 'boolean',
                      example: true,
                    },
                    data: {
                      type: 'object',
                    },
                  },
                },
              },
            },
          },
          '400': {
            description: 'Validation error / Bad request',
          },
          '401': {
            description: 'Unauthorized / Missing or invalid token',
          },
          '403': {
            description: 'Forbidden / Insufficient role privileges',
          },
          '404': {
            description: 'Resource not found',
          },
          '500': {
            description: 'Internal server error',
          },
        },
      },
    },
    '/api/v1/coupons/validate': {
      post: {
        tags: ['Coupons'],
        summary: 'Create / Submit Coupons (Admin, Cashier, Delivery)',
        description: 'Endpoint classification: M. Allowed Roles: Admin, Cashier, Delivery.',
        security: [
          {
            BearerAuth: [],
          },
        ],
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                additionalProperties: true,
              },
            },
          },
        },
        responses: {
          '200': {
            description: 'Successful operation',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    success: {
                      type: 'boolean',
                      example: true,
                    },
                    data: {
                      type: 'object',
                    },
                  },
                },
              },
            },
          },
          '400': {
            description: 'Validation error / Bad request',
          },
          '401': {
            description: 'Unauthorized / Missing or invalid token',
          },
          '403': {
            description: 'Forbidden / Insufficient role privileges',
          },
          '404': {
            description: 'Resource not found',
          },
          '500': {
            description: 'Internal server error',
          },
        },
      },
    },
    '/api/v1/coupons/{id}': {
      put: {
        tags: ['Coupons'],
        summary: 'Update Coupons (Admin)',
        description: 'Endpoint classification: M. Allowed Roles: Admin.',
        security: [
          {
            BearerAuth: [],
          },
        ],
        parameters: [
          {
            name: 'id',
            in: 'path',
            required: true,
            schema: {
              type: 'integer',
            },
            description: 'Target id',
          },
        ],
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                additionalProperties: true,
              },
            },
          },
        },
        responses: {
          '200': {
            description: 'Successful operation',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    success: {
                      type: 'boolean',
                      example: true,
                    },
                    data: {
                      type: 'object',
                    },
                  },
                },
              },
            },
          },
          '400': {
            description: 'Validation error / Bad request',
          },
          '401': {
            description: 'Unauthorized / Missing or invalid token',
          },
          '403': {
            description: 'Forbidden / Insufficient role privileges',
          },
          '404': {
            description: 'Resource not found',
          },
          '500': {
            description: 'Internal server error',
          },
        },
      },
      delete: {
        tags: ['Coupons'],
        summary: 'Delete Coupons (Admin)',
        description: 'Endpoint classification: M. Allowed Roles: Admin.',
        security: [
          {
            BearerAuth: [],
          },
        ],
        parameters: [
          {
            name: 'id',
            in: 'path',
            required: true,
            schema: {
              type: 'integer',
            },
            description: 'Target id',
          },
        ],
        responses: {
          '200': {
            description: 'Successful operation',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    success: {
                      type: 'boolean',
                      example: true,
                    },
                    data: {
                      type: 'object',
                    },
                  },
                },
              },
            },
          },
          '400': {
            description: 'Validation error / Bad request',
          },
          '401': {
            description: 'Unauthorized / Missing or invalid token',
          },
          '403': {
            description: 'Forbidden / Insufficient role privileges',
          },
          '404': {
            description: 'Resource not found',
          },
          '500': {
            description: 'Internal server error',
          },
        },
      },
    },
    '/api/v1/gift-cards': {
      get: {
        tags: ['Gift Cards'],
        summary: 'List / Query Gift Cards (Admin, Cashier, Delivery)',
        description: 'Endpoint classification: P. Allowed Roles: Admin, Cashier, Delivery.',
        security: [
          {
            BearerAuth: [],
          },
        ],
        responses: {
          '200': {
            description: 'Successful operation',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    success: {
                      type: 'boolean',
                      example: true,
                    },
                    data: {
                      type: 'object',
                    },
                  },
                },
              },
            },
          },
          '400': {
            description: 'Validation error / Bad request',
          },
          '401': {
            description: 'Unauthorized / Missing or invalid token',
          },
          '403': {
            description: 'Forbidden / Insufficient role privileges',
          },
          '404': {
            description: 'Resource not found',
          },
          '500': {
            description: 'Internal server error',
          },
        },
      },
      post: {
        tags: ['Gift Cards'],
        summary: 'Create / Submit Gift Cards (Admin, Cashier)',
        description: 'Endpoint classification: M. Allowed Roles: Admin, Cashier.',
        security: [
          {
            BearerAuth: [],
          },
        ],
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                additionalProperties: true,
              },
            },
          },
        },
        responses: {
          '200': {
            description: 'Successful operation',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    success: {
                      type: 'boolean',
                      example: true,
                    },
                    data: {
                      type: 'object',
                    },
                  },
                },
              },
            },
          },
          '400': {
            description: 'Validation error / Bad request',
          },
          '401': {
            description: 'Unauthorized / Missing or invalid token',
          },
          '403': {
            description: 'Forbidden / Insufficient role privileges',
          },
          '404': {
            description: 'Resource not found',
          },
          '500': {
            description: 'Internal server error',
          },
        },
      },
    },
    '/api/v1/gift-cards/{code}/balance': {
      get: {
        tags: ['Gift Cards'],
        summary: 'List / Query Gift Cards (Admin, Cashier, Delivery)',
        description: 'Endpoint classification: S. Allowed Roles: Admin, Cashier, Delivery.',
        security: [
          {
            BearerAuth: [],
          },
        ],
        parameters: [
          {
            name: 'code',
            in: 'path',
            required: true,
            schema: {
              type: 'string',
            },
            description: 'Target code',
          },
        ],
        responses: {
          '200': {
            description: 'Successful operation',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    success: {
                      type: 'boolean',
                      example: true,
                    },
                    data: {
                      type: 'object',
                    },
                  },
                },
              },
            },
          },
          '400': {
            description: 'Validation error / Bad request',
          },
          '401': {
            description: 'Unauthorized / Missing or invalid token',
          },
          '403': {
            description: 'Forbidden / Insufficient role privileges',
          },
          '404': {
            description: 'Resource not found',
          },
          '500': {
            description: 'Internal server error',
          },
        },
      },
    },
    '/api/v1/gift-cards/{code}/redeem': {
      post: {
        tags: ['Gift Cards'],
        summary: 'Create / Submit Gift Cards (Admin, Cashier)',
        description: 'Endpoint classification: M. Allowed Roles: Admin, Cashier.',
        security: [
          {
            BearerAuth: [],
          },
        ],
        parameters: [
          {
            name: 'code',
            in: 'path',
            required: true,
            schema: {
              type: 'string',
            },
            description: 'Target code',
          },
        ],
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                additionalProperties: true,
              },
            },
          },
        },
        responses: {
          '200': {
            description: 'Successful operation',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    success: {
                      type: 'boolean',
                      example: true,
                    },
                    data: {
                      type: 'object',
                    },
                  },
                },
              },
            },
          },
          '400': {
            description: 'Validation error / Bad request',
          },
          '401': {
            description: 'Unauthorized / Missing or invalid token',
          },
          '403': {
            description: 'Forbidden / Insufficient role privileges',
          },
          '404': {
            description: 'Resource not found',
          },
          '500': {
            description: 'Internal server error',
          },
        },
      },
    },
    '/api/v1/gift-cards/{id}/transactions': {
      get: {
        tags: ['Gift Cards'],
        summary: 'List / Query Gift Cards (Admin, Cashier, Delivery)',
        description: 'Endpoint classification: P. Allowed Roles: Admin, Cashier, Delivery.',
        security: [
          {
            BearerAuth: [],
          },
        ],
        parameters: [
          {
            name: 'id',
            in: 'path',
            required: true,
            schema: {
              type: 'integer',
            },
            description: 'Target id',
          },
        ],
        responses: {
          '200': {
            description: 'Successful operation',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    success: {
                      type: 'boolean',
                      example: true,
                    },
                    data: {
                      type: 'object',
                    },
                  },
                },
              },
            },
          },
          '400': {
            description: 'Validation error / Bad request',
          },
          '401': {
            description: 'Unauthorized / Missing or invalid token',
          },
          '403': {
            description: 'Forbidden / Insufficient role privileges',
          },
          '404': {
            description: 'Resource not found',
          },
          '500': {
            description: 'Internal server error',
          },
        },
      },
    },
    '/api/v1/gift-cards/{id}': {
      put: {
        tags: ['Gift Cards'],
        summary: 'Update Gift Cards (Admin)',
        description: 'Endpoint classification: M. Allowed Roles: Admin.',
        security: [
          {
            BearerAuth: [],
          },
        ],
        parameters: [
          {
            name: 'id',
            in: 'path',
            required: true,
            schema: {
              type: 'integer',
            },
            description: 'Target id',
          },
        ],
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                additionalProperties: true,
              },
            },
          },
        },
        responses: {
          '200': {
            description: 'Successful operation',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    success: {
                      type: 'boolean',
                      example: true,
                    },
                    data: {
                      type: 'object',
                    },
                  },
                },
              },
            },
          },
          '400': {
            description: 'Validation error / Bad request',
          },
          '401': {
            description: 'Unauthorized / Missing or invalid token',
          },
          '403': {
            description: 'Forbidden / Insufficient role privileges',
          },
          '404': {
            description: 'Resource not found',
          },
          '500': {
            description: 'Internal server error',
          },
        },
      },
    },
    '/api/v1/feedback': {
      post: {
        tags: ['Customer Feedback'],
        summary: 'Create / Submit Customer Feedback (Admin, Cashier, Delivery)',
        description: 'Endpoint classification: M. Allowed Roles: Admin, Cashier, Delivery.',
        security: [
          {
            BearerAuth: [],
          },
        ],
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                additionalProperties: true,
              },
            },
          },
        },
        responses: {
          '200': {
            description: 'Successful operation',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    success: {
                      type: 'boolean',
                      example: true,
                    },
                    data: {
                      type: 'object',
                    },
                  },
                },
              },
            },
          },
          '400': {
            description: 'Validation error / Bad request',
          },
          '401': {
            description: 'Unauthorized / Missing or invalid token',
          },
          '403': {
            description: 'Forbidden / Insufficient role privileges',
          },
          '404': {
            description: 'Resource not found',
          },
          '500': {
            description: 'Internal server error',
          },
        },
      },
      get: {
        tags: ['Customer Feedback'],
        summary: 'List / Query Customer Feedback (Admin)',
        description: 'Endpoint classification: P. Allowed Roles: Admin.',
        security: [
          {
            BearerAuth: [],
          },
        ],
        responses: {
          '200': {
            description: 'Successful operation',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    success: {
                      type: 'boolean',
                      example: true,
                    },
                    data: {
                      type: 'object',
                    },
                  },
                },
              },
            },
          },
          '400': {
            description: 'Validation error / Bad request',
          },
          '401': {
            description: 'Unauthorized / Missing or invalid token',
          },
          '403': {
            description: 'Forbidden / Insufficient role privileges',
          },
          '404': {
            description: 'Resource not found',
          },
          '500': {
            description: 'Internal server error',
          },
        },
      },
    },
    '/api/v1/segments': {
      get: {
        tags: ['Customer Segments'],
        summary: 'List / Query Customer Segments (Admin)',
        description: 'Endpoint classification: B. Allowed Roles: Admin.',
        security: [
          {
            BearerAuth: [],
          },
        ],
        responses: {
          '200': {
            description: 'Successful operation',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    success: {
                      type: 'boolean',
                      example: true,
                    },
                    data: {
                      type: 'object',
                    },
                  },
                },
              },
            },
          },
          '400': {
            description: 'Validation error / Bad request',
          },
          '401': {
            description: 'Unauthorized / Missing or invalid token',
          },
          '403': {
            description: 'Forbidden / Insufficient role privileges',
          },
          '404': {
            description: 'Resource not found',
          },
          '500': {
            description: 'Internal server error',
          },
        },
      },
      post: {
        tags: ['Customer Segments'],
        summary: 'Create / Submit Customer Segments (Admin)',
        description: 'Endpoint classification: M. Allowed Roles: Admin.',
        security: [
          {
            BearerAuth: [],
          },
        ],
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                additionalProperties: true,
              },
            },
          },
        },
        responses: {
          '200': {
            description: 'Successful operation',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    success: {
                      type: 'boolean',
                      example: true,
                    },
                    data: {
                      type: 'object',
                    },
                  },
                },
              },
            },
          },
          '400': {
            description: 'Validation error / Bad request',
          },
          '401': {
            description: 'Unauthorized / Missing or invalid token',
          },
          '403': {
            description: 'Forbidden / Insufficient role privileges',
          },
          '404': {
            description: 'Resource not found',
          },
          '500': {
            description: 'Internal server error',
          },
        },
      },
    },
    '/api/v1/segments/{id}': {
      put: {
        tags: ['Customer Segments'],
        summary: 'Update Customer Segments (Admin)',
        description: 'Endpoint classification: M. Allowed Roles: Admin.',
        security: [
          {
            BearerAuth: [],
          },
        ],
        parameters: [
          {
            name: 'id',
            in: 'path',
            required: true,
            schema: {
              type: 'integer',
            },
            description: 'Target id',
          },
        ],
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                additionalProperties: true,
              },
            },
          },
        },
        responses: {
          '200': {
            description: 'Successful operation',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    success: {
                      type: 'boolean',
                      example: true,
                    },
                    data: {
                      type: 'object',
                    },
                  },
                },
              },
            },
          },
          '400': {
            description: 'Validation error / Bad request',
          },
          '401': {
            description: 'Unauthorized / Missing or invalid token',
          },
          '403': {
            description: 'Forbidden / Insufficient role privileges',
          },
          '404': {
            description: 'Resource not found',
          },
          '500': {
            description: 'Internal server error',
          },
        },
      },
      delete: {
        tags: ['Customer Segments'],
        summary: 'Delete Customer Segments (Admin)',
        description: 'Endpoint classification: M. Allowed Roles: Admin.',
        security: [
          {
            BearerAuth: [],
          },
        ],
        parameters: [
          {
            name: 'id',
            in: 'path',
            required: true,
            schema: {
              type: 'integer',
            },
            description: 'Target id',
          },
        ],
        responses: {
          '200': {
            description: 'Successful operation',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    success: {
                      type: 'boolean',
                      example: true,
                    },
                    data: {
                      type: 'object',
                    },
                  },
                },
              },
            },
          },
          '400': {
            description: 'Validation error / Bad request',
          },
          '401': {
            description: 'Unauthorized / Missing or invalid token',
          },
          '403': {
            description: 'Forbidden / Insufficient role privileges',
          },
          '404': {
            description: 'Resource not found',
          },
          '500': {
            description: 'Internal server error',
          },
        },
      },
    },
    '/api/v1/storefront/banners': {
      get: {
        tags: ['Storefront'],
        summary: 'List / Query Storefront (Public)',
        description: 'Endpoint classification: B. Allowed Roles: Public.',
        security: [],
        responses: {
          '200': {
            description: 'Successful operation',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    success: {
                      type: 'boolean',
                      example: true,
                    },
                    data: {
                      type: 'object',
                    },
                  },
                },
              },
            },
          },
          '400': {
            description: 'Validation error / Bad request',
          },
          '401': {
            description: 'Unauthorized / Missing or invalid token',
          },
          '403': {
            description: 'Forbidden / Insufficient role privileges',
          },
          '404': {
            description: 'Resource not found',
          },
          '500': {
            description: 'Internal server error',
          },
        },
      },
      post: {
        tags: ['Storefront'],
        summary: 'Create / Submit Storefront (Admin)',
        description: 'Endpoint classification: M. Allowed Roles: Admin.',
        security: [
          {
            BearerAuth: [],
          },
        ],
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                additionalProperties: true,
              },
            },
          },
        },
        responses: {
          '200': {
            description: 'Successful operation',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    success: {
                      type: 'boolean',
                      example: true,
                    },
                    data: {
                      type: 'object',
                    },
                  },
                },
              },
            },
          },
          '400': {
            description: 'Validation error / Bad request',
          },
          '401': {
            description: 'Unauthorized / Missing or invalid token',
          },
          '403': {
            description: 'Forbidden / Insufficient role privileges',
          },
          '404': {
            description: 'Resource not found',
          },
          '500': {
            description: 'Internal server error',
          },
        },
      },
    },
    '/api/v1/storefront/banners/all': {
      get: {
        tags: ['Storefront'],
        summary: 'List / Query Storefront (Admin)',
        description: 'Endpoint classification: P. Allowed Roles: Admin.',
        security: [
          {
            BearerAuth: [],
          },
        ],
        responses: {
          '200': {
            description: 'Successful operation',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    success: {
                      type: 'boolean',
                      example: true,
                    },
                    data: {
                      type: 'object',
                    },
                  },
                },
              },
            },
          },
          '400': {
            description: 'Validation error / Bad request',
          },
          '401': {
            description: 'Unauthorized / Missing or invalid token',
          },
          '403': {
            description: 'Forbidden / Insufficient role privileges',
          },
          '404': {
            description: 'Resource not found',
          },
          '500': {
            description: 'Internal server error',
          },
        },
      },
    },
    '/api/v1/storefront/banners/{id}': {
      put: {
        tags: ['Storefront'],
        summary: 'Update Storefront (Admin)',
        description: 'Endpoint classification: M. Allowed Roles: Admin.',
        security: [
          {
            BearerAuth: [],
          },
        ],
        parameters: [
          {
            name: 'id',
            in: 'path',
            required: true,
            schema: {
              type: 'integer',
            },
            description: 'Target id',
          },
        ],
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                additionalProperties: true,
              },
            },
          },
        },
        responses: {
          '200': {
            description: 'Successful operation',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    success: {
                      type: 'boolean',
                      example: true,
                    },
                    data: {
                      type: 'object',
                    },
                  },
                },
              },
            },
          },
          '400': {
            description: 'Validation error / Bad request',
          },
          '401': {
            description: 'Unauthorized / Missing or invalid token',
          },
          '403': {
            description: 'Forbidden / Insufficient role privileges',
          },
          '404': {
            description: 'Resource not found',
          },
          '500': {
            description: 'Internal server error',
          },
        },
      },
      delete: {
        tags: ['Storefront'],
        summary: 'Delete Storefront (Admin)',
        description: 'Endpoint classification: M. Allowed Roles: Admin.',
        security: [
          {
            BearerAuth: [],
          },
        ],
        parameters: [
          {
            name: 'id',
            in: 'path',
            required: true,
            schema: {
              type: 'integer',
            },
            description: 'Target id',
          },
        ],
        responses: {
          '200': {
            description: 'Successful operation',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    success: {
                      type: 'boolean',
                      example: true,
                    },
                    data: {
                      type: 'object',
                    },
                  },
                },
              },
            },
          },
          '400': {
            description: 'Validation error / Bad request',
          },
          '401': {
            description: 'Unauthorized / Missing or invalid token',
          },
          '403': {
            description: 'Forbidden / Insufficient role privileges',
          },
          '404': {
            description: 'Resource not found',
          },
          '500': {
            description: 'Internal server error',
          },
        },
      },
    },
    '/api/v1/online-orders': {
      post: {
        tags: ['Online Orders'],
        summary: 'Create / Submit Online Orders (Public)',
        description: 'Endpoint classification: M. Allowed Roles: Public.',
        security: [],
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                additionalProperties: true,
              },
            },
          },
        },
        responses: {
          '200': {
            description: 'Successful operation',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    success: {
                      type: 'boolean',
                      example: true,
                    },
                    data: {
                      type: 'object',
                    },
                  },
                },
              },
            },
          },
          '400': {
            description: 'Validation error / Bad request',
          },
          '401': {
            description: 'Unauthorized / Missing or invalid token',
          },
          '403': {
            description: 'Forbidden / Insufficient role privileges',
          },
          '404': {
            description: 'Resource not found',
          },
          '500': {
            description: 'Internal server error',
          },
        },
      },
      get: {
        tags: ['Online Orders'],
        summary: 'List / Query Online Orders (Admin, Delivery)',
        description: 'Endpoint classification: P. Allowed Roles: Admin, Delivery.',
        security: [
          {
            BearerAuth: [],
          },
        ],
        responses: {
          '200': {
            description: 'Successful operation',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    success: {
                      type: 'boolean',
                      example: true,
                    },
                    data: {
                      type: 'object',
                    },
                  },
                },
              },
            },
          },
          '400': {
            description: 'Validation error / Bad request',
          },
          '401': {
            description: 'Unauthorized / Missing or invalid token',
          },
          '403': {
            description: 'Forbidden / Insufficient role privileges',
          },
          '404': {
            description: 'Resource not found',
          },
          '500': {
            description: 'Internal server error',
          },
        },
      },
    },
    '/api/v1/online-orders/{id}': {
      get: {
        tags: ['Online Orders'],
        summary: 'Get Online Orders by ID (Admin, Delivery)',
        description: 'Endpoint classification: S. Allowed Roles: Admin, Delivery.',
        security: [
          {
            BearerAuth: [],
          },
        ],
        parameters: [
          {
            name: 'id',
            in: 'path',
            required: true,
            schema: {
              type: 'integer',
            },
            description: 'Target id',
          },
        ],
        responses: {
          '200': {
            description: 'Successful operation',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    success: {
                      type: 'boolean',
                      example: true,
                    },
                    data: {
                      type: 'object',
                    },
                  },
                },
              },
            },
          },
          '400': {
            description: 'Validation error / Bad request',
          },
          '401': {
            description: 'Unauthorized / Missing or invalid token',
          },
          '403': {
            description: 'Forbidden / Insufficient role privileges',
          },
          '404': {
            description: 'Resource not found',
          },
          '500': {
            description: 'Internal server error',
          },
        },
      },
    },
    '/api/v1/online-orders/{id}/status': {
      put: {
        tags: ['Online Orders'],
        summary: 'Update Online Orders (Admin, Delivery)',
        description: 'Endpoint classification: M. Allowed Roles: Admin, Delivery.',
        security: [
          {
            BearerAuth: [],
          },
        ],
        parameters: [
          {
            name: 'id',
            in: 'path',
            required: true,
            schema: {
              type: 'integer',
            },
            description: 'Target id',
          },
        ],
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                additionalProperties: true,
              },
            },
          },
        },
        responses: {
          '200': {
            description: 'Successful operation',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    success: {
                      type: 'boolean',
                      example: true,
                    },
                    data: {
                      type: 'object',
                    },
                  },
                },
              },
            },
          },
          '400': {
            description: 'Validation error / Bad request',
          },
          '401': {
            description: 'Unauthorized / Missing or invalid token',
          },
          '403': {
            description: 'Forbidden / Insufficient role privileges',
          },
          '404': {
            description: 'Resource not found',
          },
          '500': {
            description: 'Internal server error',
          },
        },
      },
    },
    '/api/v1/vendors': {
      get: {
        tags: ['Vendors'],
        summary: 'List / Query Vendors (Admin)',
        description: 'Endpoint classification: P. Allowed Roles: Admin.',
        security: [
          {
            BearerAuth: [],
          },
        ],
        responses: {
          '200': {
            description: 'Successful operation',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    success: {
                      type: 'boolean',
                      example: true,
                    },
                    data: {
                      type: 'object',
                    },
                  },
                },
              },
            },
          },
          '400': {
            description: 'Validation error / Bad request',
          },
          '401': {
            description: 'Unauthorized / Missing or invalid token',
          },
          '403': {
            description: 'Forbidden / Insufficient role privileges',
          },
          '404': {
            description: 'Resource not found',
          },
          '500': {
            description: 'Internal server error',
          },
        },
      },
      post: {
        tags: ['Vendors'],
        summary: 'Create / Submit Vendors (Admin)',
        description: 'Endpoint classification: M. Allowed Roles: Admin.',
        security: [
          {
            BearerAuth: [],
          },
        ],
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                additionalProperties: true,
              },
            },
          },
        },
        responses: {
          '200': {
            description: 'Successful operation',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    success: {
                      type: 'boolean',
                      example: true,
                    },
                    data: {
                      type: 'object',
                    },
                  },
                },
              },
            },
          },
          '400': {
            description: 'Validation error / Bad request',
          },
          '401': {
            description: 'Unauthorized / Missing or invalid token',
          },
          '403': {
            description: 'Forbidden / Insufficient role privileges',
          },
          '404': {
            description: 'Resource not found',
          },
          '500': {
            description: 'Internal server error',
          },
        },
      },
    },
    '/api/v1/vendors/{id}': {
      put: {
        tags: ['Vendors'],
        summary: 'Update Vendors (Admin)',
        description: 'Endpoint classification: M. Allowed Roles: Admin.',
        security: [
          {
            BearerAuth: [],
          },
        ],
        parameters: [
          {
            name: 'id',
            in: 'path',
            required: true,
            schema: {
              type: 'integer',
            },
            description: 'Target id',
          },
        ],
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                additionalProperties: true,
              },
            },
          },
        },
        responses: {
          '200': {
            description: 'Successful operation',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    success: {
                      type: 'boolean',
                      example: true,
                    },
                    data: {
                      type: 'object',
                    },
                  },
                },
              },
            },
          },
          '400': {
            description: 'Validation error / Bad request',
          },
          '401': {
            description: 'Unauthorized / Missing or invalid token',
          },
          '403': {
            description: 'Forbidden / Insufficient role privileges',
          },
          '404': {
            description: 'Resource not found',
          },
          '500': {
            description: 'Internal server error',
          },
        },
      },
    },
    '/api/v1/vendors/{id}/payouts': {
      get: {
        tags: ['Vendors'],
        summary: 'List / Query Vendors (Admin)',
        description: 'Endpoint classification: P. Allowed Roles: Admin.',
        security: [
          {
            BearerAuth: [],
          },
        ],
        parameters: [
          {
            name: 'id',
            in: 'path',
            required: true,
            schema: {
              type: 'integer',
            },
            description: 'Target id',
          },
        ],
        responses: {
          '200': {
            description: 'Successful operation',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    success: {
                      type: 'boolean',
                      example: true,
                    },
                    data: {
                      type: 'object',
                    },
                  },
                },
              },
            },
          },
          '400': {
            description: 'Validation error / Bad request',
          },
          '401': {
            description: 'Unauthorized / Missing or invalid token',
          },
          '403': {
            description: 'Forbidden / Insufficient role privileges',
          },
          '404': {
            description: 'Resource not found',
          },
          '500': {
            description: 'Internal server error',
          },
        },
      },
      post: {
        tags: ['Vendors'],
        summary: 'Create / Submit Vendors (Admin)',
        description: 'Endpoint classification: M. Allowed Roles: Admin.',
        security: [
          {
            BearerAuth: [],
          },
        ],
        parameters: [
          {
            name: 'id',
            in: 'path',
            required: true,
            schema: {
              type: 'integer',
            },
            description: 'Target id',
          },
        ],
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                additionalProperties: true,
              },
            },
          },
        },
        responses: {
          '200': {
            description: 'Successful operation',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    success: {
                      type: 'boolean',
                      example: true,
                    },
                    data: {
                      type: 'object',
                    },
                  },
                },
              },
            },
          },
          '400': {
            description: 'Validation error / Bad request',
          },
          '401': {
            description: 'Unauthorized / Missing or invalid token',
          },
          '403': {
            description: 'Forbidden / Insufficient role privileges',
          },
          '404': {
            description: 'Resource not found',
          },
          '500': {
            description: 'Internal server error',
          },
        },
      },
    },
    '/api/v1/warranty': {
      get: {
        tags: ['Warranty'],
        summary: 'List / Query Warranty (Admin, Cashier, Delivery)',
        description: 'Endpoint classification: P. Allowed Roles: Admin, Cashier, Delivery.',
        security: [
          {
            BearerAuth: [],
          },
        ],
        responses: {
          '200': {
            description: 'Successful operation',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    success: {
                      type: 'boolean',
                      example: true,
                    },
                    data: {
                      type: 'object',
                    },
                  },
                },
              },
            },
          },
          '400': {
            description: 'Validation error / Bad request',
          },
          '401': {
            description: 'Unauthorized / Missing or invalid token',
          },
          '403': {
            description: 'Forbidden / Insufficient role privileges',
          },
          '404': {
            description: 'Resource not found',
          },
          '500': {
            description: 'Internal server error',
          },
        },
      },
      post: {
        tags: ['Warranty'],
        summary: 'Create / Submit Warranty (Admin, Cashier, Delivery)',
        description: 'Endpoint classification: M. Allowed Roles: Admin, Cashier, Delivery.',
        security: [
          {
            BearerAuth: [],
          },
        ],
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                additionalProperties: true,
              },
            },
          },
        },
        responses: {
          '200': {
            description: 'Successful operation',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    success: {
                      type: 'boolean',
                      example: true,
                    },
                    data: {
                      type: 'object',
                    },
                  },
                },
              },
            },
          },
          '400': {
            description: 'Validation error / Bad request',
          },
          '401': {
            description: 'Unauthorized / Missing or invalid token',
          },
          '403': {
            description: 'Forbidden / Insufficient role privileges',
          },
          '404': {
            description: 'Resource not found',
          },
          '500': {
            description: 'Internal server error',
          },
        },
      },
    },
    '/api/v1/warranty/{id}': {
      put: {
        tags: ['Warranty'],
        summary: 'Update Warranty (Admin)',
        description: 'Endpoint classification: M. Allowed Roles: Admin.',
        security: [
          {
            BearerAuth: [],
          },
        ],
        parameters: [
          {
            name: 'id',
            in: 'path',
            required: true,
            schema: {
              type: 'integer',
            },
            description: 'Target id',
          },
        ],
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                additionalProperties: true,
              },
            },
          },
        },
        responses: {
          '200': {
            description: 'Successful operation',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    success: {
                      type: 'boolean',
                      example: true,
                    },
                    data: {
                      type: 'object',
                    },
                  },
                },
              },
            },
          },
          '400': {
            description: 'Validation error / Bad request',
          },
          '401': {
            description: 'Unauthorized / Missing or invalid token',
          },
          '403': {
            description: 'Forbidden / Insufficient role privileges',
          },
          '404': {
            description: 'Resource not found',
          },
          '500': {
            description: 'Internal server error',
          },
        },
      },
    },
    '/api/v1/delivery': {
      get: {
        tags: ['Delivery'],
        summary: 'List / Query Delivery (Admin, Delivery)',
        description: 'Endpoint classification: P. Allowed Roles: Admin, Delivery.',
        security: [
          {
            BearerAuth: [],
          },
        ],
        responses: {
          '200': {
            description: 'Successful operation',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    success: {
                      type: 'boolean',
                      example: true,
                    },
                    data: {
                      type: 'object',
                    },
                  },
                },
              },
            },
          },
          '400': {
            description: 'Validation error / Bad request',
          },
          '401': {
            description: 'Unauthorized / Missing or invalid token',
          },
          '403': {
            description: 'Forbidden / Insufficient role privileges',
          },
          '404': {
            description: 'Resource not found',
          },
          '500': {
            description: 'Internal server error',
          },
        },
      },
      post: {
        tags: ['Delivery'],
        summary: 'Create / Submit Delivery (Admin)',
        description: 'Endpoint classification: M. Allowed Roles: Admin.',
        security: [
          {
            BearerAuth: [],
          },
        ],
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                additionalProperties: true,
              },
            },
          },
        },
        responses: {
          '200': {
            description: 'Successful operation',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    success: {
                      type: 'boolean',
                      example: true,
                    },
                    data: {
                      type: 'object',
                    },
                  },
                },
              },
            },
          },
          '400': {
            description: 'Validation error / Bad request',
          },
          '401': {
            description: 'Unauthorized / Missing or invalid token',
          },
          '403': {
            description: 'Forbidden / Insufficient role privileges',
          },
          '404': {
            description: 'Resource not found',
          },
          '500': {
            description: 'Internal server error',
          },
        },
      },
    },
    '/api/v1/delivery/analytics/performance': {
      get: {
        tags: ['Delivery'],
        summary: 'List / Query Delivery (Admin)',
        description: 'Endpoint classification: S. Allowed Roles: Admin.',
        security: [
          {
            BearerAuth: [],
          },
        ],
        responses: {
          '200': {
            description: 'Successful operation',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    success: {
                      type: 'boolean',
                      example: true,
                    },
                    data: {
                      type: 'object',
                    },
                  },
                },
              },
            },
          },
          '400': {
            description: 'Validation error / Bad request',
          },
          '401': {
            description: 'Unauthorized / Missing or invalid token',
          },
          '403': {
            description: 'Forbidden / Insufficient role privileges',
          },
          '404': {
            description: 'Resource not found',
          },
          '500': {
            description: 'Internal server error',
          },
        },
      },
    },
    '/api/v1/delivery/{id}': {
      get: {
        tags: ['Delivery'],
        summary: 'Get Delivery by ID (Admin, Delivery)',
        description: 'Endpoint classification: S. Allowed Roles: Admin, Delivery.',
        security: [
          {
            BearerAuth: [],
          },
        ],
        parameters: [
          {
            name: 'id',
            in: 'path',
            required: true,
            schema: {
              type: 'integer',
            },
            description: 'Target id',
          },
        ],
        responses: {
          '200': {
            description: 'Successful operation',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    success: {
                      type: 'boolean',
                      example: true,
                    },
                    data: {
                      type: 'object',
                    },
                  },
                },
              },
            },
          },
          '400': {
            description: 'Validation error / Bad request',
          },
          '401': {
            description: 'Unauthorized / Missing or invalid token',
          },
          '403': {
            description: 'Forbidden / Insufficient role privileges',
          },
          '404': {
            description: 'Resource not found',
          },
          '500': {
            description: 'Internal server error',
          },
        },
      },
      put: {
        tags: ['Delivery'],
        summary: 'Update Delivery (Admin)',
        description: 'Endpoint classification: M. Allowed Roles: Admin.',
        security: [
          {
            BearerAuth: [],
          },
        ],
        parameters: [
          {
            name: 'id',
            in: 'path',
            required: true,
            schema: {
              type: 'integer',
            },
            description: 'Target id',
          },
        ],
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                additionalProperties: true,
              },
            },
          },
        },
        responses: {
          '200': {
            description: 'Successful operation',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    success: {
                      type: 'boolean',
                      example: true,
                    },
                    data: {
                      type: 'object',
                    },
                  },
                },
              },
            },
          },
          '400': {
            description: 'Validation error / Bad request',
          },
          '401': {
            description: 'Unauthorized / Missing or invalid token',
          },
          '403': {
            description: 'Forbidden / Insufficient role privileges',
          },
          '404': {
            description: 'Resource not found',
          },
          '500': {
            description: 'Internal server error',
          },
        },
      },
    },
    '/api/v1/delivery/{id}/status': {
      put: {
        tags: ['Delivery'],
        summary: 'Update Delivery (Admin, Delivery)',
        description: 'Endpoint classification: M. Allowed Roles: Admin, Delivery.',
        security: [
          {
            BearerAuth: [],
          },
        ],
        parameters: [
          {
            name: 'id',
            in: 'path',
            required: true,
            schema: {
              type: 'integer',
            },
            description: 'Target id',
          },
        ],
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                additionalProperties: true,
              },
            },
          },
        },
        responses: {
          '200': {
            description: 'Successful operation',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    success: {
                      type: 'boolean',
                      example: true,
                    },
                    data: {
                      type: 'object',
                    },
                  },
                },
              },
            },
          },
          '400': {
            description: 'Validation error / Bad request',
          },
          '401': {
            description: 'Unauthorized / Missing or invalid token',
          },
          '403': {
            description: 'Forbidden / Insufficient role privileges',
          },
          '404': {
            description: 'Resource not found',
          },
          '500': {
            description: 'Internal server error',
          },
        },
      },
    },
    '/api/v1/delivery/{id}/history': {
      get: {
        tags: ['Delivery'],
        summary: 'List / Query Delivery (Admin, Delivery)',
        description: 'Endpoint classification: P. Allowed Roles: Admin, Delivery.',
        security: [
          {
            BearerAuth: [],
          },
        ],
        parameters: [
          {
            name: 'id',
            in: 'path',
            required: true,
            schema: {
              type: 'integer',
            },
            description: 'Target id',
          },
        ],
        responses: {
          '200': {
            description: 'Successful operation',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    success: {
                      type: 'boolean',
                      example: true,
                    },
                    data: {
                      type: 'object',
                    },
                  },
                },
              },
            },
          },
          '400': {
            description: 'Validation error / Bad request',
          },
          '401': {
            description: 'Unauthorized / Missing or invalid token',
          },
          '403': {
            description: 'Forbidden / Insufficient role privileges',
          },
          '404': {
            description: 'Resource not found',
          },
          '500': {
            description: 'Internal server error',
          },
        },
      },
    },
    '/api/v1/shipping-companies': {
      get: {
        tags: ['Shipping Companies'],
        summary: 'List / Query Shipping Companies (Admin)',
        description: 'Endpoint classification: B. Allowed Roles: Admin.',
        security: [
          {
            BearerAuth: [],
          },
        ],
        responses: {
          '200': {
            description: 'Successful operation',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    success: {
                      type: 'boolean',
                      example: true,
                    },
                    data: {
                      type: 'object',
                    },
                  },
                },
              },
            },
          },
          '400': {
            description: 'Validation error / Bad request',
          },
          '401': {
            description: 'Unauthorized / Missing or invalid token',
          },
          '403': {
            description: 'Forbidden / Insufficient role privileges',
          },
          '404': {
            description: 'Resource not found',
          },
          '500': {
            description: 'Internal server error',
          },
        },
      },
      post: {
        tags: ['Shipping Companies'],
        summary: 'Create / Submit Shipping Companies (Admin)',
        description: 'Endpoint classification: M. Allowed Roles: Admin.',
        security: [
          {
            BearerAuth: [],
          },
        ],
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                additionalProperties: true,
              },
            },
          },
        },
        responses: {
          '200': {
            description: 'Successful operation',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    success: {
                      type: 'boolean',
                      example: true,
                    },
                    data: {
                      type: 'object',
                    },
                  },
                },
              },
            },
          },
          '400': {
            description: 'Validation error / Bad request',
          },
          '401': {
            description: 'Unauthorized / Missing or invalid token',
          },
          '403': {
            description: 'Forbidden / Insufficient role privileges',
          },
          '404': {
            description: 'Resource not found',
          },
          '500': {
            description: 'Internal server error',
          },
        },
      },
    },
    '/api/v1/shipping-companies/{id}': {
      put: {
        tags: ['Shipping Companies'],
        summary: 'Update Shipping Companies (Admin)',
        description: 'Endpoint classification: M. Allowed Roles: Admin.',
        security: [
          {
            BearerAuth: [],
          },
        ],
        parameters: [
          {
            name: 'id',
            in: 'path',
            required: true,
            schema: {
              type: 'integer',
            },
            description: 'Target id',
          },
        ],
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                additionalProperties: true,
              },
            },
          },
        },
        responses: {
          '200': {
            description: 'Successful operation',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    success: {
                      type: 'boolean',
                      example: true,
                    },
                    data: {
                      type: 'object',
                    },
                  },
                },
              },
            },
          },
          '400': {
            description: 'Validation error / Bad request',
          },
          '401': {
            description: 'Unauthorized / Missing or invalid token',
          },
          '403': {
            description: 'Forbidden / Insufficient role privileges',
          },
          '404': {
            description: 'Resource not found',
          },
          '500': {
            description: 'Internal server error',
          },
        },
      },
      delete: {
        tags: ['Shipping Companies'],
        summary: 'Delete Shipping Companies (Admin)',
        description: 'Endpoint classification: M. Allowed Roles: Admin.',
        security: [
          {
            BearerAuth: [],
          },
        ],
        parameters: [
          {
            name: 'id',
            in: 'path',
            required: true,
            schema: {
              type: 'integer',
            },
            description: 'Target id',
          },
        ],
        responses: {
          '200': {
            description: 'Successful operation',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    success: {
                      type: 'boolean',
                      example: true,
                    },
                    data: {
                      type: 'object',
                    },
                  },
                },
              },
            },
          },
          '400': {
            description: 'Validation error / Bad request',
          },
          '401': {
            description: 'Unauthorized / Missing or invalid token',
          },
          '403': {
            description: 'Forbidden / Insufficient role privileges',
          },
          '404': {
            description: 'Resource not found',
          },
          '500': {
            description: 'Internal server error',
          },
        },
      },
    },
    '/api/v1/purchase-orders': {
      get: {
        tags: ['Purchase Orders'],
        summary: 'List / Query Purchase Orders (Admin)',
        description: 'Endpoint classification: P. Allowed Roles: Admin.',
        security: [
          {
            BearerAuth: [],
          },
        ],
        responses: {
          '200': {
            description: 'Successful operation',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    success: {
                      type: 'boolean',
                      example: true,
                    },
                    data: {
                      type: 'object',
                    },
                  },
                },
              },
            },
          },
          '400': {
            description: 'Validation error / Bad request',
          },
          '401': {
            description: 'Unauthorized / Missing or invalid token',
          },
          '403': {
            description: 'Forbidden / Insufficient role privileges',
          },
          '404': {
            description: 'Resource not found',
          },
          '500': {
            description: 'Internal server error',
          },
        },
      },
      post: {
        tags: ['Purchase Orders'],
        summary: 'Create / Submit Purchase Orders (Admin)',
        description: 'Endpoint classification: M. Allowed Roles: Admin.',
        security: [
          {
            BearerAuth: [],
          },
        ],
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                additionalProperties: true,
              },
            },
          },
        },
        responses: {
          '200': {
            description: 'Successful operation',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    success: {
                      type: 'boolean',
                      example: true,
                    },
                    data: {
                      type: 'object',
                    },
                  },
                },
              },
            },
          },
          '400': {
            description: 'Validation error / Bad request',
          },
          '401': {
            description: 'Unauthorized / Missing or invalid token',
          },
          '403': {
            description: 'Forbidden / Insufficient role privileges',
          },
          '404': {
            description: 'Resource not found',
          },
          '500': {
            description: 'Internal server error',
          },
        },
      },
    },
    '/api/v1/purchase-orders/{id}': {
      get: {
        tags: ['Purchase Orders'],
        summary: 'Get Purchase Orders by ID (Admin)',
        description: 'Endpoint classification: S. Allowed Roles: Admin.',
        security: [
          {
            BearerAuth: [],
          },
        ],
        parameters: [
          {
            name: 'id',
            in: 'path',
            required: true,
            schema: {
              type: 'integer',
            },
            description: 'Target id',
          },
        ],
        responses: {
          '200': {
            description: 'Successful operation',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    success: {
                      type: 'boolean',
                      example: true,
                    },
                    data: {
                      type: 'object',
                    },
                  },
                },
              },
            },
          },
          '400': {
            description: 'Validation error / Bad request',
          },
          '401': {
            description: 'Unauthorized / Missing or invalid token',
          },
          '403': {
            description: 'Forbidden / Insufficient role privileges',
          },
          '404': {
            description: 'Resource not found',
          },
          '500': {
            description: 'Internal server error',
          },
        },
      },
      delete: {
        tags: ['Purchase Orders'],
        summary: 'Delete Purchase Orders (Admin)',
        description: 'Endpoint classification: M. Allowed Roles: Admin.',
        security: [
          {
            BearerAuth: [],
          },
        ],
        parameters: [
          {
            name: 'id',
            in: 'path',
            required: true,
            schema: {
              type: 'integer',
            },
            description: 'Target id',
          },
        ],
        responses: {
          '200': {
            description: 'Successful operation',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    success: {
                      type: 'boolean',
                      example: true,
                    },
                    data: {
                      type: 'object',
                    },
                  },
                },
              },
            },
          },
          '400': {
            description: 'Validation error / Bad request',
          },
          '401': {
            description: 'Unauthorized / Missing or invalid token',
          },
          '403': {
            description: 'Forbidden / Insufficient role privileges',
          },
          '404': {
            description: 'Resource not found',
          },
          '500': {
            description: 'Internal server error',
          },
        },
      },
    },
    '/api/v1/purchase-orders/{id}/status': {
      put: {
        tags: ['Purchase Orders'],
        summary: 'Update Purchase Orders (Admin)',
        description: 'Endpoint classification: M. Allowed Roles: Admin.',
        security: [
          {
            BearerAuth: [],
          },
        ],
        parameters: [
          {
            name: 'id',
            in: 'path',
            required: true,
            schema: {
              type: 'integer',
            },
            description: 'Target id',
          },
        ],
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                additionalProperties: true,
              },
            },
          },
        },
        responses: {
          '200': {
            description: 'Successful operation',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    success: {
                      type: 'boolean',
                      example: true,
                    },
                    data: {
                      type: 'object',
                    },
                  },
                },
              },
            },
          },
          '400': {
            description: 'Validation error / Bad request',
          },
          '401': {
            description: 'Unauthorized / Missing or invalid token',
          },
          '403': {
            description: 'Forbidden / Insufficient role privileges',
          },
          '404': {
            description: 'Resource not found',
          },
          '500': {
            description: 'Internal server error',
          },
        },
      },
    },
    '/api/v1/purchase-orders/{id}/receive': {
      post: {
        tags: ['Purchase Orders'],
        summary: 'Create / Submit Purchase Orders (Admin)',
        description: 'Endpoint classification: M. Allowed Roles: Admin.',
        security: [
          {
            BearerAuth: [],
          },
        ],
        parameters: [
          {
            name: 'id',
            in: 'path',
            required: true,
            schema: {
              type: 'integer',
            },
            description: 'Target id',
          },
        ],
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                additionalProperties: true,
              },
            },
          },
        },
        responses: {
          '200': {
            description: 'Successful operation',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    success: {
                      type: 'boolean',
                      example: true,
                    },
                    data: {
                      type: 'object',
                    },
                  },
                },
              },
            },
          },
          '400': {
            description: 'Validation error / Bad request',
          },
          '401': {
            description: 'Unauthorized / Missing or invalid token',
          },
          '403': {
            description: 'Forbidden / Insufficient role privileges',
          },
          '404': {
            description: 'Resource not found',
          },
          '500': {
            description: 'Internal server error',
          },
        },
      },
    },
    '/api/v1/expenses': {
      get: {
        tags: ['Expenses'],
        summary: 'List / Query Expenses (Admin)',
        description: 'Endpoint classification: P. Allowed Roles: Admin.',
        security: [
          {
            BearerAuth: [],
          },
        ],
        responses: {
          '200': {
            description: 'Successful operation',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    success: {
                      type: 'boolean',
                      example: true,
                    },
                    data: {
                      type: 'object',
                    },
                  },
                },
              },
            },
          },
          '400': {
            description: 'Validation error / Bad request',
          },
          '401': {
            description: 'Unauthorized / Missing or invalid token',
          },
          '403': {
            description: 'Forbidden / Insufficient role privileges',
          },
          '404': {
            description: 'Resource not found',
          },
          '500': {
            description: 'Internal server error',
          },
        },
      },
      post: {
        tags: ['Expenses'],
        summary: 'Create / Submit Expenses (Admin)',
        description: 'Endpoint classification: M. Allowed Roles: Admin.',
        security: [
          {
            BearerAuth: [],
          },
        ],
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                additionalProperties: true,
              },
            },
          },
        },
        responses: {
          '200': {
            description: 'Successful operation',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    success: {
                      type: 'boolean',
                      example: true,
                    },
                    data: {
                      type: 'object',
                    },
                  },
                },
              },
            },
          },
          '400': {
            description: 'Validation error / Bad request',
          },
          '401': {
            description: 'Unauthorized / Missing or invalid token',
          },
          '403': {
            description: 'Forbidden / Insufficient role privileges',
          },
          '404': {
            description: 'Resource not found',
          },
          '500': {
            description: 'Internal server error',
          },
        },
      },
    },
    '/api/v1/expenses/pnl': {
      get: {
        tags: ['Expenses'],
        summary: 'List / Query Expenses (Admin)',
        description: 'Endpoint classification: S. Allowed Roles: Admin.',
        security: [
          {
            BearerAuth: [],
          },
        ],
        responses: {
          '200': {
            description: 'Successful operation',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    success: {
                      type: 'boolean',
                      example: true,
                    },
                    data: {
                      type: 'object',
                    },
                  },
                },
              },
            },
          },
          '400': {
            description: 'Validation error / Bad request',
          },
          '401': {
            description: 'Unauthorized / Missing or invalid token',
          },
          '403': {
            description: 'Forbidden / Insufficient role privileges',
          },
          '404': {
            description: 'Resource not found',
          },
          '500': {
            description: 'Internal server error',
          },
        },
      },
    },
    '/api/v1/expenses/{id}': {
      put: {
        tags: ['Expenses'],
        summary: 'Update Expenses (Admin)',
        description: 'Endpoint classification: M. Allowed Roles: Admin.',
        security: [
          {
            BearerAuth: [],
          },
        ],
        parameters: [
          {
            name: 'id',
            in: 'path',
            required: true,
            schema: {
              type: 'integer',
            },
            description: 'Target id',
          },
        ],
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                additionalProperties: true,
              },
            },
          },
        },
        responses: {
          '200': {
            description: 'Successful operation',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    success: {
                      type: 'boolean',
                      example: true,
                    },
                    data: {
                      type: 'object',
                    },
                  },
                },
              },
            },
          },
          '400': {
            description: 'Validation error / Bad request',
          },
          '401': {
            description: 'Unauthorized / Missing or invalid token',
          },
          '403': {
            description: 'Forbidden / Insufficient role privileges',
          },
          '404': {
            description: 'Resource not found',
          },
          '500': {
            description: 'Internal server error',
          },
        },
      },
      delete: {
        tags: ['Expenses'],
        summary: 'Delete Expenses (Admin)',
        description: 'Endpoint classification: M. Allowed Roles: Admin.',
        security: [
          {
            BearerAuth: [],
          },
        ],
        parameters: [
          {
            name: 'id',
            in: 'path',
            required: true,
            schema: {
              type: 'integer',
            },
            description: 'Target id',
          },
        ],
        responses: {
          '200': {
            description: 'Successful operation',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    success: {
                      type: 'boolean',
                      example: true,
                    },
                    data: {
                      type: 'object',
                    },
                  },
                },
              },
            },
          },
          '400': {
            description: 'Validation error / Bad request',
          },
          '401': {
            description: 'Unauthorized / Missing or invalid token',
          },
          '403': {
            description: 'Forbidden / Insufficient role privileges',
          },
          '404': {
            description: 'Resource not found',
          },
          '500': {
            description: 'Internal server error',
          },
        },
      },
    },
    '/api/v1/analytics/dashboard-all': {
      get: {
        tags: ['Analytics'],
        summary: 'List / Query Analytics (Admin)',
        description: 'Endpoint classification: S. Allowed Roles: Admin.',
        security: [
          {
            BearerAuth: [],
          },
        ],
        responses: {
          '200': {
            description: 'Successful operation',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    success: {
                      type: 'boolean',
                      example: true,
                    },
                    data: {
                      type: 'object',
                    },
                  },
                },
              },
            },
          },
          '400': {
            description: 'Validation error / Bad request',
          },
          '401': {
            description: 'Unauthorized / Missing or invalid token',
          },
          '403': {
            description: 'Forbidden / Insufficient role privileges',
          },
          '404': {
            description: 'Resource not found',
          },
          '500': {
            description: 'Internal server error',
          },
        },
      },
    },
    '/api/v1/analytics/dashboard': {
      get: {
        tags: ['Analytics'],
        summary: 'List / Query Analytics (Admin)',
        description: 'Endpoint classification: S. Allowed Roles: Admin.',
        security: [
          {
            BearerAuth: [],
          },
        ],
        responses: {
          '200': {
            description: 'Successful operation',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    success: {
                      type: 'boolean',
                      example: true,
                    },
                    data: {
                      type: 'object',
                    },
                  },
                },
              },
            },
          },
          '400': {
            description: 'Validation error / Bad request',
          },
          '401': {
            description: 'Unauthorized / Missing or invalid token',
          },
          '403': {
            description: 'Forbidden / Insufficient role privileges',
          },
          '404': {
            description: 'Resource not found',
          },
          '500': {
            description: 'Internal server error',
          },
        },
      },
    },
    '/api/v1/analytics/revenue': {
      get: {
        tags: ['Analytics'],
        summary: 'List / Query Analytics (Admin)',
        description: 'Endpoint classification: S. Allowed Roles: Admin.',
        security: [
          {
            BearerAuth: [],
          },
        ],
        responses: {
          '200': {
            description: 'Successful operation',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    success: {
                      type: 'boolean',
                      example: true,
                    },
                    data: {
                      type: 'object',
                    },
                  },
                },
              },
            },
          },
          '400': {
            description: 'Validation error / Bad request',
          },
          '401': {
            description: 'Unauthorized / Missing or invalid token',
          },
          '403': {
            description: 'Forbidden / Insufficient role privileges',
          },
          '404': {
            description: 'Resource not found',
          },
          '500': {
            description: 'Internal server error',
          },
        },
      },
    },
    '/api/v1/analytics/top-products': {
      get: {
        tags: ['Analytics'],
        summary: 'List / Query Analytics (Admin)',
        description: 'Endpoint classification: P. Allowed Roles: Admin.',
        security: [
          {
            BearerAuth: [],
          },
        ],
        responses: {
          '200': {
            description: 'Successful operation',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    success: {
                      type: 'boolean',
                      example: true,
                    },
                    data: {
                      type: 'object',
                    },
                  },
                },
              },
            },
          },
          '400': {
            description: 'Validation error / Bad request',
          },
          '401': {
            description: 'Unauthorized / Missing or invalid token',
          },
          '403': {
            description: 'Forbidden / Insufficient role privileges',
          },
          '404': {
            description: 'Resource not found',
          },
          '500': {
            description: 'Internal server error',
          },
        },
      },
    },
    '/api/v1/analytics/payment-methods': {
      get: {
        tags: ['Analytics'],
        summary: 'List / Query Analytics (Admin)',
        description: 'Endpoint classification: B. Allowed Roles: Admin.',
        security: [
          {
            BearerAuth: [],
          },
        ],
        responses: {
          '200': {
            description: 'Successful operation',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    success: {
                      type: 'boolean',
                      example: true,
                    },
                    data: {
                      type: 'object',
                    },
                  },
                },
              },
            },
          },
          '400': {
            description: 'Validation error / Bad request',
          },
          '401': {
            description: 'Unauthorized / Missing or invalid token',
          },
          '403': {
            description: 'Forbidden / Insufficient role privileges',
          },
          '404': {
            description: 'Resource not found',
          },
          '500': {
            description: 'Internal server error',
          },
        },
      },
    },
    '/api/v1/analytics/orders-per-day': {
      get: {
        tags: ['Analytics'],
        summary: 'List / Query Analytics (Admin)',
        description: 'Endpoint classification: B. Allowed Roles: Admin.',
        security: [
          {
            BearerAuth: [],
          },
        ],
        responses: {
          '200': {
            description: 'Successful operation',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    success: {
                      type: 'boolean',
                      example: true,
                    },
                    data: {
                      type: 'object',
                    },
                  },
                },
              },
            },
          },
          '400': {
            description: 'Validation error / Bad request',
          },
          '401': {
            description: 'Unauthorized / Missing or invalid token',
          },
          '403': {
            description: 'Forbidden / Insufficient role privileges',
          },
          '404': {
            description: 'Resource not found',
          },
          '500': {
            description: 'Internal server error',
          },
        },
      },
    },
    '/api/v1/analytics/cashier-performance': {
      get: {
        tags: ['Analytics'],
        summary: 'List / Query Analytics (Admin)',
        description: 'Endpoint classification: P. Allowed Roles: Admin.',
        security: [
          {
            BearerAuth: [],
          },
        ],
        responses: {
          '200': {
            description: 'Successful operation',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    success: {
                      type: 'boolean',
                      example: true,
                    },
                    data: {
                      type: 'object',
                    },
                  },
                },
              },
            },
          },
          '400': {
            description: 'Validation error / Bad request',
          },
          '401': {
            description: 'Unauthorized / Missing or invalid token',
          },
          '403': {
            description: 'Forbidden / Insufficient role privileges',
          },
          '404': {
            description: 'Resource not found',
          },
          '500': {
            description: 'Internal server error',
          },
        },
      },
    },
    '/api/v1/analytics/sales-by-category': {
      get: {
        tags: ['Analytics'],
        summary: 'List / Query Analytics (Admin)',
        description: 'Endpoint classification: P. Allowed Roles: Admin.',
        security: [
          {
            BearerAuth: [],
          },
        ],
        responses: {
          '200': {
            description: 'Successful operation',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    success: {
                      type: 'boolean',
                      example: true,
                    },
                    data: {
                      type: 'object',
                    },
                  },
                },
              },
            },
          },
          '400': {
            description: 'Validation error / Bad request',
          },
          '401': {
            description: 'Unauthorized / Missing or invalid token',
          },
          '403': {
            description: 'Forbidden / Insufficient role privileges',
          },
          '404': {
            description: 'Resource not found',
          },
          '500': {
            description: 'Internal server error',
          },
        },
      },
    },
    '/api/v1/analytics/sales-by-distributor': {
      get: {
        tags: ['Analytics'],
        summary: 'List / Query Analytics (Admin)',
        description: 'Endpoint classification: P. Allowed Roles: Admin.',
        security: [
          {
            BearerAuth: [],
          },
        ],
        responses: {
          '200': {
            description: 'Successful operation',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    success: {
                      type: 'boolean',
                      example: true,
                    },
                    data: {
                      type: 'object',
                    },
                  },
                },
              },
            },
          },
          '400': {
            description: 'Validation error / Bad request',
          },
          '401': {
            description: 'Unauthorized / Missing or invalid token',
          },
          '403': {
            description: 'Forbidden / Insufficient role privileges',
          },
          '404': {
            description: 'Resource not found',
          },
          '500': {
            description: 'Internal server error',
          },
        },
      },
    },
    '/api/v1/analytics/dead-stock': {
      get: {
        tags: ['Analytics'],
        summary: 'List / Query Analytics (Admin)',
        description: 'Endpoint classification: P. Allowed Roles: Admin.',
        security: [
          {
            BearerAuth: [],
          },
        ],
        responses: {
          '200': {
            description: 'Successful operation',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    success: {
                      type: 'boolean',
                      example: true,
                    },
                    data: {
                      type: 'object',
                    },
                  },
                },
              },
            },
          },
          '400': {
            description: 'Validation error / Bad request',
          },
          '401': {
            description: 'Unauthorized / Missing or invalid token',
          },
          '403': {
            description: 'Forbidden / Insufficient role privileges',
          },
          '404': {
            description: 'Resource not found',
          },
          '500': {
            description: 'Internal server error',
          },
        },
      },
    },
    '/api/v1/analytics/customer-ltv': {
      get: {
        tags: ['Analytics'],
        summary: 'List / Query Analytics (Admin)',
        description: 'Endpoint classification: P. Allowed Roles: Admin.',
        security: [
          {
            BearerAuth: [],
          },
        ],
        responses: {
          '200': {
            description: 'Successful operation',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    success: {
                      type: 'boolean',
                      example: true,
                    },
                    data: {
                      type: 'object',
                    },
                  },
                },
              },
            },
          },
          '400': {
            description: 'Validation error / Bad request',
          },
          '401': {
            description: 'Unauthorized / Missing or invalid token',
          },
          '403': {
            description: 'Forbidden / Insufficient role privileges',
          },
          '404': {
            description: 'Resource not found',
          },
          '500': {
            description: 'Internal server error',
          },
        },
      },
    },
    '/api/v1/analytics/hourly-heatmap': {
      get: {
        tags: ['Analytics'],
        summary: 'List / Query Analytics (Admin)',
        description: 'Endpoint classification: B. Allowed Roles: Admin.',
        security: [
          {
            BearerAuth: [],
          },
        ],
        responses: {
          '200': {
            description: 'Successful operation',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    success: {
                      type: 'boolean',
                      example: true,
                    },
                    data: {
                      type: 'object',
                    },
                  },
                },
              },
            },
          },
          '400': {
            description: 'Validation error / Bad request',
          },
          '401': {
            description: 'Unauthorized / Missing or invalid token',
          },
          '403': {
            description: 'Forbidden / Insufficient role privileges',
          },
          '404': {
            description: 'Resource not found',
          },
          '500': {
            description: 'Internal server error',
          },
        },
      },
    },
    '/api/v1/analytics/abc-classification': {
      get: {
        tags: ['Analytics'],
        summary: 'List / Query Analytics (Admin)',
        description: 'Endpoint classification: P. Allowed Roles: Admin.',
        security: [
          {
            BearerAuth: [],
          },
        ],
        responses: {
          '200': {
            description: 'Successful operation',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    success: {
                      type: 'boolean',
                      example: true,
                    },
                    data: {
                      type: 'object',
                    },
                  },
                },
              },
            },
          },
          '400': {
            description: 'Validation error / Bad request',
          },
          '401': {
            description: 'Unauthorized / Missing or invalid token',
          },
          '403': {
            description: 'Forbidden / Insufficient role privileges',
          },
          '404': {
            description: 'Resource not found',
          },
          '500': {
            description: 'Internal server error',
          },
        },
      },
    },
    '/api/v1/analytics/reorder-suggestions': {
      get: {
        tags: ['Analytics'],
        summary: 'List / Query Analytics (Admin)',
        description: 'Endpoint classification: P. Allowed Roles: Admin.',
        security: [
          {
            BearerAuth: [],
          },
        ],
        responses: {
          '200': {
            description: 'Successful operation',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    success: {
                      type: 'boolean',
                      example: true,
                    },
                    data: {
                      type: 'object',
                    },
                  },
                },
              },
            },
          },
          '400': {
            description: 'Validation error / Bad request',
          },
          '401': {
            description: 'Unauthorized / Missing or invalid token',
          },
          '403': {
            description: 'Forbidden / Insufficient role privileges',
          },
          '404': {
            description: 'Resource not found',
          },
          '500': {
            description: 'Internal server error',
          },
        },
      },
    },
    '/api/v1/analytics/inventory-snapshot': {
      post: {
        tags: ['Analytics'],
        summary: 'Create / Submit Analytics (Admin)',
        description: 'Endpoint classification: M. Allowed Roles: Admin.',
        security: [
          {
            BearerAuth: [],
          },
        ],
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                additionalProperties: true,
              },
            },
          },
        },
        responses: {
          '200': {
            description: 'Successful operation',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    success: {
                      type: 'boolean',
                      example: true,
                    },
                    data: {
                      type: 'object',
                    },
                  },
                },
              },
            },
          },
          '400': {
            description: 'Validation error / Bad request',
          },
          '401': {
            description: 'Unauthorized / Missing or invalid token',
          },
          '403': {
            description: 'Forbidden / Insufficient role privileges',
          },
          '404': {
            description: 'Resource not found',
          },
          '500': {
            description: 'Internal server error',
          },
        },
      },
    },
    '/api/v1/analytics/inventory-snapshots': {
      get: {
        tags: ['Analytics'],
        summary: 'List / Query Analytics (Admin)',
        description: 'Endpoint classification: P. Allowed Roles: Admin.',
        security: [
          {
            BearerAuth: [],
          },
        ],
        responses: {
          '200': {
            description: 'Successful operation',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    success: {
                      type: 'boolean',
                      example: true,
                    },
                    data: {
                      type: 'object',
                    },
                  },
                },
              },
            },
          },
          '400': {
            description: 'Validation error / Bad request',
          },
          '401': {
            description: 'Unauthorized / Missing or invalid token',
          },
          '403': {
            description: 'Forbidden / Insufficient role privileges',
          },
          '404': {
            description: 'Resource not found',
          },
          '500': {
            description: 'Internal server error',
          },
        },
      },
    },
    '/api/v1/reports/sales': {
      get: {
        tags: ['Reports'],
        summary: 'List / Query Reports (Admin)',
        description: 'Endpoint classification: S. Allowed Roles: Admin.',
        security: [
          {
            BearerAuth: [],
          },
        ],
        responses: {
          '200': {
            description: 'Successful operation',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    success: {
                      type: 'boolean',
                      example: true,
                    },
                    data: {
                      type: 'object',
                    },
                  },
                },
              },
            },
          },
          '400': {
            description: 'Validation error / Bad request',
          },
          '401': {
            description: 'Unauthorized / Missing or invalid token',
          },
          '403': {
            description: 'Forbidden / Insufficient role privileges',
          },
          '404': {
            description: 'Resource not found',
          },
          '500': {
            description: 'Internal server error',
          },
        },
      },
    },
    '/api/v1/reports/inventory': {
      get: {
        tags: ['Reports'],
        summary: 'List / Query Reports (Admin)',
        description: 'Endpoint classification: S. Allowed Roles: Admin.',
        security: [
          {
            BearerAuth: [],
          },
        ],
        responses: {
          '200': {
            description: 'Successful operation',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    success: {
                      type: 'boolean',
                      example: true,
                    },
                    data: {
                      type: 'object',
                    },
                  },
                },
              },
            },
          },
          '400': {
            description: 'Validation error / Bad request',
          },
          '401': {
            description: 'Unauthorized / Missing or invalid token',
          },
          '403': {
            description: 'Forbidden / Insufficient role privileges',
          },
          '404': {
            description: 'Resource not found',
          },
          '500': {
            description: 'Internal server error',
          },
        },
      },
    },
    '/api/v1/reports/profit-loss': {
      get: {
        tags: ['Reports'],
        summary: 'List / Query Reports (Admin)',
        description: 'Endpoint classification: S. Allowed Roles: Admin.',
        security: [
          {
            BearerAuth: [],
          },
        ],
        responses: {
          '200': {
            description: 'Successful operation',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    success: {
                      type: 'boolean',
                      example: true,
                    },
                    data: {
                      type: 'object',
                    },
                  },
                },
              },
            },
          },
          '400': {
            description: 'Validation error / Bad request',
          },
          '401': {
            description: 'Unauthorized / Missing or invalid token',
          },
          '403': {
            description: 'Forbidden / Insufficient role privileges',
          },
          '404': {
            description: 'Resource not found',
          },
          '500': {
            description: 'Internal server error',
          },
        },
      },
    },
    '/api/v1/exports/products': {
      get: {
        tags: ['Exports'],
        summary: 'Export Exports data (Admin)',
        description: 'Endpoint classification: E. Allowed Roles: Admin.',
        security: [
          {
            BearerAuth: [],
          },
        ],
        responses: {
          '200': {
            description: 'Successful operation',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    success: {
                      type: 'boolean',
                      example: true,
                    },
                    data: {
                      type: 'object',
                    },
                  },
                },
              },
            },
          },
          '400': {
            description: 'Validation error / Bad request',
          },
          '401': {
            description: 'Unauthorized / Missing or invalid token',
          },
          '403': {
            description: 'Forbidden / Insufficient role privileges',
          },
          '404': {
            description: 'Resource not found',
          },
          '500': {
            description: 'Internal server error',
          },
        },
      },
    },
    '/api/v1/exports/sales': {
      get: {
        tags: ['Exports'],
        summary: 'Export Exports data (Admin)',
        description: 'Endpoint classification: E. Allowed Roles: Admin.',
        security: [
          {
            BearerAuth: [],
          },
        ],
        responses: {
          '200': {
            description: 'Successful operation',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    success: {
                      type: 'boolean',
                      example: true,
                    },
                    data: {
                      type: 'object',
                    },
                  },
                },
              },
            },
          },
          '400': {
            description: 'Validation error / Bad request',
          },
          '401': {
            description: 'Unauthorized / Missing or invalid token',
          },
          '403': {
            description: 'Forbidden / Insufficient role privileges',
          },
          '404': {
            description: 'Resource not found',
          },
          '500': {
            description: 'Internal server error',
          },
        },
      },
    },
    '/api/v1/exports/customers': {
      get: {
        tags: ['Exports'],
        summary: 'Export Exports data (Admin)',
        description: 'Endpoint classification: E. Allowed Roles: Admin.',
        security: [
          {
            BearerAuth: [],
          },
        ],
        responses: {
          '200': {
            description: 'Successful operation',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    success: {
                      type: 'boolean',
                      example: true,
                    },
                    data: {
                      type: 'object',
                    },
                  },
                },
              },
            },
          },
          '400': {
            description: 'Validation error / Bad request',
          },
          '401': {
            description: 'Unauthorized / Missing or invalid token',
          },
          '403': {
            description: 'Forbidden / Insufficient role privileges',
          },
          '404': {
            description: 'Resource not found',
          },
          '500': {
            description: 'Internal server error',
          },
        },
      },
    },
    '/api/v1/ai/forecast': {
      get: {
        tags: ['AI Insights'],
        summary: 'List / Query AI Insights (Admin)',
        description: 'Endpoint classification: S. Allowed Roles: Admin.',
        security: [
          {
            BearerAuth: [],
          },
        ],
        responses: {
          '200': {
            description: 'Successful operation',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    success: {
                      type: 'boolean',
                      example: true,
                    },
                    data: {
                      type: 'object',
                    },
                  },
                },
              },
            },
          },
          '400': {
            description: 'Validation error / Bad request',
          },
          '401': {
            description: 'Unauthorized / Missing or invalid token',
          },
          '403': {
            description: 'Forbidden / Insufficient role privileges',
          },
          '404': {
            description: 'Resource not found',
          },
          '500': {
            description: 'Internal server error',
          },
        },
      },
    },
    '/api/v1/ai/recommendations': {
      get: {
        tags: ['AI Insights'],
        summary: 'List / Query AI Insights (Admin)',
        description: 'Endpoint classification: P. Allowed Roles: Admin.',
        security: [
          {
            BearerAuth: [],
          },
        ],
        responses: {
          '200': {
            description: 'Successful operation',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    success: {
                      type: 'boolean',
                      example: true,
                    },
                    data: {
                      type: 'object',
                    },
                  },
                },
              },
            },
          },
          '400': {
            description: 'Validation error / Bad request',
          },
          '401': {
            description: 'Unauthorized / Missing or invalid token',
          },
          '403': {
            description: 'Forbidden / Insufficient role privileges',
          },
          '404': {
            description: 'Resource not found',
          },
          '500': {
            description: 'Internal server error',
          },
        },
      },
    },
    '/api/v1/ai/pricing-suggestions': {
      get: {
        tags: ['AI Insights'],
        summary: 'List / Query AI Insights (Admin)',
        description: 'Endpoint classification: P. Allowed Roles: Admin.',
        security: [
          {
            BearerAuth: [],
          },
        ],
        responses: {
          '200': {
            description: 'Successful operation',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    success: {
                      type: 'boolean',
                      example: true,
                    },
                    data: {
                      type: 'object',
                    },
                  },
                },
              },
            },
          },
          '400': {
            description: 'Validation error / Bad request',
          },
          '401': {
            description: 'Unauthorized / Missing or invalid token',
          },
          '403': {
            description: 'Forbidden / Insufficient role privileges',
          },
          '404': {
            description: 'Resource not found',
          },
          '500': {
            description: 'Internal server error',
          },
        },
      },
    },
    '/api/v1/ai/churn-risk': {
      get: {
        tags: ['AI Insights'],
        summary: 'List / Query AI Insights (Admin)',
        description: 'Endpoint classification: P. Allowed Roles: Admin.',
        security: [
          {
            BearerAuth: [],
          },
        ],
        responses: {
          '200': {
            description: 'Successful operation',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    success: {
                      type: 'boolean',
                      example: true,
                    },
                    data: {
                      type: 'object',
                    },
                  },
                },
              },
            },
          },
          '400': {
            description: 'Validation error / Bad request',
          },
          '401': {
            description: 'Unauthorized / Missing or invalid token',
          },
          '403': {
            description: 'Forbidden / Insufficient role privileges',
          },
          '404': {
            description: 'Resource not found',
          },
          '500': {
            description: 'Internal server error',
          },
        },
      },
    },
    '/api/v1/ai/anomalies': {
      get: {
        tags: ['AI Insights'],
        summary: 'List / Query AI Insights (Admin)',
        description: 'Endpoint classification: P. Allowed Roles: Admin.',
        security: [
          {
            BearerAuth: [],
          },
        ],
        responses: {
          '200': {
            description: 'Successful operation',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    success: {
                      type: 'boolean',
                      example: true,
                    },
                    data: {
                      type: 'object',
                    },
                  },
                },
              },
            },
          },
          '400': {
            description: 'Validation error / Bad request',
          },
          '401': {
            description: 'Unauthorized / Missing or invalid token',
          },
          '403': {
            description: 'Forbidden / Insufficient role privileges',
          },
          '404': {
            description: 'Resource not found',
          },
          '500': {
            description: 'Internal server error',
          },
        },
      },
    },
    '/api/v1/notifications': {
      get: {
        tags: ['Notifications'],
        summary: 'List / Query Notifications (Admin, Cashier, Delivery)',
        description: 'Endpoint classification: P. Allowed Roles: Admin, Cashier, Delivery.',
        security: [
          {
            BearerAuth: [],
          },
        ],
        responses: {
          '200': {
            description: 'Successful operation',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    success: {
                      type: 'boolean',
                      example: true,
                    },
                    data: {
                      type: 'object',
                    },
                  },
                },
              },
            },
          },
          '400': {
            description: 'Validation error / Bad request',
          },
          '401': {
            description: 'Unauthorized / Missing or invalid token',
          },
          '403': {
            description: 'Forbidden / Insufficient role privileges',
          },
          '404': {
            description: 'Resource not found',
          },
          '500': {
            description: 'Internal server error',
          },
        },
      },
    },
    '/api/v1/notifications/unread-count': {
      get: {
        tags: ['Notifications'],
        summary: 'List / Query Notifications (Admin, Cashier, Delivery)',
        description: 'Endpoint classification: S. Allowed Roles: Admin, Cashier, Delivery.',
        security: [
          {
            BearerAuth: [],
          },
        ],
        responses: {
          '200': {
            description: 'Successful operation',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    success: {
                      type: 'boolean',
                      example: true,
                    },
                    data: {
                      type: 'object',
                    },
                  },
                },
              },
            },
          },
          '400': {
            description: 'Validation error / Bad request',
          },
          '401': {
            description: 'Unauthorized / Missing or invalid token',
          },
          '403': {
            description: 'Forbidden / Insufficient role privileges',
          },
          '404': {
            description: 'Resource not found',
          },
          '500': {
            description: 'Internal server error',
          },
        },
      },
    },
    '/api/v1/notifications/{id}/read': {
      put: {
        tags: ['Notifications'],
        summary: 'Update Notifications (Admin, Cashier, Delivery)',
        description: 'Endpoint classification: M. Allowed Roles: Admin, Cashier, Delivery.',
        security: [
          {
            BearerAuth: [],
          },
        ],
        parameters: [
          {
            name: 'id',
            in: 'path',
            required: true,
            schema: {
              type: 'integer',
            },
            description: 'Target id',
          },
        ],
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                additionalProperties: true,
              },
            },
          },
        },
        responses: {
          '200': {
            description: 'Successful operation',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    success: {
                      type: 'boolean',
                      example: true,
                    },
                    data: {
                      type: 'object',
                    },
                  },
                },
              },
            },
          },
          '400': {
            description: 'Validation error / Bad request',
          },
          '401': {
            description: 'Unauthorized / Missing or invalid token',
          },
          '403': {
            description: 'Forbidden / Insufficient role privileges',
          },
          '404': {
            description: 'Resource not found',
          },
          '500': {
            description: 'Internal server error',
          },
        },
      },
    },
    '/api/v1/notifications/read-all': {
      put: {
        tags: ['Notifications'],
        summary: 'Update Notifications (Admin, Cashier, Delivery)',
        description: 'Endpoint classification: M. Allowed Roles: Admin, Cashier, Delivery.',
        security: [
          {
            BearerAuth: [],
          },
        ],
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                additionalProperties: true,
              },
            },
          },
        },
        responses: {
          '200': {
            description: 'Successful operation',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    success: {
                      type: 'boolean',
                      example: true,
                    },
                    data: {
                      type: 'object',
                    },
                  },
                },
              },
            },
          },
          '400': {
            description: 'Validation error / Bad request',
          },
          '401': {
            description: 'Unauthorized / Missing or invalid token',
          },
          '403': {
            description: 'Forbidden / Insufficient role privileges',
          },
          '404': {
            description: 'Resource not found',
          },
          '500': {
            description: 'Internal server error',
          },
        },
      },
    },
  },
} as const;
