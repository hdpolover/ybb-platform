# Form Field Catalog & Templates — Design Spec

**Date:** 2026-04-19
**Status:** Design — approved, pending implementation plan
**Owner:** YBB platform team

## 1. Problem

The current "Add Form Field" admin UI exposes a free-form `Field Key` input (stored as `application_form_fields.name`). Non-technical admins (program managers, brand partners) must invent internal identifiers that become JSON keys in `participant_applications.personalData`. The current state has four problems:

1. **UX burden on the wrong persona.** Admins care about labels and options, not database keys. They have no reliable intuition for what a valid key looks like.
2. **Silent magic keys.** The backend special-cases `category` and `program_subtheme_id` (see `get-portal-submission-detail.handler.ts:297-322`) with no surfacing in the UI. A typo or collision silently breaks behavior.
3. **No integrity guarantees.** The backend accepts any string — no format check, no per-program uniqueness index, no reserved-word blocking. Two fields can share a key and overwrite each other's values.
4. **No reuse.** Form configuration is highly repetitive across programs, but there is no way to copy a standard set of fields to a new program.

## 2. Goals

- Hide `field_key` from the default admin flow; auto-generate it from the label.
- Provide a **System Field catalog** so common fields (and magic-key fields) are pickable rather than retyped.
- Provide **Form Field Templates** so admins can apply a standard set of fields to a new program in one action.
- Enforce key format, uniqueness, and reserved-word protection server-side.
- Preserve all existing submission data; migrate cleanly without touching `personalData` JSON values.

## 3. Non-goals

- Changing the submission storage model (keys stay in JSON blobs).
- Retroactive propagation: editing a template does **not** update programs that already applied it.
- Cross-program per-field analytics (deferred; the catalog makes this tractable later but is not built here).
- Restructuring form sections (`personal_details`, `contact_information`, …) — they remain as-is.

## 4. Architecture overview

Two new concepts at the data layer, both additive:

- **System Field Catalog** — a curated list of canonical fields. Hybrid-stored:
  - **Code-backed magic fields** for keys that trigger runtime behavior (`category`, `program_subtheme_id`, `program_id`). Defined in a constants module. Cannot be edited.
  - **DB-backed catalog entries** for generic common fields (name, email, t-shirt size, …). Stored in a new `system_form_field_definitions` table. Managed by super-admins through a new admin page.

- **Form Field Templates** — named, versioned bundles of fields (system references + inline custom snapshots) that can be applied to a program as a one-shot copy.

Per-program form fields continue to live in `application_form_fields`. Each row is now tagged `source = 'system' | 'custom'`. The storage key (`name`) is either the system key (for `source = 'system'`) or an auto-generated slug (for `source = 'custom'`).

Field storage on submission (`personalData[key]`, `essayAnswers[id]`, `uploadedFiles[id]`) is unchanged.

## 5. Data model

### 5.1 New: `system_form_field_definitions`

```prisma
model SystemFormFieldDefinition {
  id              String    @id @default(dbgenerated("uuid_generate_v4()")) @db.Uuid
  key             String    @unique @db.VarChar(64)            // canonical storage key
  label           String    @db.VarChar(255)                   // default label
  category        String    @db.VarChar(32)                    // identity | program_structure | logistics | professional | misc
  type            String    @db.VarChar(32)                    // text | radio | ...
  defaultOptions  Json?     @default("[]") @map("default_options") @db.Json
  validationRules Json?     @default("{}") @map("validation_rules") @db.Json
  helpText        String?   @map("help_text") @db.Text
  placeholder     String?   @db.VarChar(255)
  isMagic         Boolean   @default(false) @map("is_magic")   // true for code-integrated keys
  isActive        Boolean   @default(true) @map("is_active")
  order           Int       @default(0)
  createdAt       DateTime  @default(now()) @map("created_at") @db.Timestamptz(6)
  updatedAt       DateTime  @updatedAt @map("updated_at") @db.Timestamptz(6)
  deletedAt       DateTime? @map("deleted_at") @db.Timestamptz(6)

  @@index([category])
  @@index([isActive])
  @@map("system_form_field_definitions")
}
```

### 5.2 Changes to `application_form_fields`

