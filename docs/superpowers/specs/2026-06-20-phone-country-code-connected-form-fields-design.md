# Design: Phone Country Code & Catalog-Canonical Form Fields

- **Date:** 2026-06-20
- **Status:** Approved (brainstorming) — pending spec review
- **Related specs:**
  - `2026-04-19-form-field-catalog-and-templates-design.md` (system catalog + templates)
  - `2026-06-15-copy-form-fields-from-program-design.md` (copy fields from program)

## Problem

Participants report that on newer program sites (IYS — Istanbul Youth Summit) the
**phone field shows no country-code dropdown** and the country code does not
auto-populate. The same issue was fixed on CYS (China Youth Summit 2026) and later
on MEYS (Middle East Youth Summit 6th), but each fix was a **manual, per-program
DB adjustment**. The team keeps having to "menyesuaikan terus" (adjust every time)
for each new program. The request: make it **connected** so future programs inherit
correct behavior automatically — starting with phone/country, designed to generalize
to all field types.

## Root Cause

The participant frontend renders dynamic DB-driven form fields in exactly **one**
surface: the dashboard submission edit view
(`ybb-program-next/components/dashboard/sections/SubmissionEditSection.tsx`, plus its
read counterpart `SubmissionReadSection.tsx`). There is no separate public registration
form. That renderer **already** handles:

- `field.type === "phone"` → renders `<PhoneField>` (flag + dial-code dropdown,
  E.164 output). Default country derived from the nationality field via
  `isCountrySelectorField()`, falling back to hardcoded `"ID"`.
- `field.type === "country"` → renders `<CountryField>` (country selector).
- A **legacy phone pair** convention: two `type:"text"` fields
  `phone_country_code` + `phone_number` carrying `validationRules.inputType`
  metadata, merged into one `<PhoneField>` via `getPhonePairKind()`.

So the frontend supports two valid conventions and is **not** the defect.

The defect is in the **backend**, in how system-catalog fields are materialized into
a program's `application_form_fields`:

| Creation path | File | Behavior |
|---|---|---|
| Apply form template | `apply-form-template.handler.ts` (line ~90) | **Correct** — `type = def.type` from catalog |
| Copy fields from program | `copy-fields-from-program.handler.ts` (line ~93) | Verbatim copy of source `type` (inherits source state — acceptable) |
| Single add system field | `application-form-field.handler.ts` (`mapDtoToField`, line 44; system branch lines 79–114) | **Bug** — `type` comes only from `dto.fieldType`; the catalog `definition.type` is never applied |

