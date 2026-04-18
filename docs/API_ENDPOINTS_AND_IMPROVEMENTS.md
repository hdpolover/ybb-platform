# API Endpoint Reference & Improvement Plan

> Generated: April 18, 2026 | Source: Live Swagger at `localhost:4000/docs/v1`

---

## Table of Contents

1. [Endpoint Inventory](#1-endpoint-inventory)
2. [Critical Issues](#2-critical-issues)
3. [Improvement Recommendations](#3-improvement-recommendations)

---

## 1. Endpoint Inventory

**Total: 126 operations across 121 paths** (from Swagger)

> 🌐 = Public (no auth) | 🔒 = Requires JWT

---

### Auth (10 endpoints)

| | Method | Path | Summary |
|-|--------|------|---------|
| 🌐 | POST | `/auth/login` | Login User |
| 🌐 | POST | `/auth/register` | Register User |
| 🌐 | POST | `/auth/firebase-login` | Login/Register with Firebase Token (Google, Apple, etc.) |
| 🌐 | POST | `/auth/forgot-password` | Request Password Reset |
| 🌐 | POST | `/auth/reset-password` | Reset Password |
| 🌐 | POST | `/auth/verify-email` | Verify Email |
| 🌐 | POST | `/auth/resend-verification` | Resend Verification Email |
| 🌐 | GET | `/auth/providers` | Get Authentication Providers |
| 🔒 | GET | `/auth/me` | Get Current User Profile |
| 🔒 | POST | `/auth/logout` | Logout User |

---

### Programs (6 endpoints)

| | Method | Path | Summary |
|-|--------|------|---------|
| 🌐 | GET | `/programs` | Get all programs |
| 🌐 | GET | `/programs/{identifier}` | Get program detail by ID or slug |
| 🌐 | GET | `/programs/{id}/landing` | Get aggregated landing page content |
| 🌐 | GET | `/programs/{programId}/participation-info` | List participation infos |
| 🌐 | GET | `/programs/{programId}/participation-info/{category}` | Get participation info by category |
| 🔒 | GET | `/programs/{id}/participant/progress` | Get participant progress tracking |

### Program Application Config (5 endpoints)

| | Method | Path | Summary |
|-|--------|------|---------|
| 🌐 | GET | `/programs/{id}/pricing-tiers` | Get program pricing tiers |
| 🌐 | GET | `/programs/{id}/requirements` | Get program requirements |
| 🌐 | GET | `/programs/{id}/essays` | Get program essays |
| 🌐 | GET | `/programs/{id}/participation-categories` | Get participation categories |
| 🌐 | GET | `/programs/{id}/form-fields` | Get application form fields |

### Program Content (4 endpoints)

| | Method | Path | Summary |
|-|--------|------|---------|
| 🌐 | GET | `/programs/{id}/faqs` | Get program FAQs |
| 🌐 | GET | `/programs/{id}/gallery` | Get program gallery |
| 🌐 | GET | `/programs/{id}/testimonials` | Get program testimonials |
| 🌐 | GET | `/programs/{id}/resources` | Get program resources |

### Program People (3 endpoints)

| | Method | Path | Summary |
|-|--------|------|---------|
| 🌐 | GET | `/programs/{id}/speakers` | Get program speakers |
| 🌐 | GET | `/programs/{id}/team` | Get program team |
| 🌐 | GET | `/programs/{id}/partners` | Get program partners |

### Program Schedule (2 endpoints)

| | Method | Path | Summary |
|-|--------|------|---------|
| 🌐 | GET | `/programs/{id}/timeline` | Get program timeline |
| 🌐 | GET | `/programs/{id}/schedules` | Get program schedules |

### Program Announcements (1 endpoint)

| | Method | Path | Summary |
|-|--------|------|---------|
| 🌐 | GET | `/programs/{id}/announcements` | List program announcements |

### Program Exchange Rate (2 endpoints)

| | Method | Path | Summary |
|-|--------|------|---------|
| 🌐 | GET | `/programs/{programId}/exchange-rate` | Get current exchange rate |
| 🔒 | GET | `/programs/{programId}/exchange-rate/history` | Get exchange rate change history |

---

### Applications (6 endpoints)

| | Method | Path | Summary |
|-|--------|------|---------|
| 🔒 | POST | `/applications` | Create a new application |
| 🔒 | GET | `/applications/{id}` | Get application by ID |
| 🔒 | POST | `/applications/{id}/submit` | Submit application |
| 🔒 | POST | `/applications/{id}/withdraw` | Withdraw application |
| 🔒 | POST | `/applications/{id}/switch-category` | Switch application category |
| 🔒 | POST | `/applications/{id}/payment-intent` | Create registration payment intent |

---

### Participants (6 endpoints)

| | Method | Path | Summary |
|-|--------|------|---------|
| 🔒 | GET | `/participants/me` | Get current user participant profile |
| 🔒 | PUT | `/participants/me` | Update participant profile |
| 🔒 | POST | `/participants/onboarding` | Complete participant onboarding |
| 🔒 | GET | `/participants/dashboard` | Get participant dashboard summary |
| 🔒 | POST | `/participants/ambassador/apply` | Apply to become an ambassador |
| 🔒 | GET | `/participants/ambassador/dashboard` | Get ambassador dashboard stats |

---

### Portal (9 endpoints)

| | Method | Path | Summary |
|-|--------|------|---------|
| 🔒 | GET | `/portal/dashboard` | Get participant dashboard summary |
| 🔒 | GET | `/portal/submissions` | Get application submission progress |
| 🔒 | GET | `/portal/submissions/detail` | Get full submission form data with saved values |
| 🔒 | PUT | `/portal/submissions/sections/{section}` | Save/update submission section |
| 🔒 | POST | `/portal/submissions/submit` | Submit the application (final) |
| 🔒 | GET | `/portal/payments` | Get payment history and outstanding items |
| 🔒 | GET | `/portal/documents` | Get program resources and my documents |
| 🔒 | GET | `/portal/certificates` | List all certificates and documents |
| 🔒 | GET | `/portal/certificates/{id}/download` | Get download URL for certificate |

---

### Payments (9 endpoints)

| | Method | Path | Summary |
|-|--------|------|---------|
| 🔒 | POST | `/payments/intents` | Create payment intent |
| 🔒 | POST | `/payments/intents/{id}/confirm` | Confirm payment (charge) |
| 🔒 | GET | `/payments` | List my payments |
| 🔒 | GET | `/payments/methods` | Get available payment methods |
| 🔒 | GET | `/payments/{id}` | Get payment detail |
| 🔒 | POST | `/infra/payments/intents` | Create Payment Intent (Direct) |
| 🔒 | POST | `/infra/payments/manual` | Submit Manual Payment Proof |
| 🔒 | GET | `/infra/payments/methods` | Get Payment Methods |
| 🔒 | GET | `/infra/payments/by-reference/{type}/{id}` | Get Intents by Reference |

---

### Brands (4 endpoints)

| | Method | Path | Summary |
|-|--------|------|---------|
| 🌐 | GET | `/brands` | List all brands |
| 🌐 | GET | `/brands/{id}` | Get brand detail |
| 🌐 | GET | `/brands/{id}/programs` | List brand programs |
| 🌐 | GET | `/brands/{id}/sponsors` | List brand sponsors |

---

### Users (10 endpoints)

| | Method | Path | Summary |
|-|--------|------|---------|
| 🔒 | GET | `/users/me/preferences` | Get current user preferences |
| 🔒 | POST | `/users/me/preferences` | Update current user preferences |
| 🔒 | GET | `/users/me/notifications` | Get current user notifications |
| 🔒 | POST | `/users/me/notifications/{id}/read` | Mark notification as read |
| 🔒 | GET | `/users/me/activity-logs` | Get current user activity logs |
| 🔒 | GET | `/users/me/security-logs` | Get current user security logs |
| 🔒 | POST | `/users/me/deletion-request` | Request account deletion |
| 🔒 | POST | `/users` | Create new user (Admin) |
| 🔒 | GET | `/users` | Get all users (Admin) |
| 🔒 | GET | `/users/{id}` | Get user by ID (Admin) |

---

### Landing (8 endpoints)

| | Method | Path | Summary |
|-|--------|------|---------|
| 🌐 | GET | `/landing/settings` | Get global settings |
| 🌐 | GET | `/landing/home` | Get home page content |
| 🌐 | GET | `/landing/about` | Get about page content |
| 🌐 | GET | `/landing/programs` | Get programs listing page |
| 🌐 | GET | `/landing/programs/{slug}` | Get specific program details |
| 🌐 | GET | `/landing/partners-sponsors` | Get partners and sponsors |
| 🌐 | GET | `/landing/announcements` | Get announcements page |
| 🌐 | GET | `/landing/faqs` | Get FAQs page |

---

### Documents (7 endpoints)

| | Method | Path | Summary |
|-|--------|------|---------|
| 🔒 | POST | `/documents/export/participants` | Export participant report to Excel |
| 🔒 | POST | `/documents/export/payments` | Export payment report to Excel |
| 🔒 | POST | `/documents/export/custom` | Export custom report to Excel |
| 🔒 | POST | `/documents/generate/certificate` | Generate certificate PDF |
| 🔒 | POST | `/documents/generate/offer-letter` | Generate offer letter PDF |
| 🔒 | POST | `/documents/generate/receipt` | Generate payment receipt PDF |
| 🔒 | GET | `/documents/verify/{hash}` | Verify certificate authenticity |

---

### Metadata (11 endpoints)

| | Method | Path | Summary |
|-|--------|------|---------|
| 🌐 | GET | `/metadata/countries` | Get list of countries |
| 🌐 | GET | `/metadata/states/{countryCode}` | Get states by country |
| 🌐 | GET | `/metadata/cities/{countryCode}` | Get cities by country |
| 🌐 | GET | `/metadata/timezones` | Get timezones |
| 🌐 | GET | `/metadata/currencies` | Get currencies |
| 🌐 | GET | `/metadata/genders` | Get genders |
| 🌐 | GET | `/metadata/application-categories` | Get application categories |
| 🌐 | GET | `/metadata/dietary-restrictions` | Get dietary restrictions |
| 🌐 | GET | `/metadata/knowledge-sources` | Get knowledge sources |
| 🌐 | GET | `/metadata/shirt-sizes` | Get shirt sizes |
| 🌐 | GET | `/metadata/enums` | Get all system enums |

---

### Support (4 endpoints)

| | Method | Path | Summary |
|-|--------|------|---------|
| 🔒 | POST | `/support/tickets` | Create a support ticket |
| 🔒 | GET | `/support/tickets` | List my support tickets |
| 🔒 | GET | `/support/tickets/{id}` | Get ticket detail |
| 🔒 | POST | `/support/tickets/{id}/messages` | Reply to a ticket |

---

### System Announcements (3 endpoints)

| | Method | Path | Summary |
|-|--------|------|---------|
| 🌐 | GET | `/system/announcements` | List public announcements |
| 🌐 | GET | `/system/announcements/{id}` | Get announcement detail |
| 🔒 | POST | `/system/announcements/{id}/read` | Mark as read |

---

### Achievements (2 endpoints)

| | Method | Path | Summary |
|-|--------|------|---------|
| 🔒 | GET | `/achievements/applications/{applicationId}/documents` | List generated documents |
| 🔒 | GET | `/achievements/applications/{applicationId}/awards` | List awards |

---

### Files (4 endpoints)

| | Method | Path | Summary |
|-|--------|------|---------|
| 🔒 | POST | `/files/upload` | Upload file to storage |
| 🔒 | POST | `/files/presigned-upload-url` | Get presigned URL for direct upload |
| 🔒 | GET | `/files/{fileId}` | Get file information and download URL |
| 🌐 | POST | `/files/events/minio` | MinIO Webhook Handler |

---

### Gallery (2 endpoints)

| | Method | Path | Summary |
|-|--------|------|---------|
| 🔒 | POST | `/gallery` | Upload gallery item |
| 🌐 | GET | `/gallery` | Get gallery items |

---

### Legal (2 endpoints)

| | Method | Path | Summary |
|-|--------|------|---------|
| 🌐 | GET | `/brands/{brandSlug}/legal-documents` | List legal documents |
| 🌐 | GET | `/brands/{brandSlug}/legal-documents/{typeSlug}` | Get legal document by slug |

---

### Newsletter (2 endpoints)

| | Method | Path | Summary |
|-|--------|------|---------|
| 🌐 | POST | `/newsletter/subscribe` | Subscribe |
| 🌐 | POST | `/newsletter/unsubscribe` | Unsubscribe |

---

### Partnerships (2 endpoints)

| | Method | Path | Summary |
|-|--------|------|---------|
| 🌐 | GET | `/public/brands/{brandSlug}/partnerships` | Get partnership opportunities |
| 🌐 | POST | `/public/brands/{brandSlug}/partnerships/enquiry` | Submit partnership enquiry |

---

### AI Bot (1 endpoint)

| | Method | Path | Summary |
|-|--------|------|---------|
| 🌐 | GET | `/ai-bot/active` | Get active bot config for frontend |

---

### Webhooks (1 endpoint)

| | Method | Path | Summary |
|-|--------|------|---------|
| 🌐 | POST | `/webhooks/payment/{gateway}` | Handle payment gateway webhooks |

---

## Endpoints in Code but NOT in Swagger (~70+ missing)

These endpoints exist in controllers but are **excluded from Swagger** (likely excluded via `@ApiExcludeEndpoint()` or missing `@ApiTags()`):

### Admin Management
- `POST /admins` — Create admin
- `GET /admins` — List admins
- `GET /admins/:id` — Get admin detail
- `PATCH /admins/:id` — Update admin
- `DELETE /admins/:id` — Delete admin

### Ambassador Admin
- `GET /admin/ambassadors` — List ambassadors
- `PATCH /admin/ambassadors/:id/activate` — Activate ambassador
- `PATCH /admin/ambassadors/:id/deactivate` — Deactivate ambassador
- `GET /admin/ambassadors/:id/referrals` — List referrals
- `DELETE /admin/ambassadors/:id` — Delete ambassador

### Audit Admin
- `GET /admin/audit-logs` — List audit logs
- `GET /admin/audit-logs/:id` — Get log detail
- `GET /admin/audit-logs/entity/:entityType/:entityId` — Entity change history
- `DELETE /admin/audit-logs/:id` — Delete log
- `GET /admin/audit-logs/export` — Export logs

### Deletion Requests (Admin)
- `GET /admin/deletion-requests` — List deletion requests
- `PATCH /admin/deletion-requests/:id/review` — Review request

### Payment Admin
- `GET /admin/payments/methods` — List payment methods
- `POST /admin/payments/methods` — Create method
- `PUT /admin/payments/methods/:id` — Update method
- `DELETE /admin/payments/methods/:id` — Delete method
- `GET /admin/payments/gateways` — List gateways
- `POST /admin/payments/gateways` — Create gateway
- `POST /infra/payments/manual/:id/verify` — Verify manual payment
- `GET /infra/payments/admin/list` — List all payments

### Reporting (Admin)
- `GET /reporting/audit-logs/export` — Export audit logs
- `GET /reporting/users/export` — Export users
- `GET /reporting/participants/export` — Export participants
- `GET /reporting/payments/export` — Export payments

### Stats (Admin)
- `GET /stats/admin/analytics` — Admin analytics summary

### Program CRUD (Admin — POST/PUT/DELETE)
- `POST /programs` — Create program
- `PUT /programs/:id` — Update program
- `POST /programs/:id/branding` — Upload branding
- `DELETE /programs/:id` — Delete program

### Program Content CRUD (Admin — POST/PUT/DELETE for each)
- Speakers, Team, Partners (POST/PUT/DELETE × 3 = 9 endpoints)
- Timeline, Schedules (POST/PUT/DELETE × 2 = 6 endpoints)
- Gallery, Testimonials, FAQs, Resources (POST/PUT/DELETE × 4 = 12 endpoints)
- Announcements (POST/PUT/DELETE = 3 endpoints)
- Pricing Tiers, Requirements, Essays, Participation Categories, Form Fields (POST/PUT/DELETE × 5 = 15 endpoints)

### Brand CRUD (Admin)
- `POST /brands` — Create brand
- `PUT /brands/:id` — Update brand
- `PUT /brands/:id/details` — Update brand details
- `PUT /brands/:id/settings` — Update brand settings
- `DELETE /brands/:id` — Delete brand

### Legal Documents CRUD (Admin)
- `POST /brands/:brandSlug/legal-documents` — Create
- `PUT /brands/:brandSlug/legal-documents/:id` — Update
- `DELETE /brands/:brandSlug/legal-documents/:id` — Delete

### Auth Provider Admin
- `POST /auth/providers` — Create provider
- `PUT /auth/providers/:id` — Update provider
- `DELETE /auth/providers/:id` — Delete provider

### Application Admin
- `GET /applications` — List all applications (admin filtered)
- `PUT /applications/:id` — Update application
- `POST /applications/:id/review` — Review application
- `GET /applications/export` — Export to CSV

### Newsletter Admin
- `GET /newsletter/subscribers` — List subscribers

### AI Bot Admin
- `POST /ai-bot` — Create config
- `GET /ai-bot` — List configs
- `GET /ai-bot/:id` — Get config
- `PATCH /ai-bot/:id` — Update config
- `DELETE /ai-bot/:id` — Delete config

### Exchange Rate Admin
- `PUT /programs/:programId/exchange-rate` — Update rate

### Participation Info Admin
- `POST /programs/:programId/participation-info` — Create
- `DELETE /programs/:programId/participation-info/:id` — Delete

---

## 2. Critical Issues

> **Status as of April 18, 2026: All critical/high issues below have been fixed.**

---

### ✅ FIXED — S1: Reporting Exports
**File:** `src/modules/reporting/reporting.controller.ts`

Added `@UseGuards(JwtAuthGuard, RolesGuard)` + `@Roles(UserRole.ADMIN, UserRole.SUPER_ADMIN)` + `@ApiBearerAuth()` to all 4 export endpoints. Removed commented-out guards; added proper imports.

---

### ✅ FIXED — S2: Newsletter Subscribers
**File:** `src/modules/newsletter/newsletter.controller.ts`

Added `@UseGuards(JwtAuthGuard, RolesGuard)` + `@Roles(UserRole.ADMIN, UserRole.SUPER_ADMIN)` + `@ApiBearerAuth()` to `GET /newsletter/subscribers`. Fixed imports to use correct guard paths.

---

### ✅ FIXED — S3: AI Bot CRUD
**File:** `src/modules/ai-bot/ai-bot.controller.ts`

Applied `@UseGuards(JwtAuthGuard, RolesGuard)` + `@ApiBearerAuth()` at class level. Added `@Roles(UserRole.ADMIN, UserRole.SUPER_ADMIN)` to all admin endpoints (create, list, detail, update, delete). The public `GET /ai-bot/active` endpoint is protected with `@Public()` which bypasses `JwtAuthGuard` — no role check required for frontend use.

---

### ✅ FIXED — S4: Admins CRUD — Role Check Added
**File:** `src/modules/admins/presentation/admins.controller.ts`

Added `RolesGuard` to `@UseGuards` and `@Roles(UserRole.ADMIN, UserRole.SUPER_ADMIN)` at class level. Manual `adminId` checks in handlers kept as belt-and-suspenders.

---

### ✅ FIXED — S5: Deletion Request Review
**File:** `src/modules/users/presentation/deletion-requests.controller.ts`

Added `RolesGuard` to `@UseGuards` and `@Roles(UserRole.ADMIN, UserRole.SUPER_ADMIN)` at class level.

---

### ✅ FIXED — S6: Payment Webhook — Signature Validation
**Files:**
- `src/modules/payments/infrastructure/webhook-validation.service.ts` *(new)*
- `src/modules/payments/presentation/webhooks.controller.ts`
- `src/modules/payments/payments.module.ts`
- `services/api/.env.example`

Created `WebhookValidationService` with per-gateway signature logic:
- **Midtrans**: validates `X-Signature-Key` header = `SHA512(order_id + status_code + gross_amount + MIDTRANS_SERVER_KEY)` using timing-safe comparison
- **Xendit**: validates `x-callback-token` header against `XENDIT_WEBHOOK_TOKEN` using timing-safe comparison
- **Unknown gateways**: rejected with `400 Bad Request`
- Missing config keys fail closed (400) with an error log, never silently pass

Added `MIDTRANS_SERVER_KEY` and `XENDIT_WEBHOOK_TOKEN` to `.env.example`.

Also removed the `details: err.message` leak from the 500 error response in the webhook proxy.

---

### ✅ FIXED — S7: Audit Admin — Standardized to RolesGuard
**File:** `src/modules/audit/audit-admin.controller.ts`

Added `RolesGuard` to `@UseGuards` and `@Roles(UserRole.ADMIN, UserRole.SUPER_ADMIN)` at class level. Manual `adminId` checks in handlers kept for defense-in-depth.

---

## 3. Improvement Recommendations

### Priority 1 — Security ✅ COMPLETED

| # | Issue | Status |
|---|-------|--------|
| S1 | Add auth guards to reporting exports | ✅ Fixed |
| S2 | Add auth guards to newsletter subscribers | ✅ Fixed |
| S3 | Add auth guards to AI bot CRUD | ✅ Fixed |
| S4 | Add `@Roles('ADMIN')` to admins controller | ✅ Fixed |
| S5 | Add `@Roles('ADMIN')` to deletion requests | ✅ Fixed |
| S6 | Implement webhook signature validation | ✅ Fixed |
| S7 | Standardize audit controller to use `@Roles()` | ✅ Fixed |

### Priority 2 — API Quality

| # | Issue | Effort | Impact |
|---|-------|--------|--------|
| Q1 | Expose admin endpoints in Swagger (separate admin doc) | 2 hrs | Developer productivity |
| Q2 | Standardize pagination to `page`/`limit` everywhere | 1 hr | Consistency |
| Q3 | Add sorting support to list endpoints (`sortBy`, `sortOrder`) | 2 hrs | Usability |
| Q4 | Add search/filter to admin list endpoints | 2 hrs | Usability |
| Q5 | Use response DTOs instead of raw Prisma objects | 3 hrs | Data safety |
| Q6 | Add `@ApiResponse()` with all status codes | 1 hr | Documentation completeness |

### Priority 3 — Testing & Maintenance

| # | Issue | Effort | Impact |
|---|-------|--------|--------|
| T1 | Add unit tests for auth module | 4 hrs | Core module untested |
| T2 | Add unit tests for applications module | 4 hrs | Core module untested |
| T3 | Add unit tests for payments module | 4 hrs | Financial logic untested |
| T4 | Resolve all TODO/FIXME comments (6 found) | 2 hrs | Tech debt |
| T5 | Add E2E tests for critical user flows | 8 hrs | Regression safety |

### Priority 4 — Missing Features

| # | Feature | Effort | Impact |
|---|---------|--------|--------|
| F1 | Brands list: add pagination | 30 min | Performance at scale |
| F2 | Applications list: add full-text search | 2 hrs | Admin efficiency |
| F3 | Health check: implement actual DB check | 30 min | Monitoring accuracy |
| F4 | Rate limiting on newsletter subscribe | 15 min | Spam prevention |
