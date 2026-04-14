# Admin Dashboard — Implementation Plan

**Last Updated:** 2026-04-14  
**Status:** In Progress

---

## Overview

This document tracks the step-by-step implementation plan to wire the admin dashboard UI (`services/admin-dashboard`) to the API service (`services/api`) and fill in any missing backend endpoints.

The admin dashboard is a Next.js app; the API is a NestJS monolith using Clean Architecture (CQRS pattern with Command/QueryBus, Repository via Prisma).

---

## Current State Audit

### ✅ Already Wired (Real Data)
| Page | Endpoint(s) Used |
|---|---|
| `/platform` (Dashboard) | `GET /brands`, `GET /programs` |
| `/platform/brands` | Full CRUD via `GET/POST/PUT/DELETE /brands` |
| `/platform/programs` | Full CRUD via `GET/POST/PUT/DELETE /programs` |
| `/platform/ambassadors` | `GET/PATCH/DELETE /admin/ambassadors` |
| `/programs/[id]/master-data/program-details` | `GET /programs/:id`, `PUT /programs/:id` |

### ❌ Placeholder Only (Priority Order)

#### Platform Admin
| Page | Needed Endpoint(s) | Status |
|---|---|---|
| `/platform/admins` | `GET/POST/PATCH/DELETE /admins` | Endpoint exists, UI not wired |
| `/platform/users` | `GET /users?brandId=...` | Endpoint exists, UI not wired |
| `/platform/settings` | `GET /brands/:id`, `PUT /brands/:id/details`, `PUT /brands/:id/settings` | Endpoints exist, UI not wired |
| `/platform/analytics` | `GET /admin/analytics` | **Endpoint missing** |

#### Program Admin
| Page | Needed Endpoint(s) | Status |
|---|---|---|
| `master-data/faqs` | `GET/POST/PUT/DELETE /programs/:id/faqs` | Endpoint exists, UI not wired |
| `master-data/program-speakers` | `GET/POST/PUT/DELETE /programs/:id/speakers` | Endpoint exists, UI not wired |
| `master-data/program-testimonies` | `GET/POST/PUT/DELETE /programs/:id/testimonials` | Endpoint exists, UI not wired |
| `master-data/timelines` | `GET/POST/PUT/DELETE /programs/:id/timeline` | Endpoint exists, UI not wired |
| `master-data/program-rundowns` | `GET/POST/PUT/DELETE /programs/:id/schedules` | Endpoint exists, UI not wired |
| `master-data/program-photos` | `GET/POST/PUT/DELETE /programs/:id/gallery` | Endpoint exists, UI not wired |
| `master-data/payment-methods` | `GET /admin/payments/methods` | Endpoint exists, UI not wired |
| `submissions` | `GET /applications?programId=X` | Endpoint exists, UI not wired |
| `participants` | `GET /applications?programId=X` | Endpoint exists, UI not wired |
| `announcements` | `GET/POST/PUT/DELETE /programs/:id/announcements` | **Endpoint missing** |

---

## Implementation Phases

---

### Phase 1: Missing API Endpoints (NestJS — `services/api`)

#### 1.1 Program Announcements CRUD

**File:** New controller extending `programs.module.ts`  
**Pattern:** Follow `program-content.controller.ts` pattern (inject handlers directly, not via bus).

```
New files:
  src/modules/programs/application/queries/list-program-announcements.query.ts
  src/modules/programs/application/queries/handlers/list-program-announcements.handler.ts
  src/modules/programs/application/commands/program-announcement.commands.ts
  src/modules/programs/application/commands/handlers/manage-program-announcements.handler.ts
  src/modules/programs/presentation/program-announcements.controller.ts
  src/modules/programs/presentation/dto/program-announcement.dto.ts
```

**Endpoints added:**
- `GET /programs/:id/announcements` — Public read, paginated, query: `?page&limit&type&priority`
- `POST /programs/:id/announcements` — JWT required
- `PUT /programs/announcements/:itemId` — JWT required
- `DELETE /programs/announcements/:itemId` — JWT required

**Prisma model used:** `ProgramAnnouncement` (already defined in `content.prisma`)

---

#### 1.2 Admin Analytics Endpoint

**File:** New controller/service in `stats` module (or new `admin` module)  
**Route:** `GET /admin/analytics`  
**Guards:** `JwtAuthGuard` + `RolesGuard` → `ADMIN/SUPER_ADMIN`

Response shape:
```json
{
  "programs": { "total": 24, "published": 18, "active": 6, "draft": 6 },
  "users": { "total": 2847, "active": 2541, "new_this_month": 127 },
  "applications": {
    "total": 4200,
    "by_status": { "submitted": 1200, "accepted": 890, "under_review": 310, ... }
  },
  "participants": { "total": 890 },
  "top_programs": [{ "id": "...", "name": "...", "applicants": 350 }]
}
```

**Implementation:** New query in `stats` module or dedicated `admin` analytics service. Aggregates data from `Program`, `User`, `ParticipantApplication`, `Participant` Prisma models.