The system catalog (`system_form_field_definitions`) is already canonical and correct:
`phone → type:phone`, `emergency_contact_phone → type:phone`,
`nationality → type:country`. But because at least one creation path (and historically
the path that built IYS's fields) ignores the catalog `type`, IYS's fields landed as
`type:"text"` with empty `validation_rules {}`. With `type:"text"` and a field name
`phone` (which does not match the legacy `phonenumber` heuristic), **neither** the
`type:"phone"` branch **nor** the phone-pair branch fires — so the field renders as a
plain text box with no country code.

### Verified production state (2026-06-20)

- `china-youth-summit-2026` (CYS): legacy pair + `inputType` metadata + `nationality`
  `inputType:country_select`. Works.
- `middle-east-youth-summit-6th` (MEYS): identical correct legacy-pair schema
  (manually patched 2026-05-28). Works.
- `istanbul-youth-summit-2027` (IYS): **broken**. `phone` and `emergency_contact_phone`
  materialized as `type:text`; `nationality` as `type:text`; plus two stray custom
  leftovers from a half-done manual fix: `phone_country_code` and
  `emergency_contact_country_code` (both `type:text`, empty rules).
  **0 submissions** (draft program) → no participant data to migrate.

## Goal & Principle

Make the **system catalog the single source of truth** for a `source:system` field's
`type` and default metadata, so any program adding a catalog field inherits correct
rendering with zero manual per-program work. Fix phone/country now; the mechanism
generalizes to all field types.

**Invariant:** a materialized `source:system` field's `type` (and default options)
must always reflect the current catalog definition. No creation path may silently
downgrade a catalog `type`. Clients may override only presentational/structural
attributes of a system field (label, order, isRequired, section) — never `type`.

## Design

### Part 1 — Close the creation-path gap (backend)

In `application-form-field.handler.ts`, the `source:system` branch of
`CreateApplicationFormFieldHandler` must derive `type`, `options` (when the client
sends none), `placeholder`, and `helpText` from the looked-up `definition`, matching
what `apply-form-template.handler.ts` already does. The client DTO's `fieldType` must
**not** set the `type` of a system field.

- Keep the existing catalog lookup + active/deleted guard (lines 86–94).
- After lookup, build the persisted field with `type: definition.type` (not
  `dto.fieldType`), `name: definition.key`, and options defaulted from
  `definition.defaultOptions` when the client supplies none (the existing
  `systemDto` logic already covers options — extend it to type).
- Custom fields (`source:custom`) are unchanged — they legitimately own their `type`.

### Part 2 — Reconcile operation (backend, the "connected" backbone)

Add a reconcile command/handler — `ReconcileSystemFormFieldsCommand(programId?, { dryRun })`:

- For every `source:system`, non-deleted `application_form_fields` row (optionally
  scoped to one program), compare `type` (and empty `options`) against the current
  `system_form_field_definitions` entry for its `systemFieldKey`.
- Where they diverge, update `type` to the catalog value and fill empty `options`
  from `defaultOptions`. Never touches `source:custom` fields. Never touches label,
  order, isRequired, or section (admin-owned).
- **Idempotent** (re-running makes no further changes), **dry-run-able** (returns the
  list of intended changes without writing), and **logs every change**
  (program, field, old type → new type).
- This is what fixes already-broken programs and keeps programs in sync after future
  catalog edits. It is the durable mechanism behind "terkoneksi", not a one-off script.

Exposure: a guarded admin endpoint/command is acceptable, but an internal
command invoked by a maintenance script is sufficient for the immediate need. Choose
the lighter option that fits existing patterns (see Open Questions).

### Part 3 — `copy-fields-from-program` (backend, no change)

Verbatim `type` copy is correct by design (it snapshots a source program). Document
that copying from a stale source carries stale types, and that the reconcile
(Part 2) realigns system fields afterward. No code change.

### Part 4 — IYS 2027 data patch

Apply the reconcile (Part 2) scoped to `istanbul-youth-summit-2027`, which will:

- `phone` → `type: phone`
- `emergency_contact_phone` → `type: phone`
- `nationality` → `type: country`
- `gender` → `type: radio`, `tshirt_size` → `type: radio` (realign to catalog; both
  render fine as select, so cosmetic but keeps the invariant true)

Then **soft-delete** the two stray custom fields, which are redundant once the unified
`type:phone` fields render their own dropdown:

- `phone_country_code` (custom)
- `emergency_contact_country_code` (custom)

Safety: 0 submissions → no value migration. Changes are reversible (type edits +
soft-delete with `deleted_at`). Dry-run first, review the diff, then apply to prod via
the established prod-script flow (compile TS → scp → docker cp → docker exec in the
API container).

### Part 5 — Frontend

**No code change expected.** The single dynamic-field renderer already supports
`type:phone` and `type:country`. Once IYS's fields carry the correct types, the
existing renderer produces the country-code dropdown and the nationality-driven default
country. Scope here is **verification only**: load the IYS submission edit form and
confirm the phone dropdown and country selector render and submit E.164 correctly.

If verification reveals a gap (e.g. an unexpected stored-value parse issue), the
fallback is to harden the `type:"phone"` branch's value parsing — but this is not
anticipated.

## Testing

**Backend (unit/integration):**
- Creating a `source:system` field derives `type` from the catalog, ignoring a
  conflicting `dto.fieldType`.
- A `source:custom` field keeps its client-provided `type`.
- Reconcile changes a divergent system field's `type` to the catalog value, fills
  empty options, and is idempotent on a second run.
- Reconcile never modifies custom fields or admin-owned attributes (label/order/
  isRequired/section).
- Dry-run returns intended changes and writes nothing.

**Frontend (verification):**
- IYS submission edit form renders `<PhoneField>` (dropdown) for `phone` and
  `emergency_contact_phone`, and `<CountryField>` for `nationality`.
- Default phone country follows the selected nationality; falls back to `ID`.
- Submitted phone persists as E.164 and re-renders correctly in the read view.

## Rollout

1. Ship backend: Part 1 (creation-path fix) + Part 2 (reconcile) with tests.
2. Dry-run reconcile scoped to IYS 2027; review the change diff.
3. Apply reconcile + soft-delete the two stray fields on prod IYS 2027.
4. Verify live IYS submission form shows the country code and country selector.
5. (Optional follow-up) Dry-run reconcile across all programs to surface any other
   drifted system fields; apply per review.

## Non-Goals

- Migrating CYS/MEYS off the legacy phone-pair convention — they work; leave them.
- Building a new public registration form — none exists; out of scope.
- Connecting non-system (`source:custom`) fields to a canonical source — custom fields
  own their definition by design.
- Migrating existing participant submission values (IYS has none; other programs are
  not part of this change).

## Open Questions

1. **Reconcile exposure:** internal maintenance command vs. a guarded admin API
   endpoint. Recommendation: start with an internal command + script (matches the
   immediate need and existing prod-script flow); add an admin endpoint later only if
   ops wants self-serve.
2. **Type-realignment breadth in the IYS patch:** include the cosmetic
   `gender`/`tshirt_size` → `radio` realignment now, or limit the first apply strictly
   to phone/country to minimize the diff. Recommendation: include them — keeping the
   invariant fully true avoids a second pass, and `radio`/`select` render equivalently.
