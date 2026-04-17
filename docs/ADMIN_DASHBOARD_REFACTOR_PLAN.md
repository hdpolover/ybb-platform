# Admin Dashboard — UI/UX Refactor Plan

> **Date:** April 17, 2026
> **Scope:** `ybb-platform/services/admin-dashboard/`
> **Status:** Proposal

---

## 1. Executive Summary

The current admin dashboard is functional but suffers from **structural debt** that makes it hard to maintain, scale, and use effectively. This document identifies the core problems, proposes a unified approach, and defines phased implementation.

### The TL;DR

| Area | Current State | Target State |
|------|--------------|--------------|
| **Sidebar** | 700+ line monolith, if/else chains for routing & icons | Config-driven, declarative, < 200 lines |
| **Menu system** | Two separate sidebars (Platform vs Program) with no shared logic | Unified sidebar component, context-aware menu config |
| **Navigation** | Manual `router.push()` for every menu item (30+ if/else) | `href` on each item, auto-derived from config |
| **UI library** | Zero shared components, raw Tailwind everywhere | shadcn/ui component layer + consistent design tokens |
| **Data fetching** | Manual `fetch()` + `useEffect` in every page | Shared API client exists but no caching layer |
| **Tables** | Each page builds its own table from scratch | Shared `DataTable` component with sorting, pagination, filters |
| **Forms** | Each modal builds its own form | Shared form patterns with validation |
| **Layout** | Duplicated layout logic between Platform and Program | Single shared shell, context-aware |
| **Responsiveness** | Desktop-only, collapse toggle exists but mobile UX is poor | Responsive sidebar with proper mobile drawer |
| **Notifications** | Hard-coded fake notifications | Real notification system or remove |
| **Page structure** | Inconsistent page headers, spacing, card usage | Standardized page template |

---

## 2. Detailed Findings

### 2.1. Sidebar & Navigation — The Biggest Problem

**Current:** Two completely separate sidebar implementations:
1. **Platform sidebar** — Inline in `app/platform/layout.tsx` (~300 lines), uses a simple `MenuItem[]` array with `href` fields. Reasonable but not reusable.
2. **Program sidebar** — `app/components/layout/Sidebar.tsx` (~700 lines). This is where most of the debt lives:

**Problems in the Program Sidebar:**
- **Giant if/else for routing:** `handleClickItem()` has 30+ branches manually mapping `item.id` → `router.push(path)`. Every new menu item requires adding an `if` clause.
- **Giant if/else for active state:** `useState<string>(() => { ... })` has 25+ `pathname.includes()` checks to derive which menu is active.
- **Giant if/else for icons:** `SidebarIcon()` function uses chained `if/includes` statements to map labels → icons. Adding a new menu item means editing 3 separate places.
- **No `href` on menu items:** Menu items only have `id` and `label`. Routes are hard-coded in the click handler, not in the config. This means you can't derive the active state from the URL automatically.
- **Submenu model is flat:** Children use `parentId` references in a flat array rather than nested children. This makes rendering and state management awkward.
- **Program ID dependency:** Every route needs `selectedProgramId` injected. This should come from the URL param automatically.

**The Fix:**
```typescript
// Target: Declarative nav config with href, icon, and nested children
type NavItem = {
  id: string;
  label: string;
  href: string;        // Relative to context (e.g., "/payments")
  icon: LucideIcon;
  children?: NavItem[];
};

type NavSection = {
  title?: string;
  items: NavItem[];
};
```
- Active state derived from `pathname.startsWith(item.href)` — zero manual mapping.
- Routing via `<Link href={...}>` — zero `router.push()` if/else.
- Icons live on the config object — zero `SidebarIcon()` function.
- `programId` injected once at the layout level to prefix all hrefs.

### 2.2. Duplicated Layouts

**Current:** Two completely separate layout shells:
- `app/platform/layout.tsx` — Has its own sidebar, navbar, profile menu, notifications dropdown all inline (~300 lines).
- `app/programs/[programId]/layout.tsx` — Uses shared `Sidebar` + `Navbar` components but with its own auth logic.

**Problems:**
- Notification dropdown is copy-pasted with hard-coded fake data in the Platform layout.
- Profile menu is duplicated with slightly different styling.
- Auth guard logic is duplicated (both check `adminProfile` + redirect to `/login`).
- Sidebar collapse state is managed separately in each layout.

