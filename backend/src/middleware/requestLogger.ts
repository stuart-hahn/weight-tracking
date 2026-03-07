import type { Request, Response, NextFunction } from 'express';
import crypto from 'node:crypto';

export interface RequestWithId extends Request {
  id?: string;
}

export function requestLogger(req: RequestWithId, res: Response, next: NextFunction): void {
  const id = typeof req.headers['x-request-id'] === 'string' && req.headers['x-request-id'].trim() !== ''
    ? req.headers['x-request-id'].trim()
    : crypto.randomUUID();
  req.id = id;
  const start = Date.now();
  res.on('finish', () => {
    const durationMs = Date.now() - start;
    const logLine = {
      method: req.method,
      path: req.path,
      statusCode: res.statusCode,
      durationMs,
      requestId: id,
    };
    console.log(JSON.stringify(logLine));
  });
  next();
}
