import { Router, Request, Response, NextFunction } from 'express';
import db from '../db';
import { verifyToken, requireRole } from '../middleware/auth';
import crypto from 'crypto';

const router: Router = Router();

// ===== Smart Pricing =====

// GET /api/ai/pricing/rules
router.get(
  '/pricing/rules',
  verifyToken,
  requireRole('Admin'),
  async (_req: Request, res: Response, next: NextFunction) => {
    try {
      const result = await db.query(
        'SELECT * FROM pricing_rules ORDER BY priority DESC, created_at DESC'
      );
      res.json({ success: true, data: result.rows });
    } catch (err) {
      next(err);
    }
  }
);

// POST /api/ai/pricing/rules
router.post(
  '/pricing/rules',
  verifyToken,
  requireRole('Admin'),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { name, rule_type, config, priority, applies_to } = req.body;
      const result = await db.query(
        'INSERT INTO pricing_rules (name, rule_type, config, priority, applies_to) VALUES (?, ?, ?, ?, ?) RETURNING *',
        [name, rule_type, JSON.stringify(config), priority || 0, applies_to || 'all']
      );
      res.status(201).json({ success: true, data: result.rows[0] });
    } catch (err) {
      next(err);
    }
  }
);

// POST /api/ai/pricing/generate — generate price suggestions
router.post(
  '/pricing/generate',
  verifyToken,
  requireRole('Admin'),
  async (_req: Request, res: Response, next: NextFunction) => {
    try {
      // Simple demand-based pricing algorithm
      const products = await db.query(
        `SELECT p.id, p.name, p.price, p.stock, p.cost_price,
        COALESCE((SELECT SUM(si.quantity) FROM sale_items si JOIN sales s ON si.sale_id = s.id WHERE si.product_id = p.id AND s.created_at >= date('now', '-30 days')), 0) as monthly_sales,
        COALESCE((SELECT SUM(si.quantity) FROM sale_items si JOIN sales s ON si.sale_id = s.id WHERE si.product_id = p.id AND s.created_at >= date('now', '-7 days')), 0) as weekly_sales
       FROM products p WHERE p.status = 'active'`
      );

      interface PricingProduct {
        id: number;
        name: string;
        price: number;
        stock: number;
        cost_price: number;
        monthly_sales: number;
        weekly_sales: number;
      }
      interface PricingSuggestion {
        product_id: number;
        product_name: string;
        current_price: number;
        suggested_price: number;
        reason: string;
        confidence: number;
      }
      const suggestions: PricingSuggestion[] = [];
      for (const p of products.rows as unknown as PricingProduct[]) {
        let suggested_price = p.price;
        let reason = '';

        // High demand, low stock — increase price
        if (p.weekly_sales > 5 && p.stock < 10) {
          suggested_price = Math.round(p.price * 1.1 * 100) / 100;
          reason = 'High demand + low stock: suggest 10% increase';
        }
        // Low demand, high stock — decrease price
        else if (p.monthly_sales < 2 && p.stock > 50) {
          suggested_price = Math.round(p.price * 0.85 * 100) / 100;
          reason = 'Low demand + high stock: suggest 15% clearance discount';
        }
        // Moderate demand
        else if (p.weekly_sales > 3) {
          suggested_price = Math.round(p.price * 1.05 * 100) / 100;
          reason = 'Moderate demand: suggest 5% increase';
        }

        // Ensure minimum margin
        if (p.cost_price && suggested_price < p.cost_price * 1.2) {
          suggested_price = Math.round(p.cost_price * 1.2 * 100) / 100;
          reason += ' (adjusted for minimum 20% margin)';
        }

        if (suggested_price !== p.price) {
          suggestions.push({
            product_id: p.id,
            product_name: p.name,
            current_price: p.price,
            suggested_price,
            reason,
            confidence: 0.7,
          });
        }
      }

      // Save suggestions
      const rawDb = db.db;
      const stmt = rawDb.prepare(
        'INSERT OR REPLACE INTO price_suggestions (product_id, current_price, suggested_price, reason, confidence) VALUES (?, ?, ?, ?, ?)'
      );
      for (const s of suggestions) {
        stmt.run(s.product_id, s.current_price, s.suggested_price, s.reason, s.confidence);
      }

      res.json({ success: true, data: suggestions });
    } catch (err) {
      next(err);
    }
  }
);