```prisma
model ApplicationFormField {
  // ... existing columns unchanged ...

  source          String  @default("custom") @db.VarChar(16)   // 'system' | 'custom'
  systemFieldKey  String? @map("system_field_key") @db.VarChar(64)  // matches SystemFormFieldDefinition.key when source = 'system'

  @@unique([programId, name, deletedAt], map: "application_form_fields_program_name_uq")
  // (existing indexes retained)
}
```

The unique index includes `deletedAt` so soft-deleted rows don't block re-creation with the same key.

### 5.3 New: `application_form_templates`

```prisma
model ApplicationFormTemplate {
  id          String    @id @default(dbgenerated("uuid_generate_v4()")) @db.Uuid
  name        String    @db.VarChar(255)
  description String?   @db.Text
  category    String?   @db.VarChar(64)
  isDefault   Boolean   @default(false) @map("is_default")
  createdBy   String?   @map("created_by") @db.Uuid
  createdAt   DateTime  @default(now()) @map("created_at") @db.Timestamptz(6)
  updatedAt   DateTime  @updatedAt @map("updated_at") @db.Timestamptz(6)
  deletedAt   DateTime? @map("deleted_at") @db.Timestamptz(6)

  fields ApplicationFormTemplateField[]

  @@index([category])
  @@map("application_form_templates")
}

model ApplicationFormTemplateField {
  id              String  @id @default(dbgenerated("uuid_generate_v4()")) @db.Uuid
  templateId      String  @map("template_id") @db.Uuid
  source          String  @db.VarChar(16)  // 'system' | 'custom'
  systemFieldKey  String? @map("system_field_key") @db.VarChar(64)

  // Custom-field snapshot — populated only when source = 'custom'
  name            String? @db.VarChar(100)
  label           String? @db.VarChar(255)
  type            String? @db.VarChar(50)
  placeholder     String? @db.VarChar(255)
  helpText        String? @map("help_text") @db.Text
  options         Json?   @default("[]") @db.Json
  validationRules Json?   @default("{}") @map("validation_rules") @db.Json

  // Overrides (apply to both system and custom)
  section         String  @default("personal_details") @db.VarChar(50)
  isRequired      Boolean @default(false) @map("is_required")
  order           Int     @default(0)
  labelOverride   String? @map("label_override") @db.VarChar(255)
  helpTextOverride String? @map("help_text_override") @db.Text

  template ApplicationFormTemplate @relation(fields: [templateId], references: [id], onDelete: Cascade)

  @@index([templateId])
  @@map("application_form_template_fields")
}
```

## 6. System Field catalog — initial contents

### 6.1 Code-backed magic fields

Defined in `services/api/src/modules/programs/constants/magic-form-fields.ts`:

| Key | Type | Behavior |
|---|---|---|
| `category` | radio | Options = `ApplicationCategory` enum values. On submission-save, value is written to `ParticipantApplication.applicationCategory` in addition to `personalData`. |
| `program_subtheme_id` | select | Options populated dynamically from `program.subthemes` (active only). |
| `program_id` | — | Reserved key only. Resolved server-side when present on a form (existing behavior), but **not surfaced in the catalog picker** — admins never add it manually. Listed here so the reserved-key validator blocks admins from creating a custom field with this name. |

`category` and `program_subtheme_id` are seeded into `system_form_field_definitions` with `is_magic = true` (so the picker renders them with the ⚙️ distinct styling). `program_id` is listed only in the code-backed magic registry for reservation and runtime resolution; no catalog row.

### 6.2 DB-seeded generic catalog

Catalog composition is grounded in the legacy `participants` table (260k+ rows) so the template covers the fields YBB has historically collected.

**Identity**

| Key | Type | Label | Notes |
|---|---|---|---|
| `full_name` | text | Full Name | |
| `nickname` | text | Nickname / Preferred Name | |
| `email` | email | Email Address | |
| `phone` | phone | Phone Number | |
| `date_of_birth` | date | Date of Birth | Legacy `birthdate`. |
| `gender` | radio | Gender | Options: `male`, `female`, `prefer-not`, `other` (legacy enum). |
| `nationality` | text | Nationality | |
| `origin_address` | textarea | Origin Address | Hometown / permanent address. |
| `current_address` | textarea | Current Address | |
| `profile_picture` | file | Profile Picture | Legacy `picture_url`. |
| `instagram_account` | text | Instagram Handle | |

