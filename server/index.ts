import 'dotenv/config';
import express, { Request, Response } from 'express';
import cors from 'cors';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import cookieParser from 'cookie-parser';
import path from 'path';
import errorHandler from './middleware/errorHandler';
import { requestLogger } from './middleware/requestLogger';
import logger from './lib/logger';
import db from './db';

import authRoutes from './routes/auth';
import productRoutes from './routes/products';
import salesRoutes from './routes/sales';
import deliveryRoutes from './routes/delivery';
import analyticsRoutes from './routes/analytics';
import userRoutes from './routes/users';
import customerRoutes from './routes/customers';
import distributorRoutes from './routes/distributors';
import categoryRoutes from './routes/categories';
import stockAdjustmentRoutes from './routes/stockAdjustments';
import settingsRoutes from './routes/settings';
import purchaseOrderRoutes from './routes/purchaseOrders';
import auditLogRoutes from './routes/auditLog';
import notificationRoutes from './routes/notifications';
import couponRoutes from './routes/coupons';
import giftCardRoutes from './routes/giftCards';
import bundleRoutes from './routes/bundles';
import stockCountRoutes from './routes/stockCounts';
import reservationRoutes from './routes/reservations';
import labelTemplateRoutes from './routes/labelTemplates';

import exportRoutes from './routes/exports';
import registerRoutes from './routes/register';
import exchangeRoutes from './routes/exchanges';
import shiftRoutes from './routes/shifts';
import expenseRoutes from './routes/expenses';
import segmentRoutes from './routes/segments';
import layawayRoutes from './routes/layaway';
import collectionRoutes from './routes/collections';
import warrantyRoutes from './routes/warranty';
import feedbackRoutes from './routes/feedback';
import branchRoutes from './routes/branches';
import storefrontRoutes from './routes/storefront';
import onlineOrderRoutes from './routes/onlineOrders';
import reportRoutes from './routes/reports';
import vendorRoutes from './routes/vendors';
import aiRoutes from './routes/ai';
import shippingCompanyRoutes from './routes/shippingCompanies';
import { cleanupExpiredReservations } from './routes/reservations';

// Validate required environment variables
const requiredEnvVars = ['JWT_SECRET', 'JWT_REFRESH_SECRET'] as const;
for (const envVar of requiredEnvVars) {
  if (!process.env[envVar]) {
    logger.error(`FATAL: Missing required environment variable: ${envVar}`);
    process.exit(1);
  }
}

const app = express();
const PORT: number = Number(process.env.PORT) || 3001;

// Security
app.use(
  helmet({
    crossOriginResourcePolicy: { policy: 'cross-origin' },
  })
);
const allowedOrigins: string[] = process.env.ALLOWED_ORIGINS
  ? process.env.ALLOWED_ORIGINS.split(',').map((o) => o.trim())
  : [
      process.env.CLIENT_URL || 'http://localhost:5173',
      'http://localhost:5173',
      'http://localhost:5174',
      'http://localhost:5175',
    ];

app.use(
  cors({
    origin: function (
      origin: string | undefined,
      callback: (err: Error | null, allow?: boolean) => void
    ) {
      if (!origin || allowedOrigins.includes(origin)) {
        callback(null, true);
      } else {
        callback(new Error(`Origin ${origin} not allowed by CORS`));
      }
    },
    credentials: true,
  })
);

// Rate limiting
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 200,
  standardHeaders: true,
  legacyHeaders: false,
  message: { success: false, error: 'Too many requests, please try again later' },
});
app.use(limiter);

// Parsing
app.use(express.json({ limit: '10mb' }));
app.use(cookieParser());

// Request logging
app.use(requestLogger);

// Static files (product images)
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

// Routes
app.use('/api/auth', authRoutes);
app.use('/api/products', productRoutes);
app.use('/api/sales', salesRoutes);
app.use('/api/delivery', deliveryRoutes);
app.use('/api/analytics', analyticsRoutes);
app.use('/api/users', userRoutes);
app.use('/api/customers', customerRoutes);
app.use('/api/distributors', distributorRoutes);
app.use('/api/categories', categoryRoutes);
app.use('/api/stock-adjustments', stockAdjustmentRoutes);
app.use('/api/settings', settingsRoutes);
app.use('/api/purchase-orders', purchaseOrderRoutes);
app.use('/api/audit-log', auditLogRoutes);
app.use('/api/notifications', notificationRoutes);
app.use('/api/coupons', couponRoutes);
app.use('/api/gift-cards', giftCardRoutes);
app.use('/api/bundles', bundleRoutes);
app.use('/api/stock-counts', stockCountRoutes);
app.use('/api/reservations', reservationRoutes);
app.use('/api/label-templates', labelTemplateRoutes);

app.use('/api/exports', exportRoutes);
app.use('/api/register', registerRoutes);
app.use('/api/exchanges', exchangeRoutes);
app.use('/api/shifts', shiftRoutes);
app.use('/api/expenses', expenseRoutes);
app.use('/api/segments', segmentRoutes);
app.use('/api/layaway', layawayRoutes);
app.use('/api/collections', collectionRoutes);
app.use('/api/warranty', warrantyRoutes);
app.use('/api/feedback', feedbackRoutes);
app.use('/api/branches', branchRoutes);
app.use('/api/storefront', storefrontRoutes);
app.use('/api/online-orders', onlineOrderRoutes);
app.use('/api/reports', reportRoutes);
app.use('/api/vendors', vendorRoutes);
app.use('/api/ai', aiRoutes);
app.use('/api/shipping-companies', shippingCompanyRoutes);

// Health check (includes DB connectivity test)
app.get('/api/health', (_req: Request, res: Response) => {
  try {
    db.db.prepare('SELECT 1').get();
    res.json({ success: true, data: { status: 'ok', timestamp: new Date().toISOString() } });
  } catch {
    res.status(503).json({ success: false, error: 'Database unreachable' });
  }
});

// Error handler
app.use(errorHandler);

// Cleanup expired reservations every 5 minutes
const cleanupInterval = setInterval(cleanupExpiredReservations, 5 * 60 * 1000);

// Prevent crashes from unhandled errors
process.on('uncaughtException', (err) => {
  logger.error('Uncaught Exception', { message: err.message, stack: err.stack });
});

process.on('unhandledRejection', (reason) => {
  logger.error('Unhandled Rejection', { reason: String(reason) });
});

const server = app.listen(PORT, () => {
  logger.info(`MOON Fashion API running on port ${PORT}`);
});

// Graceful shutdown
function shutdown(signal: string): void {
  logger.info(`${signal} received, shutting down gracefully`);
  clearInterval(cleanupInterval);
  server.close(() => {
    logger.info('HTTP server closed');
    db.db.close();
    logger.info('Database connection closed');
    process.exit(0);
  });
  // Force exit after 10s if connections don't close
  setTimeout(() => {
    logger.error('Forced shutdown after timeout');
    process.exit(1);
  }, 10000);
}

process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT', () => shutdown('SIGINT'));
