import { Router } from 'express';
import { verifyToken, requireRole } from '../../../../middleware/auth';
import { giftCardsController } from './controller';

const router: Router = Router();

// GET /api/gift-cards — List all gift cards (Admin)
router.get('/', verifyToken, requireRole('Admin'), (req, res, next) =>
  giftCardsController.listGiftCards(req, res, next)
);

// POST /api/gift-cards — Create a gift card (Admin)
router.post('/', verifyToken, requireRole('Admin'), (req, res, next) =>
  giftCardsController.createGiftCard(req, res, next)
);

// GET /api/gift-cards/:code/balance — Check balance by code (any authenticated user)
router.get('/:code/balance', verifyToken, (req, res, next) =>
  giftCardsController.getBalance(req, res, next)
);

// POST /api/gift-cards/:code/redeem — Redeem gift card
router.post('/:code/redeem', verifyToken, (req, res, next) =>
  giftCardsController.redeemGiftCard(req, res, next)
);

// GET /api/gift-cards/:id/transactions — View transaction history (Admin)
router.get('/:id/transactions', verifyToken, requireRole('Admin'), (req, res, next) =>
  giftCardsController.getTransactions(req, res, next)
);

// PUT /api/gift-cards/:id — Update gift card status (Admin) — activate/cancel
router.put('/:id', verifyToken, requireRole('Admin'), (req, res, next) =>
  giftCardsController.updateStatus(req, res, next)
);

export default router;
