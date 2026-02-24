import bcrypt from 'bcrypt';
import Database from 'better-sqlite3';
import path from 'path';

const dbPath = path.join(__dirname, 'moon.db');
const db = new Database(dbPath);
db.pragma('foreign_keys = OFF');

// ─── Clear all data ───────────────────────────────────────────────
const clearAll = db.transaction(() => {
  const tables = db
    .prepare(
      `SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%' AND name NOT IN ('migrations','_migrations')`
    )
    .all() as { name: string }[];
  for (const t of tables) {
    db.prepare(`DELETE FROM "${t.name}"`).run();
  }
  // Reset autoincrement counters so IDs start from 1
  for (const t of tables) {
    db.prepare(`DELETE FROM sqlite_sequence WHERE name = ?`).run(t.name);
  }
});
clearAll();
console.log('✓ All data cleared + autoincrement reset.');
db.pragma('foreign_keys = ON');

// ─── Categories (Arabic) ─────────────────────────────────────────
const categories = [
  { name: 'فساتين', code: 'DRS' },
  { name: 'تريكو', code: 'KNT' },
  { name: 'حقائب', code: 'BAG' },
  { name: 'بناطيل', code: 'BTM' },
  { name: 'مجوهرات', code: 'JWL' },
  { name: 'بلوزات', code: 'TOP' },
  { name: 'جاكيتات', code: 'JKT' },
  { name: 'أحذية', code: 'SHO' },
  { name: 'إكسسوارات', code: 'ACC' },
  { name: 'عبايات', code: 'ABA' },
  { name: 'حجاب', code: 'HJB' },
];

const insertCategory = db.prepare(`INSERT INTO categories (name, code) VALUES (?, ?)`);
const seedCategories = db.transaction(() => {
  for (const c of categories) {
    insertCategory.run(c.name, c.code);
  }
});
seedCategories();
console.log(`✓ ${categories.length} categories inserted.`);

// ─── Users (Egyptian Arabic names) ───────────────────────────────
const insertUser = db.prepare(
  `INSERT INTO users (name, email, password_hash, role, commission_rate) VALUES (?, ?, ?, ?, ?)`
);

const adminHash = bcrypt.hashSync('admin123', 10);
const cashierHash = bcrypt.hashSync('cashier123', 10);
const deliveryHash = bcrypt.hashSync('delivery123', 10);

const seedUsers = db.transaction(() => {
  insertUser.run('أحمد محمد', 'admin@moon.com', adminHash, 'Admin', 0);
  insertUser.run('سارة حسن', 'sarah@moon.com', cashierHash, 'Cashier', 2.5);
  insertUser.run('محمد علي', 'james@moon.com', deliveryHash, 'Delivery', 0);
});
seedUsers();
console.log('✓ 3 users created (admin@moon.com / admin123)');

// ─── Distributors (Egyptian suppliers) ───────────────────────────
const distributors = [
  {
    name: 'دار الأزياء المصرية',
    contact: 'طارق عبدالله',
    phone: '+201012345678',
    email: 'info@darazya.eg',
    address: 'شارع الأهرام، الجيزة',
    notes: 'مورد رئيسي للفساتين والعبايات',
  },
  {
    name: 'النسيج الذهبي',
    contact: 'هاني رشدي',
    phone: '+201112345678',
    email: 'sales@goldtex.eg',
    address: 'شارع الأزهر، القاهرة',
    notes: 'أقمشة وتريكو فاخر',
  },
  {
    name: 'مصنع الجلود المتحدة',
    contact: 'سمير فؤاد',
    phone: '+201212345678',
    email: 'orders@unitedleather.eg',
    address: 'المنطقة الصناعية، العاشر من رمضان',
    notes: 'حقائب وأحذية جلدية',
  },
  {
    name: 'مجوهرات النيل',
    contact: 'نادية كمال',
    phone: '+201012345999',
    email: 'nile@jewelry.eg',
    address: 'خان الخليلي، القاهرة',
    notes: 'مجوهرات وإكسسوارات',
  },
  {
    name: 'شركة القطن الممتاز',
    contact: 'عمرو حسين',
    phone: '+201112345999',
    email: 'cotton@premium.eg',
    address: 'المحلة الكبرى، الغربية',
    notes: 'أقمشة قطنية عالية الجودة',
  },
];

const insertDistributor = db.prepare(
  `INSERT INTO distributors (name, contact_person, phone, email, address, notes) VALUES (?, ?, ?, ?, ?, ?)`
);
const seedDistributors = db.transaction(() => {
  for (const d of distributors) {
    insertDistributor.run(d.name, d.contact, d.phone, d.email, d.address, d.notes);
  }
});
seedDistributors();
console.log(`✓ ${distributors.length} distributors inserted.`);

