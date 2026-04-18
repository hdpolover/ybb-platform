# API Service — Current State Analysis

> Generated: April 18, 2026

## 1. Overview

The API service is the **primary backend** of the YBB Platform. It is a **NestJS** (v10.3.0) monolith using **Prisma** (v7.2.0) as the ORM against a **PostgreSQL** database with the `uuid-ossp` extension.

| Attribute         | Value                                |
|-------------------|--------------------------------------|
| Framework         | NestJS 10.3.0                        |
| ORM               | Prisma 7.2.0                         |
| Database          | PostgreSQL                           |
| Language          | TypeScript                           |
| Port              | 3000                                 |
| API Docs          | Swagger at `/docs`                   |
| Versioning        | URI-based, default `v1`              |
| Entry Point       | `src/main.ts`                        |

---

## 2. Architecture

The service follows a **modular NestJS architecture** with domain-separated modules. Each module generally contains its own controller, service, repository, and DTOs.

```
src/
├── main.ts               # Bootstrap with RabbitMQ, Winston, CORS, Swagger
├── app.module.ts          # Root module
├── config/                # Configuration
├── core/                  # Domain layer (guards, interceptors, decorators)
├── modules/               # 24 feature modules
│   ├── achievements/      ├── admins/
│   ├── ai-bot/            ├── applications/
│   ├── audit/             ├── auth/
│   ├── brands/            ├── files/
│   ├── gallery/           ├── health/
│   ├── landing/           ├── legal/
│   ├── metadata/          ├── newsletter/
│   ├── participants/      ├── partnerships/
│   ├── payments/          ├── portal/
│   ├── programs/          ├── reporting/
│   ├── stats/             ├── support/
│   ├── system/            └── users/
└── shared/                # Infrastructure & utilities
```

---

## 3. Infrastructure & Middleware

### 3.1 Async Messaging
- **RabbitMQ** — Two queues: `audit_log_queue`, `reporting_queue`

### 3.2 Caching
- **Redis** via `cache-manager` + `Keyv`

### 3.3 Observability
- **Winston** logger with **Loki** integration
- **OpenTelemetry** for distributed tracing
- **Prometheus** for metrics

### 3.4 Security & Auth
| Guard                    | Purpose                              |
|--------------------------|--------------------------------------|
| `JwtAuthGuard`           | JWT token validation                 |
| `BrandScopedGuard`       | Multi-tenant brand isolation         |
| `RoleBasedAccessGuard`   | Permission-based access              |
| `AdminAuthGuard`         | Admin-only endpoints                 |

### 3.5 Interceptors
- `TransformInterceptor` — Standardize response shape
- `TraceIdInterceptor` — Inject trace IDs
- `LoggingInterceptor` — Request/response logging

### 3.6 Rate Limiting
- NestJS `@nestjs/throttler`

### 3.7 Other Services
- **GeoIP** — Geolocation for security logs
- **ExcelJS** — Spreadsheet parsing/generation
- **Firebase Admin** — Push notifications / OAuth

---

## 4. API Endpoints (Major Routes)

| Route Prefix               | Module         | Purpose                                     |
|----------------------------|----------------|---------------------------------------------|
| `/auth`                    | auth           | Login, register, OAuth, password reset       |
| `/programs`                | programs       | CRUD + nested content (timeline, FAQ, etc.)  |
| `/applications`            | applications   | Submit, update, withdraw, review             |
| `/participants`            | participants   | Profile management                           |
| `/users`                   | users          | Preferences, deletion requests               |
| `/payments`                | payments       | Intents, confirmation, status                |
| `/files`                   | files          | Upload, download, deletion                   |
| `/support/tickets`         | support        | Create and manage support tickets            |
| `/portal`                  | portal         | Participant dashboard, certificates          |
| `/admin/*`                 | admins         | Admin operations                             |
| `/brands`                  | brands         | Multi-brand management                       |
| `/system/announcements`    | system         | System notifications                         |
| `/achievements`            | achievements   | Award tracking                               |
| `/gallery`                 | gallery        | Photo galleries                              |
| `/stats`                   | stats          | Statistics/analytics endpoints               |
| `/health`                  | health         | Health check                                 |
| `/landing`                 | landing        | Public landing page data                     |
| `/legal`                   | legal          | ToS, privacy policy                          |
| `/newsletter`              | newsletter     | Email subscription                           |
| `/partnerships`            | partnerships   | Partnership inquiries                        |
| `/ai-bot`                  | ai-bot         | Chatbot configuration                        |
| `/metadata`                | metadata       | System metadata                              |
| `/reporting`               | reporting      | Reports generation                           |
| `/audit`                   | audit          | Audit log queries                            |