**Professional**

| Key | Type | Label | Notes |
|---|---|---|---|
| `occupation` | text | Occupation | |
| `institution` | text | Institution / University | |
| `major` | text | Major / Field of Study | |
| `education_level` | select | Highest Education Level | Options seeded: High School, Diploma, Bachelor's, Master's, Doctorate, Other. |
| `organizations` | textarea | Organizations / Extracurriculars | |
| `linkedin_url` | url | LinkedIn URL | |
| `cv_upload` | file | CV / Resume | Legacy `resume_url`. |

**Logistics**

| Key | Type | Label | Notes |
|---|---|---|---|
| `tshirt_size` | radio | T-Shirt Size | Options: XS, S, M, L, XL, XXL. |
| `dietary_restrictions` | text | Dietary Restrictions | |
| `disease_history` | textarea | Medical / Health History | |
| `emergency_contact_name` | text | Emergency Contact Name | |
| `emergency_contact_phone` | phone | Emergency Contact Phone | |
| `emergency_contact_relation` | text | Relation to Emergency Contact | Legacy `contact_relation`. |

**Misc**

| Key | Type | Label | Notes |
|---|---|---|---|
| `referral_source` | select | How did you hear about us? | Options seeded: Instagram, Twitter/X, Friend, School, Ambassador, Other. |
| `referral_source_detail` | text | Referral source detail | Legacy `source_account_name` — specific person/account who referred. |
| `ambassador_referral_code` | text | Ambassador Referral Code | Legacy `ref_code_ambassador`. |
| `twibbon_link` | url | Twibbon / Social Media Post Link | |

All multi-option fields (`tshirt_size`, `gender`, `education_level`, `referral_source`) have their option sets baked into the seed migration and are editable later through the super-admin catalog page.

## 7. Validation & conflict rules

- **Custom key format (server-enforced):** `^[a-z][a-z0-9_]{0,63}$`.
- **Reserved-key blocking:** a custom field's `name` cannot equal any `system_form_field_definitions.key` (active) or any code-backed magic key. Violation returns `409` with message "`<key>` is a system field — pick it from the catalog instead."
- **Per-program uniqueness:** enforced by `(program_id, name, deleted_at)` composite unique index. Violation returns `409` with "A field named `<key>` already exists in this program."
- **Auto-slug collision:** when auto-generating a key from a label, the client appends `_2`, `_3`, … until unique within the program. The final slug appears in the "will be stored as" caption.

## 8. UI / UX

### 8.1 Add Field flow (per-program form builder)

**Entry point.** Clicking "Add Form Field" opens a catalog picker (not the current editor). Layout:

- Search bar at top.
- System Fields grouped by category: **Identity**, **Program structure**, **Logistics**, **Professional**, **Misc**.
- Magic-key fields (`category`, `program_subtheme_id`) get distinct styling (blue tint + ⚙️ icon) so admins know options are locked and managed by the system.
- Dashed-border divider, then prominent **"＋ Create custom field"** button.

**After picking a system field.** A simplified sheet with only these inputs:
- Section (dropdown, overridable)
- Required? (optional / required)
- Label override (defaults to system label)
- Help text override (optional)

A caption reads: _Stored as `<key>` — consistent across all programs._ The field type and choices are displayed in read-only preview form (so admins can see what applicants will experience) but cannot be edited from this sheet; edits to the type/choices go through the super-admin System Fields catalog page.

**After picking "Create custom field".** A sheet with:
- **Label** (required)
- **Section**
- **Field Type**
- **Help text**
- **Required?**
- **Display order**
- Field-type-specific inputs (options for radio/select/checkbox, validation for text/number/date, media for any)

The storage key is **not** shown by default. A caption under the label reads: _Will be stored as `<auto_slug>`._ An **"Advanced"** disclosure toggle reveals an editable key input (rarely used; keeps the escape hatch for power users).

### 8.2 Template management (super-admin)

