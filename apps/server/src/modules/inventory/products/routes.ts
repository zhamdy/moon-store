import { Router } from 'express';
import { verifyToken, requireRole } from '../../../../middleware/auth';
import { uploadRateLimit } from '../../../../middleware/upload';
import { createImageUpload, validateImageBytes } from '../../../storage/upload';
import { cacheControl } from '../../../../middleware/cache';
import { productsController } from './controller';

// Memory-backed: the bytes go to the configured storage driver, not to this container's
// disk. Size, extension and magic-byte checks are unchanged and still run before the write.
const upload = createImageUpload({ maxSize: 2 * 1024 * 1024 });
const router: Router = Router();

router.get('/', verifyToken, (req, res, next) => productsController.getProducts(req, res, next));
router.get('/lookup', verifyToken, (req, res, next) => productsController.lookup(req, res, next));
router.get('/categories', verifyToken, cacheControl(300), (req, res, next) =>
  productsController.getCategories(req, res, next)
);
router.get('/generate-sku/:categoryId', verifyToken, requireRole('Admin'), (req, res, next) =>
  productsController.generateSku(req, res, next)
);
router.get('/generate-barcode', verifyToken, requireRole('Admin'), (req, res, next) =>
  productsController.generateBarcode(req, res, next)
);
router.get('/barcode/:barcode', verifyToken, (req, res, next) =>
  productsController.getByBarcode(req, res, next)
);
router.get('/:id', verifyToken, (req, res, next) =>
  productsController.getProductById(req, res, next)
);

router.post('/', verifyToken, requireRole('Admin'), (req, res, next) =>
  productsController.createProduct(req, res, next)
);
router.put('/bulk-update', verifyToken, requireRole('Admin'), (req, res, next) =>
  productsController.bulkUpdate(req, res, next)
);
router.put('/:id', verifyToken, requireRole('Admin'), (req, res, next) =>
  productsController.updateProduct(req, res, next)
);
router.put('/:id/status', verifyToken, requireRole('Admin'), (req, res, next) =>
  productsController.updateStatus(req, res, next)
);
router.delete('/:id', verifyToken, requireRole('Admin'), (req, res, next) =>
  productsController.discontinue(req, res, next)
);
router.post('/bulk-delete', verifyToken, requireRole('Admin'), (req, res, next) =>
  productsController.bulkDelete(req, res, next)
);
router.post('/import', verifyToken, requireRole('Admin'), (req, res, next) =>
  productsController.import(req, res, next)
);
router.post('/:id/adjust-stock', verifyToken, requireRole('Admin'), (req, res, next) =>
  productsController.adjustStock(req, res, next)
);
router.get('/:id/stock-history', verifyToken, requireRole('Admin'), (req, res, next) =>
  productsController.getStockHistory(req, res, next)
);

router.post(
  '/:id/image',
  verifyToken,
  requireRole('Admin'),
  uploadRateLimit,
  upload.single('image'),
  validateImageBytes,
  (req, res, next) => productsController.uploadImage(req, res, next)
);
router.delete('/:id/image', verifyToken, requireRole('Admin'), (req, res, next) =>
  productsController.deleteImage(req, res, next)
);

router.get('/:id/variants', verifyToken, (req, res, next) =>
  productsController.getVariants(req, res, next)
);
router.post('/:id/variants', verifyToken, requireRole('Admin'), (req, res, next) =>
  productsController.createVariant(req, res, next)
);
router.put('/:id/variants/:variantId', verifyToken, requireRole('Admin'), (req, res, next) =>
  productsController.updateVariant(req, res, next)
);
router.delete('/:id/variants/:variantId', verifyToken, requireRole('Admin'), (req, res, next) =>
  productsController.deleteVariant(req, res, next)
);

router.get('/:id/price-history', verifyToken, requireRole('Admin'), (req, res, next) =>
  productsController.getPriceHistory(req, res, next)
);
router.post('/batch-generate-barcodes', verifyToken, requireRole('Admin'), (req, res, next) =>
  productsController.batchGenerateBarcodes(req, res, next)
);

export default router;
