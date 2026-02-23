const bcrypt = require('bcrypt');
const Database = require('better-sqlite3');
const path = require('path');

const dbPath = path.join(__dirname, 'moon.db');
const db = new Database(dbPath);
db.pragma('foreign_keys = ON');

const products = [
  { name: 'Silk Midi Dress', sku: 'MN-DRS-001', barcode: '8901001001', price: 189.00, stock: 25, category: 'Dresses', min_stock: 5 },
  { name: 'Cashmere Sweater', sku: 'MN-KNT-002', barcode: '8901001002', price: 245.00, stock: 18, category: 'Knitwear', min_stock: 5 },
  { name: 'Leather Crossbody Bag', sku: 'MN-BAG-003', barcode: '8901001003', price: 320.00, stock: 12, category: 'Bags', min_stock: 3 },
  { name: 'Wide-Leg Trousers', sku: 'MN-BTM-004', barcode: '8901001004', price: 135.00, stock: 30, category: 'Bottoms', min_stock: 8 },
  { name: 'Gold Chain Necklace', sku: 'MN-JWL-005', barcode: '8901001005', price: 85.00, stock: 40, category: 'Jewelry', min_stock: 10 },
  { name: 'Satin Blouse', sku: 'MN-TOP-006', barcode: '8901001006', price: 125.00, stock: 22, category: 'Tops', min_stock: 5 },
  { name: 'Wool Blazer', sku: 'MN-JKT-007', barcode: '8901001007', price: 295.00, stock: 15, category: 'Outerwear', min_stock: 3 },
  { name: 'Pearl Earrings', sku: 'MN-JWL-008', barcode: '8901001008', price: 65.00, stock: 50, category: 'Jewelry', min_stock: 10 },
  { name: 'Pleated Maxi Skirt', sku: 'MN-BTM-009', barcode: '8901001009', price: 155.00, stock: 20, category: 'Bottoms', min_stock: 5 },
  { name: 'Suede Ankle Boots', sku: 'MN-SHO-010', barcode: '8901001010', price: 210.00, stock: 14, category: 'Shoes', min_stock: 3 },
  { name: 'Linen Shirt Dress', sku: 'MN-DRS-011', barcode: '8901001011', price: 165.00, stock: 3, category: 'Dresses', min_stock: 5 },
  { name: 'Velvet Evening Clutch', sku: 'MN-BAG-012', barcode: '8901001012', price: 145.00, stock: 2, category: 'Bags', min_stock: 3 },
  { name: 'Ribbed Turtleneck', sku: 'MN-KNT-013', barcode: '8901001013', price: 95.00, stock: 28, category: 'Knitwear', min_stock: 5 },
  { name: 'High-Waist Denim', sku: 'MN-BTM-014', barcode: '8901001014', price: 115.00, stock: 35, category: 'Bottoms', min_stock: 8 },
  { name: 'Silk Scarf', sku: 'MN-ACC-015', barcode: '8901001015', price: 75.00, stock: 45, category: 'Accessories', min_stock: 10 },
  { name: 'Trench Coat', sku: 'MN-JKT-016', barcode: '8901001016', price: 385.00, stock: 8, category: 'Outerwear', min_stock: 3 },
  { name: 'Statement Ring Set', sku: 'MN-JWL-017', barcode: '8901001017', price: 55.00, stock: 60, category: 'Jewelry', min_stock: 15 },
  { name: 'Pointed Toe Heels', sku: 'MN-SHO-018', barcode: '8901001018', price: 175.00, stock: 16, category: 'Shoes', min_stock: 3 },
  { name: 'Oversized Sunglasses', sku: 'MN-ACC-019', barcode: '8901001019', price: 120.00, stock: 1, category: 'Accessories', min_stock: 5 },
  { name: 'Wrap Cocktail Dress', sku: 'MN-DRS-020', barcode: '8901001020', price: 225.00, stock: 10, category: 'Dresses', min_stock: 5 },
];

async function seed() {
  console.log('Seeding database...');

  const insertUser = db.prepare(
    `INSERT OR IGNORE INTO users (name, email, password_hash, role) VALUES (?, ?, ?, ?)`
  );

  // Create admin user
  const adminHash = await bcrypt.hash('admin123', 10);
  insertUser.run('Admin', 'admin@moon.com', adminHash, 'Admin');
  console.log('  Admin user created: admin@moon.com / admin123');

  // Create sample cashier
  const cashierHash = await bcrypt.hash('cashier123', 10);
  insertUser.run('Sarah Miller', 'sarah@moon.com', cashierHash, 'Cashier');

  // Create sample delivery user
  const deliveryHash = await bcrypt.hash('delivery123', 10);
  insertUser.run('James Wilson', 'james@moon.com', deliveryHash, 'Delivery');

  // Insert products
  const insertProduct = db.prepare(
    `INSERT OR IGNORE INTO products (name, sku, barcode, price, stock, category, min_stock)
     VALUES (?, ?, ?, ?, ?, ?, ?)`
  );

  const insertMany = db.transaction(() => {
    for (const p of products) {
      insertProduct.run(p.name, p.sku, p.barcode, p.price, p.stock, p.category, p.min_stock);
    }
  });
  insertMany();

  console.log(`  ${products.length} fashion products inserted.`);
  console.log('Seeding complete.');

  db.close();
  process.exit(0);
}

seed().catch((err) => {
  console.error('Seed failed:', err);
  process.exit(1);
});
