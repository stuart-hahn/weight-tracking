import type { Request, Response, NextFunction } from 'express';
import { Prisma } from '../generated/prisma/client.js';

export interface HttpError extends Error {
  statusCode?: number;
}

export function errorHandler(
  err: unknown,
  _req: Request,
  res: Response,
  _next: NextFunction
): void {
  const httpErr = err as HttpError;

  if (httpErr.statusCode != null && typeof httpErr.statusCode === 'number') {
    const message = httpErr.message && String(httpErr.message).trim() ? httpErr.message : 'Request failed';
    res.status(httpErr.statusCode).json({ error: message });
    return;
  }

  if (err instanceof Prisma.PrismaClientKnownRequestError) {
    if (err.code === 'P2002') {
      res.status(409).json({ error: 'Resource already exists' });
      return;
    }
    if (err.code === 'P2025') {
      res.status(404).json({ error: 'Not found' });
      return;
    }
  }

  console.error(err);
  res.status(500).json({ error: 'Internal server error' });
}
