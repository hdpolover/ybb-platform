-- NULL out any existing rows that used 'other' before we drop it from the enum.
-- The column is nullable on both tables, so this is safe.
UPDATE "participants" SET "gender" = NULL WHERE "gender" = 'other';
UPDATE "ambassadors" SET "gender" = NULL WHERE "gender" = 'other';

-- Recreate the Gender enum without 'other'.
-- PostgreSQL doesn't support DROP VALUE on an enum, so we rename/replace the type.
ALTER TYPE "Gender" RENAME TO "Gender_old";
CREATE TYPE "Gender" AS ENUM ('male', 'female');

-- Re-bind the columns to the new type.
ALTER TABLE "participants"
  ALTER COLUMN "gender" TYPE "Gender"
    USING "gender"::text::"Gender";

ALTER TABLE "ambassadors"
  ALTER COLUMN "gender" TYPE "Gender"
    USING "gender"::text::"Gender";

-- Drop the old type.
DROP TYPE "Gender_old";
