export const ADMIN_PROFILE_REFRESH_EVENT = "ybb:admin-profile-refresh";
const ADMIN_PROFILE_REFRESH_STORAGE_KEY = "ybb:admin-profile-refresh-request";

const MUTATING_METHODS = new Set(["POST", "PUT", "PATCH", "DELETE"]);

export function shouldRefreshAdminProfileForMutation(path: string, method?: string): boolean {
  const normalizedMethod = (method ?? "GET").toUpperCase();
  if (!MUTATING_METHODS.has(normalizedMethod)) {
    return false;
  }

  return (
    /^\/brands(?:$|\/[^/]+(?:$|\/details$|\/settings$))/.test(path) ||
    /^\/programs(?:$|\/[^/]+(?:$|\/branding$))/.test(path)
  );
}

export function requestAdminProfileRefresh(): void {
  if (typeof window === "undefined") {
    return;
  }

  try {
    window.localStorage.setItem(ADMIN_PROFILE_REFRESH_STORAGE_KEY, String(Date.now()));
  } catch {
    // Ignore storage quota / privacy mode failures — same-tab event still works.
  }

  window.dispatchEvent(new CustomEvent(ADMIN_PROFILE_REFRESH_EVENT));
}

export function isAdminProfileRefreshStorageKey(key: string | null): boolean {
  return key === ADMIN_PROFILE_REFRESH_STORAGE_KEY;
}
