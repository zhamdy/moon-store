import { Router } from 'express';
import { verifyToken, requireRole } from '../../../../middleware/auth';
import { purchaseOrdersController } from './controller';

const router: Router = Router();

// GET /api/purchase-orders — List all POs
router.get('/', verifyToken, requireRole('Admin'), (req, res, next) =>
  purchaseOrdersController.getPurchaseOrders(req, res, next)
);

// GET /api/purchase-orders/:id — Get PO details with items
router.get('/:id', verifyToken, requireRole('Admin'), (req, res, next) =>
  purchaseOrdersController.getPurchaseOrderById(req, res, next)
);

// POST /api/purchase-orders — Create a new PO
router.post('/', verifyToken, requireRole('Admin'), (req, res, next) =>
  purchaseOrdersController.createPurchaseOrder(req, res, next)
);

// PUT /api/purchase-orders/:id/status — Update PO status
router.put('/:id/status', verifyToken, requireRole('Admin'), (req, res, next) =>
  purchaseOrdersController.updateStatus(req, res, next)
);

// POST /api/purchase-orders/:id/receive — Receive items
router.post('/:id/receive', verifyToken, requireRole('Admin'), (req, res, next) =>
  purchaseOrdersController.receiveItems(req, res, next)
);

// DELETE /api/purchase-orders/:id
router.delete('/:id', verifyToken, requireRole('Admin'), (req, res, next) =>
  purchaseOrdersController.deletePurchaseOrder(req, res, next)
);

export default router;