---

## 5. Database Schema

### 5.1 Table Inventory

The database has **55 tables** organized across 16 Prisma schema files.

#### Schema File Breakdown

| Schema File            | Tables | Domain                           |
|------------------------|--------|----------------------------------|
| `auth.prisma`          | 9      | Users, sessions, security        |
| `roles.prisma`         | 7      | Admin, participant, ambassador   |
| `program.prisma`       | 8      | Brands, programs, tags, waitlist |
| `applications.prisma`  | 11     | Applications, pricing, reviews   |
| `participation.prisma` | 1      | Participation category info      |
| `content.prisma`       | 14     | Program content (FAQ, etc.)      |
| `scoring.prisma`       | 4      | Scoring rubrics & reviews        |
| `system.prisma`        | 2      | Files, migration tracking        |
| `preferences.prisma`   | 1      | User preferences                 |
| `audit.prisma`         | 1      | Data change log                  |
| `features.prisma`      | 5      | Announcements, notifications, support |
| `marketing.prisma`     | 1      | Newsletter subscribers           |
| `legal.prisma`         | 1      | Legal documents                  |
| `ai_bot.prisma`        | 1      | AI chatbot config                |
| `enums.prisma`         | 0      | Enum definitions only            |
| `base.prisma`          | 0      | Generator & datasource config    |

---

### 5.2 Complete Table Reference

#### Auth & Users (9 tables)

| Table                     | DB Name                     | Key Fields                                          |
|---------------------------|-----------------------------|-----------------------------------------------------|
| `AuthProvider`            | `auth_providers`            | name, clientId, clientSecret, authUrl, tokenUrl, isOAuth |
| `User`                    | `users`                     | email, brandId, passwordHash, emailVerified, isActive, failedLoginAttempts |
| `UserIdentity`            | `user_identities`           | userId, providerId, brandId, providerUserId, accessToken, refreshToken |
| `UserSession`             | `user_sessions`             | userId, sessionToken, refreshToken, deviceType, ipAddress, country |
| `UserSecurityLog`         | `user_security_logs`        | userId, eventType, eventStatus, ipAddress, riskLevel, flagged |
| `UserPrivacyConsent`      | `user_privacy_consents`     | userId, consentType, consentVersion, isGranted       |
| `UserBlockedAccount`      | `user_blocked_accounts`     | userId, blockReason, blockType, blockedUntil, violationsCount |
| `UserActivityLog`         | `user_activity_logs`        | userId, activityType, activityCategory, pageUrl, sessionId |
| `AccountDeletionRequest`  | `account_deletion_requests` | userId, reason, status, reviewedBy, scheduledDeletionDate |

#### Roles & Profiles (7 tables)

| Table                     | DB Name                        | Key Fields                                          |
|---------------------------|--------------------------------|-----------------------------------------------------|
| `Admin`                   | `admin`                        | userId, fullName, roleId, department, jobTitle, accessLevel, canManageAdmins |
| `AdminRole`               | `admin_roles`                  | name, permissions (JSON), isActive                   |
| `AdminProgram`            | `admin_programs`               | adminId, programId, roleInProgram, permissions       |
| `AdminBrand`              | `admin_brands`                 | adminId, brandId, roleInBrand, permissions            |
| `Participant`             | `participants`                 | userId, fullName, birthdate, gender, nationality, education, occupation, emergencyContact, profilePictureUrl, referralCode (~50 fields) |
| `Ambassador`              | `ambassadors`                  | userId, fullName, referralCode, programId, totalReferrals, successfulReferrals |
| `AmbassadorReferral`      | `ambassador_referrals`         | ambassadorId, participantId, status, referredAt → completedAt funnel |

#### Brands & Programs (8 tables)