// ─── Products (Egyptian fashion, EGP prices) ─────────────────────
const products = [
  // فساتين (Dresses)
  {
    name: 'فستان حرير ميدي',
    sku: 'MN-DRS-001',
    barcode: '6221001001',
    price: 2850,
    cost: 1400,
    stock: 25,
    category: 'فساتين',
    min_stock: 5,
    dist_id: 1,
  },
  {
    name: 'فستان سهرة مطرز',
    sku: 'MN-DRS-002',
    barcode: '6221001002',
    price: 4500,
    cost: 2200,
    stock: 12,
    category: 'فساتين',
    min_stock: 3,
    dist_id: 1,
  },
  {
    name: 'فستان كتان صيفي',
    sku: 'MN-DRS-003',
    barcode: '6221001003',
    price: 1950,
    cost: 950,
    stock: 30,
    category: 'فساتين',
    min_stock: 8,
    dist_id: 5,
  },
  // تريكو (Knitwear)
  {
    name: 'بلوفر كشمير',
    sku: 'MN-KNT-001',
    barcode: '6221002001',
    price: 3200,
    cost: 1600,
    stock: 18,
    category: 'تريكو',
    min_stock: 5,
    dist_id: 2,
  },
  {
    name: 'كارديجان صوف طويل',
    sku: 'MN-KNT-002',
    barcode: '6221002002',
    price: 2400,
    cost: 1200,
    stock: 20,
    category: 'تريكو',
    min_stock: 5,
    dist_id: 2,
  },
  {
    name: 'تيشيرت تريكو خفيف',
    sku: 'MN-KNT-003',
    barcode: '6221002003',
    price: 1200,
    cost: 580,
    stock: 35,
    category: 'تريكو',
    min_stock: 8,
    dist_id: 2,
  },
  // حقائب (Bags)
  {
    name: 'شنطة جلد طبيعي كروس',
    sku: 'MN-BAG-001',
    barcode: '6221003001',
    price: 3800,
    cost: 1900,
    stock: 15,
    category: 'حقائب',
    min_stock: 3,
    dist_id: 3,
  },
  {
    name: 'حقيبة يد سهرة مخمل',
    sku: 'MN-BAG-002',
    barcode: '6221003002',
    price: 1800,
    cost: 850,
    stock: 10,
    category: 'حقائب',
    min_stock: 3,
    dist_id: 3,
  },
  {
    name: 'شنطة ظهر جلد',
    sku: 'MN-BAG-003',
    barcode: '6221003003',
    price: 2600,
    cost: 1300,
    stock: 12,
    category: 'حقائب',
    min_stock: 3,
    dist_id: 3,
  },
  // بناطيل (Bottoms)
  {
    name: 'بنطلون واسع قماش',
    sku: 'MN-BTM-001',
    barcode: '6221004001',
    price: 1650,
    cost: 800,
    stock: 28,
    category: 'بناطيل',
    min_stock: 8,
    dist_id: 5,
  },
  {
    name: 'جيبة بليسيه ماكسي',
    sku: 'MN-BTM-002',
    barcode: '6221004002',
    price: 1900,
    cost: 920,
    stock: 22,
    category: 'بناطيل',
    min_stock: 5,
    dist_id: 5,
  },
  {
    name: 'جينز هاي ويست',
    sku: 'MN-BTM-003',
    barcode: '6221004003',
    price: 1400,
    cost: 680,
    stock: 40,
    category: 'بناطيل',
    min_stock: 10,
    dist_id: 5,
  },
  // مجوهرات (Jewelry)
  {
    name: 'عقد ذهب ناعم',
    sku: 'MN-JWL-001',
    barcode: '6221005001',
    price: 5500,
    cost: 3800,
    stock: 8,
    category: 'مجوهرات',
    min_stock: 2,
    dist_id: 4,
  },
  {
    name: 'حلق لؤلؤ طبيعي',
    sku: 'MN-JWL-002',
    barcode: '6221005002',
    price: 2200,
    cost: 1100,
    stock: 20,
    category: 'مجوهرات',
    min_stock: 5,
    dist_id: 4,
  },
  {
    name: 'طقم خواتم استيت',
    sku: 'MN-JWL-003',
    barcode: '6221005003',
    price: 950,
    cost: 420,
    stock: 50,
    category: 'مجوهرات',
    min_stock: 10,
    dist_id: 4,
  },
  // بلوزات (Tops)
  {
    name: 'بلوزة ساتان أوف شولدر',
    sku: 'MN-TOP-001',
    barcode: '6221006001',
    price: 1550,
    cost: 750,
    stock: 22,
    category: 'بلوزات',
    min_stock: 5,
    dist_id: 1,
  },
  {
    name: 'قميص كتان أوفرسايز',
    sku: 'MN-TOP-002',
    barcode: '6221006002',
    price: 1350,
    cost: 650,
    stock: 30,
    category: 'بلوزات',
    min_stock: 8,
    dist_id: 5,
  },
  {
    name: 'توب كروشيه يدوي',
    sku: 'MN-TOP-003',
    barcode: '6221006003',
    price: 1800,
    cost: 900,
    stock: 15,
    category: 'بلوزات',
    min_stock: 3,
    dist_id: 2,
  },
  // جاكيتات (Outerwear)
  {
    name: 'بليزر صوف كلاسيك',
    sku: 'MN-JKT-001',
    barcode: '6221007001',
    price: 3600,
    cost: 1800,
    stock: 14,
    category: 'جاكيتات',
    min_stock: 3,
    dist_id: 2,
  },
  {
    name: 'ترنش كوت بيج',
    sku: 'MN-JKT-002',
    barcode: '6221007002',
    price: 4200,
    cost: 2100,
    stock: 8,
    category: 'جاكيتات',
    min_stock: 3,
    dist_id: 2,
  },
  // أحذية (Shoes)
  {
    name: 'حذاء جلد بكعب عالي',
    sku: 'MN-SHO-001',
    barcode: '6221008001',
    price: 2400,
    cost: 1150,
    stock: 16,
    category: 'أحذية',
    min_stock: 3,
    dist_id: 3,
  },
  {
    name: 'صندل فلات مزين',
    sku: 'MN-SHO-002',
    barcode: '6221008002',
    price: 1100,
    cost: 520,
    stock: 25,
    category: 'أحذية',
    min_stock: 5,
    dist_id: 3,
  },
  {
    name: 'بوت شمواه أنكل',
    sku: 'MN-SHO-003',
    barcode: '6221008003',
    price: 2800,
    cost: 1350,
    stock: 10,
    category: 'أحذية',
    min_stock: 3,
    dist_id: 3,
  },
  // إكسسوارات (Accessories)
  {
    name: 'وشاح حرير مطبوع',
    sku: 'MN-ACC-001',
    barcode: '6221009001',
    price: 850,
    cost: 380,
    stock: 40,
    category: 'إكسسوارات',
    min_stock: 10,
    dist_id: 4,
  },
  {
    name: 'نظارة شمس أوفرسايز',
    sku: 'MN-ACC-002',
    barcode: '6221009002',
    price: 1450,
    cost: 680,
    stock: 18,
    category: 'إكسسوارات',
    min_stock: 5,
    dist_id: 4,
  },
  {
    name: 'حزام جلد عريض',
    sku: 'MN-ACC-003',
    barcode: '6221009003',
    price: 750,
    cost: 340,
    stock: 30,
    category: 'إكسسوارات',
    min_stock: 8,
    dist_id: 3,
  },
  // عبايات (Abayas)
  {
    name: 'عباية كريب مطرزة',
    sku: 'MN-ABA-001',
    barcode: '6221010001',
    price: 3200,
    cost: 1550,
    stock: 20,
    category: 'عبايات',
    min_stock: 5,
    dist_id: 1,
  },
  {
    name: 'عباية ملونة كاجوال',
    sku: 'MN-ABA-002',
    barcode: '6221010002',
    price: 2100,
    cost: 1000,
    stock: 25,
    category: 'عبايات',
    min_stock: 5,
    dist_id: 1,
  },
  // حجاب (Hijab)
  {
    name: 'طرحة شيفون سادة',
    sku: 'MN-HJB-001',
    barcode: '6221011001',
    price: 350,
    cost: 150,
    stock: 80,
    category: 'حجاب',
    min_stock: 20,
    dist_id: 5,
  },
  {
    name: 'إيشارب حرير مطبوع',
    sku: 'MN-HJB-002',
    barcode: '6221011002',
    price: 650,
    cost: 300,
    stock: 60,
    category: 'حجاب',
    min_stock: 15,
    dist_id: 5,
  },
  {
    name: 'بندانة قطن',
    sku: 'MN-HJB-003',
    barcode: '6221011003',
    price: 180,
    cost: 80,
    stock: 100,
    category: 'حجاب',
    min_stock: 25,
    dist_id: 5,
  },
];

