// services/api/src/shared/utils/prisma-error.util.ts
import { Prisma } from '@prisma/client';

// Matches the parenthesized field list Prisma's query engine puts in the
// human-readable P2002 message, e.g.
//   Unique constraint failed on the fields: (`program_id`, `stage`, `version`)
const UNIQUE_CONSTRAINT_MESSAGE_RE = /Unique constraint failed on the fields: \(([^)]*)\)/;

/**
 * Extracts the constraint's field names from a P2002 error, tolerating every
 * shape observed so far -- do not assume any one of these is "the" shape:
 *
 * - meta.driverAdapterError.cause.constraint.fields as string[] of DB column
 *   names: the most precise shape observed, and what Prisma 7.3.0 with
 *   @prisma/adapter-pg actually populates against Postgres (verified in
 *   test/integration/scoring-rubric-version-conflict.spec.ts). It comes
 *   straight from Postgres's own error detail, so it is exact.
 * - meta.target as string[] of Prisma field names (documented Prisma
 *   behavior on some engines/versions, but NOT what adapter-pg + Postgres
 *   populates -- meta.target was `undefined` in the same verification run).
 * - meta.target as a single delimited string (some driver adapters).
 * - message text as a last resort, e.g.
 *   "Unique constraint failed on the fields: (`program_id`, `stage`, `version`)"
 *   -- also confirmed present in the same verification run, backtick-quoted
 *   snake_case DB columns.
 *
 * Relying on meta.target alone, as an earlier version of this function did,
 * made the retry/409 path silently dead code against a real Postgres
 * database -- every genuine version race would have degraded to an
 * unhandled 500 instead of the retry-then-409 this handler exists to
 * provide.
 */