---

### Phase 2: Admin Dashboard UI Wiring (`services/admin-dashboard`)

#### 2.1 Shared API Client

**New file:** `src/lib/api-client.ts`

A single typed API client module that:
- Reads `access_token` from `localStorage`
- Provides typed functions for every endpoint used across all dashboard pages
- Exports typed response shapes (interfaces)
- Handles error responses consistently

**Replaces:** The fragmented `app/platform/api.ts` (kept for backward compat, but deprecated).

---

#### 2.2 Platform Admins Page (`/platform/admins`)

Wire to existing `GET/POST/PATCH/DELETE /admins` endpoints. Features:
- Table listing all admins with name, email, role, brand, status
- Search/filter by name + role
- Create admin modal (POST)
- Edit admin modal (PATCH)
- Delete with confirmation (soft-delete via DELETE)
- Stats: total, super admins, program admins, active count

---

#### 2.3 Platform Users Page (`/platform/users`)

Wire to `GET /users?brandId={currentBrandId}&role=participant`.  
Features:
- Paginated user table with search
- User detail drawer/modal
- Status toggle (active/inactive)
- Security logs link

---

#### 2.4 Platform Settings Page (`/platform/settings`)

Wire to:
- `GET /brands/:id` → populate General, Branding, Contact tabs
- `PUT /brands/:id/details` → save General + Contact info
- `PUT /brands/:id/settings` → save Localization + Finance settings

Features:
- Multi-tab form (General, Localization, Legal, Finance)
- Optimistic locking — show save success/failure toast
- Brand logo/banner upload via `POST /brands/:id` (multipart)

---

#### 2.5 Platform Analytics Page (`/platform/analytics`)

Wire to new `GET /admin/analytics` endpoint.  
Features:
- 4 stat cards (Programs, Users, Applications, Revenue)
- Bar chart: Applications by status
- Top programs by applicant count table

---

#### 2.6 Program Master-Data Pages

All follow the same pattern: fetch on mount → render table → CRUD modals.

| Page | GET | POST | PUT | DELETE |
|---|---|---|---|---|
| FAQs | `/programs/:id/faqs` | same | `/programs/faqs/:itemId` | same |
| Speakers | `/programs/:id/speakers` | same | `/programs/speakers/:itemId` | same |
| Testimonials | `/programs/:id/testimonials` | same | `/programs/testimonials/:itemId` | same |
| Timelines | `/programs/:id/timeline` | same | `/programs/timeline/:itemId` | same |
| Rundowns | `/programs/:id/schedules` | same | `/programs/schedules/:itemId` | same |
| Photos | `/programs/:id/gallery` | same (multipart) | `/programs/gallery/:itemId` | same |

**Shared pattern for each page:**
1. Remove `MOCK_*` constants
2. Add `useEffect(() => fetchData(programId), [programId])`
3. Wire Create/Edit form submit to POST/PUT
4. Wire Delete button to DELETE with confirm dialog
5. Show loading/error states

---

#### 2.7 Program Submissions & Participants Pages

**Submissions:** `GET /applications?programId={id}&status=submitted&limit=20&offset=0`  
**Participants:** `GET /applications?programId={id}&status=accepted&limit=20&offset=0`

Features:
- Paginated table
- Search by name/email
- Status badge
- Link to individual participant detail
- Export CSV via `GET /applications/export?programId={id}`

---

#### 2.8 Program Announcements Page

Wire to new `GET/POST/PUT/DELETE /programs/:id/announcements` endpoints.  
Features:
- Table listing announcements (title, type, priority, created date, status)
- Create modal with fields: title, content, type, priority, expiresAt
- Edit + Delete actions

---

## Implementation Order

```
1. Phase 1.1 — Program Announcements CRUD (API)
2. Phase 1.2 — Admin Analytics (API)
3. Phase 2.1 — Shared API client (Dashboard)
4. Phase 2.2 — Platform Admins page wire-up (Dashboard)
5. Phase 2.3 — Platform Users page wire-up (Dashboard)
6. Phase 2.4 — Platform Settings page wire-up (Dashboard)
7. Phase 2.5 — Platform Analytics page wire-up (Dashboard)
8. Phase 2.6 — Program Master-Data pages (FAQs, Speakers, Testimonials, Timelines, Schedules, Photos) — Dashboard
9. Phase 2.7 — Program Submissions & Participants pages (Dashboard)
10. Phase 2.8 — Program Announcements page (Dashboard)
```

---

## Architecture Notes

- **API Base URL:** Read from `NEXT_PUBLIC_API_URL` env in dashboard; default `http://localhost:3000`
- **Auth:** JWT Bearer token stored in `localStorage` as `access_token`
- **Admin role check:** Backend enforces via `RolesGuard`; frontend should reflect current user roles from auth context (`useAuth()`)
- **Brand scoping:** Most admin endpoints are scoped to the current user's brand. The `brandId` is derived from `useAuth().user.brandId`
- **Error handling:** API errors return `{ statusCode, message, error }` — dashboard should handle 401 (redirect to login), 403 (show permission denied), 4xx (show toast with message)
- **File uploads:** Use `FormData`, set `Content-Type: multipart/form-data` (browser sets boundary automatically — do NOT set manually)

