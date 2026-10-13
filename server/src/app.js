import express from 'express';
import helmet from 'helmet';
import cors from 'cors';
import morgan from 'morgan';
import rateLimit from 'express-rate-limit';
import env from './config/env.js';
import { notFound, errorHandler } from './middleware/errorHandler.js';
import scanRoutes from './routes/scans.js';

export function createApp() {
  const app = express();

  app.disable('x-powered-by');
  app.set('trust proxy', env.trustProxy);
  app.use(helmet());
  app.use(cors({ origin: env.clientOrigin }));
  app.use(express.json({ limit: '10kb' }));
  if (env.nodeEnv === 'development') app.use(morgan('dev'));

  app.get('/api/health', (req, res) => {
    res.json({ status: 'ok', uptime: Math.round(process.uptime()) });
  });

  // General ceiling for every route (status polling included). Scan
  // creation has its own stricter, Redis-backed limit.
  app.use(
    '/api',
    rateLimit({
      windowMs: 60 * 1000,
      limit: 600,
      standardHeaders: 'draft-7',
      legacyHeaders: false,
      skip: () => env.nodeEnv === 'test',
      message: { error: { message: 'Too many requests, slow down' } },
    }),
  );

  app.use('/api/scans', scanRoutes);

  app.use(notFound);
  app.use(errorHandler);

  return app;
}
