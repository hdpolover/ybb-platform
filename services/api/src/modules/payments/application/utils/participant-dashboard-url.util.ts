type ParticipantBrandUrls =
  | {
      landingUrl?: string | null;
      websiteUrl?: string | null;
    }
  | null
  | undefined;

function normalizeParticipantDashboardBaseUrl(brand: ParticipantBrandUrls): string {
  const base = (brand?.landingUrl ?? brand?.websiteUrl ?? '').trim().replace(/\/$/, '');
  return base;
}

export function buildParticipantPaymentsUrl(brand: ParticipantBrandUrls): string {
  const base = normalizeParticipantDashboardBaseUrl(brand);
  if (!base) return '';
  return `${base}/dashboard/payments`;
}

export function buildParticipantInvoiceUrl(
  brand: ParticipantBrandUrls,
  invoiceId: string | null | undefined,
): string {
  const paymentsUrl = buildParticipantPaymentsUrl(brand);
  if (!paymentsUrl || !invoiceId) return paymentsUrl;
  return `${paymentsUrl}/${invoiceId}`;
}

export function buildParticipantSubmissionUrl(brand: ParticipantBrandUrls): string {
  const base = normalizeParticipantDashboardBaseUrl(brand);
  if (!base) return '';
  return `${base}/dashboard/submission`;
}
