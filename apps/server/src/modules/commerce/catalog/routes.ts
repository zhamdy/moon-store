/**
 * The public catalog: six anonymous GETs and one read-only POST, nothing that writes (KD-1).
 *
 * Deliberately no `verifyToken` anywhere in this router; the manifest classifies every
 * route `publicAuth` and `check:route-auth` holds the two in agreement.
 *
 * Order matters. The cart quote comes first, ahead of both the catalog read limiter and
 * `publicCacheOnSuccess` (plan 2026-09-15-001, CD-21/CD-22): its CORS, limiter and 16 KB
 * parser run in `app.ts`, and the cache middleware rewrites `Cache-Control` at `writeHead`
 * on any 2xx, so a priced quote behind it would ship `public, max-age=60`.
 *
 * For the reads, the catalog limiter answers a 429 before anything else runs, and sets
 * `no-store` on it itself; the status-aware cache header then covers every response the
 * router or the app's 404 fallback produces (2xx public, everything else no-store).
 */
import { Router, type NextFunction, type Request, type Response } from 'express';
import { createCatalogLimiter } from '../../../http/rateLimits';
import { publicCacheOnSuccess } from '../../../../middleware/cache';
import { CATALOG_CACHE_SECONDS } from './constants';
import { catalogController } from './controller';

const router: Router = Router();

/** Set before the handler, so success and every error the handler raises carry it. */
function noStore(_req: Request, res: Response, next: NextFunction): void {
  res.set('Cache-Control', 'no-store');
  next();
}

// POST /api/v1/catalog/cart/quote (Public, read-only)
router.post('/cart/quote', noStore, (req, res, next) =>
  catalogController.quoteCart(req, res, next)
);

router.use(createCatalogLimiter());
router.use(publicCacheOnSuccess(CATALOG_CACHE_SECONDS));

// GET /api/v1/catalog/products (Public)
router.get('/products', (req, res, next) => catalogController.listProducts(req, res, next));

// GET /api/v1/catalog/products/:slug (Public)
router.get('/products/:slug', (req, res, next) => catalogController.getProduct(req, res, next));

// GET /api/v1/catalog/categories (Public)
router.get('/categories', (req, res, next) => catalogController.listCategories(req, res, next));

// GET /api/v1/catalog/collections (Public)
router.get('/collections', (req, res, next) => catalogController.listCollections(req, res, next));

// GET /api/v1/catalog/store-policies (Public). Its own top-level segment, so it can never
// collide with /products/:slug or /collections/:slug.
router.get('/store-policies', (req, res, next) =>
  catalogController.getStorePolicies(req, res, next)
);

// GET /api/v1/catalog/collections/:slug (Public)
router.get('/collections/:slug', (req, res, next) =>
  catalogController.getCollection(req, res, next)
);

export default router;
