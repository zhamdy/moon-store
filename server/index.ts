import 'dotenv/config';
import express, { Request, Response } from 'express';
import cors from 'cors';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import cookieParser from 'cookie-parser';
import path from 'path';
import errorHandler from './middleware/errorHandler';

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
import { cleanupExpiredReservations } from './routes/reservations';

const app = express();
const PORT: number = Number(process.env.PORT) || 3001;

// Security
app.use(
  helmet({
    crossOriginResourcePolicy: { policy: 'cross-origin' },
  })
);
app.use(
  cors({
    origin: function (
      origin: string | undefined,
      callback: (err: Error | null, allow?: boolean) => void
    ) {
      const allowed: string[] = [
        process.env.CLIENT_URL || 'http://localhost:5173',
        'http://localhost:5173',
        'http://localhost:5174',
        'http://localhost:5175',
      ];
      if (!origin || allowed.includes(origin)) {
        callback(null, true);
      } else {
        callback(null, true); // allow all in dev
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

// Health check
app.get('/api/health', (req: Request, res: Response) => {
  res.json({ success: true, data: { status: 'ok', timestamp: new Date().toISOString() } });
});

// Error handler
app.use(errorHandler);

// Cleanup expired reservations every 5 minutes
setInterval(cleanupExpiredReservations, 5 * 60 * 1000);

// Prevent crashes from unhandled errors
process.on('uncaughtException', (err) => {
  console.error('Uncaught Exception:', err.message);
  console.error(err.stack);
});

process.on('unhandledRejection', (reason) => {
  console.error('Unhandled Rejection:', reason);
});

app.listen(PORT, () => {
  console.log(`MOON Fashion API running on port ${PORT}`);
});