| Table                            | DB Name                           | Key Fields                                    |
|----------------------------------|-----------------------------------|-----------------------------------------------|
| `Brand`                          | `brands`                          | name, slug, logos, colors, contact, socialMediaLinks, currency |
| `BrandSetting`                   | `brand_settings`                  | brandId, maintenanceMode, usdInIdr, googleAnalyticsId |
| `BrandSocialFeed`                | `brand_social_feeds`              | brandId, platform, postId, imageUrl, permalink |
| `Program`                        | `programs`                        | brandId, name, slug, year, startDate, endDate, applicationDeadline, capacity, currency, status (~40 fields) |
| `ProgramTag`                     | `program_tags`                    | name, slug, color                             |
| `ProgramTagRelation`             | `program_tag_relations`           | programId, tagId (composite PK)               |
| `ProgramWaitlist`                | `program_waitlist`                | programId, userId, position, notified          |
| `ProgramExchangeRateHistory`     | `program_exchange_rate_history`   | programId, oldRate, newRate, changedBy          |

#### Applications & Payment (11 tables)

| Table                           | DB Name                          | Key Fields                                     |
|---------------------------------|----------------------------------|------------------------------------------------|
| `ProgramPricingTier`            | `program_pricing_tiers`          | programId, name, price, currency, capacity, feeType, allowedCategories |
| `PricingTierValidityPeriod`     | `pricing_tier_validity_periods`  | pricingTierId, startDate, endDate               |
| `ProgramRequirement`            | `program_requirements`           | programId, name, type, fileMaxSize, isRequired   |
| `ApplicationFormField`          | `application_form_fields`        | programId, section, label, type, validationRules |
| `ParticipantApplication`        | `participant_applications`       | programId, participantId, status, registrationPaymentStatus, programPaymentStatus, pricingTierId, essayAnswers, scoreTotal |
| `ApplicationInvoice`            | `application_invoices`           | applicationId, pricingTierId, amount, currency, status, externalTransactionId |
| `ApplicationAssessment`         | `application_assessments`        | applicationId, type, status, score, assessorId   |
| `ApplicationEditHistory`        | `application_edit_history`       | applicationId, editedBy, changes (JSON), snapshot |
| `ParticipantAward`              | `participant_awards`             | applicationId, programAwardId, awardedBy         |
| `ParticipantDocument`           | `participant_documents`          | applicationId, templateId, name, type, fileUrl    |
| `ProgramEssay`                  | `program_essays`                 | programId, question, wordLimit, isRequired, order |

#### Program Content (14 tables)

| Table                       | DB Name                        | Key Fields                                       |
|-----------------------------|--------------------------------|--------------------------------------------------|
| `ProgramFaq`                | `program_faqs`                 | programId, question, answer, category, order      |
| `ProgramTimeline`           | `program_timeline`             | programId, date, title, type, completionType      |
| `ProgramSchedule`           | `program_schedules`            | programId, day, startTime, endTime, activity      |
| `ProgramSpeaker`            | `program_speakers`             | programId, name, title, organization, photoUrl    |
| `ProgramGallery`            | `program_gallery`              | programId, imageUrl, videoUrl, type, order        |
| `ProgramTestimonial`        | `program_testimonials`         | programId/brandId, name, testimonial, rating      |
| `Sponsor`                   | `sponsors`                     | brandId, name, type, logoUrl, tier                |
| `EmailTemplate`             | `email_templates`              | brandId, programId, name, type, subject, body     |
| `ProgramTeam`               | `program_team`                 | brandId/programId, name, role, photoUrl           |
| `ProgramPartner`            | `program_partners`             | programId, name, type, logoUrl                    |
| `ProgramResource`           | `program_resources`            | programId, title, fileUrl, fileType, downloads    |
| `ProgramAnnouncement`       | `program_announcements`        | programId, title, content, targetAudience, isPinned |
| `ProgramAnnouncementRead`   | `program_announcement_reads`   | userId, announcementId, readAt                    |
| `ProgramObjective`          | `program_objectives`           | programId, description, order                     |

#### Additional Content (4 tables)