**The Fix:** Single `AdminShell` component that both layouts use:
```
<AdminShell
  navSections={platformNavSections}  // or programNavSections
  context="platform"                  // or "program"
>
  {children}
</AdminShell>
```

### 2.3. Missing Component Library

**Current:** The project has almost zero shared UI components:
- `app/components/ui/Button.tsx` — A single button component. That's it.
- Every page builds its own tables, modals, status badges, form inputs, page headers, error states, empty states, and loading spinners from raw Tailwind classes.

**Evidence of duplication:**
- Status badges are re-implemented in at least 5 pages (admins, submissions, payments, ambassadors, programs) with slightly different colors and sizes each time.
- Modal pattern (overlay + centered card + close button) is re-built in every page that needs one.
- Table structure (header + rows + pagination) is re-built in every list page.
- Search + filter bar pattern is re-built in every list page.
- Page header pattern (badge + title + description) is re-built in every page.

**The Fix:** Introduce a shared component layer. We should adopt **shadcn/ui** (already using Tailwind 4) for base primitives, then build domain-specific components on top:

| Component | Purpose |
|-----------|---------|
| `PageHeader` | Consistent page title + description + breadcrumb + action buttons |
| `DataTable` | Sortable, paginated table with column definitions |
| `FilterBar` | Search input + filter dropdowns + refresh button + count |
| `StatusBadge` | Semantic status pills with consistent color mapping |
| `FormModal` | Overlay modal with form, validation, loading, error handling |
| `ConfirmDialog` | Destructive action confirmation |
| `EmptyState` | Consistent empty data display |
| `StatCard` | Dashboard metric card (icon + value + label + trend) |
| `LoadingSkeleton` | Skeleton loader for content areas |

### 2.4. Data Fetching Patterns

**Current:** Every page does its own `useEffect` + `fetch` + loading/error state management. The shared API client (`src/shared/api-client.ts`) is well-structured with typed functions, but there's no caching or deduplication layer.

**Problems:**
- Every page manages `isLoading`, `error`, `data` states manually.
- No cache — navigating away and back re-fetches everything.
- No optimistic updates on mutations.
- Pagination logic is re-implemented per page.

**The Fix:** Introduce **TanStack Query (React Query)** or **SWR**:
- Automatic caching and background refetch.
- Shared loading/error state hooks.
- Pagination handled via `useInfiniteQuery` or keyed queries.
- Mutations with automatic cache invalidation.

### 2.5. Menu Organization — Information Architecture

The current Program sidebar has **too many top-level items** and the grouping doesn't match how admins actually work. Here's the proposed restructure based on the `ADMIN_DASHBOARD_PLAN.md` blueprint:

#### Current Program Sidebar (6 sections, 30+ items)
```
├── Main
│   └── Dashboard
├── Financial
│   └── Payments
├── Scoring
│   ├── Scoring
│   ├── Fully Funded
│   └── Interview
├── User Management
│   ├── Users
│   ├── Participants
│   └── Ambassadors
├── Program Content
│   ├── Submissions (+ Essays, Agreement Letters)
│   ├── Documents (+ Program Documents, Certificates)
│   └── Announcements
├── Configuration
│   ├── Master Data (+ 13 sub-items!)
│   └── Settings (+ 4 sub-items)
```

#### Proposed Program Sidebar (5 sections, organized by workflow)
```
├── Overview
│   └── Dashboard                    — Stats, timeline, quick actions
│
├── Applications                     — Everything about reviewing applicants
│   ├── Submissions                  — Inbox, review
│   ├── Scoring                      — Essay scoring, interview tracking
│   └── Documents                    — Uploaded docs, agreement letters
│
├── People                           — Managing accepted participants
│   ├── Participants                 — Full participant database
│   └── Ambassadors                  — Referral management
│
├── Program                          — Content & communication
│   ├── Announcements                — Broadcasts
│   ├── Payments                     — Transactions, verification
│   └── Website Content              — Grouped master data:
│       ├── Details & Schedule
│       ├── Speakers & Partners
│       ├── Gallery & Testimonials
│       ├── FAQs
│       └── Awards & Certificates
│
├── Settings
│   ├── Configuration                — Dates, registration, pricing
│   ├── Submission Form              — Form builder
│   ├── Payment Methods              — Gateway config
│   └── Admin Management             — Program-level admin access
```

