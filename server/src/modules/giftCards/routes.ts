import { Router } from 'express';
import { verifyToken, requireRole } from '../../../middleware/auth';
import { giftCardsController } from './controller';

const router: Router = Router();

router.get('/', verifyToken, requireRole('Admin'), (req, res, next) =>
  giftCardsController.getGiftCards(req, res, next)
);
router.post('/', verifyToken, requireRole('Admin'), (req, res, next) =>
  giftCardsController.createGiftCard(req, res, next)
);
router.get('/:code/balance', verifyToken, (req, res, next) =>
  giftCardsController.getBalance(req, res, next)
);
router.post('/:code/redeem', verifyToken, (req, res, next) =>
  giftCardsController.redeem(req, res, next)
);
router.get('/:id/transactions', verifyToken, requireRole('Admin'), (req, res, next) =>
  giftCardsController.getTransactions(req, res, next)
);
router.put('/:id', verifyToken, requireRole('Admin'), (req, res, next) =>
  giftCardsController.updateStatus(req, res, next)
);

export default router;
