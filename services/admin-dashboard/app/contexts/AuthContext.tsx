"use client";

import { createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from "react";
import { redirectToLogin } from "@/src/shared/login-redirect";
import {
  ADMIN_PROFILE_REFRESH_EVENT,
  isAdminProfileRefreshStorageKey,
} from "@/src/shared/admin-profile-refresh";

export type AdminAccessLevel = "super_admin" | "platform_admin" | "program_admin" | "no_access";

export type AdminProgram = {
  programId: string;
  brandId: string;
  brandName: string;
  brandSlug: string;
  programName: string;
  programSlug: string;
  programYear: number;
  programStatus: string;
  isActive: boolean;
  startDate: string;
  endDate: string;
  logoUrl?: string | null;
  roleInProgram: string;
  permissions: string[];
  accessType: "assigned" | "brand_scope" | "platform";
};

export type AdminBrand = {
  brandId: string;
  brandSlug: string;
  brandName: string;
  isActive: boolean;
  logoUrl?: string | null;
  roleInBrand: string;
  permissions: string[];
};

export type AdminAccessConfig = {
  isSuperAdmin: boolean;
  canAccessPlatform: boolean;
  canAccessPrograms: boolean;
  canManageAdmins: boolean;
  canAssignRoles: boolean;
};

export type AdminProfile = {
  id: string;
  userId: string;
  fullName: string;
  email: string;
  avatarUrl?: string;
  accessLevel: number;
  canManageAdmins: boolean;
  canAssignRoles: boolean;
  roleId: string;
  roleName: string;
  permissions: string[];
  customPermissions: string[];
  assignedPrograms: AdminProgram[];
  accessiblePrograms: AdminProgram[];
  assignedBrands: AdminBrand[];
};

type AuthContextType = {
  isAuthenticated: boolean;
  isLoading: boolean;
  adminProfile: AdminProfile | null;
  adminAccessLevel: AdminAccessLevel;
  accessConfig: AdminAccessConfig;
  isPlatformAdmin: boolean;
  assignedPrograms: AdminProgram[];
  accessiblePrograms: AdminProgram[];
  refreshAdminProfile: () => Promise<void>;
  login: (email: string, password: string) => Promise<void>;
  logout: () => void;
};

type AdminLoginResponse = {
  accessToken: string;
  refreshToken: string;
  user: {
    id: string;
    email: string;
  };
  admin: {
    id: string;
    fullName: string;
    avatarUrl?: string;
    roleId: string;
    role: string;
    accessLevel: number;
    permissions?: string[];
    customPermissions?: string[];
    canManageAdmins?: boolean;
    canAssignRoles?: boolean;
    programs?: Array<{
      programId: string;
      brandId: string;
      brandName: string;
      brandSlug: string;
      programName: string;
      programSlug: string;
      programYear: number;
      programStatus: string;
      isActive: boolean;
      startDate: string;
      endDate: string;
      logoUrl?: string | null;
      role: string;
      permissions?: string[];
      accessType: "assigned" | "brand_scope" | "platform";
    }>;
    accessiblePrograms?: Array<{
      programId: string;
      brandId: string;
      brandName: string;
      brandSlug: string;
      programName: string;
      programSlug: string;
      programYear: number;
      programStatus: string;
      isActive: boolean;
      startDate: string;
      endDate: string;
      logoUrl?: string | null;
      role: string | null;
      permissions?: string[];
      accessType: "assigned" | "brand_scope" | "platform";
    }>;
    brands?: Array<{
      brandId: string;
      brandName: string;
      brandSlug: string;
      isActive: boolean;
      logoUrl?: string | null;
      role: string;
      permissions?: string[];
    }>;
  };
};

type ApiEnvelope<T> = {
  statusCode: number;
  message: string;
  data: T;
};

type JwtPayload = {
  exp?: number;
};

type PersistedAuthSession = {
  accessToken: string;
  refreshToken: string;
  adminProfile: AdminProfile;
};

const ACCESS_TOKEN_STORAGE_KEY = "access_token";
const REFRESH_TOKEN_STORAGE_KEY = "refresh_token";
const AUTH_SESSION_STORAGE_KEY = "admin_auth_session";
const REFRESH_WINDOW_MS = 5 * 60 * 1000;

const AuthContext = createContext<AuthContextType | undefined>(undefined);

function buildApiUrl(path: string): string {
  const baseUrl = process.env.NEXT_PUBLIC_API_URL;
  if (!baseUrl) {
    throw new Error("NEXT_PUBLIC_API_URL is not configured.");
  }

  return `${baseUrl}${path}`;
}

function normalizePermissions(value: unknown): string[] {
  if (!Array.isArray(value)) {
    return [];
  }

  return value.filter((item): item is string => typeof item === "string");
}

function readStoredSession(): PersistedAuthSession | null {
  if (typeof window === "undefined") return null;

  const rawValue = window.localStorage.getItem(AUTH_SESSION_STORAGE_KEY);
  if (!rawValue) return null;

  try {
    const parsed = JSON.parse(rawValue) as PersistedAuthSession;
    if (!parsed?.accessToken || !parsed?.refreshToken || !parsed?.adminProfile?.id) {
      return null;
    }

    return parsed;
  } catch {
    return null;
  }
}

function persistSession(session: PersistedAuthSession): void {
  if (typeof window === "undefined") return;

  window.localStorage.setItem(ACCESS_TOKEN_STORAGE_KEY, session.accessToken);
  window.localStorage.setItem(REFRESH_TOKEN_STORAGE_KEY, session.refreshToken);
  window.localStorage.setItem(AUTH_SESSION_STORAGE_KEY, JSON.stringify(session));
}

function clearStoredSession(): void {
  if (typeof window === "undefined") return;

  window.localStorage.removeItem(ACCESS_TOKEN_STORAGE_KEY);
  window.localStorage.removeItem(REFRESH_TOKEN_STORAGE_KEY);
  window.localStorage.removeItem(AUTH_SESSION_STORAGE_KEY);
}

async function readErrorMessage(response: Response): Promise<string> {
  try {
    const payload = (await response.json()) as { message?: string | string[] };
    if (Array.isArray(payload.message)) {
      return payload.message.join(", ");
    }
    if (typeof payload.message === "string") {
      return payload.message;
    }
  } catch {
    // Fall through to generic message.
  }

  return `Request failed with status ${response.status}.`;
}

async function readApiData<T>(response: Response): Promise<T> {
  const payload = (await response.json()) as ApiEnvelope<T>;
  return payload.data;
}

function decodeJwtPayload(token: string): JwtPayload | null {
  try {
    const [, payload] = token.split(".");
    if (!payload) {
      return null;
    }

    const normalizedPayload = payload.replace(/-/g, "+").replace(/_/g, "/");
    const decodedPayload = window.atob(normalizedPayload);
    return JSON.parse(decodedPayload) as JwtPayload;
  } catch {
    return null;
  }
}

function getRefreshDelay(accessToken: string): number {
  const payload = decodeJwtPayload(accessToken);
  if (!payload?.exp) {
    return 0;
  }

  return payload.exp * 1000 - Date.now() - REFRESH_WINDOW_MS;
}

function isAccessTokenExpiringSoon(accessToken: string): boolean {
  return getRefreshDelay(accessToken) <= 0;
}

function computeAccessConfig(profile: AdminProfile | null): AdminAccessConfig {
  if (!profile) {
    return {
      isSuperAdmin: false,
      canAccessPlatform: false,
      canAccessPrograms: false,
      canManageAdmins: false,
      canAssignRoles: false,
    };
  }

  const permissionSet = new Set(
    [
      ...profile.permissions,
      ...profile.customPermissions,
      ...profile.assignedPrograms.flatMap((program) => program.permissions),
      ...profile.assignedBrands.flatMap((brand) => brand.permissions),
    ].map((permission) => permission.toLowerCase()),
  );

  const normalizedRoleName = profile.roleName.toLowerCase();
  const isSuperAdmin =
    profile.accessLevel >= 10 ||
    profile.canManageAdmins ||
    profile.canAssignRoles ||
    ["super admin", "super_admin", "super-admin", "owner"].includes(normalizedRoleName) ||
    permissionSet.has("*") ||
    permissionSet.has("admin.*") ||
    permissionSet.has("platform.*");

  const canAccessPlatform =
    isSuperAdmin ||
    profile.accessLevel >= 5 ||
    permissionSet.has("platform_access") ||
    permissionSet.has("platform.manage") ||
    permissionSet.has("admin.manage");

  const canAccessPrograms = isSuperAdmin || profile.accessiblePrograms.length > 0;

  return {
    isSuperAdmin,
    canAccessPlatform,
    canAccessPrograms,
    canManageAdmins:
      profile.canManageAdmins ||
      isSuperAdmin ||
      permissionSet.has("admin.manage") ||
      permissionSet.has("admin.*") ||
      permissionSet.has("platform.manage"),
    canAssignRoles:
      profile.canAssignRoles ||
      isSuperAdmin ||
      permissionSet.has("roles.manage") ||
      permissionSet.has("admin.manage") ||
      permissionSet.has("admin.*") ||
      permissionSet.has("platform.manage"),
  };
}

function mapProgramSummary(
  program: NonNullable<AdminLoginResponse["admin"]["accessiblePrograms"]>[number],
): AdminProgram {
  return {
    programId: program.programId,
    brandId: program.brandId,
    brandName: program.brandName,
    brandSlug: program.brandSlug,
    programName: program.programName,
    programSlug: program.programSlug,
    programYear: program.programYear,
    programStatus: program.programStatus,
    isActive: program.isActive,
    startDate: program.startDate,
    endDate: program.endDate,
    logoUrl: program.logoUrl,
    roleInProgram: program.role ?? "member",
    permissions: normalizePermissions(program.permissions),
    accessType: program.accessType,
  };
}

function buildAdminProfile(authResponse: AdminLoginResponse): AdminProfile {
  const permissions = normalizePermissions(authResponse.admin.permissions);
  const customPermissions = normalizePermissions(authResponse.admin.customPermissions);
  const programAssignments = authResponse.admin.programs ?? [];
  const accessiblePrograms = authResponse.admin.accessiblePrograms ?? authResponse.admin.programs ?? [];
  const brandAssignments = authResponse.admin.brands ?? [];

  return {
    id: authResponse.admin.id,
    userId: authResponse.user.id,
    fullName: authResponse.admin.fullName,
    email: authResponse.user.email,
    avatarUrl: authResponse.admin.avatarUrl,
    accessLevel: authResponse.admin.accessLevel,
    canManageAdmins: authResponse.admin.canManageAdmins ?? false,
    canAssignRoles: authResponse.admin.canAssignRoles ?? false,
    roleId: authResponse.admin.roleId,
    roleName: authResponse.admin.role,
    permissions,
    customPermissions,
    assignedPrograms: programAssignments.map((program) => mapProgramSummary(program)),
    accessiblePrograms: accessiblePrograms.map((program) => mapProgramSummary(program)),
    assignedBrands: brandAssignments.map((brandAssignment) => {
      return {
        brandId: brandAssignment.brandId,
        brandSlug: brandAssignment.brandSlug,
        brandName: brandAssignment.brandName,
        isActive: brandAssignment.isActive,
        logoUrl: brandAssignment.logoUrl,
        roleInBrand: brandAssignment.role,
        permissions: normalizePermissions(brandAssignment.permissions),
      };
    }),
  };
}

async function refreshAdminTokens(refreshToken: string): Promise<AdminLoginResponse> {
  const response = await fetch(buildApiUrl("/auth/admin/refresh"), {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ refreshToken }),
  });

  if (!response.ok) {
    throw new Error(await readErrorMessage(response));
  }

  return await readApiData<AdminLoginResponse>(response);
}

