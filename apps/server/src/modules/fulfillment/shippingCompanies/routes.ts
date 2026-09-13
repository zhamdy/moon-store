import { Router } from 'express';
import { verifyToken, requireRole } from '../../../../middleware/auth';
import { shippingCompaniesController } from './controller';

const router: Router = Router();

// GET /api/shipping-companies
router.get('/', verifyToken, requireRole('Admin'), (req, res, next) =>
  shippingCompaniesController.getShippingCompanies(req, res, next)
);

// POST /api/shipping-companies
router.post('/', verifyToken, requireRole('Admin'), (req, res, next) =>
  shippingCompaniesController.createShippingCompany(req, res, next)
);

// PUT /api/shipping-companies/:id
router.put('/:id', verifyToken, requireRole('Admin'), (req, res, next) =>
  shippingCompaniesController.updateShippingCompany(req, res, next)
);

// DELETE /api/shipping-companies/:id
router.delete('/:id', verifyToken, requireRole('Admin'), (req, res, next) =>
  shippingCompaniesController.deleteShippingCompany(req, res, next)
);

export default router;
