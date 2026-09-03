import { ApplicationCategory } from '@core/entities/participant-application.entity';
import { PaymentStatus } from '@prisma/client';

/**
 * One application whose already-paid (or processing) registration-fee
 * invoice was issued under a tier category that no longer matches the
 * application's current category — i.e. an admin moved the application
 * between fully_funded/self_funded after the fee was paid, and the invoice
 * was deliberately left untouched.
 */
export class RegistrationFeeMismatchRowDto {
  applicationId: string;
  participantFullName: string;
  participantEmail: string | null;
  /** Application's current category (what it is now). */
  currentCategory: ApplicationCategory;
  /** Category the paid invoice's tier was issued under (what it was paid for). */
  invoicedCategory: ApplicationCategory;
  invoiceId: string;
  invoiceStatus: PaymentStatus;
  amountPaid: number;
  currency: string;
  paidAt: Date | null;
  /** Current price of the active registration_fee tier for currentCategory, if one exists. */
  currentTierPrice: number | null;
  /** currentTierPrice - amountPaid. Positive = still owed, negative = overpaid. Null if there is no active tier to compare against. */
  difference: number | null;
}

export class RegistrationFeeMismatchListResponseDto {
  rows: RegistrationFeeMismatchRowDto[];
  total: number;
}
