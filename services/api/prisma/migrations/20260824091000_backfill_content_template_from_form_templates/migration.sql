-- prisma/migrations/20260824091000_backfill_content_template_from_form_templates/migration.sql

-- Why: one generic template store (content_templates, added in
-- 20260824090000_add_content_template) replaces application_form_templates /
-- application_form_template_fields. This copies every existing template
-- across losslessly — including whatever label_override/help_text_override
-- values already sit in the field rows, even though no UI has ever set a
-- non-null one — before the old tables are dropped
-- (20260824092000_drop_application_form_template). "order" is a reserved
-- word in Postgres and must stay quoted.
--
-- FIX 1: skip zero-field templates. form-template.dto.ts's `fields` array has
-- no @ArrayMinSize(1), so a zero-field ApplicationFormTemplate is creatable
-- today. Migrating one as items: [] would produce a ContentTemplate row that
-- is permanently unrepairable — UpdateContentTemplateHandler never writes
-- payload (immutable after creation) and CreateContentTemplateHandler
-- rejects empty payloads outright. The WHERE EXISTS below excludes such rows.
INSERT INTO "content_templates" (
    "id", "name", "description", "entity_type", "payload", "payload_version",
    "is_default", "created_by", "created_at", "updated_at", "deleted_at"
)
SELECT
    aft."id",
    aft."name",
    aft."description",
    'form-fields',
    jsonb_build_object(
        'entityType', 'form-fields',
        'payloadVersion', 1,
        'items', COALESCE(
            (
                SELECT jsonb_agg(
                    jsonb_build_object(
                        'source', aftf."source",
                        'systemFieldKey', aftf."system_field_key",
                        'name', aftf."name",
                        'label', aftf."label",
                        'type', aftf."type",
                        'placeholder', aftf."placeholder",
                        'helpText', aftf."help_text",
                        'options', aftf."options",
                        'validationRules', aftf."validation_rules",
                        'section', aftf."section",
                        'isRequired', aftf."is_required",
                        'order', aftf."order",
                        'labelOverride', aftf."label_override",
                        'helpTextOverride', aftf."help_text_override"
                    ) ORDER BY aftf."order"
                )
                FROM "application_form_template_fields" aftf
                WHERE aftf."template_id" = aft."id"
            ),
            '[]'::jsonb
        )
    ),
    1,
    aft."is_default",
    aft."created_by",
    aft."created_at",
    aft."updated_at",
    aft."deleted_at"
FROM "application_form_templates" aft
WHERE EXISTS (
    SELECT 1 FROM "application_form_template_fields" aftf
    WHERE aftf."template_id" = aft."id"
);

-- FIX 2: collapse multiple legacy defaults. The old model scoped "default" by
-- category (form-template.handler.ts:135 — `if (dto.isDefault && dto.category)`,
-- so uncategorized rows never deduped at all); ContentTemplate scopes
-- "default" by entityType. Copying is_default verbatim could therefore land
-- multiple entityType='form-fields' rows with is_default = true in the same
-- statement, violating the at-most-one-default invariant (enforced only at
-- the handler layer — see the addendum note against adding a DB constraint
-- here). Keep only the most-recently-updated default; clear the rest.
WITH ranked AS (
    SELECT "id",
           ROW_NUMBER() OVER (PARTITION BY "entity_type" ORDER BY "updated_at" DESC) AS rn
    FROM "content_templates"
    WHERE "entity_type" = 'form-fields' AND "is_default" = true
)
UPDATE "content_templates"
SET "is_default" = false
WHERE "id" IN (SELECT "id" FROM ranked WHERE rn > 1);
