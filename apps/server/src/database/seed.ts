import bcrypt from 'bcrypt';
import { Pool } from 'pg';
import { getPool, closePool } from './pool';
import { withTransaction } from './transaction';
import logger from '../../lib/logger';
import { slugify } from '../modules/inventory/shared/slug';

const DAY_MS = 24 * 60 * 60 * 1000;

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
      'branch_transfers',
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
      // Vendors was removed; its tables stay dormant until a drop migration retires them.
      'vendor_reviews',
      'vendor_payouts',
      'vendor_commissions',
      'vendor_products',
      'vendors',
      'purchase_order_items',
      'purchase_orders',
      'exchange_new_items',
      'exchange_returned_items',
      'exchange_items',
      'exchanges',
      // Layaway was removed; its tables stay dormant until a drop migration retires them.
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
    // `slug` is the storefront URL key. dresses, tops, knitwear, bags and abayas are the
    // homepage's category keys (tests/database/seedCatalogKeys.test.ts). Kimonos holds only
    // a discontinued product, so the storefront's empty-category state has a real target.
    const categories = [
      { name: 'فساتين', code: 'DRS', slug: 'dresses', name_en: 'Dresses' },
      { name: 'تريكو', code: 'KNT', slug: 'knitwear', name_en: 'Knitwear' },
      { name: 'حقائب', code: 'BAG', slug: 'bags', name_en: 'Bags' },
      { name: 'بناطيل', code: 'BTM', slug: 'trousers-skirts', name_en: 'Trousers & Skirts' },
      { name: 'مجوهرات', code: 'JWL', slug: 'jewellery', name_en: 'Jewellery' },
      { name: 'بلوزات', code: 'TOP', slug: 'tops', name_en: 'Tops' },
      { name: 'جاكيتات', code: 'JKT', slug: 'outerwear', name_en: 'Outerwear' },
      { name: 'أحذية', code: 'SHO', slug: 'shoes', name_en: 'Shoes' },
      { name: 'إكسسوارات', code: 'ACC', slug: 'accessories', name_en: 'Accessories' },
      { name: 'عبايات', code: 'ABA', slug: 'abayas', name_en: 'Abayas' },
      { name: 'حجاب', code: 'HJB', slug: 'scarves-hijabs', name_en: 'Scarves & Hijabs' },
      { name: 'كيمونو', code: 'KIM', slug: 'kimonos', name_en: 'Kimonos' },
    ];

    for (const c of categories) {
      await client.query(
        'INSERT INTO categories (name, code, slug, name_en) VALUES ($1, $2, $3, $4)',
        [c.name, c.code, c.slug, c.name_en]
      );
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
        name_en: 'Silk Midi Dress',
        days_ago: 4,
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
        name_en: 'Embroidered Evening Gown',
        days_ago: 12,
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
        name_en: 'Linen Summer Dress',
        days_ago: 21,
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
        name_en: 'Cashmere Pullover',
        days_ago: 27,
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
        name_en: 'Long Wool Cardigan',
        days_ago: 33,
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
        name_en: 'Fine Knit T-Shirt',
        days_ago: 88,
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
        name_en: 'Leather Crossbody Bag',
        days_ago: 40,
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
        name_en: 'Velvet Evening Clutch',
        days_ago: 9,
        barcode: '6221003002',
        price: 1800,
        cost: 850,
        stock: 0,
        category: 'حقائب',
        min_stock: 3,
        dist_id: 3,
      },
      {
        name: 'شنطة ظهر جلد',
        sku: 'MN-BAG-003',
        name_en: 'Leather Backpack',
        days_ago: 62,
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
        name_en: 'Wide-Leg Trousers',
        days_ago: 18,
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
        name_en: 'Pleated Maxi Skirt',
        days_ago: 47,
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
        name_en: null,
        slug: 'high-waist-jeans',
        days_ago: 75,
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
        name_en: 'Fine Gold Necklace',
        days_ago: 6,
        barcode: '6221005001',
        price: 5500,
        cost: 3800,
        stock: 0,
        category: 'مجوهرات',
        min_stock: 2,
        dist_id: 4,
      },
      {
        name: 'حلق لؤلؤ طبيعي',
        sku: 'MN-JWL-002',
        name_en: 'Natural Pearl Earrings',
        days_ago: 15,
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
        name_en: null,
        slug: 'steel-ring-set',
        days_ago: 83,
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
        name_en: 'Satin Off-Shoulder Blouse',
        days_ago: 2,
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
        name_en: 'Oversized Linen Shirt',
        days_ago: 24,
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
        name_en: 'Hand-Crocheted Top',
        days_ago: 55,
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
        name_en: 'Classic Wool Blazer',
        days_ago: 36,
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
        name_en: 'Beige Trench Coat',
        days_ago: 68,
        barcode: '6221007002',
        price: 4200,
        cost: 2100,
        stock: 0,
        category: 'جاكيتات',
        min_stock: 3,
        dist_id: 2,
      },
      {
        name: 'حذاء جلد بكعب عالي',
        sku: 'MN-SHO-001',
        name_en: 'Leather High Heels',
        days_ago: 11,
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
        name_en: 'Embellished Flat Sandals',
        days_ago: 29,
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
        name_en: 'Suede Ankle Boots',
        days_ago: 80,
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
        name_en: 'Printed Silk Scarf',
        days_ago: 14,
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
        name_en: 'Oversized Sunglasses',
        days_ago: 58,
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
        name_en: 'Wide Leather Belt',
        days_ago: 71,
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
        name_en: 'Embroidered Crepe Abaya',
        days_ago: 8,
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
        name_en: 'Casual Colour Abaya',
        days_ago: 44,
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
        name_en: 'Plain Chiffon Hijab',
        days_ago: 52,
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
        name_en: 'Printed Silk Square',
        days_ago: 19,
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
        name_en: null,
        slug: 'cotton-bandana',
        days_ago: 90,
        barcode: '6221011003',
        price: 180,
        cost: 80,
        stock: 100,
        category: 'حجاب',
        min_stock: 25,
        dist_id: 5,
      },
      {
        name: 'فستان حرير سليب',
        sku: 'MN-DRS-004',
        name_en: 'Silk Slip Dress',
        days_ago: 3,
        barcode: '6221001004',
        price: 6750,
        cost: 3300,
        stock: 0,
        category: 'فساتين',
        min_stock: 2,
        dist_id: 1,
      },
      {
        name: 'قميص حرير واسع',
        sku: 'MN-TOP-004',
        name_en: 'Relaxed Silk Shirt',
        days_ago: 38,
        barcode: '6221006004',
        price: 2275,
        cost: 1100,
        stock: 9,
        category: 'بلوزات',
        min_stock: 3,
        dist_id: 1,
      },
      {
        name: 'كيمونو قطن مطبوع',
        sku: 'MN-KIM-001',
        name_en: 'Printed Cotton Kimono',
        days_ago: 85,
        barcode: '6221012001',
        price: 1750,
        cost: 820,
        stock: 6,
        category: 'كيمونو',
        min_stock: 2,
        dist_id: 5,
        status: 'discontinued',
      },
    ];

    /**
     * One short line of copy per piece, Arabic primary and English beside it. The
     * storefront's product card shows the opening two lines of it and the product page
     * shows all of it, so a seeded database exercises both. `MN-HJB-003` deliberately
     * has none: a card with no description is a real state.
     */
    const productCopy: Record<string, { ar: string; en: string }> = {
      'MN-DRS-001': {
        ar: 'حرير بقصّة ميدي انسيابية، بحزام يُربط عند الخصر.',
        en: 'Fluid silk cut to the midi, with a belt that ties at the waist.',
      },
      'MN-DRS-002': {
        ar: 'تطريز يدوي على التول، لأمسية واحدة تُتذكَّر.',
        en: 'Tulle embroidered by hand, for the evening that gets remembered.',
      },
      'MN-DRS-003': {
        ar: 'كتان مغسول يتنفّس، بأكمام قصيرة وجيوب جانبية.',
        en: 'Washed linen that breathes, with short sleeves and side pockets.',
      },
      'MN-KNT-001': {
        ar: 'كشمير ناعم بياقة دائرية، يُلبس وحده أو فوق قميص.',
        en: 'Soft cashmere with a round neck, worn alone or over a shirt.',
      },
      'MN-KNT-002': {
        ar: 'صوف طويل مفتوح من الأمام، يلفّ القوام بلا ثقل.',
        en: 'Long open wool that wraps the shape without weight.',
      },
      'MN-KNT-003': {
        ar: 'تريكو خفيف بأكمام قصيرة، للطبقة الأولى في كل موسم.',
        en: 'Fine short-sleeved knit, the first layer in every season.',
      },
      'MN-BAG-001': {
        ar: 'جلد طبيعي بحزام كتف قابل للتعديل، وجيب داخلي واحد.',
        en: 'Natural leather on an adjustable strap, with one inner pocket.',
      },
      'MN-BAG-002': {
        ar: 'مخمل بإغلاق معدني ذهبي، بحجم المساء لا أكثر.',
        en: 'Velvet with a gold clasp, sized for the evening and nothing more.',
      },
      'MN-BAG-003': {
        ar: 'ظهر جلد بحمّالات مبطّنة، يتّسع لحاسوب محمول.',
        en: 'Leather with padded straps, wide enough for a laptop.',
      },
      'MN-BTM-001': {
        ar: 'قصّة واسعة من الخصر العالي حتى الكاحل، بكسرات أمامية.',
        en: 'A wide line from the high waist to the ankle, front-pleated.',
      },
      'MN-BTM-002': {
        ar: 'بليسيه ماكسي يتحرّك مع الخطوة، بخصر مطاطي.',
        en: 'Pleats that move with the step, on an elasticated waist.',
      },
      'MN-BTM-003': {
        ar: 'جينز بخصر عالٍ وقصّة مستقيمة، بقطن قاسٍ قليلًا.',
        en: 'High-waisted denim in a straight leg, in a firmer cotton.',
      },
      'MN-JWL-001': {
        ar: 'سلسلة ذهب رفيعة تُلبس وحدها أو فوق طبقات.',
        en: 'A fine gold chain, worn alone or layered.',
      },
      'MN-JWL-002': {
        ar: 'لؤلؤ طبيعي على قاعدة ذهبية، بوزن خفيف على الأذن.',
        en: 'Natural pearls on a gold fitting, light on the ear.',
      },
      'MN-JWL-003': {
        ar: 'ثلاثة خواتم تُلبس معًا أو متفرّقة، بلمسة غير لامعة.',
        en: 'Three rings to stack or separate, in a matte finish.',
      },
      'MN-TOP-001': {
        ar: 'ساتان بكتفين مكشوفين وحافة مطاطية تثبت مكانها.',
        en: 'Satin off the shoulder, on an elasticated edge that stays put.',
      },
      'MN-TOP-002': {
        ar: 'كتان أوفرسايز بأزرار صدفية، يُلبس مفتوحًا أو مغلقًا.',
        en: 'Oversized linen with shell buttons, open or closed.',
      },
      'MN-TOP-003': {
        ar: 'كروشيه مشغول يدويًا، كل قطعة تختلف قليلًا عن الأخرى.',
        en: 'Crocheted by hand, so no two pieces are quite alike.',
      },
      'MN-JKT-001': {
        ar: 'بليزر صوف بقصّة كلاسيكية وبطانة حريرية.',
        en: 'A classic wool blazer, lined in silk.',
      },
      'MN-JKT-002': {
        ar: 'ترنش بيج بحزام وأكتاف مبنية، لمطر الخريف.',
        en: 'A belted beige trench with built shoulders, for autumn rain.',
      },
      'MN-SHO-001': {
        ar: 'جلد بكعب رفيع ونعل مبطّن، بارتفاع تسعة سنتيمترات.',
        en: 'Leather on a fine nine-centimetre heel, with a cushioned sole.',
      },
      'MN-SHO-002': {
        ar: 'صندل فلات مزيّن بحبيبات يدوية، لليوم الطويل.',
        en: 'Flat sandals beaded by hand, for the long day.',
      },
      'MN-SHO-003': {
        ar: 'شمواه بكعب منخفض وسحّاب جانبي.',
        en: 'Suede on a low heel, with a side zip.',
      },
      'MN-ACC-001': {
        ar: 'حرير مطبوع بحواف مخاطة يدويًا، يُلبس على الرقبة أو الحقيبة.',
        en: 'Printed silk with hand-rolled edges, for the neck or the bag.',
      },
      'MN-ACC-002': {
        ar: 'إطار أوفرسايز بعدسات مضادة للأشعة.',
        en: 'An oversized frame with UV lenses.',
      },
      'MN-ACC-003': {
        ar: 'جلد عريض بإبزيم معدني غير لامع.',
        en: 'Wide leather on a matte metal buckle.',
      },
      'MN-ABA-001': {
        ar: 'كريب بتطريز على الأكمام، بقصّة واسعة تسقط بثبات.',
        en: 'Crepe embroidered at the sleeve, falling wide and steady.',
      },
      'MN-ABA-002': {
        ar: 'عباية يومية بألوان هادئة وقصّة مريحة.',
        en: 'An everyday abaya in quiet colours and an easy cut.',
      },
      'MN-HJB-001': {
        ar: 'شيفون سادة بحواف مخاطة، بطول متر وثمانين.',
        en: 'Plain chiffon with stitched edges, 180 centimetres long.',
      },
      'MN-HJB-002': {
        ar: 'مربع حرير مطبوع، يُلفّ بأكثر من طريقة.',
        en: 'A printed silk square that ties more than one way.',
      },
      'MN-DRS-004': {
        ar: 'حرير سليب بحمّالات رفيعة قابلة للتعديل.',
        en: 'A silk slip on fine adjustable straps.',
      },
      'MN-TOP-004': {
        ar: 'قميص حرير واسع بأزرار مخفية.',
        en: 'A relaxed silk shirt with a concealed placket.',
      },
      'MN-KIM-001': {
        ar: 'كيمونو قطن مطبوع بحزام من القماش نفسه.',
        en: 'A printed cotton kimono with a belt in the same cloth.',
      },
    };

    // The storefront reads `slug`, `name_en` and `created_at`: slugs come from the English
    // name (or an explicit value where name_en is left null to exercise the Arabic
    // fallback), and `days_ago` spreads arrivals over 90 days so "new in" (30 days) has
    // both members and non-members.
    const now = Date.now();
    const productIds = new Map<string, number>();
    for (const p of products) {
      const realDistId = distMap.get(p.dist_id) || null;
      const slug = ('slug' in p ? p.slug : null) ?? slugify(p.name_en);
      const copy = productCopy[p.sku] ?? null;
      const res = await client.query<{ id: number }>(
        `INSERT INTO products (name, sku, barcode, price, cost_price, stock, category, category_id, min_stock, distributor_id, status, slug, name_en, description, description_en, created_at)
         VALUES ($1, $2, $3, $4, $5, $6, $7, (SELECT id FROM categories WHERE name = $8), $9, $10, $11, $12, $13, $14, $15, $16)
         RETURNING id`,
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
          ('status' in p ? p.status : null) ?? 'active',
          slug,
          p.name_en,
          copy?.ar ?? null,
          copy?.en ?? null,
          new Date(now - p.days_ago * DAY_MS).toISOString(),
        ]
      );
      productIds.set(p.sku, res.rows[0].id);
    }
    logger.info(`✓ ${products.length} products inserted.`);

    // ─── Variants ────────────────────────────────────────────────────
    // Mixed stock (some sizes sold out) and one product whose every size is sold out, so
    // the storefront's in-stock filter is decided by variants, not `products.stock`.
    const variantSizes: Record<string, [string, number][]> = {
      'MN-DRS-001': [
        ['S', 0],
        ['M', 3],
        ['L', 0],
      ],
      'MN-KNT-001': [
        ['S', 4],
        ['M', 0],
        ['L', 2],
      ],
      'MN-DRS-004': [
        ['S', 0],
        ['M', 0],
      ],
    };
    let variantCount = 0;
    for (const [sku, sizes] of Object.entries(variantSizes)) {
      const productId = productIds.get(sku);
      for (const [size, stock] of sizes) {
        await client.query(
          'INSERT INTO product_variants (product_id, sku, stock, attributes) VALUES ($1, $2, $3, $4)',
          [productId, `${sku}-${size}`, stock, JSON.stringify({ size })]
        );
        variantCount += 1;
      }
      await client.query('UPDATE products SET has_variants = 1, stock = $1 WHERE id = $2', [
        sizes.reduce((sum, [, stock]) => sum + stock, 0),
        productId,
      ]);
    }
    logger.info(`✓ ${variantCount} variants inserted.`);

    // ─── Collections ─────────────────────────────────────────────────
    // evening, linen and silk are the homepage's collection keys
    // (tests/database/seedCatalogKeys.test.ts). The upcoming and archived ones are not
    // public, which the storefront's not-found path needs. No images: operators upload them.
    const collections = [
      {
        name: 'مجموعة السهرة',
        slug: 'evening',
        name_en: 'Evening',
        description: 'قطع مطرزة ولمعة ناعمة لأمسيات لا تُنسى.',
        description_en: 'Embroidery and quiet shine for evenings that stay with you.',
        season: 'Autumn/Winter',
        year: 2026,
        is_featured: 1,
        status: 'active',
        skus: ['MN-DRS-002', 'MN-BAG-002', 'MN-JWL-001', 'MN-SHO-001', 'MN-JWL-002', 'MN-ABA-001'],
      },
      {
        name: 'مجموعة الكتان',
        slug: 'linen',
        name_en: 'Linen',
        description: 'كتان خفيف يتنفس لأيام الصيف الطويلة.',
        description_en: 'Light, breathable linen for long summer days.',
        season: 'Spring/Summer',
        year: 2026,
        is_featured: 0,
        status: 'active',
        skus: ['MN-DRS-003', 'MN-TOP-002', 'MN-BTM-001', 'MN-TOP-003', 'MN-SHO-002'],
      },
      {
        name: 'مجموعة الحرير',
        slug: 'silk',
        name_en: 'Silk',
        description: 'حرير ينساب مع الحركة، من النهار إلى المساء.',
        description_en: 'Silk that moves with you, from day into evening.',
        season: 'Resort',
        year: 2026,
        is_featured: 0,
        status: 'active',
        skus: ['MN-DRS-001', 'MN-DRS-004', 'MN-TOP-001', 'MN-ACC-001', 'MN-HJB-002', 'MN-TOP-004'],
      },
      {
        name: 'تفصيل الشتاء',
        slug: 'winter-tailoring',
        name_en: 'Winter Tailoring',
        description: 'قصات صوف كلاسيكية، قريباً.',
        description_en: 'Classic wool tailoring, coming soon.',
        season: 'Autumn/Winter',
        year: 2027,
        is_featured: 0,
        status: 'upcoming',
        skus: ['MN-JKT-001', 'MN-JKT-002'],
      },
      {
        name: 'صيف 2025',
        slug: 'summer-2025',
        name_en: 'Summer 2025',
        description: 'مجموعة الموسم الماضي.',
        description_en: "Last season's collection.",
        season: 'Spring/Summer',
        year: 2025,
        is_featured: 0,
        status: 'archived',
        skus: ['MN-KNT-003', 'MN-ACC-002'],
      },
    ];

    for (const c of collections) {
      const res = await client.query<{ id: number }>(
        `INSERT INTO collections (name, slug, name_en, description, description_en, season, year, is_featured, status)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9) RETURNING id`,
        [
          c.name,
          c.slug,
          c.name_en,
          c.description,
          c.description_en,
          c.season,
          c.year,
          c.is_featured,
          c.status,
        ]
      );
      // Positions are dense from 0 (migration 006).
      for (const [position, sku] of c.skus.entries()) {
        await client.query(
          'INSERT INTO collection_products (collection_id, product_id, position) VALUES ($1, $2, $3)',
          [res.rows[0].id, productIds.get(sku), position]
        );
      }
    }
    logger.info(`✓ ${collections.length} collections inserted.`);

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
      ['loyalty_enabled', 'true'],
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

    // Placeholder copy: replace with the real policy before launch (storefront product page).
    // Deliberately promises nothing (no area, fee, time, return or exchange; ED-5 revised).
    const storePolicies = [
      ['delivery_policy', 'نؤكد لكِ تفاصيل التوصيل عند إتمام طلبك.'],
      ['delivery_policy_en', 'Delivery details are confirmed when you place your order.'],
      ['returns_policy', 'لديكِ سؤال عن طلبك؟ تواصلي معنا وسيساعدك فريقنا.'],
      ['returns_policy_en', 'Questions about your order? Contact us and our team will help.'],
    ];

    // Only when absent. Note the settings table is cleared above, so this protects a
    // policy only if that clear is ever narrowed; it never overwrites an existing row.
    for (const [key, value] of storePolicies) {
      await client.query(
        `INSERT INTO settings (key, value) VALUES ($1, $2) ON CONFLICT (key) DO NOTHING`,
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
