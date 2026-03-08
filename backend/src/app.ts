import express from 'express';
import cors from 'cors';
import rateLimit from 'express-rate-limit';
import { requestLogger } from './middleware/requestLogger.js';
import authRouter from './routes/auth.js';
import usersRouter from './routes/users.js';
import entriesRouter from './routes/entries.js';
import progressRouter from './routes/progress.js';
import optionalMetricsRouter from './routes/optionalMetrics.js';
import { errorHandler } from './middleware/errorHandler.js';

export const app = express();
app.set('trust proxy', true);

app.use(cors({ origin: process.env.CORS_ORIGIN ?? 'http://localhost:5173', credentials: true }));
app.use(express.json());
app.use(requestLogger);

const globalApiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 100,
  message: { error: 'Too many requests; try again later' },
  standardHeaders: true,
  legacyHeaders: false,
});
app.use('/api', globalApiLimiter);

app.use('/api/auth', authRouter);
app.use('/api/users/:id/entries', entriesRouter);
app.use('/api/users/:id/progress', progressRouter);
app.use('/api/users/:id/optional-metrics', optionalMetricsRouter);
app.use('/api/users', usersRouter);

app.get('/health', (_req, res) => {
  res.json({ status: 'ok' });
});

app.use(errorHandler);