---

## Endpoint Reference (Quick Lookup)

### Existing — Available Now
```
# Platform Admin
GET    /admins                       → list admins (page, limit, search, roleId, brandId)
POST   /admins                       → create admin
PATCH  /admins/:id                   → update admin
DELETE /admins/:id                   → soft-delete admin

GET    /users                        → list users (brandId, role, skip, take)
GET    /users/:id                    → get user detail

GET    /brands                       → list all brands
GET    /brands/:id                   → get brand detail (full)
PUT    /brands/:id/details           → update brand general + contact
PUT    /brands/:id/settings          → update brand settings (localization, finance)

# Program Content (all CRUD)
GET    /programs/:id/faqs            → list FAQs
POST   /programs/:id/faqs            → create FAQ
PUT    /programs/faqs/:itemId        → update FAQ
DELETE /programs/faqs/:itemId        → delete FAQ

GET    /programs/:id/speakers        → list speakers
POST   /programs/:id/speakers        → create speaker (multipart: photo)
PUT    /programs/speakers/:itemId    → update speaker
DELETE /programs/speakers/:itemId   → delete speaker

GET    /programs/:id/testimonials    → list testimonials
POST   /programs/:id/testimonials    → create testimonial
PUT    /programs/testimonials/:id    → update testimonial
DELETE /programs/testimonials/:id   → delete testimonial

GET    /programs/:id/timeline        → list timeline items
POST   /programs/:id/timeline        → create timeline item
PUT    /programs/timeline/:itemId    → update timeline item
DELETE /programs/timeline/:itemId   → delete timeline item

GET    /programs/:id/schedules       → list schedule items
POST   /programs/:id/schedules       → create schedule item
PUT    /programs/schedules/:itemId   → update schedule item
DELETE /programs/schedules/:itemId  → delete schedule item

GET    /programs/:id/gallery         → list gallery photos
POST   /programs/:id/gallery         → add gallery photo (multipart: image)
PUT    /programs/gallery/:itemId     → update gallery item
DELETE /programs/gallery/:itemId    → delete gallery item

# Admin Payments
GET    /admin/payments/methods       → list payment methods
POST   /admin/payments/methods       → create payment method
PUT    /admin/payments/methods/:id   → update payment method
DELETE /admin/payments/methods/:id  → delete payment method

# Applications / Submissions
GET    /applications                 → list (programId, participantId, status, search, limit, offset)
GET    /applications/export          → export CSV
POST   /applications/:id/review      → review (accept/reject/interview)
```

### New — To Be Implemented
```
GET    /programs/:id/announcements         → list program announcements
POST   /programs/:id/announcements         → create announcement
PUT    /programs/announcements/:itemId     → update announcement
DELETE /programs/announcements/:itemId    → delete announcement

GET    /admin/analytics                    → platform analytics summary
```

---

## Files Modified / Created (Running Log)

| File | Change | Phase |
|---|---|---|
| `ybb-platform/docs/ADMIN_DASHBOARD_IMPLEMENTATION.md` | Created this doc | — |
| `services/api/src/modules/programs/presentation/program-announcements.controller.ts` | New | 1.1 |
| `services/api/src/modules/programs/presentation/dto/program-announcement.dto.ts` | New | 1.1 |
| `services/api/src/modules/programs/application/queries/list-program-announcements.query.ts` | New | 1.1 |
| `services/api/src/modules/programs/application/queries/handlers/list-program-announcements.handler.ts` | New | 1.1 |
| `services/api/src/modules/programs/application/commands/program-announcement.commands.ts` | New | 1.1 |
| `services/api/src/modules/programs/application/commands/handlers/manage-program-announcements.handler.ts` | New | 1.1 |
| `services/api/src/modules/programs/programs.module.ts` | Updated — register new controllers/handlers | 1.1 |
| `services/api/src/modules/stats/stats.controller.ts` | Updated — add admin analytics route | 1.2 |
| `services/api/src/modules/stats/stats.service.ts` | Updated — add getAdminAnalytics method | 1.2 |
| `services/admin-dashboard/src/lib/api-client.ts` | New | 2.1 |
| `services/admin-dashboard/app/platform/admins/page.tsx` | Updated — real data wiring | 2.2 |
| `services/admin-dashboard/app/platform/users/page.tsx` | Updated — real data wiring | 2.3 |
| `services/admin-dashboard/app/platform/settings/page.tsx` | Updated — real data wiring | 2.4 |
| `services/admin-dashboard/app/platform/analytics/page.tsx` | Updated — real data wiring | 2.5 |
| Program master-data page files (6x) | Updated — real data wiring | 2.6 |
| `submissions/page.tsx`, `participants/page.tsx` | Updated — real data wiring | 2.7 |
| `announcements/page.tsx` | Updated — real data wiring | 2.8 |
