export type LoginRedirectReason = "session_expired";

export function getLoginRedirectMessage(reason: string | null): string | null {
  if (reason === "session_expired") {
    return "Your session expired. Please sign in again.";
  }

  return null;
}

export function redirectToLogin(reason?: LoginRedirectReason): void {
  if (typeof window === "undefined") {
    return;
  }

  ["access_token", "refresh_token", "admin_auth_session"].forEach((key) =>
    window.localStorage.removeItem(key),
  );

  const loginUrl = new URL("/login", window.location.origin);
  if (reason) {
    loginUrl.searchParams.set("reason", reason);
  }

  window.location.href = loginUrl.toString();
}