**Key changes:**
- **"Master Data" is gone.** It was a catch-all that forced admins to dig through 13 sub-items. Items are now grouped by purpose.
- **"Website Content"** groups all the landing page data (speakers, gallery, testimonials, FAQs, etc.) under one collapsible section — because admins typically edit these together.
- **"Scoring" is under "Applications"** — because scoring is part of the review workflow, not a separate concern.
- **"Users" is removed from the program sidebar.** Program-scoped user listing is just "Participants". Global user management stays in Platform admin only.
- **"Configuration"** separates operational settings from content management.

#### Proposed Platform Sidebar (simplified)
```
├── Dashboard                        — Revenue, programs, users overview
├── Programs                         — All programs list + create
├── Brands                           — Brand/org management
├── Users                            — Global user directory
├── Ambassadors                      — Cross-program ambassador management
├── Admins                           — Team + role management
├── Analytics                        — Cross-program reports
├── Settings                         — Organization, branding, legal, finance
```
This is already close to what exists — just needs the shared layout treatment.

### 2.6. Page Layout Consistency

**Current:** Each page has its own ad-hoc layout structure. Some use cards with rounded borders, some don't. Some have page header badges, some don't. Spacing varies.

**The Fix — Standard Page Template:**
```
┌─ Shell ──────────────────────────────────────────────┐
│ ┌─ Sidebar ─┐ ┌─ Content Area ─────────────────────┐ │
│ │            │ │ ┌─ Breadcrumb ───────────────────┐ │ │
│ │            │ │ └────────────────────────────────┘ │ │
│ │            │ │ ┌─ PageHeader ───────────────────┐ │ │
│ │            │ │ │ Title + Description + Actions   │ │ │
│ │            │ │ └────────────────────────────────┘ │ │
│ │            │ │ ┌─ Page Content ─────────────────┐ │ │
│ │            │ │ │ Stats row (optional)            │ │ │
│ │            │ │ │ Filter bar (for lists)          │ │ │
│ │            │ │ │ Data table / Form / Cards       │ │ │
│ │            │ │ │ Pagination (for lists)          │ │ │
│ │            │ │ └────────────────────────────────┘ │ │
│ └────────────┘ └────────────────────────────────────┘ │
└──────────────────────────────────────────────────────┘
```

Every page should follow this template. The content area uses `max-w-7xl` with consistent padding (`px-6 py-6`). List pages get the filter bar + data table pattern. Detail/edit pages get the form card pattern.

### 2.7. Additional UI/UX Issues

| Issue | Detail |
|-------|--------|
| **No breadcrumbs** | Deep pages (e.g., Program > Master Data > FAQs > Edit) have no way to navigate back except the browser button. |
| **No global search** | Platform layout has no search. Program layout requires selecting a program first before anything works. |
| **Notification dropdown has fake data** | The Platform layout has hard-coded notification items that never change. Either wire to real data or remove. |
| **Comments in Indonesian** | Many code comments are in Indonesian (e.g., "Kalau belum ke-auth", "Menu yang gk ada submenu"). Should be English for maintainability. |
| **No dark mode** | Not critical, but admin dashboards benefit from dark mode for long work sessions. |
| **Tailwind v4 but no design tokens** | Using Tailwind 4 but no custom theme tokens in CSS. Colors are hard-coded (`blue-800`, `zinc-200`, etc.) instead of semantic (`sidebar-bg`, `border-default`). |
| **No keyboard shortcuts** | No `Cmd+K` search, no keyboard nav for sidebar. |
| **Loading states** | Only a centered spinner. No skeleton loaders for progressive loading. |
| **Error handling** | Errors show as inline red text. No toast/notification system for action results. |
| **Footer credits** | Sidebar footer says "Made by Hilmi Farrel Firjatullah :D" — should be brand/version info. |

---

## 3. Proposed Architecture

### 3.1. New Dependencies

```json
{
  "@tanstack/react-query": "^5",    // Data fetching + caching
  "class-variance-authority": "^0.7", // Component variants
  "clsx": "^2",                       // Class merging
  "tailwind-merge": "^2",            // Tailwind class dedup
  "lucide-react": "^0.400",          // Consistent icon set (replace @heroicons)
  "sonner": "^1",                    // Toast notifications
  "react-hook-form": "^7",           // Form management
  "zod": "^3"                        // Schema validation
}
```

