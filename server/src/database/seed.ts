import bcrypt from 'bcrypt';
import { Pool } from 'pg';
import { getPool, closePool } from './pool';
import { withTransaction } from './transaction';
import logger from '../../lib/logger';

export async function seedDatabase(pool?: Pool): Promise<void> {
  if (process.env.NODE_ENV === 'production' && !process.env.FORCE_SEED) {
    throw new Error(
      'Seeding is blocked in production mode unless FORCE_SEED=true is explicitly set'
    );
  }

  const dbPool = pool || getPool();

  await withTransaction(async (client) => {
    logger.info('Clearing existing data...');
    // Clear data from tables in dependency order
    const tablesToClear = [
      'auto_descriptions',
      'sales_predictions',
      'ai_chat_messages',
      'ai_chat_sessions',
      'dashboard_widgets',
      'data_warehouse_sync',
      'saved_reports',
      'report_builder',
      'product_reviews',
      'offline_sync_queue',
      'notifications',
      'audit_log',
      'warranty_claims',
      'warranties',
      'store_performance',
      'inter_store_transfers',
      'label_templates',
      'collection_products',
      'collections',
      'bundle_items',
      'product_bundles',
      'storefront_banners',
      'storefront_config',
      'online_order_items',
      'online_orders',
      'delivery_tracking',
      'delivery_status_history',
      'delivery_items',
      'delivery_orders',
      'shipping_companies',
      'vendor_reviews',
      'vendor_commissions',
      'vendor_products',
      'vendors',
      'purchase_order_items',
      'purchase_orders',
      'exchange_items',
      'exchanges',
      'layaway_payments',
      'layaway_items',
      'layaway_plans',
      'expenses',
      'shifts',
      'register_movements',
      'register_sessions',
      'branch_inventory',
      'inventory_snapshots',
      'stock_reservations',
      'stock_count_items',
      'stock_counts',
      'stock_adjustments',
      'gift_card_transactions',
      'gift_cards',
      'coupon_usage',
      'coupons',
      'refunds',
      'sale_payments',
      'sale_items',
      'sales',
      'settings',
      'customer_feedback',
      'customer_segment_members',
      'customer_segments',
      'loyalty_transactions',
      'customers',
      'price_history',
      'product_variants',
      'products',
      'distributors',
      'categories',
      'refresh_tokens',
      'users',
      'branches',
    ];

    for (const table of tablesToClear) {
      await client.query(`DELETE FROM "${table}"`);
    }

    // Reset sequences if available
    try {
      const seqs = await client.query<{ sequence_name: string }>(
        `SELECT sequence_name FROM information_schema.sequences WHERE sequence_schema = 'public'`
      );
      for (const seq of seqs.rows) {
        await client.query(`ALTER SEQUENCE "${seq.sequence_name}" RESTART WITH 1`);
      }
    } catch (_seqErr) {
      // Non-fatal in mock/test environments without sequences view
    }

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

    for (const c of categories) {
      await client.query('INSERT INTO categories (name, code) VALUES ($1, $2)', [c.name, c.code]);
    }
    logger.info(`✓ ${categories.length} categories inserted.`);

    // ─── Users ───────────────────────────────────────────────────────
    const adminHash = bcrypt.hashSync('admin123', 10);
    const cashierHash = bcrypt.hashSync('cashier123', 10);
    const deliveryHash = bcrypt.hashSync('delivery123', 10);

    await client.query(
      'INSERT INTO users (name, email, password_hash, role, commission_rate) VALUES ($1, $2, $3, $4, $5)',
      ['أحمد محمد', 'admin@moon.com', adminHash, 'Admin', 0]
    );
    await client.query(
      'INSERT INTO users (name, email, password_hash, role, commission_rate) VALUES ($1, $2, $3, $4, $5)',
      ['سارة حسن', 'sarah@moon.com', cashierHash, 'Cashier', 2.5]
    );
    await client.query(
      'INSERT INTO users (name, email, password_hash, role, commission_rate) VALUES ($1, $2, $3, $4, $5)',
      ['محمد علي', 'james@moon.com', deliveryHash, 'Delivery', 0]
    );
    logger.info('✓ 3 users created (admin@moon.com / admin123)');

    // ─── Distributors ────────────────────────────────────────────────
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

    const distMap = new Map<number, number>();
    for (let i = 0; i < distributors.length; i++) {
      const d = distributors[i];
      const res = await client.query<{ id: number }>(
        'INSERT INTO distributors (name, contact_person, phone, email, address, notes) VALUES ($1, $2, $3, $4, $5, $6) RETURNING id',
        [d.name, d.contact, d.phone, d.email, d.address, d.notes]
      );
      distMap.set(i + 1, res.rows[0].id);
    }
    logger.info(`✓ ${distributors.length} distributors inserted.`);

    // ─── Products ────────────────────────────────────────────────────
    const products = [
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

    for (const p of products) {
      const realDistId = distMap.get(p.dist_id) || null;
      await client.query(
        `INSERT INTO products (name, sku, barcode, price, cost_price, stock, category, category_id, min_stock, distributor_id, status)
         VALUES ($1, $2, $3, $4, $5, $6, $7, (SELECT id FROM categories WHERE name = $8), $9, $10, 'active')`,
        [
          p.name,
          p.sku,
          p.barcode,
          p.price,
          p.cost,
          p.stock,
          p.category,
          p.category,
          p.min_stock,
          realDistId,
        ]
      );
    }
    logger.info(`✓ ${products.length} products inserted.`);

    // ─── Customers ───────────────────────────────────────────────────
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
      {
        name: 'جنى حسام',
        phone: '+201111122334',
        address: 'المهندسين، الجيزة',
        notes: '',
        points: 75,
      },
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

    const custMap = new Map<number, number>();
    for (let i = 0; i < customers.length; i++) {
      const c = customers[i];
      const res = await client.query<{ id: number }>(
        'INSERT INTO customers (name, phone, address, notes, loyalty_points) VALUES ($1, $2, $3, $4, $5) RETURNING id',
        [c.name, c.phone, c.address, c.notes, c.points]
      );
      custMap.set(i + 1, res.rows[0].id);
    }
    logger.info(`✓ ${customers.length} customers inserted.`);

    // ─── Settings ────────────────────────────────────────────────────
    const settings = [
      ['store_name', 'MOON Fashion & Style'],
      ['store_name_ar', 'مون للأزياء والموضة'],
      ['currency', 'EGP'],
      ['currency_symbol', 'ج.م'],
      ['tax_rate', '14'],
      ['tax_name', 'ضريبة القيمة المضافة'],
      ['phone', '+201001112233'],
      ['address', 'شارع 9، المعادي، القاهرة، مصر'],
      ['loyalty_points_per_egp', '1'],
      ['loyalty_egp_per_point', '0.1'],
      ['receipt_footer', 'شكراً لتسوقكم في مون! 🌙'],
      ['receipt_show_logo', 'true'],
      ['low_stock_threshold', '5'],
    ];

    for (const [key, value] of settings) {
      await client.query(
        `INSERT INTO settings (key, value) VALUES ($1, $2) ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value`,
        [key, value]
      );
    }
    logger.info('✓ Settings configured (EGP, Egypt).');

    // ─── Shipping Companies ──────────────────────────────────────────
    const shippingCompanies = [
      { name: 'أرامكس مصر', phone: '+201234567890', url: 'https://www.aramex.com/eg' },
      { name: 'بوسطة', phone: '+201234567891', url: 'https://bosta.co' },
      { name: 'مايلر', phone: '+201234567892', url: 'https://mylerz.com' },
      { name: 'توصيل خاص', phone: '+201234567893', url: '' },
    ];

    for (const s of shippingCompanies) {
      await client.query(
        'INSERT INTO shipping_companies (name, contact_phone, tracking_url_template) VALUES ($1, $2, $3)',
        [s.name, s.phone, s.url]
      );
    }
    logger.info(`✓ ${shippingCompanies.length} shipping companies inserted.`);

    // ─── Branches ────────────────────────────────────────────────────
    const branches = [
      { name: 'فرع المعادي', code: 'MAADI', address: 'شارع 9، المعادي، القاهرة', is_main: 1 },
      {
        name: 'فرع التجمع الخامس',
        code: 'TAGAMOA',
        address: 'داون تاون مول، التجمع الخامس',
        is_main: 0,
      },
    ];

    for (const b of branches) {
      await client.query(
        'INSERT INTO branches (name, code, address, is_main, currency) VALUES ($1, $2, $3, $4, $5)',
        [b.name, b.code, b.address, b.is_main, 'EGP']
      );
    }
    logger.info(`✓ ${branches.length} branches inserted.`);

    // ─── Coupons ─────────────────────────────────────────────────────
    const coupons = [
      {
        code: 'MOON10',
        type: 'percentage',
        value: 10,
        min: 500,
        max: 500,
        start: '2026-01-01',
        end: '2026-12-31',
        uses: 100,
      },
      {
        code: 'WELCOME',
        type: 'percentage',
        value: 15,
        min: 1000,
        max: 750,
        start: '2026-01-01',
        end: '2026-06-30',
        uses: 50,
      },
      {
        code: 'EID2026',
        type: 'percentage',
        value: 20,
        min: 2000,
        max: 1000,
        start: '2026-03-25',
        end: '2026-04-10',
        uses: 200,
      },
      {
        code: 'SUMMER500',
        type: 'fixed',
        value: 500,
        min: 3000,
        max: 500,
        start: '2026-06-01',
        end: '2026-08-31',
        uses: 150,
      },
      {
        code: 'VIP25',
        type: 'percentage',
        value: 25,
        min: 5000,
        max: 2000,
        start: '2026-01-01',
        end: '2026-12-31',
        uses: 30,
      },
    ];

    for (const c of coupons) {
      await client.query(
        `INSERT INTO coupons (code, type, value, min_purchase, max_discount, starts_at, expires_at, max_uses, status, scope)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, 'active', 'all')`,
        [c.code, c.type, c.value, c.min, c.max, c.start, c.end, c.uses]
      );
    }
    logger.info(`✓ ${coupons.length} coupons inserted.`);

    // ─── Gift Cards ──────────────────────────────────────────────────
    const giftCards = [
      {
        code: 'GIFT-001',
        barcode: '9991001001',
        value: 1000,
        customer_id: 1,
        expires: '2026-12-31',
      },
      {
        code: 'GIFT-002',
        barcode: '9991001002',
        value: 2000,
        customer_id: 5,
        expires: '2026-12-31',
      },
      {
        code: 'GIFT-003',
        barcode: '9991001003',
        value: 500,
        customer_id: null,
        expires: '2026-06-30',
      },
      {
        code: 'GIFT-004',
        barcode: '9991001004',
        value: 3000,
        customer_id: 10,
        expires: '2027-02-28',
      },
    ];

    for (const g of giftCards) {
      const realCustId = g.customer_id ? custMap.get(g.customer_id) || null : null;
      await client.query(
        `INSERT INTO gift_cards (code, barcode, initial_value, balance, customer_id, expires_at, status)
         VALUES ($1, $2, $3, $4, $5, $6, 'active')`,
        [g.code, g.barcode, g.value, g.value, realCustId, g.expires]
      );
    }
    logger.info(`✓ ${giftCards.length} gift cards inserted.`);
  }, dbPool);

  logger.info('✅ Seeding complete! Database ready with Egyptian Arabic data.');
}

// CLI Execution
if (require.main === module) {
  (async () => {
    try {
      await seedDatabase();
      console.log('Seeding finished successfully.');
    } catch (err) {
      console.error('Seeding failed:', err);
      process.exitCode = 1;
    } finally {
      await closePool();
    }
  })();
}