async function hydrateSession(authResponse: AdminLoginResponse): Promise<PersistedAuthSession> {
  return {
    accessToken: authResponse.accessToken,
    refreshToken: authResponse.refreshToken,
    adminProfile: buildAdminProfile(authResponse),
  };
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [adminProfile, setAdminProfile] = useState<AdminProfile | null>(null);
  const refreshInFlightRef = useRef<Promise<void> | null>(null);

  const refreshAdminProfile = useCallback(async () => {
    const storedSession = readStoredSession();
    if (!storedSession) {
      return;
    }

    if (refreshInFlightRef.current) {
      return refreshInFlightRef.current;
    }

    const refreshTask = (async () => {
      try {
        const refreshedAuthResponse = await refreshAdminTokens(storedSession.refreshToken);
        const hydratedSession = await hydrateSession(refreshedAuthResponse);
        persistSession(hydratedSession);
        setAdminProfile(hydratedSession.adminProfile);
        setIsAuthenticated(true);
      } catch {
        clearStoredSession();
        setAdminProfile(null);
        setIsAuthenticated(false);
        redirectToLogin("session_expired");
      } finally {
        refreshInFlightRef.current = null;
      }
    })();

    refreshInFlightRef.current = refreshTask;
    return refreshTask;
  }, []);

  useEffect(() => {
    let isMounted = true;

    async function bootstrapAuth() {
      const storedSession = readStoredSession();

      if (!storedSession) {
        if (isMounted) {
          setIsLoading(false);
        }
        return;
      }

      try {
        const authResponse = isAccessTokenExpiringSoon(storedSession.accessToken)
          ? await refreshAdminTokens(storedSession.refreshToken)
          : {
              accessToken: storedSession.accessToken,
              refreshToken: storedSession.refreshToken,
              user: {
                id: storedSession.adminProfile.userId,
                email: storedSession.adminProfile.email,
              },
              admin: {
                id: storedSession.adminProfile.id,
                fullName: storedSession.adminProfile.fullName,
                avatarUrl: storedSession.adminProfile.avatarUrl,
                roleId: storedSession.adminProfile.roleId,
                role: storedSession.adminProfile.roleName,
                accessLevel: storedSession.adminProfile.accessLevel,
                permissions: storedSession.adminProfile.permissions,
                customPermissions: storedSession.adminProfile.customPermissions,
                canManageAdmins: storedSession.adminProfile.canManageAdmins,
                canAssignRoles: storedSession.adminProfile.canAssignRoles,
                programs: storedSession.adminProfile.assignedPrograms.map((program) => ({
                  programId: program.programId,
                  brandId: program.brandId,
                  brandName: program.brandName,
                  brandSlug: program.brandSlug,
                  programName: program.programName,
                  programSlug: program.programSlug,
                  programYear: program.programYear,
                  programStatus: program.programStatus,
                  isActive: program.isActive,
                  startDate: program.startDate,
                  endDate: program.endDate,
                  logoUrl: program.logoUrl,
                  role: program.roleInProgram,
                  permissions: program.permissions,
                  accessType: program.accessType,
                })),
                accessiblePrograms: storedSession.adminProfile.accessiblePrograms.map((program) => ({
                  programId: program.programId,
                  brandId: program.brandId,
                  brandName: program.brandName,
                  brandSlug: program.brandSlug,
                  programName: program.programName,
                  programSlug: program.programSlug,
                  programYear: program.programYear,
                  programStatus: program.programStatus,
                  isActive: program.isActive,
                  startDate: program.startDate,
                  endDate: program.endDate,
                  logoUrl: program.logoUrl,
                  role: program.roleInProgram,
                  permissions: program.permissions,
                  accessType: program.accessType,
                })),
                brands: storedSession.adminProfile.assignedBrands.map((brand) => ({
                  brandId: brand.brandId,
                  brandName: brand.brandName,
                  brandSlug: brand.brandSlug,
                  isActive: brand.isActive,
                  logoUrl: brand.logoUrl,
                  role: brand.roleInBrand,
                  permissions: brand.permissions,
                })),
              },
            };

        const hydratedSession = await hydrateSession(authResponse);
        persistSession(hydratedSession);

        if (isMounted) {
          setAdminProfile(hydratedSession.adminProfile);
          setIsAuthenticated(true);
        }
      } catch {
        clearStoredSession();
        if (isMounted) {
          setAdminProfile(null);
          setIsAuthenticated(false);
        }
        redirectToLogin("session_expired");
      } finally {
        if (isMounted) {
          setIsLoading(false);
        }
      }
    }

    void bootstrapAuth();

    return () => {
      isMounted = false;
    };
  }, []);

  useEffect(() => {
    if (typeof window === "undefined") {
      return;
    }

    const triggerRefresh = () => {
      if (!readStoredSession()) {
        return;
      }

      void refreshAdminProfile();
    };

    const handleStorage = (event: StorageEvent) => {
      if (isAdminProfileRefreshStorageKey(event.key)) {
        triggerRefresh();
      }
    };

    window.addEventListener(ADMIN_PROFILE_REFRESH_EVENT, triggerRefresh);
    window.addEventListener("storage", handleStorage);

    return () => {
      window.removeEventListener(ADMIN_PROFILE_REFRESH_EVENT, triggerRefresh);
      window.removeEventListener("storage", handleStorage);
    };
  }, [refreshAdminProfile]);

  useEffect(() => {
    if (!isAuthenticated) {
      return;
    }

    const storedSession = readStoredSession();
    if (!storedSession) {
      return;
    }

    const refreshDelay = getRefreshDelay(storedSession.accessToken);

    const timeoutId = window.setTimeout(() => {
      void refreshAdminProfile();
    }, Math.max(refreshDelay, 0));

    return () => {
      window.clearTimeout(timeoutId);
    };
  }, [isAuthenticated, adminProfile?.id, refreshAdminProfile]);

  const accessConfig = computeAccessConfig(adminProfile);

  const adminAccessLevel: AdminAccessLevel = (() => {
    if (accessConfig.isSuperAdmin) {
      return "super_admin";
    }

    if (accessConfig.canAccessPlatform) {
      return "platform_admin";
    }

    if (accessConfig.canAccessPrograms) {
      return "program_admin";
    }

    return "no_access";
  })();

  const isPlatformAdmin = accessConfig.canAccessPlatform;
  const assignedPrograms = adminProfile?.assignedPrograms || [];
  const accessiblePrograms = adminProfile?.accessiblePrograms || [];

  const login = async (email: string, password: string) => {
    setIsLoading(true);

    try {
      const response = await fetch(buildApiUrl("/auth/admin/login"), {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ email, password }),
      });

      if (!response.ok) {
        throw new Error(await readErrorMessage(response));
      }

      const authResponse = await readApiData<AdminLoginResponse>(response);
      const hydratedSession = await hydrateSession(authResponse);

      persistSession(hydratedSession);
      setAdminProfile(hydratedSession.adminProfile);
      setIsAuthenticated(true);
    } catch (error) {
      clearStoredSession();
      setAdminProfile(null);
      setIsAuthenticated(false);
      throw error instanceof Error ? error : new Error("Unable to sign in.");
    } finally {
      setIsLoading(false);
    }
  };

  const logout = () => {
    const storedSession = readStoredSession();

    clearStoredSession();
    setAdminProfile(null);
    setIsAuthenticated(false);

    if (storedSession?.accessToken) {
      void fetch(buildApiUrl("/auth/logout"), {
        method: "POST",
        headers: {
          Authorization: `Bearer ${storedSession.accessToken}`,
        },
      }).catch(() => undefined);
    }
  };

  return (
    <AuthContext.Provider
      value={{
        isAuthenticated,
        isLoading,
        adminProfile,
        adminAccessLevel,
        accessConfig,
        isPlatformAdmin,
        assignedPrograms,
        accessiblePrograms,
        refreshAdminProfile,
        login,
        logout,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
}