**Why replace @heroicons with lucide-react?**
- The participant dashboard (`ybb-program-next`) already uses lucide-react. Consistency across projects.
- Lucide has better tree-shaking and a larger icon set.

### 3.2. Directory Structure (Target)

```
app/
├── (auth)/
│   └── login/page.tsx
├── (admin)/                           # Shared admin shell
│   ├── layout.tsx                     # AdminShell: sidebar + navbar + providers
│   ├── page.tsx                       # Landing / program selector
│   ├── platform/                      # Platform admin pages
│   │   ├── page.tsx                   # Dashboard
│   │   ├── programs/
│   │   ├── brands/
│   │   ├── users/
│   │   ├── ambassadors/
│   │   ├── admins/
│   │   ├── analytics/
│   │   └── settings/
│   └── programs/
│       └── [programId]/               # Program admin pages
│           ├── page.tsx               # Program dashboard
│           ├── submissions/
│           ├── scoring/
│           ├── documents/
│           ├── participants/
│           ├── ambassadors/
│           ├── announcements/
│           ├── payments/
│           ├── website/               # Grouped master data
│           │   ├── details/
│           │   ├── speakers/
│           │   ├── gallery/
│           │   ├── testimonials/
│           │   ├── faqs/
│           │   ├── awards/
│           │   └── certificates/
│           └── settings/
│               ├── configuration/
│               ├── submission-form/
│               ├── payment-methods/
│               └── admin-management/
├── api/                               # Next.js API routes (proxy if needed)
├── components/
│   ├── ui/                            # shadcn/ui base primitives
│   │   ├── button.tsx
│   │   ├── input.tsx
│   │   ├── select.tsx
│   │   ├── dialog.tsx
│   │   ├── dropdown-menu.tsx
│   │   ├── table.tsx
│   │   ├── badge.tsx
│   │   ├── card.tsx
│   │   ├── skeleton.tsx
│   │   ├── toast.tsx (sonner)
│   │   └── ...
│   ├── admin/                         # Admin-specific shared components
│   │   ├── admin-shell.tsx            # Sidebar + Navbar + Content shell
│   │   ├── sidebar.tsx                # Config-driven sidebar
│   │   ├── navbar.tsx                 # Top bar with search, notifications, profile
│   │   ├── page-header.tsx            # Title + description + actions
│   │   ├── data-table.tsx             # Generic sortable/paginated table
│   │   ├── filter-bar.tsx             # Search + filters + count
│   │   ├── stat-card.tsx              # Metric display card
│   │   ├── status-badge.tsx           # Semantic status pills
│   │   ├── empty-state.tsx            # No-data display
│   │   ├── confirm-dialog.tsx         # Destructive action confirmation
│   │   └── form-modal.tsx             # CRUD modal pattern
│   └── domain/                        # Domain-specific components
│       ├── programs/
│       ├── submissions/
│       ├── payments/
│       └── ...
├── hooks/                             # Shared React hooks
│   ├── use-admin-nav.ts               # Navigation config based on context
│   ├── use-debounce.ts
│   └── use-media-query.ts
├── lib/
│   ├── api-client.ts                  # Typed API functions (existing, enhanced)
│   ├── query-client.ts                # TanStack Query client config
│   ├── utils.ts                       # cn() helper, formatters
│   └── nav-config.ts                  # Centralized navigation definitions
└── providers/
    ├── auth-provider.tsx              # Auth context (existing, cleaned up)
    ├── query-provider.tsx             # TanStack Query provider
    └── toast-provider.tsx             # Sonner toast provider
```

### 3.3. Nav Config System