const insertProduct = db.prepare(
  `INSERT INTO products (name, sku, barcode, price, cost_price, stock, category, category_id, min_stock, distributor_id, status)
   VALUES (?, ?, ?, ?, ?, ?, ?, (SELECT id FROM categories WHERE name = ?), ?, ?, 'active')`
);
const seedProducts = db.transaction(() => {
  for (const p of products) {
    insertProduct.run(
      p.name,
      p.sku,
      p.barcode,
      p.price,
      p.cost,
      p.stock,
      p.category,
      p.category,
      p.min_stock,
      p.dist_id
    );
  }
});
seedProducts();
console.log(`✓ ${products.length} products inserted.`);

// ─── Customers (Egyptian) ────────────────────────────────────────
const customers = [
  {
    name: 'نورا عبدالرحمن',
    phone: '+201001234567',
    address: 'شارع 9، المعادي، القاهرة',
    notes: 'عميلة VIP',
    points: 1250,
  },
  {
    name: 'ياسمين خالد',
    phone: '+201112223344',
    address: 'شارع مصطفى النحاس، مدينة نصر، القاهرة',
    notes: '',
    points: 800,
  },
  {
    name: 'هدى إبراهيم',
    phone: '+201223334455',
    address: 'شارع 26 يوليو، الزمالك، القاهرة',
    notes: 'تفضل التوصيل صباحاً',
    points: 450,
  },
  {
    name: 'فاطمة السيد',
    phone: '+201014445566',
    address: 'شارع الهرم، الجيزة',
    notes: '',
    points: 200,
  },
  {
    name: 'مريم أحمد',
    phone: '+201115556677',
    address: 'كمبوند ميفيدا، التجمع الخامس، القاهرة الجديدة',
    notes: 'عميلة جديدة',
    points: 50,
  },
  {
    name: 'سلمى حسين',
    phone: '+201226667788',
    address: 'شارع أبو قير، الإسكندرية',
    notes: '',
    points: 620,
  },
  {
    name: 'رنا محمود',
    phone: '+201017778899',
    address: 'شارع التحرير، الدقي، الجيزة',
    notes: 'تحب العبايات',
    points: 980,
  },
  {
    name: 'لمياء عادل',
    phone: '+201118889900',
    address: 'حي اللوتس، التجمع الأول، القاهرة الجديدة',
    notes: '',
    points: 150,
  },
  {
    name: 'دينا وليد',
    phone: '+201229990011',
    address: 'شارع البحر، المنصورة، الدقهلية',
    notes: '',
    points: 340,
  },
  {
    name: 'أميرة طارق',
    phone: '+201010011223',
    address: 'شارع الجمهورية، طنطا، الغربية',
    notes: 'عميلة منتظمة',
    points: 1500,
  },
  { name: 'جنى حسام', phone: '+201111122334', address: 'المهندسين، الجيزة', notes: '', points: 75 },
  {
    name: 'ريهام سعيد',
    phone: '+201212233445',
    address: 'شارع الكورنيش، المعادي، القاهرة',
    notes: '',
    points: 420,
  },
  {
    name: 'شيماء مصطفى',
    phone: '+201013344556',
    address: 'مدينتي، القاهرة الجديدة',
    notes: 'تحب الماركات',
    points: 890,
  },
  {
    name: 'نادين حاتم',
    phone: '+201114455667',
    address: 'شارع سوريا، المهندسين، الجيزة',
    notes: '',
    points: 560,
  },
  {
    name: 'منى الشريف',
    phone: '+201215566778',
    address: 'الرحاب، القاهرة الجديدة',
    notes: 'تدفع بالبطاقة دائماً',
    points: 2100,
  },
];