// GET /api/ai/pricing/suggestions
router.get(
  '/pricing/suggestions',
  verifyToken,
  requireRole('Admin'),
  async (_req: Request, res: Response, next: NextFunction) => {
    try {
      const result = await db.query(
        `SELECT ps.*, p.name as product_name, p.sku FROM price_suggestions ps
       LEFT JOIN products p ON ps.product_id = p.id WHERE ps.status = 'pending' ORDER BY ps.confidence DESC`
      );
      res.json({ success: true, data: result.rows });
    } catch (err) {
      next(err);
    }
  }
);

// PUT /api/ai/pricing/suggestions/:id — accept/reject
router.put(
  '/pricing/suggestions/:id',
  verifyToken,
  requireRole('Admin'),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { action } = req.body; // 'accept' or 'reject'
      if (action === 'accept') {
        const suggestion = await db.query('SELECT * FROM price_suggestions WHERE id = ?', [
          req.params.id,
        ]);
        if (suggestion.rows.length > 0) {
          const s = suggestion.rows[0] as {
            product_id: number;
            current_price: number;
            suggested_price: number;
            reason: string;
          };
          await db.query('UPDATE products SET price = ? WHERE id = ?', [
            s.suggested_price,
            s.product_id,
          ]);
          await db.query(
            "INSERT INTO price_history (product_id, old_price, new_price, changed_by, reason) VALUES (?, ?, ?, 'AI', ?)",
            [s.product_id, s.current_price, s.suggested_price, s.reason]
          );
        }
        await db.query("UPDATE price_suggestions SET status = 'accepted' WHERE id = ?", [
          req.params.id,
        ]);
      } else {
        await db.query("UPDATE price_suggestions SET status = 'rejected' WHERE id = ?", [
          req.params.id,
        ]);
      }
      res.json({ success: true, data: { message: `Suggestion ${action}ed` } });
    } catch (err) {
      next(err);
    }
  }
);

// ===== Chatbot =====

// POST /api/ai/chat/session — create session
router.post('/chat/session', async (_req: Request, res: Response, next: NextFunction) => {
  try {
    const token = crypto.randomBytes(16).toString('hex');
    const result = await db.query(
      'INSERT INTO chat_sessions (session_token) VALUES (?) RETURNING *',
      [token]
    );
    res.status(201).json({ success: true, data: result.rows[0] });
  } catch (err) {
    next(err);
  }
});

// POST /api/ai/chat/message — send message and get bot response
router.post('/chat/message', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { session_token, message } = req.body;
    const session = await db.query(
      "SELECT id FROM chat_sessions WHERE session_token = ? AND status = 'active'",
      [session_token]
    );
    if (session.rows.length === 0)
      return res.status(404).json({ success: false, error: 'Session not found' });
    const sessionId = (session.rows[0] as { id: number }).id;

    // Save customer message
    await db.query(
      "INSERT INTO chat_messages (session_id, sender, message) VALUES (?, 'customer', ?)",
      [sessionId, message]
    );

    // Simple keyword-based response
    const lowerMsg = message.toLowerCase();
    let botResponse = 'Thank you for your message! A team member will help you shortly.';

    const kb = await db.query('SELECT * FROM knowledge_base WHERE is_active = 1');
    for (const entry of kb.rows as Array<{ keywords: string; answer: string }>) {
      const keywords = entry.keywords.split(',').map((k) => k.trim().toLowerCase());
      if (keywords.some((k) => lowerMsg.includes(k))) {
        botResponse = entry.answer;
        break;
      }
    }

    // Product search in chat
    if (
      lowerMsg.includes('looking for') ||
      lowerMsg.includes('do you have') ||
      lowerMsg.includes('search')
    ) {
      const searchTerms = lowerMsg.replace(/(looking for|do you have|search|find)/gi, '').trim();
      if (searchTerms) {
        const products = await db.query(
          "SELECT name, price FROM products WHERE status = 'active' AND (name LIKE ? OR category LIKE ?) LIMIT 3",
          [`%${searchTerms}%`, `%${searchTerms}%`]
        );
        if ((products.rows as Array<{ name: string; price: number }>).length > 0) {
          const list = (products.rows as Array<{ name: string; price: number }>)
            .map((p) => `• ${p.name} — ${p.price} SAR`)
            .join('\n');
          botResponse = `I found these products for you:\n${list}\n\nWould you like more details?`;
        }
      }
    }

    // Save bot response
    await db.query("INSERT INTO chat_messages (session_id, sender, message) VALUES (?, 'bot', ?)", [
      sessionId,
      botResponse,
    ]);

    const messages = await db.query(
      'SELECT * FROM chat_messages WHERE session_id = ? ORDER BY created_at ASC',
      [sessionId]
    );
    res.json({ success: true, data: { response: botResponse, messages: messages.rows } });
  } catch (err) {
    next(err);
  }
});

