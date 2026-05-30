import {
    registerDecorator,
    ValidationOptions,
    ValidatorConstraint,
    ValidatorConstraintInterface,
    ValidationArguments,
} from 'class-validator';

/**
 * Regex for English names: letters, spaces, hyphens, apostrophes, periods only.
 * Matches the frontend validation rule exactly.
 */
const ENGLISH_NAME_REGEX = /^[A-Za-z .'-]*$/;

/**
 * Regex for general English text: printable ASCII (0x20–0x7E) plus tab, newline,
 * and carriage return. Blocks diacritics, non-Latin scripts, and emoji.
 * Matches the frontend validation rule exactly.
 */
const ENGLISH_TEXT_REGEX = /^[\x20-\x7E\n\r\t]*$/;

// ─── Name validator ───────────────────────────────────────────────────────────

@ValidatorConstraint({ name: 'IsEnglishName', async: false })
export class IsEnglishNameConstraint implements ValidatorConstraintInterface {
    validate(value: unknown, _args: ValidationArguments): boolean {
        if (value === null || value === undefined || value === '') {
            return true; // defer to @IsNotEmpty / @IsOptional
        }
        if (typeof value !== 'string') return false;
        return ENGLISH_NAME_REGEX.test(value);
    }

    defaultMessage(_args: ValidationArguments): string {
        return "must use the English alphabet only (letters, spaces, - ' .)";
    }
}

/**
 * Validates that a name field contains only English alphabet characters,
 * spaces, hyphens, apostrophes, and periods.
 *
 * Valid:   "Anne-Marie O'Brien", "John Doe", "Dr. Smith"
 * Invalid: "Nguyễn", "Çağ", "João"
 *
 * Combine with @IsOptional() for optional fields — the constraint passes on
 * undefined/null/empty so that @IsOptional() is the sole gatekeeper.
 */
export function IsEnglishName(validationOptions?: ValidationOptions) {
    return function (object: object, propertyName: string) {
        registerDecorator({
            target: object.constructor,
            propertyName,
            options: validationOptions,
            constraints: [],
            validator: IsEnglishNameConstraint,
        });
    };
}

// ─── General text validator ───────────────────────────────────────────────────

@ValidatorConstraint({ name: 'IsEnglishText', async: false })
export class IsEnglishTextConstraint implements ValidatorConstraintInterface {
    validate(value: unknown, _args: ValidationArguments): boolean {
        if (value === null || value === undefined || value === '') {
            return true; // defer to @IsNotEmpty / @IsOptional
        }
        if (typeof value !== 'string') return false;
        return ENGLISH_TEXT_REGEX.test(value);
    }

    defaultMessage(_args: ValidationArguments): string {
        return 'must use standard English characters only (no accented or non-Latin characters)';
    }
}

/**
 * Validates that a text field contains only printable ASCII characters plus
 * common whitespace (tab, newline, carriage return). This blocks diacritics,
 * non-Latin scripts, and emoji while allowing digits and all ASCII punctuation.
 *
 * Valid:   "12 Main St., #3", "Software Engineer", "B.Sc. (Hons)"
 * Invalid: "café", "Москва", "Tokyo 東京", "Hello 🌍"
 *
 * Combine with @IsOptional() for optional fields.
 */
export function IsEnglishText(validationOptions?: ValidationOptions) {
    return function (object: object, propertyName: string) {
        registerDecorator({
            target: object.constructor,
            propertyName,
            options: validationOptions,
            constraints: [],
            validator: IsEnglishTextConstraint,
        });
    };
}
