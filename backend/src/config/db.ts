import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { PrismaBetterSqlite3 } from '@prisma/adapter-better-sqlite3';
import { PrismaClient } from '../../generated/prisma/client.js';

// Allow config via DATABASE_FILE (e.g. ./data/body_fat_tracker.db) for SQLite
if (
  process.env.DATABASE_FILE !== undefined &&
  process.env.DATABASE_FILE !== '' &&
  process.env.DATABASE_URL === undefined
) {
  process.env.DATABASE_URL = `file:${process.env.DATABASE_FILE}`;
}

let databaseUrl = process.env.DATABASE_URL ?? 'file:./data/body_fat_tracker.db';

// Resolve relative file: paths to absolute so app and CLI use the same DB
if (databaseUrl.startsWith('file:./') || databaseUrl.startsWith('file:../')) {
  const relativePath = databaseUrl.slice(5); // strip "file:"
  const __dirname = path.dirname(fileURLToPath(import.meta.url)); // .../backend/src/config
  const backendRoot = path.resolve(__dirname, '../..');
  const absolutePath = path.resolve(backendRoot, relativePath);
  databaseUrl = `file:${absolutePath}`;
}

const adapter = new PrismaBetterSqlite3({ url: databaseUrl });

const globalForPrisma = globalThis as unknown as { prisma: PrismaClient | undefined };

export const prisma =
  globalForPrisma.prisma ??
  new PrismaClient({
    adapter,
    log: process.env.NODE_ENV === 'development' ? ['error', 'warn'] : ['error'],
  });

if (process.env.NODE_ENV !== 'production') {
  globalForPrisma.prisma = prisma;
}