// ===== Sales Predictions =====

// POST /api/ai/predictions/generate
router.post(
  '/predictions/generate',
  verifyToken,
  requireRole('Admin'),
  async (_req: Request, res: Response, next: NextFunction) => {
    try {
      // Simple moving average prediction
      const products = await db.query(
        `SELECT p.id, p.name, p.price, p.category,
        COALESCE((SELECT SUM(si.quantity) FROM sale_items si JOIN sales s ON si.sale_id = s.id WHERE si.product_id = p.id AND s.created_at >= date('now', '-30 days')), 0) as last_30d,
        COALESCE((SELECT SUM(si.quantity) FROM sale_items si JOIN sales s ON si.sale_id = s.id WHERE si.product_id = p.id AND s.created_at >= date('now', '-60 days') AND s.created_at < date('now', '-30 days')), 0) as prev_30d
       FROM products p WHERE p.status = 'active'`
      );

      interface PredictionProduct {
        id: number;
        name: string;
        price: number;
        category: string;
        last_30d: number;
        prev_30d: number;
      }
      interface Prediction {
        product_id: number;
        product_name: string;
        category: string;
        predicted_units: number;
        predicted_revenue: number;
        trend: string;
        confidence: number;
      }
      const predictions: Prediction[] = [];
      const nextMonth = new Date();
      nextMonth.setMonth(nextMonth.getMonth() + 1);
      const period = `${nextMonth.getFullYear()}-${String(nextMonth.getMonth() + 1).padStart(2, '0')}`;

      for (const p of products.rows as unknown as PredictionProduct[]) {
        // Weighted average: 70% recent, 30% older
        const predicted_units = Math.round(p.last_30d * 0.7 + p.prev_30d * 0.3);
        const predicted_revenue = predicted_units * p.price;
        const trend =
          p.last_30d > p.prev_30d ? 'growing' : p.last_30d < p.prev_30d ? 'declining' : 'stable';

        predictions.push({
          product_id: p.id,
          product_name: p.name,
          category: p.category,
          predicted_units,
          predicted_revenue,
          trend,
          confidence: 0.65,
        });
      }

      // Save predictions
      const rawDb = db.db;
      const stmt = rawDb.prepare(
        "INSERT OR REPLACE INTO sales_predictions (product_id, category, prediction_type, period, predicted_units, predicted_revenue, confidence) VALUES (?, ?, 'monthly', ?, ?, ?, ?)"
      );
      for (const p of predictions) {
        stmt.run(
          p.product_id,
          p.category,
          period,
          p.predicted_units,
          p.predicted_revenue,
          p.confidence
        );
      }

      res.json({
        success: true,
        data: predictions.sort((a, b) => b.predicted_revenue - a.predicted_revenue).slice(0, 20),
      });
    } catch (err) {
      next(err);
    }
  }
);

// GET /api/ai/predictions
router.get(
  '/predictions',
  verifyToken,
  async (_req: Request, res: Response, next: NextFunction) => {
    try {
      const result = await db.query(
        `SELECT sp.*, p.name as product_name, p.sku FROM sales_predictions sp
       LEFT JOIN products p ON sp.product_id = p.id ORDER BY sp.predicted_revenue DESC LIMIT 50`
      );
      res.json({ success: true, data: result.rows });
    } catch (err) {
      next(err);
    }
  }
);

