"use client";

import { createContext, useContext, useState, useEffect, ReactNode } from "react";

// Types
export type AdminAccessLevel = "super_admin" | "platform_admin" | "program_admin" | "no_access";

export type AdminProgram = {
  programId: string;
  programName: string;
  programYear: number;
  roleInProgram: string;
  permissions: string[];
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
  assignedPrograms: AdminProgram[];
};

type AuthContextType = {
  isAuthenticated: boolean;
  isLoading: boolean;
  adminProfile: AdminProfile | null;
  adminAccessLevel: AdminAccessLevel;
  isPlatformAdmin: boolean;
  assignedPrograms: AdminProgram[];
  login: (email: string, password: string) => Promise<void>;
  logout: () => void;
  switchMockAdmin: (type: "super" | "multi" | "single" | "none") => void;
};

const AuthContext = createContext<AuthContextType | undefined>(undefined);

// Mock data for different admin types
const MOCK_ADMINS = {
  super: {
    id: "admin-super-1",
    userId: "user-super-1",
    fullName: "Super Admin",
    email: "super@ybb.com",
    avatarUrl: undefined,
    accessLevel: 3,
    canManageAdmins: true,
    canAssignRoles: true,
    roleId: "role-super",
    roleName: "Super Administrator",
    assignedPrograms: [] as AdminProgram[], // Super admin has access to all programs
  },
  multi: {
    id: "admin-multi-1",
    userId: "user-multi-1",
    fullName: "Program Coordinator",
    email: "coordinator@ybb.com",
    avatarUrl: undefined,
    accessLevel: 2,
    canManageAdmins: false,
    canAssignRoles: false,
    roleId: "role-coordinator",
    roleName: "Program Coordinator",
    assignedPrograms: [
      {
        programId: "iys-2026",
        programName: "Istanbul Youth Summit 2026",
        programYear: 2026,
        roleInProgram: "coordinator",
        permissions: ["view_applications", "review_applications", "manage_participants"],
      },
      {
        programId: "jys-2026",
        programName: "Japan Youth Summit 2026",
        programYear: 2026,
        roleInProgram: "coordinator",
        permissions: ["view_applications", "review_applications"],
      },
      {
        programId: "kys-2026",
        programName: "Korea Youth Summit 2026",
        programYear: 2026,
        roleInProgram: "coordinator",
        permissions: ["view_applications", "review_applications", "manage_participants"],
      },
    ],
  },
  single: {
    id: "admin-single-1",
    userId: "user-single-1",
    fullName: "Program Reviewer",
    email: "reviewer@ybb.com",
    avatarUrl: undefined,
    accessLevel: 1,
    canManageAdmins: false,
    canAssignRoles: false,
    roleId: "role-reviewer",
    roleName: "Program Reviewer",
    assignedPrograms: [
      {
        programId: "iys-2026",
        programName: "Istanbul Youth Summit 2026",
        programYear: 2026,
        roleInProgram: "reviewer",
        permissions: ["view_applications", "score_applications"],
      },
    ],
  },
  none: null,
};

export function AuthProvider({ children }: { children: ReactNode }) {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [adminProfile, setAdminProfile] = useState<AdminProfile | null>(null);

  // Initialize authentication state
  useEffect(() => {
    // Simulate loading
    const timer = setTimeout(() => {
      const isAuth = localStorage.getItem("isAuthenticated") === "true";
      const savedAdminType = localStorage.getItem("mockAdminType") as keyof typeof MOCK_ADMINS;
      
      if (isAuth && savedAdminType) {
        const mockAdmin = MOCK_ADMINS[savedAdminType];
        if (mockAdmin) {
          setAdminProfile(mockAdmin);
          setIsAuthenticated(true);
        }
      }
      
      setIsLoading(false);
    }, 500);

    return () => clearTimeout(timer);
  }, []);

  // Determine access level
  const adminAccessLevel: AdminAccessLevel = (() => {
    if (!adminProfile) return "no_access";
    
    if (adminProfile.canManageAdmins || adminProfile.accessLevel >= 3) {
      return "super_admin";
    }
    
    if (adminProfile.assignedPrograms.length > 0) {
      return "program_admin";
    }
    
    return "no_access";
  })();

  const isPlatformAdmin = adminAccessLevel === "super_admin";
  const assignedPrograms = adminProfile?.assignedPrograms || [];

  const login = async (email: string, password: string) => {
    setIsLoading(true);
    // Simulate API call
    await new Promise(resolve => setTimeout(resolve, 1000));
    
    // Mock login - determine admin type based on email
    const mockAdmin = email.includes("super") 
      ? MOCK_ADMINS.super 
      : email.includes("coordinator")
      ? MOCK_ADMINS.multi
      : MOCK_ADMINS.single;
    
    setAdminProfile(mockAdmin);
    setIsAuthenticated(true);
    setIsLoading(false);
  };

  const logout = () => {
    setAdminProfile(null);
    setIsAuthenticated(false);
    localStorage.removeItem("mockAdminType");
    localStorage.removeItem("isAuthenticated");
  };

  const switchMockAdmin = (type: "super" | "multi" | "single" | "none") => {
    const mockAdmin = MOCK_ADMINS[type];
    setAdminProfile(mockAdmin);
    setIsAuthenticated(mockAdmin !== null);
    localStorage.setItem("mockAdminType", type);
    localStorage.setItem("isAuthenticated", mockAdmin !== null ? "true" : "false");
  };

  return (
    <AuthContext.Provider
      value={{
        isAuthenticated,
        isLoading,
        adminProfile,
        adminAccessLevel,
        isPlatformAdmin,
        assignedPrograms,
        login,
        logout,
        switchMockAdmin,
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