```typescript
// lib/nav-config.ts
import {
  LayoutDashboard, FileText, Users, Megaphone,
  CreditCard, Settings, Globe, Award, ImageIcon,
  MessageSquare, UserCheck, BarChart3, Building2,
  ClipboardCheck, Folder
} from "lucide-react";

export const platformNav: NavSection[] = [
  {
    items: [
      { id: "dashboard", label: "Dashboard", href: "/platform", icon: LayoutDashboard },
      { id: "programs", label: "Programs", href: "/platform/programs", icon: Folder },
      { id: "brands", label: "Brands", href: "/platform/brands", icon: Building2 },
    ],
  },
  {
    title: "People",
    items: [
      { id: "users", label: "Users", href: "/platform/users", icon: Users },
      { id: "ambassadors", label: "Ambassadors", href: "/platform/ambassadors", icon: UserCheck },
      { id: "admins", label: "Admins", href: "/platform/admins", icon: Users },
    ],
  },
  {
    title: "Insights",
    items: [
      { id: "analytics", label: "Analytics", href: "/platform/analytics", icon: BarChart3 },
    ],
  },
  {
    title: "System",
    items: [
      { id: "settings", label: "Settings", href: "/platform/settings", icon: Settings },
    ],
  },
];

export function getProgramNav(programId: string): NavSection[] {
  const base = `/programs/${programId}`;
  return [
    {
      items: [
        { id: "dashboard", label: "Overview", href: base, icon: LayoutDashboard },
      ],
    },
    {
      title: "Applications",
      items: [
        { id: "submissions", label: "Submissions", href: `${base}/submissions`, icon: FileText },
        { id: "scoring", label: "Scoring", href: `${base}/scoring`, icon: ClipboardCheck },
        { id: "documents", label: "Documents", href: `${base}/documents`, icon: Folder },
      ],
    },
    {
      title: "People",
      items: [
        { id: "participants", label: "Participants", href: `${base}/participants`, icon: Users },
        { id: "ambassadors", label: "Ambassadors", href: `${base}/ambassadors`, icon: UserCheck },
      ],
    },
    {
      title: "Program",
      items: [
        { id: "announcements", label: "Announcements", href: `${base}/announcements`, icon: Megaphone },
        { id: "payments", label: "Payments", href: `${base}/payments`, icon: CreditCard },
        {
          id: "website", label: "Website Content", href: `${base}/website`, icon: Globe,
          children: [
            { id: "details", label: "Details & Schedule", href: `${base}/website/details`, icon: FileText },
            { id: "speakers", label: "Speakers", href: `${base}/website/speakers`, icon: Users },
            { id: "gallery", label: "Gallery", href: `${base}/website/gallery`, icon: ImageIcon },
            { id: "testimonials", label: "Testimonials", href: `${base}/website/testimonials`, icon: MessageSquare },
            { id: "faqs", label: "FAQs", href: `${base}/website/faqs`, icon: MessageSquare },
            { id: "awards", label: "Awards & Certs", href: `${base}/website/awards`, icon: Award },
          ],
        },
      ],
    },
    {
      title: "Settings",
      items: [
        { id: "configuration", label: "Configuration", href: `${base}/settings`, icon: Settings },
        { id: "submission-form", label: "Submission Form", href: `${base}/settings/submission-form`, icon: FileText },
        { id: "payment-methods", label: "Payment Methods", href: `${base}/settings/payment-methods`, icon: CreditCard },
      ],
    },
  ];
}
```

---

## 4. Implementation Phases

### Phase 1: Foundation (Week 1-2)
**Goal:** New component system, shared layout, nav config. No page rewrites yet.

- [ ] Install new dependencies (TanStack Query, lucide-react, sonner, react-hook-form, zod, cva, clsx, tailwind-merge).
- [ ] Set up `cn()` utility (`lib/utils.ts`).
- [ ] Set up Tailwind CSS theme tokens (semantic color variables in `globals.css`).
- [ ] Build base UI components: `Button`, `Input`, `Select`, `Badge`, `Card`, `Skeleton`, `Dialog`, `DropdownMenu`, `Table`.
- [ ] Build admin shared components: `AdminShell`, `Sidebar`, `Navbar`, `PageHeader`, `DataTable`, `FilterBar`, `StatCard`, `StatusBadge`, `EmptyState`, `ConfirmDialog`.
- [ ] Create `lib/nav-config.ts` with Platform and Program nav definitions.
- [ ] Set up `QueryProvider` and `ToastProvider`.
- [ ] Create the unified `(admin)/layout.tsx` that uses `AdminShell`.
- [ ] Migrate `AuthContext` to `providers/auth-provider.tsx` (clean up, English comments).

### Phase 2: Platform Pages (Week 2-3)
**Goal:** Migrate all Platform admin pages to new component system.

