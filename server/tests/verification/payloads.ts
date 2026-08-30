import { SeededFixtures } from './fixtureProvider';

export function getSamplePayload(
  path: string,
  method: string,
  fixtures: SeededFixtures
): Record<string, unknown> {
  // Auth
  if (path.includes('/auth/login')) {
    return { email: 'admin@moon.com', password: 'admin123' };
  }

  // Users
  if (path === '/api/v1/users' && method === 'POST') {
    return {
      name: 'Test TestUser',
      email: `test_${Date.now()}@moon.com`,
      password: 'password123',
      role: 'Cashier',
    };
  }
  if (path.includes('/users/me/favorites')) {
    return { productIds: [fixtures.product.id] };
  }
  if (path.startsWith('/api/v1/users/') && method === 'PUT') {
    return { name: 'Updated User Name' };
  }

  // Settings
  if (path === '/api/v1/settings') {
    return {
      storeName: 'MOON Fashion Store',
      currency: 'EGP',
      taxRate: 14,
    };
  }

  // Branches
  if (path === '/api/v1/branches' && method === 'POST') {
    return {
      name: `Branch ${Date.now()}`,
      code: `BR-${Date.now().toString().slice(-4)}`,
      address: 'Cairo, Egypt',
      phone: '01011112222',
      isMain: false,
    };
  }

  // Categories
  if (path === '/api/v1/categories' && method === 'POST') {
    return {
      name: `Category ${Date.now()}`,
      description: 'Test category description',
    };
  }

  // Products
  if (path === '/api/v1/products' && method === 'POST') {
    return {
      name: `Product ${Date.now()}`,
      sku: `SKU-${Date.now().toString().slice(-6)}`,
      barcode: `BC-${Date.now().toString().slice(-6)}`,
      categoryId: fixtures.category.id,
      price: 250,
      cost: 150,
      stock: 50,
      minStock: 5,
    };
  }
  if (path.startsWith('/api/v1/products/') && method === 'PUT') {
    return {
      name: 'Updated Product Name',
      price: 300,
    };
  }

  // Customers
  if (path === '/api/v1/customers' && method === 'POST') {
    return {
      name: `Customer ${Date.now()}`,
      phone: `01${Math.floor(100000000 + Math.random() * 900000000)}`,
      email: `customer_${Date.now()}@example.com`,
    };
  }

  // Coupons
  if (path === '/api/v1/coupons' && method === 'POST') {
    return {
      code: `TEST${Date.now().toString().slice(-4)}`,
      discountType: 'percentage',
      discountValue: 15,
      minSpend: 100,
      expiresAt: new Date(Date.now() + 86400000 * 30).toISOString(),
    };
  }

  // Gift cards
  if (path === '/api/v1/gift-cards' && method === 'POST') {
    return {
      code: `GC-${Date.now().toString().slice(-5)}`,
      initialBalance: 500,
      expiresAt: new Date(Date.now() + 86400000 * 365).toISOString(),
    };
  }

  // Expenses
  if (path === '/api/v1/expenses' && method === 'POST') {
    return {
      category: 'Utilities',
      amount: 150,
      description: 'Electricity bill',
      expenseDate: new Date().toISOString(),
    };
  }

  // Feedback
  if (path === '/api/v1/feedback' && method === 'POST') {
    return {
      customerId: fixtures.customer.id,
      rating: 5,
      comment: 'Excellent service!',
    };
  }

  // Stock Counts
  if (path === '/api/v1/stock-counts' && method === 'POST') {
    return {
      branchId: fixtures.branch.id,
      notes: 'Monthly audit',
      items: [{ productId: fixtures.product.id, countedQty: 45, systemQty: 50 }],
    };
  }

  // Shipping Companies
  if (path.includes('/shipping-companies') && (method === 'POST' || method === 'PUT')) {
    return {
      name: `Shipping Co ${Date.now()}`,
      phone: '0100000000',
      email: `shipping_${Date.now()}@example.com`,
      trackingUrlTemplate: 'https://track.example.com/{tracking}',
      isActive: 1,
    };
  }

  // Stock Adjustments
  if (path === '/api/v1/stock-adjustments' && method === 'POST') {
    return {
      productId: fixtures.product.id,
      branchId: fixtures.branch.id,
      quantity: 5,
      type: 'increase',
      reason: 'Damaged item restocked',
    };
  }

  // Sales / POS Register
  if (path === '/api/v1/sales' && method === 'POST') {
    return {
      customerId: fixtures.customer.id,
      branchId: fixtures.branch.id,
      items: [
        { productId: fixtures.product.id, quantity: 1, unitPrice: 200, discount: 0, subtotal: 200 },
      ],
      subtotal: 200,
      discount: 0,
      tax: 28,
      total: 228,
      paymentMethod: 'cash',
      paidAmount: 250,
      changeAmount: 22,
    };
  }

  // Shifts
  if (path === '/api/v1/shifts/open' && method === 'POST') {
    return {
      branchId: fixtures.branch.id,
      startingCash: 1000,
    };
  }
  if (path === '/api/v1/shifts/close' && method === 'POST') {
    return {
      endingCash: 1500,
      notes: 'End of day shift close',
    };
  }

  // Default fallback payload
  return {
    name: 'Sample Test Entity',
    description: 'Sample description for verification',
  };
}