const insertCustomer = db.prepare(
  `INSERT INTO customers (name, phone, address, notes, loyalty_points) VALUES (?, ?, ?, ?, ?)`
);
const seedCustomers = db.transaction(() => {
  for (const c of customers) {
    insertCustomer.run(c.name, c.phone, c.address, c.notes, c.points);
  }
});
seedCustomers();
console.log(`✓ ${customers.length} customers inserted.`);

// ─── Sales (last 30 days, realistic EGP) ─────────────────────────
function randomDate(daysAgo: number): string {
  const d = new Date();
  d.setDate(d.getDate() - Math.floor(Math.random() * daysAgo));
  d.setHours(Math.floor(Math.random() * 12) + 9, Math.floor(Math.random() * 60), 0, 0);
  return d.toISOString().replace('T', ' ').slice(0, 19);
}

const paymentMethods = ['Cash', 'Card', 'Card', 'Cash', 'Cash', 'Other'];

const insertSale = db.prepare(
  `INSERT INTO sales (total, discount, discount_type, payment_method, cashier_id, customer_id, created_at)
   VALUES (?, ?, ?, ?, ?, ?, ?)`
);
const insertSaleItem = db.prepare(
  `INSERT INTO sale_items (sale_id, product_id, quantity, unit_price, cost_price)
   VALUES (?, ?, ?, ?, ?)`
);

const salesData: {
  total: number;
  discount: number;
  dtype: string;
  method: string;
  cashier: number;
  customer: number | null;
  date: string;
  items: { pid: number; qty: number; price: number; cost: number }[];
}[] = [];