| Table                       | DB Name                        | Key Fields                                       |
|-----------------------------|--------------------------------|--------------------------------------------------|
| `ProgramSubtheme`           | `program_subthemes`            | programId, name, description, order               |
| `ProgramParticipationCategory` | `program_participation_category` | programId, name, benefits, eligibility         |
| `ProgramParticipationInfo`  | `program_participation_info`   | programId, category, benefits, requirements, sections |
| `CertificateTemplate`       | `certificate_templates`        | programId, name, templateUrl, fields              |

#### Scoring & Assessment (4 tables)

| Table                    | DB Name                     | Key Fields                                       |
|--------------------------|-----------------------------|--------------------------------------------------|
| `ScoringSchema`          | `scoring_schemas`           | programId, name, isActive                         |
| `ScoringCategory`        | `scoring_categories`        | schemaId, name, weight, order                     |
| `ScoringCriterion`       | `scoring_criteria`          | categoryId, name, weight, maxScore                |
| `ApplicationReview`      | `application_reviews`       | applicationId, schemaId, reviewerId, totalScore    |
| `ApplicationScoreItem`   | `application_score_items`   | reviewId, criterionId, score, notes                |

#### System Features (5 tables)

| Table                    | DB Name                     | Key Fields                                       |
|--------------------------|-----------------------------|--------------------------------------------------|
| `SystemAnnouncement`     | `system_announcements`      | title, content, targetAudience, priority, type, isPublished |
| `UserAnnouncementRead`   | `user_announcement_reads`   | userId, announcementId, isDismissed               |
| `UserNotification`       | `user_notifications`        | userId, type, title, message, isRead, priority    |
| `SupportTicket`          | `support_tickets`           | participantId, ticketNumber, category, status, priority |
| `SupportTicketMessage`   | `support_ticket_messages`   | ticketId, message, isFromAdmin, senderId          |

#### Supporting Tables (6 tables)

| Table                    | DB Name                     | Key Fields                                       |
|--------------------------|-----------------------------|--------------------------------------------------|
| `ProgramAward`           | `program_awards`            | programId, name, category, tier, badgeUrl         |
| `DocumentTemplate`       | `document_templates`        | programId, name, type, htmlContent, placeholders  |
| `File`                   | `files`                     | filename, contentType, size, url, userId          |
| `MigrationTracking`      | `migration_tracking`        | tableName, mysqlId, postgresId                    |
| `DataChangeLog`          | `data_change_logs`          | entityType, action, beforeState, afterState, actorType, riskLevel |
| `UserPreference`         | `user_preferences`          | userId, theme, language, timezone, emailNotifications |

#### Marketing & Legal (3 tables)

| Table                    | DB Name                     | Key Fields                                       |
|--------------------------|-----------------------------|--------------------------------------------------|
| `NewsletterSubscriber`   | `newsletter_subscribers`    | email, name, source, isSubscribed                 |
| `LegalDocument`          | `legal_documents`           | brandId, title, slug, content, version            |
| `AiChatBotConfig`        | `ai_chatbot_configs`        | brandId, name, type, botConfig, allowedDomains    |

#### Partnerships (3 tables)

| Table                    | DB Name                     | Key Fields                                       |
|--------------------------|-----------------------------|--------------------------------------------------|
| `PartnershipOpportunity` | `partnership_opportunities` | brandId/programId, title, type, features          |
| `SponsorshipTier`        | `sponsorship_tiers`         | brandId/programId, name, priceDescription, features |
| `PartnershipEnquiry`     | `partnership_enquiries`     | brandId/programId, partnershipType, fullName, email, status |

---

### 5.3 Enums

