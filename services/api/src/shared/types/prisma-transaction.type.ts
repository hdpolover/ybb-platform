import { Prisma } from '@prisma/client';

/**
 * Prisma Transaction Client Type
 * 
 * Represents a Prisma client instance within a transaction context.
 * This type is used throughout the application for transaction operations.
 */
export type PrismaTransactionClient = Omit<
  Prisma.TransactionClient,
  '$connect' | '$disconnect' | '$on' | '$transaction' | '$use'
>;