- [ ] Platform Dashboard — Use `StatCard`, `PageHeader`.
- [ ] Programs list — Use `DataTable`, `FilterBar`, `FormModal`.
- [ ] Brands list — Use `DataTable`, `FilterBar`.
- [ ] Users list — Use `DataTable`, `FilterBar`.
- [ ] Ambassadors list — Use `DataTable`, `StatusBadge`.
- [ ] Admins list — Use `DataTable`, `FormModal`.
- [ ] Analytics — Use `StatCard` + recharts (already installed).
- [ ] Settings — Form-based page with sections.
- [ ] Convert all data fetching to TanStack Query hooks.

### Phase 3: Program Pages (Week 3-4)
**Goal:** Migrate all Program admin pages to new component system.

- [ ] Program Dashboard — Use `StatCard`, timeline component.
- [ ] Submissions — Use `DataTable` with status filters, review modal.
- [ ] Scoring — Specialized scoring UI (keep custom but use shared primitives).
- [ ] Documents — Use `DataTable` with upload actions.
- [ ] Participants — Use `DataTable` with search/filter.
- [ ] Ambassadors — Use `DataTable` with activation toggles.
- [ ] Announcements — Use `DataTable` + `FormModal`.
- [ ] Payments — Use `DataTable` with status badges, verification actions.
- [ ] Website Content pages (grouped master data) — Use `DataTable` + `FormModal` for each.
- [ ] Settings pages — Form-based with section tabs.

### Phase 4: Polish (Week 4-5)
**Goal:** UX improvements, responsiveness, quality.

- [ ] Add breadcrumb navigation to all pages.
- [ ] Add `Cmd+K` command palette for quick navigation.
- [ ] Add proper mobile responsive sidebar (drawer on mobile).
- [ ] Add skeleton loaders for all list pages.
- [ ] Add toast notifications for all CRUD operations.
- [ ] Wire real notification data (or remove the dropdown).
- [ ] Add keyboard navigation support in sidebar.
- [ ] Convert all Indonesian comments to English.
- [ ] Remove "Made by" footer, replace with version info.
- [ ] Error boundaries for each route segment.
- [ ] 404 page for invalid routes.

---

## 5. Design Tokens

Define semantic CSS variables so the admin dashboard has a consistent, maintainable visual language:

```css
/* globals.css */
@theme {
  /* Sidebar */
  --color-sidebar-bg: var(--color-blue-800);
  --color-sidebar-text: var(--color-blue-100);
  --color-sidebar-active: var(--color-blue-500);
  --color-sidebar-hover: color-mix(in srgb, var(--color-blue-500) 60%, transparent);
  --color-sidebar-border: var(--color-blue-500);

  /* Content */
  --color-content-bg: var(--color-white);
  --color-content-text: var(--color-zinc-900);
  --color-content-muted: var(--color-zinc-500);
  --color-content-border: var(--color-zinc-200);

  /* Status colors */
  --color-status-success: var(--color-emerald-600);
  --color-status-warning: var(--color-amber-600);
  --color-status-error: var(--color-red-600);
  --color-status-info: var(--color-blue-600);
  --color-status-pending: var(--color-sky-600);

  /* Sizes */
  --sidebar-width: 256px;
  --sidebar-collapsed-width: 64px;
  --navbar-height: 64px;
  --content-max-width: 1280px;
}
```

---

## 6. Risk & Trade-offs

| Risk | Mitigation |
|------|-----------|
| **Big-bang rewrite** | Phase 1 lays the foundation without breaking existing pages. New components coexist with old ones during migration. |
| **Scope creep** | Each phase has a clear, shippable deliverable. Phase 1 is the only hard dependency. |
| **Learning curve** | TanStack Query and shadcn/ui are industry standards with excellent docs. |
| **Performance** | TanStack Query reduces network calls via caching. shadcn/ui is zero-runtime. Lucide icons tree-shake better than heroicons. |
| **Backend changes** | This plan is frontend-only. No backend changes required. Missing APIs (announcements CRUD, analytics) can be stubbed. |

---

## 7. Success Metrics

After completing all phases:

- **Developer velocity:** Adding a new CRUD page should take < 1 hour (config + page file, everything else is shared).
- **Sidebar:** < 200 lines total (currently 700+).
- **Code duplication:** Zero copy-pasted table/modal/badge/form implementations.
- **Page consistency:** Every page follows the same layout template.
- **Navigation:** Adding a new menu item = 1 line in `nav-config.ts`.
- **Bundle size:** Smaller (lucide tree-shakes, shadcn is zero-runtime, TanStack Query replaces per-page state management code).