New page at `/admin/form-templates` (super-admin gated behind a new `manage_system_form_fields` permission):
- List of templates with name, category, # fields, last updated.
- Create / edit / delete actions.
- Template editor reuses the same field-picker-and-editor sheets as the per-program builder, but writes to `application_form_template_fields` instead of `application_form_fields`.

### 8.3 Copy from template (per-program form builder)

A secondary button "Copy from template" alongside "Add Form Field":
- Opens a picker modal listing templates (grouped by category).
- After selecting, shows a preview of the fields that would be added, with any collisions flagged.
- Mode toggle: **Append** (default, safe — skips colliding keys) or **Replace** (destructive — requires typed confirmation).
- Apply triggers the backend endpoint and refreshes the form-fields table.

### 8.4 New-program hook

On program creation, if the chosen program category has a default template (`is_default = true`), the wizard offers "Start with the `<template name>` template?" checked by default. Admin can skip.

## 9. API

New endpoints under existing programs module:

- `GET /system-form-fields` — catalog listing (active only); used by the Add Field picker.
- `POST /system-form-fields` (super-admin) — create catalog entry.
- `PATCH /system-form-fields/:id` (super-admin).
- `DELETE /system-form-fields/:id` (super-admin, soft-delete).
- `GET /form-templates` — template listing.
- `POST /form-templates` (super-admin).
- `PATCH /form-templates/:id` (super-admin).
- `DELETE /form-templates/:id` (super-admin, soft-delete).
- `POST /programs/:id/form-fields/apply-template` — body: `{ templateId, mode: 'append' | 'replace' }`. Returns `{ added: FormField[], skipped: string[] }`. `replace` mode wraps the soft-delete + insert in a transaction.

Existing endpoints (`POST /programs/:id/form-fields`, `PUT /programs/form-fields/:id`) add `source` and `systemFieldKey` validation; reject unknown `systemFieldKey`; auto-set `source = 'system'` when `systemFieldKey` is present.

## 10. Migration

One-time idempotent script: `pnpm migrate:form-field-catalog`.

1. **Seed catalog.** Upsert rows into `system_form_field_definitions` for code-backed magic fields (`is_magic = true`) and the generic catalog (6.2).
2. **Seed one default template.** "Standard Program Application" — models the full set of fields the legacy system collected on `participants`, grouped into the new form sections. Motivation letter, achievements, and experiences are **not** in the template — they live in dedicated `ParticipantApplication` columns and `ApplicationEssayQuestion` rows. Scoring fields (`score_total`, `score_status`) are not in the template either — they are internal and written by reviewers.

   Template contents, in order:

   | Section | Field key | Source | Required? |
   |---|---|---|---|
   | Personal Details | `full_name` | system | Yes |
   | Personal Details | `nickname` | system | No |
   | Personal Details | `email` | system | Yes |
   | Personal Details | `phone` | system | Yes |
   | Personal Details | `date_of_birth` | system | Yes |
   | Personal Details | `gender` | system | Yes |
   | Personal Details | `nationality` | system | Yes |
   | Personal Details | `origin_address` | system | Yes |
   | Personal Details | `current_address` | system | No |
   | Personal Details | `profile_picture` | system | No |
   | Personal Details | `instagram_account` | system | No |
   | Professional Profile | `occupation` | system | No |
   | Professional Profile | `institution` | system | Yes |
   | Professional Profile | `major` | system | No |
   | Professional Profile | `education_level` | system | Yes |
   | Professional Profile | `organizations` | system | No |
   | Professional Profile | `cv_upload` | system | Yes |
   | Entry Information | `category` | system (magic) | Yes |
   | Entry Information | `program_subtheme_id` | system (magic) | Yes |
   | Miscellaneous | `tshirt_size` | system | No |
   | Miscellaneous | `disease_history` | system | No |
   | Miscellaneous | `emergency_contact_name` | system | Yes |
   | Miscellaneous | `emergency_contact_phone` | system | Yes |
   | Miscellaneous | `emergency_contact_relation` | system | Yes |
   | Miscellaneous | `referral_source` | system | Yes |
   | Miscellaneous | `referral_source_detail` | system | No |
   | Miscellaneous | `ambassador_referral_code` | system | No |
   | Miscellaneous | `twibbon_link` | system | No |
