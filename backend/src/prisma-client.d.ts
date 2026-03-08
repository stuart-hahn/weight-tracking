/**
 * Type declaration for the generated Prisma client so TypeScript can typecheck
 * when the client lives at backend/generated/prisma/ (after prisma generate).
 */
declare module '../../generated/prisma/client.js' {
  export class PrismaClient {
    constructor(options?: { adapter?: unknown; log?: unknown[] });
    user: unknown;
    dailyEntry: unknown;
    optionalMetric: unknown;
  }

  export namespace Prisma {
    export class PrismaClientKnownRequestError extends Error {
      code: string;
    }
  }
}
