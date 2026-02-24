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
import locationRoutes from './routes/locations';
import exportRoutes from './routes/exports';
import { cleanupExpiredReservations } from './routes/reservations';

const app = express();
const PORT: number = Number(process.env.PORT) || 3001;

// Security
app.use(helmet());
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
app.use('/api/locations', locationRoutes);
app.use('/api/exports', exportRoutes);

// Health check
app.get('/api/health', (req: Request, res: Response) => {
  res.json({ success: true, data: { status: 'ok', timestamp: new Date().toISOString() } });
});

// Error handler
app.use(errorHandler);

// Cleanup expired reservations every 5 minutes
setInterval(cleanupExpiredReservations, 5 * 60 * 1000);

app.listen(PORT, () => {
  console.log(`MOON Fashion API running on port ${PORT}`);
});
