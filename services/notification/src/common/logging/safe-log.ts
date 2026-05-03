export function maskEmail(email: unknown): string {
  if (typeof email !== 'string') {
    return '[redacted-email]';
  }

  const trimmed = email.trim().toLowerCase();
  const [localPart, domain] = trimmed.split('@');
  if (!localPart || !domain) {
    return '[redacted-email]';
  }

  const visibleLocal = localPart.slice(0, 2);
  const maskedLocal = `${visibleLocal}${'*'.repeat(Math.max(localPart.length - visibleLocal.length, 1))}`;
  return `${maskedLocal}@${domain}`;
}

export function summarizeEventPayload(
  payload: unknown,
): Record<string, unknown> {
  const data =
    payload && typeof payload === 'object'
      ? (payload as Record<string, unknown>)
      : {};
  const metadata =
    data.metadata && typeof data.metadata === 'object'
      ? (data.metadata as Record<string, unknown>)
      : undefined;

  const hasEmail = typeof data.email === 'string' && data.email.length > 0;

  return {
    paymentId: data.payment_id ?? data.order_id ?? null,
    status: data.status ?? null,
    gateway: data.gateway ?? null,
    hasEmail,
    ...(hasEmail ? { email: maskEmail(data.email) } : {}),
    hasToken: typeof data.token === 'string' && data.token.length > 0,
    metadataKeys: metadata ? Object.keys(metadata).slice(0, 10) : [],
  };
}
