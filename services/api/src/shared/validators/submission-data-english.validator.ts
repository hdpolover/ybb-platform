import {
    ValidatorConstraint,
    ValidatorConstraintInterface,
    ValidationArguments,
    registerDecorator,
    ValidationOptions,
} from 'class-validator';

/**
 * Regex for name-like fields: letters, spaces, hyphens, apostrophes, periods.
 * Applied when the key matches the NAME_KEY_PATTERN.
 */
const ENGLISH_NAME_REGEX = /^[A-Za-z .'-]*$/;

/**
 * Regex for general text fields: printable ASCII plus tab/newline/CR.
 */
const ENGLISH_TEXT_REGEX = /^[\x20-\x7E\n\r\t]*$/;

/**
 * Pattern to identify keys that hold a person's name.
 * Matches: full_name, fullName, name, first_name, last_name,
 *          emergency_contact_name, emergencyContactName, nick_name, etc.
 */
const NAME_KEY_PATTERN = /name/i;

/**
 * Keys whose string values should be exempt from text-content validation
 * because they hold structured identifiers (UUIDs, ISO codes, URLs, etc.).
 */
const EXEMPT_KEY_PATTERN =
    /^(program_?id|programId|participation_?category_?id|participationCategoryId|category|application_?category|applicationCategory|phone|email|url|link|code|token|id)$/i;

/**
 * Validates that all string values in a submission `data` object use
 * English-only characters:
 *
 * - Keys matching `/name/i`           → ENGLISH_NAME_REGEX  (A-Za-z .'-  only)
 * - All other non-exempt string keys  → ENGLISH_TEXT_REGEX  (printable ASCII + whitespace)
 *
 * Non-string values (booleans, numbers, objects, arrays, null) are skipped.
 * Empty strings are skipped (deferred to required-field validators).
 * Exempt structural keys (IDs, codes, URLs) are skipped.
 */
@ValidatorConstraint({ name: 'SubmissionDataEnglish', async: false })
export class SubmissionDataEnglishConstraint implements ValidatorConstraintInterface {
    private failedField: string | null = null;
    private failedReason: string | null = null;

    validate(data: unknown, _args: ValidationArguments): boolean {
        this.failedField = null;
        this.failedReason = null;

        if (data === null || data === undefined || typeof data !== 'object' || Array.isArray(data)) {
            return true; // defer to @IsObject
        }

        const record = data as Record<string, unknown>;

        for (const [key, value] of Object.entries(record)) {
            if (typeof value !== 'string' || value === '') continue;
            if (EXEMPT_KEY_PATTERN.test(key)) continue;

            if (NAME_KEY_PATTERN.test(key)) {
                if (!ENGLISH_NAME_REGEX.test(value)) {
                    this.failedField = key;
                    this.failedReason = "must use the English alphabet only (letters, spaces, - ' .)";
                    return false;
                }
            } else {
                if (!ENGLISH_TEXT_REGEX.test(value)) {
                    this.failedField = key;
                    this.failedReason =
                        'must use standard English characters only (no accented or non-Latin characters)';
                    return false;
                }
            }
        }

        return true;
    }

    defaultMessage(_args: ValidationArguments): string {
        if (this.failedField && this.failedReason) {
            return `Field "${this.failedField}" ${this.failedReason}`;
        }
        return 'Submission data contains non-English characters';
    }
}

/**
 * Decorator that applies SubmissionDataEnglishConstraint to a
 * Record<string, unknown> property (the dynamic submission form `data` field).
 */
export function IsSubmissionDataEnglish(validationOptions?: ValidationOptions) {
    return function (object: object, propertyName: string) {
        registerDecorator({
            target: object.constructor,
            propertyName,
            options: validationOptions,
            constraints: [],
            validator: SubmissionDataEnglishConstraint,
        });
    };
}
