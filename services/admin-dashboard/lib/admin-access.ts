import type { AdminProfile } from "@/app/contexts/AuthContext";
import type { NavItem, NavSection } from "@/lib/nav-config";

export type PermissionDefinition = {
  key: string;
  label: string;
  description: string;
};

export type PermissionCategoryDefinition = {
  id: string;
  name: string;
  permissions: PermissionDefinition[];
};

export const permissionCategories: PermissionCategoryDefinition[] = [
  {
    id: "platform",
    name: "Platform Access",
    permissions: [
      { key: "platform_access", label: "Platform access", description: "Access the platform-wide admin experience." },
      { key: "platform.manage", label: "Manage platform", description: "Manage platform-wide settings and data." },
      { key: "brand.manage", label: "Manage brand", description: "Manage brand-scoped configuration and content." },
      { key: "program:read", label: "View program", description: "Open program workspaces and dashboards." },
      { key: "program:write", label: "Manage program", description: "Edit program configuration and master data." },
    ],
  },
  {
    id: "admins",
    name: "Administrator Access",
    permissions: [
      { key: "admin.manage", label: "Manage admins", description: "Create, edit, reset, and deactivate administrators." },
      { key: "roles.manage", label: "Manage roles", description: "Create and edit admin roles and permission sets." },
    ],
  },
  {
    id: "applications",
    name: "Applications",
    permissions: [
      { key: "applications:read", label: "View submissions", description: "Read submissions, essays, and application records." },
      { key: "applications:write", label: "Manage submissions", description: "Review and update application-related records." },
      { key: "review:read", label: "View scoring", description: "Open scoring and interview review flows." },
      { key: "review:write", label: "Score applicants", description: "Submit or update reviews and scores." },
    ],
  },
  {
    id: "participants",
    name: "Participants",
    permissions: [
      { key: "participants:read", label: "View participants", description: "Access participant and ambassador records." },
      { key: "participants:write", label: "Manage participants", description: "Update participant and ambassador records." },
      { key: "support:read", label: "View support", description: "Read support tickets and participant issues." },
      { key: "support:write", label: "Manage support", description: "Respond to and manage support tickets." },
    ],
  },
  {
    id: "content",
    name: "Content",
    permissions: [
      { key: "content:read", label: "View content", description: "Open content-management screens for a program." },
      { key: "content:write", label: "Manage content", description: "Create and edit program content." },
      { key: "announcements:read", label: "View announcements", description: "Open the announcements module." },
      { key: "announcements:write", label: "Manage announcements", description: "Create and publish announcements." },
      { key: "media:read", label: "View media library", description: "Access uploaded media assets." },
      { key: "media:write", label: "Manage media library", description: "Upload and delete media assets." },
      { key: "documents:read", label: "View documents", description: "Access documents, templates, and guidelines." },
      { key: "documents:write", label: "Manage documents", description: "Edit document templates and uploaded files." },
      { key: "partnerships:read", label: "View partnerships", description: "Access partnership records and content." },
      { key: "partnerships:write", label: "Manage partnerships", description: "Manage partnership records." },
    ],
  },
  {
    id: "payments",
    name: "Payments",
    permissions: [
      { key: "payments:read", label: "View payments", description: "Access payment records and payment master data." },
      { key: "payments:write", label: "Manage payments", description: "Update payment-related configuration and records." },
    ],
  },
];

