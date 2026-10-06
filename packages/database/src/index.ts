import { PrismaClient } from "../generated/client/index.js";

declare global {
  var __prisma: PrismaClient | undefined;
}

/** Reuses a single PrismaClient instance across hot reloads in development. */
export const prisma: PrismaClient = globalThis.__prisma ?? new PrismaClient();

if (process.env.NODE_ENV !== "production") {
  globalThis.__prisma = prisma;
}

export { PrismaClient } from "../generated/client/index.js";
export type * from "../generated/client/index.js";