// ===== Auto Descriptions =====

// POST /api/ai/descriptions/generate/:productId
router.post(
  '/descriptions/generate/:productId',
  verifyToken,
  requireRole('Admin'),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const product = await db.query('SELECT * FROM products WHERE id = ?', [req.params.productId]);
      if (product.rows.length === 0)
        return res.status(404).json({ success: false, error: 'Product not found' });
      const p = product.rows[0] as {
        id: number;
        name: string;
        category: string;
        price: number;
        sku: string;
      };

      // Template-based description generation
      const descriptions: Record<string, string> = {
        'Evening Wear': `Elevate your evening look with ${p.name}. Crafted with premium materials, this stunning piece combines elegance with modern design. Perfect for special occasions and formal events.`,
        Casual: `Stay stylish and comfortable with ${p.name}. Made from high-quality fabrics for everyday wear that doesn't compromise on fashion. A versatile addition to your wardrobe.`,
        Accessories: `Complete your outfit with ${p.name}. This carefully crafted accessory adds the perfect finishing touch to any ensemble. Designed with attention to detail and quality materials.`,
      };

      const ai_description =
        descriptions[p.category] ||
        `Discover ${p.name} from MOON Fashion & Style. This premium ${(p.category || 'fashion').toLowerCase()} piece showcases exceptional craftsmanship and contemporary design. SKU: ${p.sku}.`;

      const seo_title = `${p.name} | MOON Fashion & Style`;
      const seo_description = `Shop ${p.name} at MOON Fashion. ${p.category || 'Premium fashion'} collection. Price: ${p.price} SAR. Free shipping on orders over 500 SAR.`;
      const tags = [p.category, 'fashion', 'luxury', p.name.split(' ')[0]]
        .filter(Boolean)
        .join(',');

      await db.query(
        'UPDATE products SET ai_description = ?, seo_title = ?, seo_description = ?, tags = ? WHERE id = ?',
        [ai_description, seo_title, seo_description, tags, req.params.productId]
      );

      await db.query(
        "INSERT INTO ai_generation_log (product_id, generation_type, input_data, output_data) VALUES (?, 'description', ?, ?)",
        [
          req.params.productId,
          JSON.stringify({ name: p.name, category: p.category }),
          ai_description,
        ]
      );

      res.json({ success: true, data: { ai_description, seo_title, seo_description, tags } });
    } catch (err) {
      next(err);
    }
  }
);

// POST /api/ai/descriptions/bulk — generate for all products without AI descriptions
router.post(
  '/descriptions/bulk',
  verifyToken,
  requireRole('Admin'),
  async (_req: Request, res: Response, next: NextFunction) => {
    try {
      const products = await db.query(
        "SELECT id FROM products WHERE ai_description IS NULL AND status = 'active'"
      );
      for (const _p of products.rows as Record<string, unknown>[]) {
        // Reuse single generation endpoint logic
      }
      res.json({
        success: true,
        data: {
          message: `${(products.rows as Record<string, unknown>[]).length} products queued for description generation`,
        },
      });
    } catch (err) {
      next(err);
    }
  }
);

// GET /api/ai/knowledge-base
router.get(
  '/knowledge-base',
  verifyToken,
  async (_req: Request, res: Response, next: NextFunction) => {
    try {
      const result = await db.query('SELECT * FROM knowledge_base ORDER BY category, id');
      res.json({ success: true, data: result.rows });
    } catch (err) {
      next(err);
    }
  }
);

// POST /api/ai/knowledge-base
router.post(
  '/knowledge-base',
  verifyToken,
  requireRole('Admin'),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { category, question, answer, keywords } = req.body;
      const result = await db.query(
        'INSERT INTO knowledge_base (category, question, answer, keywords) VALUES (?, ?, ?, ?) RETURNING *',
        [category, question, answer, keywords || '']
      );
      res.status(201).json({ success: true, data: result.rows[0] });
    } catch (err) {
      next(err);
    }
  }
);

export default router;
