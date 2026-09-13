import { Router } from 'express';
import { verifyToken, requireRole } from '../../../../middleware/auth';
import { aiController } from './controller';

const router: Router = Router();

// GET /api/ai/forecast — 30-day demand forecast based on 90-day moving averages
router.get('/forecast', verifyToken, requireRole('Admin'), (req, res, next) =>
  aiController.getForecast(req, res, next)
);

// GET /api/ai/recommendations — Product affinities / cross-sell rules
router.get('/recommendations', verifyToken, (req, res, next) =>
  aiController.getRecommendations(req, res, next)
);

// GET /api/ai/pricing-suggestions — Slow-moving discounts & high-demand price increase suggestions
router.get('/pricing-suggestions', verifyToken, requireRole('Admin'), (req, res, next) =>
  aiController.getPricingSuggestions(req, res, next)
);

// GET /api/ai/churn-risk — Customer churn prediction
router.get('/churn-risk', verifyToken, requireRole('Admin'), (req, res, next) =>
  aiController.getChurnRisk(req, res, next)
);

// GET /api/ai/anomalies — Fraud & anomaly detection
router.get('/anomalies', verifyToken, requireRole('Admin'), (req, res, next) =>
  aiController.getAnomalies(req, res, next)
);

export default router;