// Generate 40 realistic sales
for (let i = 0; i < 40; i++) {
  const numItems = Math.floor(Math.random() * 3) + 1;
  const items: { pid: number; qty: number; price: number; cost: number }[] = [];
  let total = 0;

  for (let j = 0; j < numItems; j++) {
    const pIdx = Math.floor(Math.random() * products.length);
    const qty = Math.floor(Math.random() * 2) + 1;
    const price = products[pIdx].price;
    const cost = products[pIdx].cost;
    items.push({ pid: pIdx + 1, qty, price, cost });
    total += price * qty;
  }

  const hasDiscount = Math.random() > 0.7;
  const discount = hasDiscount ? Math.round(total * 0.1) : 0;
  const finalTotal = total - discount;

  salesData.push({
    total: finalTotal,
    discount,
    dtype: hasDiscount ? 'percentage' : 'fixed',
    method: paymentMethods[Math.floor(Math.random() * paymentMethods.length)],
    cashier: Math.random() > 0.3 ? 2 : 1, // mostly cashier (id=2)
    customer: Math.random() > 0.4 ? Math.floor(Math.random() * 15) + 1 : null,
    date: randomDate(30),
    items,
  });
}

const seedSales = db.transaction(() => {
  for (const s of salesData) {
    const info = insertSale.run(
      s.total,
      s.discount,
      s.dtype,
      s.method,
      s.cashier,
      s.customer,
      s.date
    );
    const saleId = info.lastInsertRowid;
    for (const item of s.items) {
      insertSaleItem.run(saleId, item.pid, item.qty, item.price, item.cost);
    }
  }
});
seedSales();
console.log(`✓ ${salesData.length} sales inserted.`);

// ─── Delivery Orders (Egyptian addresses) ────────────────────────
const deliveryOrders = [
  {
    num: 'DEL-2026-001',
    custId: 1,
    name: 'نورا عبدالرحمن',
    phone: '+201001234567',
    address: 'شارع 9، المعادي، القاهرة',
    status: 'Delivered',
    assignedTo: 3,
    items: [
      { pid: 1, qty: 1 },
      { pid: 24, qty: 2 },
    ],
  },
  {
    num: 'DEL-2026-002',
    custId: 2,
    name: 'ياسمين خالد',
    phone: '+201112223344',
    address: 'شارع مصطفى النحاس، مدينة نصر، القاهرة',
    status: 'Delivered',
    assignedTo: 3,
    items: [{ pid: 7, qty: 1 }],
  },
  {
    num: 'DEL-2026-003',
    custId: 5,
    name: 'مريم أحمد',
    phone: '+201115556677',
    address: 'كمبوند ميفيدا، التجمع الخامس',
    status: 'In Transit',
    assignedTo: 3,
    items: [
      { pid: 27, qty: 1 },
      { pid: 29, qty: 3 },
    ],
  },
  {
    num: 'DEL-2026-004',
    custId: 6,
    name: 'سلمى حسين',
    phone: '+201226667788',
    address: 'شارع أبو قير، الإسكندرية',
    status: 'Shipping Contacted',
    assignedTo: 3,
    items: [{ pid: 2, qty: 1 }],
  },
  {
    num: 'DEL-2026-005',
    custId: 10,
    name: 'أميرة طارق',
    phone: '+201010011223',
    address: 'شارع الجمهورية، طنطا',
    status: 'Order Received',
    assignedTo: 3,
    items: [
      { pid: 13, qty: 1 },
      { pid: 14, qty: 1 },
    ],
  },
  {
    num: 'DEL-2026-006',
    custId: 7,
    name: 'رنا محمود',
    phone: '+201017778899',
    address: 'شارع التحرير، الدقي، الجيزة',
    status: 'Delivered',
    assignedTo: 3,
    items: [
      { pid: 27, qty: 1 },
      { pid: 28, qty: 1 },
    ],
  },
  {
    num: 'DEL-2026-007',
    custId: 15,
    name: 'منى الشريف',
    phone: '+201215566778',
    address: 'الرحاب، القاهرة الجديدة',
    status: 'Order Received',
    assignedTo: 3,
    items: [
      { pid: 19, qty: 1 },
      { pid: 16, qty: 1 },
      { pid: 30, qty: 2 },
    ],
  },
  {
    num: 'DEL-2026-008',
    custId: 3,
    name: 'هدى إبراهيم',
    phone: '+201223334455',
    address: 'شارع 26 يوليو، الزمالك، القاهرة',
    status: 'Delivered',
    assignedTo: 3,
    items: [{ pid: 21, qty: 1 }],
  },
];