| Enum                        | Values                                                                 |
|-----------------------------|------------------------------------------------------------------------|
| `Gender`                    | male, female, other                                                    |
| `ApplicationStatus`         | draft, submitted, under_review, interview_scheduled, accepted, rejected, waitlisted, withdrawn |
| `ApplicationCategory`       | fully_funded, self_funded                                              |
| `PaymentStatus`             | unpaid, paid, processing, failed, refunded                             |
| `ScoreStatus`               | pending, scored, go_to_interview, rejected                             |
| `ReferralStatus`            | referred, registered, applied, accepted, completed                     |
| `AssessmentType`            | document_review, interview, essay_scoring, final_assessment            |
| `AssessmentStatus`          | pending, in_progress, completed, skipped                               |
| `BlockType`                 | temporary, permanent                                                   |
| `RiskLevel`                 | low, medium, high, critical                                            |
| `NotificationPriority`      | low, normal, high, urgent                                              |
| `AnnouncementTarget`        | all, participants, ambassadors, specific_program                       |
| `AnnouncementPriority`      | low, normal, high, urgent                                              |
| `AnnouncementType`          | general, maintenance, deadline, feature, alert                         |
| `FaqCategory`               | general, registration, payment, event_details, accommodation, visa, other |
| `DeletionStatus`            | pending, approved, rejected, completed, cancelled                      |
| `Theme`                     | light, dark, auto                                                      |
| `ChangeType`                | create, update, delete, status_change, bulk_update                     |
| `ChangedByType`             | participant, admin, system, webhook                                    |
| `PricingFeeType`            | registration_fee, program_fee_1, program_fee_2, full_fee, custom_fee   |
| `PricingTarget`             | self_funded, fully_funded, all                                         |
| `SupportTicketStatus`       | open, in_progress, waiting_response, resolved, closed                  |
| `SupportTicketPriority`     | low, normal, high, urgent                                              |
| `DocumentTemplateType`      | letter_of_acceptance, letter_of_invitation, certificate_participation, certificate_achievement, certificate_speaker, letter_recommendation, agreement_letter, custom |
| `TimelineType`              | registration, announcement_loa, payment_1, payment_2, mentoring, interview, announcement_final, program_start, program_end, onboarding, custom |
| `TimelineCompletionType`    | date_passed, status_change, payment_completed, document_uploaded, manual, always_open |

---

## 6. Key Dependencies

| Package                    | Purpose                          |
|----------------------------|----------------------------------|
| `@nestjs/*`                | Core framework (10.3.0)          |
| `@prisma/client` (7.2.0)  | Database ORM                     |
| `passport`, `passport-jwt` | Authentication                   |
| `firebase-admin`           | Firebase OAuth / push            |
| `amqplib`                  | RabbitMQ messaging               |
| `cache-manager`, `keyv`   | Redis caching                    |
| `class-validator`          | DTO validation                   |
| `class-transformer`        | DTO transformation               |
| `exceljs`                  | Excel import/export              |
| `geoip-lite`               | IP geolocation                   |
| `@opentelemetry/*`         | Distributed tracing              |
| `prom-client`              | Prometheus metrics               |
| `winston`, `winston-loki`  | Structured logging               |
| `bcrypt`                   | Password hashing                 |
| `axios`                    | HTTP client                      |
| `@nestjs/swagger`          | API documentation                |

---

## 7. Key Observations & Notes

### Multi-Tenancy
The platform is **multi-tenant by brand**. Users are unique per `(email, brandId)`. Admins are scoped to specific brands and programs via `admin_brands` and `admin_programs` junction tables.

### Payment
Payments are currently tracked via `ApplicationInvoice` with `PaymentStatus` enum (unpaid, paid, processing, failed, refunded). There is a `payments` module, but the actual payment gateway integration (Midtrans/Xendit) appears to be in transition — a planned migration to a Custom Payment Gateway model with `payment_intents` and `payment_transactions` is documented separately.

### Application Lifecycle
Applications follow: `draft → submitted → under_review → interview_scheduled → accepted/rejected/waitlisted → withdrawn`. Each application can have multiple `ApplicationInvoice` records (for registration fee and program fees), reviews, assessments, and edit history.

### Scoring System
A flexible scoring system with `ScoringSchema → ScoringCategory → ScoringCriterion` hierarchy. Each application can have multiple `ApplicationReview` instances, each with individual `ApplicationScoreItem` entries per criterion.

### Ambassador & Referral Tracking
Full referral funnel from `referred → registered → applied → accepted → completed` with computed conversion day metrics (`daysToRegister`, `daysToApply`, etc.).

### Audit Trail
`DataChangeLog` captures every entity mutation with before/after state snapshots, actor info, risk level, and correlation IDs. Security events go to `UserSecurityLog`.

### Legacy Migration
`MigrationTracking` table maps MySQL IDs → PostgreSQL UUIDs. Many tables retain a `legacyId` field for backward compatibility.