const menuPermissionRules: Record<string, string[]> = {
  dashboard: [],
  analytics: ["participants:read", "payments:read", "program:read"],
  payments: ["payments:read", "payments:write", "program:write"],
  scoring: ["review:read", "review:write", "applications:read", "applications:write"],
  "scoring-fully-funded": ["review:read", "review:write", "applications:read", "applications:write"],
  "scoring-interview": ["review:read", "review:write", "applications:read", "applications:write"],
  participants: ["participants:read", "participants:write", "applications:read", "program:write"],
  ambassadors: ["participants:read", "participants:write", "program:write"],
  "support-tickets": ["support:read", "support:write", "admin.manage"],
  "media-library": ["media:read", "media:write", "content:read", "content:write", "program:write"],
  submissions: ["applications:read", "applications:write", "review:read", "review:write", "program:write"],
  "submissions-essays": ["applications:read", "applications:write", "review:read", "review:write", "program:write"],
  "submissions-agreement-letters": ["applications:read", "applications:write", "program:write"],
  documents: ["documents:read", "documents:write", "content:read", "content:write", "program:write"],
  "documents-program-documents": ["documents:read", "documents:write", "content:read", "content:write", "program:write"],
  "documents-loa-template": ["documents:write", "content:write", "program:write"],
  "documents-certificates": ["documents:read", "documents:write", "content:read", "content:write", "program:write"],
  "documents-program-guidelines": ["documents:read", "documents:write", "content:read", "content:write", "program:write"],
  announcements: ["announcements:read", "announcements:write", "content:read", "content:write", "program:write"],
  // Reminders mail real participants about money owed, so it sits behind the
  // same write-level permissions as announcements plus payments.
  reminders: ["announcements:write", "payments:write", "participants:write", "program:write"],
  partnerships: ["partnerships:read", "partnerships:write", "content:read", "content:write", "program:write"],
  "master-data": ["program:write", "payments:write", "content:write"],
  "program-details": ["program:write"],
  "submission-form": ["program:write", "applications:write"],
  "program-payments": ["payments:read", "payments:write", "program:write"],
  "payment-methods": ["payments:read", "payments:write", "program:write"],
  timelines: ["program:write"],
  "program-testimonies": ["content:write", "program:write"],
  "video-testimonies": ["content:write", "program:write"],
  "program-photos": ["media:write", "content:write", "program:write"],
  "program-rundowns": ["program:write"],
  "program-speakers": ["content:write", "program:write"],
  "program-awards": ["content:write", "program:write"],
  "program-certificates": ["documents:write", "content:write", "program:write"],
  faqs: ["content:write", "program:write"],
  settings: ["program:write", "admin.manage", "roles.manage"],
  "main-configuration": ["program:write"],
  "admin-management": ["admin.manage"],
  "roles-permissions": ["roles.manage"],
  "menu-management": ["roles.manage", "admin.manage"],
};

export function getRequiredPermissionsForMenuItem(itemId: string): string[] {
  return menuPermissionRules[itemId] ?? [];
}

export function buildPermissionSet(profile: AdminProfile | null, programId?: string): Set<string> {
  if (!profile) {
    return new Set<string>();
  }

  const assignedProgramPermissions = programId
    ? [
        ...profile.assignedPrograms
          .filter((program) => program.programId === programId)
          .flatMap((program) => program.permissions),
        ...profile.accessiblePrograms
          .filter((program) => program.programId === programId)
          .flatMap((program) => program.permissions),
      ]
    : [];

  return new Set(
    [
      ...profile.permissions,
      ...profile.customPermissions,
      ...profile.assignedBrands.flatMap((brand) => brand.permissions),
      ...profile.assignedPrograms.flatMap((program) => program.permissions),
      ...assignedProgramPermissions,
    ].map((permission) => permission.toLowerCase()),
  );
}

export function hasRequiredPermissions(
  permissionSet: Set<string>,
  requiredPermissions: string[],
): boolean {
  if (requiredPermissions.length === 0) {
    return true;
  }

  if (
    permissionSet.has("*") ||
    permissionSet.has("platform.*") ||
    permissionSet.has("admin.*") ||
    permissionSet.has("platform.manage")
  ) {
    return true;
  }

  return requiredPermissions.some((permission) => permissionSet.has(permission.toLowerCase()));
}

export function filterProgramNavSectionsByPermissions(
  sections: NavSection[],
  permissionSet: Set<string>,
): NavSection[] {
  const filteredSections = sections
    .map((section) => {
      const items = section.items
        .map((item) => filterNavItemByPermissions(item, permissionSet))
        .filter((item): item is NavItem => Boolean(item));

      return {
        ...section,
        items,
      };
    })
    .filter((section) => section.items.length > 0);

  return filteredSections;
}

function filterNavItemByPermissions(item: NavItem, permissionSet: Set<string>): NavItem | null {
  const filteredChildren = item.children
    ?.map((child) => filterNavItemByPermissions(child, permissionSet))
    .filter((child): child is NavItem => Boolean(child));

  const canAccessSelf = hasRequiredPermissions(permissionSet, getRequiredPermissionsForMenuItem(item.id));
  const hasVisibleChildren = (filteredChildren?.length ?? 0) > 0;

  if (!canAccessSelf && !hasVisibleChildren) {
    return null;
  }

  return {
    ...item,
    ...(filteredChildren ? { children: filteredChildren } : {}),
  };
}

export type FlattenedMenuItem = {
  id: string;
  label: string;
  href: string;
  requiredPermissions: string[];
  depth: number;
};

export function flattenProgramNavSections(sections: NavSection[]): FlattenedMenuItem[] {
  return sections.flatMap((section) =>
    section.items.flatMap((item) => flattenNavItem(item, 0)),
  );
}

function flattenNavItem(item: NavItem, depth: number): FlattenedMenuItem[] {
  const current: FlattenedMenuItem = {
    id: item.id,
    label: item.label,
    href: item.href,
    requiredPermissions: getRequiredPermissionsForMenuItem(item.id),
    depth,
  };

  return [current, ...(item.children?.flatMap((child) => flattenNavItem(child, depth + 1)) ?? [])];
}