3. **Classify existing `application_form_fields` rows.** For each row:
   - Apply a **legacy-alias map** first to align historical names with the new canonical keys. The alias map is kept small and explicit:

     | Legacy `name` value | → Canonical key |
     |---|---|
     | `birthdate` | `date_of_birth` |
     | `resume_url` | `cv_upload` |
     | `picture_url` | `profile_picture` |
     | `contact_relation` | `emergency_contact_relation` |
     | `ref_code_ambassador` | `ambassador_referral_code` |
     | `source_account_name` | `referral_source_detail` |
     | `knowledge_source` | `referral_source` |

     When an alias applies, the row is rewritten: `name` → canonical key, `source = 'system'`, `systemFieldKey = canonical key`. The pre-migration value is preserved in `validationRules._legacy_name` for traceability.
   - After alias rewriting: if `name` now matches a magic key or a seeded catalog key → `source = 'system'`, `systemFieldKey = name`. Existing label / placeholder / help text are kept as per-program overrides.
   - Otherwise → `source = 'custom'`. Validate `name` against `^[a-z][a-z0-9_]{0,63}$`. If it fails, set `validationRules._legacy_invalid_key = true` so the UI can flag it for manual cleanup without breaking submissions.

   **Note on submission data:** the alias rewrite changes `application_form_fields.name`, which is the JSON key used to look up values in `personalData`. Because the JSON keys were written under the **legacy** names, the migration script must also walk `participant_applications.personalData` for every affected application and rename the JSON keys in-place (e.g. `personalData.birthdate` → `personalData.date_of_birth`). This is done in the same transaction as the alias rewrite. Non-renamed keys are left untouched.
4. **Deduplicate per program.** For any `(program_id, name)` with multiple active rows, keep the most-recently-updated row; soft-delete the rest. Log the casualties.
5. **Report.** Print summary: `migrated_to_system`, `kept_as_custom`, `flagged_invalid`, `deduped`.

No modification to `personalData`, `essayAnswers`, or `uploadedFiles`. Submission reads continue to resolve `personalData[field.name]` as before.

## 11. Testing

**Unit**
- Auto-slug utility: labels → valid slugs; handles non-ASCII, long labels, collisions.
- Reserved-key validator: magic keys and DB catalog keys both rejected; inactive catalog entries do not block.
- Migration classifier: known keys classified as system; unknown classified as custom; invalid format flagged.

**Integration (API)**
- Create custom field — happy path, uniqueness rejection, reserved-word rejection, invalid-format rejection.
- Create system field — happy path, unknown `systemFieldKey` rejection.
- Apply template (append) — new fields added, colliding skipped, response payload accurate.
- Apply template (replace) — transactional; failure rolls back.
- Super-admin gating on catalog and template endpoints.
- Magic-field option injection continues to work (`program_subtheme_id` returns program's subthemes).

**E2E (admin dashboard)**
- Open Add Field → catalog opens → pick "T-Shirt Size" → simplified config sheet → save → field appears in form-fields table.
- Open Add Field → Create custom field → auto-slug caption visible → save → server-stored key matches caption.
- Create custom field with label "T-Shirt Size" → slug collides with catalog → client blocks with "Use the system field instead" message.
- Copy-from-template flow — append and replace paths.

**Portal regression**
- Snapshot test on at least two existing programs' submission-detail payloads pre- and post-migration: identical output.

## 12. Rollout

1. Ship schema migration, seed, and backfill script behind a feature flag for the admin UI.
2. Run migration in staging; verify portal snapshot tests.
3. Enable admin UI flag for internal users; gather feedback on catalog contents and template default.
4. Enable for all admins.
5. Monitor `application_form_fields` writes for `_legacy_invalid_key` flags; follow up with program owners on cleanup.

## 13. Open questions

None blocking. Deferred follow-ups:

- Cross-program field analytics / reporting surfaces (enabled by the catalog; not built here).
- Template versioning with retroactive update propagation (intentionally out of scope — current model is one-shot copy).
- Bulk catalog import / export (defer until a super-admin asks for it).
