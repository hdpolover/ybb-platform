export type LoginRedirectReason = "session_expired";

export function getLoginRedirectMessage(reason: string | null): string | null {
  if (reason === "session_expired") {
    return "Your session expired. Please sign in again.";
  }

  return null;
}

// Pages that work without a session; a stale token must not bounce visitors off them.
const PUBLIC_PATHS = ["/request-access", "/set-password", "/forgot-password"];

export function isPublicPath(pathname: string): boolean {
  return PUBLIC_PATHS.some((path) => pathname === path || pathname.startsWith(`${path}/`));
}

export function redirectToLogin(reason?: LoginRedirectReason): void {
  if (typeof window === "undefined") {
    return;
  }

  // Before clearing the session: a stray 401 on a public page must not log an admin out of this browser.
  if (isPublicPath(window.location.pathname)) {
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
