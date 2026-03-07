import { PrismaClient } from '@prisma/client';

// Allow config via DATABASE_FILE (e.g. ./data/body_fat_tracker.db) for SQLite
if (process.env.DATABASE_FILE !== undefined && process.env.DATABASE_FILE !== '' && process.env.DATABASE_URL === undefined) {
  process.env.DATABASE_URL = `file:${process.env.DATABASE_FILE}`;
}

const globalForPrisma = globalThis as unknown as { prisma: PrismaClient | undefined };

export const prisma =
  globalForPrisma.prisma ??
  new PrismaClient({
    log: process.env.NODE_ENV === 'development' ? ['error', 'warn'] : ['error'],
  });

if (process.env.NODE_ENV !== 'production') {
  globalForPrisma.prisma = prisma;
}
