import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import authRouter from './routes/auth.js';
import usersRouter from './routes/users.js';
import entriesRouter from './routes/entries.js';
import progressRouter from './routes/progress.js';

const app = express();
const PORT = Number(process.env.PORT) || 3001;

app.use(cors({ origin: process.env.CORS_ORIGIN ?? 'http://localhost:5173', credentials: true }));
app.use(express.json());

app.use('/api/auth', authRouter);
app.use('/api/users/:id/entries', entriesRouter);
app.use('/api/users/:id/progress', progressRouter);
app.use('/api/users', usersRouter);

app.get('/health', (_req, res) => {
  res.json({ status: 'ok' });
});

app.listen(PORT, () => {
  console.log(`Body Fat Tracker API listening on http://localhost:${PORT}`);
});