const insertDelivery = db.prepare(
  `INSERT INTO delivery_orders (order_number, customer_id, customer_name, phone, address, status, assigned_to, created_at)
   VALUES (?, ?, ?, ?, ?, ?, ?, datetime('now', '-' || ? || ' days'))`
);
const insertDeliveryItem = db.prepare(
  `INSERT INTO delivery_items (order_id, product_id, quantity) VALUES (?, ?, ?)`
);
const seedDeliveries = db.transaction(() => {
  for (let i = 0; i < deliveryOrders.length; i++) {
    const d = deliveryOrders[i];
    const daysAgo = deliveryOrders.length - i; // older orders first
    const info = insertDelivery.run(
      d.num,
      d.custId,
      d.name,
      d.phone,
      d.address,
      d.status,
      d.assignedTo,
      daysAgo
    );
    const orderId = info.lastInsertRowid;
    for (const item of d.items) {
      insertDeliveryItem.run(orderId, item.pid, item.qty);
    }
  }
});
seedDeliveries();
console.log(`✓ ${deliveryOrders.length} delivery orders inserted.`);

// ─── Expenses (EGP) ──────────────────────────────────────────────
const expenses = [
  {
    category: 'rent',
    amount: 35000,
    desc: 'إيجار المحل - فرع المعادي',
    date: '2026-02-01',
    recurring: 'monthly',
  },
  {
    category: 'rent',
    amount: 28000,
    desc: 'إيجار المحل - فرع التجمع',
    date: '2026-02-01',
    recurring: 'monthly',
  },
  {
    category: 'salaries',
    amount: 85000,
    desc: 'رواتب الموظفين - فبراير',
    date: '2026-02-01',
    recurring: 'monthly',
  },
  {
    category: 'utilities',
    amount: 4500,
    desc: 'فاتورة كهرباء',
    date: '2026-02-05',
    recurring: 'monthly',
  },
  {
    category: 'utilities',
    amount: 1200,
    desc: 'فاتورة مياه',
    date: '2026-02-05',
    recurring: 'monthly',
  },
  {
    category: 'utilities',
    amount: 2800,
    desc: 'إنترنت وتليفون',
    date: '2026-02-05',
    recurring: 'monthly',
  },
  {
    category: 'marketing',
    amount: 15000,
    desc: 'إعلانات فيسبوك وإنستجرام',
    date: '2026-02-10',
    recurring: 'monthly',
  },
  {
    category: 'marketing',
    amount: 8000,
    desc: 'تصوير منتجات جديدة',
    date: '2026-02-12',
    recurring: 'one_time',
  },
  {
    category: 'supplies',
    amount: 3500,
    desc: 'أكياس وعلب تغليف',
    date: '2026-02-08',
    recurring: 'monthly',
  },
  {
    category: 'supplies',
    amount: 1800,
    desc: 'مستلزمات نظافة',
    date: '2026-02-15',
    recurring: 'monthly',
  },
  {
    category: 'other',
    amount: 5000,
    desc: 'صيانة تكييف المحل',
    date: '2026-02-18',
    recurring: 'one_time',
  },
  {
    category: 'other',
    amount: 2500,
    desc: 'رسوم ترخيص سنوية',
    date: '2026-01-15',
    recurring: 'yearly',
  },
];

const insertExpense = db.prepare(
  `INSERT INTO expenses (category, amount, description, date, recurring, user_id) VALUES (?, ?, ?, ?, ?, 1)`
);
const seedExpenses = db.transaction(() => {
  for (const e of expenses) {
    insertExpense.run(e.category, e.amount, e.desc, e.date, e.recurring);
  }
});
seedExpenses();
console.log(`✓ ${expenses.length} expenses inserted.`);

// ─── Loyalty Transactions ────────────────────────────────────────
const insertLoyalty = db.prepare(
  `INSERT INTO loyalty_transactions (customer_id, sale_id, points, type, note) VALUES (?, ?, ?, ?, ?)`
);
const seedLoyalty = db.transaction(() => {
  insertLoyalty.run(1, 1, 285, 'earned', 'نقاط من عملية شراء');
  insertLoyalty.run(1, null, 500, 'earned', 'مكافأة عميل VIP');
  insertLoyalty.run(2, 2, 180, 'earned', 'نقاط من عملية شراء');
  insertLoyalty.run(10, 3, 350, 'earned', 'نقاط من عملية شراء');
  insertLoyalty.run(15, null, 200, 'redeemed', 'استبدال نقاط');
  insertLoyalty.run(7, 4, 420, 'earned', 'نقاط من عملية شراء');
  insertLoyalty.run(13, 5, 150, 'earned', 'نقاط من عملية شراء');
});
seedLoyalty();
console.log('✓ Loyalty transactions inserted.');