export function targetFieldsOf(error: Prisma.PrismaClientKnownRequestError): string[] {
  const meta = error.meta as
    | { target?: unknown; driverAdapterError?: { cause?: { constraint?: { fields?: unknown } } } }
    | undefined;

  const adapterFields = meta?.driverAdapterError?.cause?.constraint?.fields;
  if (Array.isArray(adapterFields)) return adapterFields as string[];

  const target = meta?.target;
  if (Array.isArray(target)) return target as string[];
  if (typeof target === 'string' && target.length > 0) {
    return target.split(/[,\s]+/).filter(Boolean);
  }

  const match = UNIQUE_CONSTRAINT_MESSAGE_RE.exec(error.message);
  if (!match) return [];
  return match[1]
    .split(',')
    .map((field) => field.trim().replace(/`/g, ''))
    .filter(Boolean);
}

export interface PrismaHttpMapping {
  status: number;
  message: string;
  errorCode: string;
}

type KnownRequestErrorLike = Prisma.PrismaClientKnownRequestError;

/**
 * `instanceof` alone is unreliable: a second copy of @prisma/client anywhere
 * in node_modules gives a different class identity, so a genuine Prisma error
 * would silently fall through to an opaque 500. Duck-type as a fallback.
 */
function asKnownRequestError(exception: unknown): KnownRequestErrorLike | null {
  if (exception instanceof Prisma.PrismaClientKnownRequestError) return exception;
  const e = exception as { code?: unknown; clientVersion?: unknown } | null;
  if (
    e &&
    typeof e === 'object' &&
    typeof e.code === 'string' &&
    /^P\d{4}$/.test(e.code) &&
    'clientVersion' in e
  ) {
    return exception as KnownRequestErrorLike;
  }
  return null;
}

function isInitializationError(exception: unknown): boolean {
  if (exception instanceof Prisma.PrismaClientInitializationError) return true;
  return (exception as { name?: unknown } | null)?.name === 'PrismaClientInitializationError';
}

/** Raw Postgres text from the driver adapter — the only field populated in every case. */
function originalMessageOf(error: KnownRequestErrorLike): string {
  const meta = error.meta as
    | { driverAdapterError?: { cause?: { originalMessage?: unknown } } }
    | undefined;
  const raw = meta?.driverAdapterError?.cause?.originalMessage;
  return typeof raw === 'string' ? raw : '';
}

/**
 * Best-effort column name for the codes where Prisma's documented meta field
 * is empty under adapter-pg. Structured meta first, raw Postgres text second.
 */
function columnOf(error: KnownRequestErrorLike, messageRe: RegExp): string | null {
  const meta = error.meta as
    | {
        column_name?: unknown;
        constraint?: unknown;
        driverAdapterError?: {
          cause?: { column?: unknown; constraint?: { fields?: unknown } };
        };
      }
    | undefined;

  const documented = meta?.column_name ?? meta?.constraint;
  if (typeof documented === 'string' && documented) return documented;

  const cause = meta?.driverAdapterError?.cause;
  if (typeof cause?.column === 'string' && cause.column) return cause.column;
  const fields = cause?.constraint?.fields;
  if (Array.isArray(fields) && typeof fields[0] === 'string') return fields[0];

  return messageRe.exec(originalMessageOf(error))?.[1] ?? null;
}

const DB_UNAVAILABLE: PrismaHttpMapping = {
  status: 503,
  message: 'The service is temporarily unavailable. Please try again shortly.',
  errorCode: 'DATABASE_UNAVAILABLE',
};

const UNAVAILABLE_CODES = new Set(['P2024', 'P1001', 'P1002', 'P1008', 'P1017']);

/**
 * Maps a Prisma error to a client-safe HTTP response, or null when the error
 * is not one we translate (so the caller keeps its existing 500 behavior).
 *
 * Prisma's own `message` is NEVER forwarded: it embeds the invocation
 * ("Invalid `prisma.user.create()` invocation:"), source paths and query
 * fragments. Only column/field names lifted out of `meta` are echoed.
 */
export function prismaToHttp(exception: unknown): PrismaHttpMapping | null {
  if (isInitializationError(exception)) return DB_UNAVAILABLE;

  const error = asKnownRequestError(exception);
  if (!error) return null;

  if (UNAVAILABLE_CODES.has(error.code)) return DB_UNAVAILABLE;

  switch (error.code) {
    case 'P2002': {
      const fields = targetFieldsOf(error);
      if (fields.length === 1) {
        return {
          status: 409,
          message: `A record with this ${fields[0]} already exists.`,
          errorCode: 'DUPLICATE_RECORD',
        };
      }
      return {
        status: 409,
        message:
          fields.length > 1
            ? `A record with these values already exists (${fields.join(', ')}).`
            : 'A record with these values already exists.',
        errorCode: 'DUPLICATE_RECORD',
      };
    }
    case 'P2025':
      // Deliberately does not echo meta — it can carry query internals.
      return {
        status: 404,
        message: 'The requested record no longer exists.',
        errorCode: 'RECORD_NOT_FOUND',
      };
    case 'P2000': {
      // Postgres does not populate column_name for SQLSTATE 22001, and the raw
      // text only names the type width — so the column is often unavailable.
      const column = columnOf(error, /column "([^"]+)"/);
      return {
        status: 400,
        message: column
          ? `The value provided for ${column} is too long.`
          : 'One of the provided values is too long.',
        errorCode: 'VALUE_TOO_LONG',
      };
    }
    case 'P2003':
      return {
        status: 409,
        message: 'This operation conflicts with a related record.',
        errorCode: 'RELATED_RECORD_CONFLICT',
      };
    case 'P2011': {
      const column = columnOf(error, /null value in column "([^"]+)"/);
      return {
        status: 400,
        message: column ? `${column} is required.` : 'A required field is missing.',
        errorCode: 'MISSING_REQUIRED_FIELD',
      };
    }
    case 'P2023':
      return {
        status: 400,
        message: 'One of the provided values is invalid.',
        errorCode: 'INVALID_FIELD_VALUE',
      };
    default:
      // Every other Prisma code — and PrismaClientValidationError, which is a
      // developer bug, not a client error — keeps the generic 500.
      return null;
  }
}