// ─── Coupons (Arabic) ────────────────────────────────────────────
const insertCoupon = db.prepare(
  `INSERT INTO coupons (code, type, value, min_purchase, max_discount, starts_at, expires_at, max_uses, status, scope)
   VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'active', 'all')`
);
const seedCoupons = db.transaction(() => {
  insertCoupon.run('MOON10', 'percentage', 10, 500, 500, '2026-01-01', '2026-12-31', 100);
  insertCoupon.run('WELCOME', 'percentage', 15, 1000, 750, '2026-01-01', '2026-06-30', 50);
  insertCoupon.run('EID2026', 'percentage', 20, 2000, 1000, '2026-03-25', '2026-04-10', 200);
  insertCoupon.run('SUMMER500', 'fixed', 500, 3000, 500, '2026-06-01', '2026-08-31', 150);
  insertCoupon.run('VIP25', 'percentage', 25, 5000, 2000, '2026-01-01', '2026-12-31', 30);
});
seedCoupons();
console.log('✓ 5 coupons inserted.');

// ─── Gift Cards (EGP) ───────────────────────────────────────────
const insertGiftCard = db.prepare(
  `INSERT INTO gift_cards (code, barcode, initial_value, balance, customer_id, expires_at, status) VALUES (?, ?, ?, ?, ?, ?, 'active')`
);
const seedGiftCards = db.transaction(() => {
  insertGiftCard.run('GIFT-001', '9991001001', 1000, 1000, 1, '2026-12-31');
  insertGiftCard.run('GIFT-002', '9991001002', 2000, 1500, 5, '2026-12-31');
  insertGiftCard.run('GIFT-003', '9991001003', 500, 500, null, '2026-06-30');
  insertGiftCard.run('GIFT-004', '9991001004', 3000, 3000, 10, '2027-02-28');
});
seedGiftCards();
console.log('✓ 4 gift cards inserted.');

// ─── Shipping Companies (Egyptian) ──────────────────────────────
const insertShipping = db.prepare(
  `INSERT INTO shipping_companies (name, phone, website) VALUES (?, ?, ?)`
);
const seedShipping = db.transaction(() => {
  insertShipping.run('أرامكس مصر', '+201234567890', 'https://www.aramex.com/eg');
  insertShipping.run('بوسطة', '+201234567891', 'https://bosta.co');
  insertShipping.run('مايلر', '+201234567892', 'https://mylerz.com');
  insertShipping.run('توصيل خاص', '+201234567893', '');
});
seedShipping();
console.log('✓ 4 shipping companies inserted.');

// ─── Locations (Egyptian branches) ──────────────────────────────
const insertLocation = db.prepare(
  `INSERT INTO locations (name, address, type) VALUES (?, ?, 'Store')`
);
const seedLocations = db.transaction(() => {
  insertLocation.run('فرع المعادي', 'شارع 9، المعادي، القاهرة');
  insertLocation.run('فرع التجمع الخامس', 'داون تاون مول، التجمع الخامس، القاهرة الجديدة');
});
seedLocations();
console.log('✓ 2 locations inserted.');

// ─── Collections (Arabic) ───────────────────────────────────────
const insertCollection = db.prepare(
  `INSERT INTO collections (name, description, status) VALUES (?, ?, 'active')`
);
const insertCollectionProduct = db.prepare(
  `INSERT INTO collection_products (collection_id, product_id) VALUES (?, ?)`
);
const seedCollections = db.transaction(() => {
  const c1 = insertCollection.run('مجموعة ربيع ٢٠٢٦', 'أحدث صيحات الموضة لموسم الربيع');
  insertCollectionProduct.run(c1.lastInsertRowid, 3); // فستان كتان صيفي
  insertCollectionProduct.run(c1.lastInsertRowid, 16); // بلوزة ساتان
  insertCollectionProduct.run(c1.lastInsertRowid, 17); // قميص كتان
  insertCollectionProduct.run(c1.lastInsertRowid, 22); // صندل فلات
  insertCollectionProduct.run(c1.lastInsertRowid, 11); // جيبة بليسيه
  insertCollectionProduct.run(c1.lastInsertRowid, 29); // طرحة شيفون

  const c2 = insertCollection.run('أناقة السهرة', 'فساتين وإكسسوارات مناسبات خاصة');
  insertCollectionProduct.run(c2.lastInsertRowid, 2); // فستان سهرة
  insertCollectionProduct.run(c2.lastInsertRowid, 8); // حقيبة سهرة
  insertCollectionProduct.run(c2.lastInsertRowid, 13); // عقد ذهب
  insertCollectionProduct.run(c2.lastInsertRowid, 14); // حلق لؤلؤ
  insertCollectionProduct.run(c2.lastInsertRowid, 21); // حذاء كعب عالي

  const c3 = insertCollection.run('العباية العصرية', 'عبايات وحجاب بلمسة عصرية');
  insertCollectionProduct.run(c3.lastInsertRowid, 27); // عباية كريب
  insertCollectionProduct.run(c3.lastInsertRowid, 28); // عباية ملونة
  insertCollectionProduct.run(c3.lastInsertRowid, 29); // طرحة شيفون
  insertCollectionProduct.run(c3.lastInsertRowid, 30); // إيشارب حرير
  insertCollectionProduct.run(c3.lastInsertRowid, 24); // وشاح حرير
});
seedCollections();
console.log('✓ 3 collections inserted.');

// ─── Settings (Arabic defaults) ─────────────────────────────────
const insertSetting = db.prepare(`INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)`);
const seedSettings = db.transaction(() => {
  insertSetting.run('store_name', 'MOON Fashion & Style');
  insertSetting.run('store_name_ar', 'مون للأزياء والموضة');
  insertSetting.run('currency', 'EGP');
  insertSetting.run('currency_symbol', 'ج.م');
  insertSetting.run('tax_rate', '14');
  insertSetting.run('tax_name', 'ضريبة القيمة المضافة');
  insertSetting.run('phone', '+201001112233');
  insertSetting.run('address', 'شارع 9، المعادي، القاهرة، مصر');
  insertSetting.run('loyalty_points_per_egp', '1');
  insertSetting.run('loyalty_egp_per_point', '0.1');
  insertSetting.run('receipt_footer', 'شكراً لتسوقكم في مون! 🌙');
  insertSetting.run('receipt_show_logo', 'true');
  insertSetting.run('low_stock_threshold', '5');
});
seedSettings();
console.log('✓ Settings configured (EGP, Egypt).');

// ─── Custom Roles ────────────────────────────────────────────────
// Already seeded by migration 044 with defaults

// ─── Activity Notes ──────────────────────────────────────────────
const insertNote = db.prepare(
  `INSERT INTO activity_notes (user_id, content, pinned) VALUES (?, ?, ?)`
);
const seedNotes = db.transaction(() => {
  insertNote.run(1, 'تم استلام شحنة جديدة من دار الأزياء المصرية - ٥٠ قطعة فساتين', 1);
  insertNote.run(
    1,
    'ملاحظة: العميلة نورا عبدالرحمن طلبت فستان سهرة مقاس خاص - يرجى المتابعة مع المورد',
    0
  );
  insertNote.run(2, 'المخزون من طرحة شيفون سادة بدأ ينفذ - يرجى الطلب من المورد', 1);
  insertNote.run(1, 'تم تحديث أسعار مجموعة الربيع ٢٠٢٦', 0);
  insertNote.run(2, 'عروض عيد الأم: خصم ١٥٪ على كل المجوهرات حتى ٢١ مارس', 1);
});
seedNotes();
console.log('✓ Activity notes inserted.');

// ─── Audit Log (sample entries) ──────────────────────────────────
const insertAudit = db.prepare(
  `INSERT INTO audit_log (user_id, user_name, action, entity_type, entity_id, details, ip_address, created_at)
   VALUES (?, ?, ?, ?, ?, ?, '127.0.0.1', datetime('now', '-' || ? || ' hours'))`
);
const seedAudit = db.transaction(() => {
  insertAudit.run(1, 'أحمد محمد', 'create', 'product', 1, '{"name":"فستان حرير ميدي"}', 48);
  insertAudit.run(1, 'أحمد محمد', 'create', 'product', 2, '{"name":"فستان سهرة مطرز"}', 47);
  insertAudit.run(2, 'سارة حسن', 'create', 'sale', 1, '{"total":2850}', 36);
  insertAudit.run(2, 'سارة حسن', 'create', 'sale', 2, '{"total":4500}', 24);
  insertAudit.run(
    1,
    'أحمد محمد',
    'update',
    'product',
    5,
    '{"field":"price","old":5000,"new":5500}',
    12
  );
  insertAudit.run(3, 'محمد علي', 'update', 'delivery', 1, '{"status":"Delivered"}', 6);
  insertAudit.run(1, 'أحمد محمد', 'create', 'expense', 1, '{"amount":35000,"category":"rent"}', 3);
  insertAudit.run(2, 'سارة حسن', 'create', 'sale', 5, '{"total":3200}', 1);
});
seedAudit();
console.log('✓ Audit log entries inserted.');

// ─── Done ────────────────────────────────────────────────────────
console.log('\n✅ Seeding complete! Database ready with Egyptian Arabic data.');
console.log('   Login: admin@moon.com / admin123');
db.close();
process.exit(0);
