import { validate } from 'class-validator';
import { IsOptional, IsString } from 'class-validator';
import { IsEnglishName, IsEnglishText } from './english-text.validator';
import { IsSubmissionDataEnglish } from './submission-data-english.validator';

// ─── Test fixtures ────────────────────────────────────────────────────────────

class NameDto {
    @IsString()
    @IsEnglishName()
    value: string;
}

class OptionalNameDto {
    @IsOptional()
    @IsString()
    @IsEnglishName()
    value?: string;
}

class TextDto {
    @IsString()
    @IsEnglishText()
    value: string;
}

class SubmissionDataDto {
    @IsSubmissionDataEnglish()
    data: Record<string, unknown>;
}

// ─── IsEnglishName ────────────────────────────────────────────────────────────

describe('IsEnglishName', () => {
    async function validate_name(value: string): Promise<boolean> {
        const dto = new NameDto();
        dto.value = value;
        const errors = await validate(dto);
        return errors.length === 0;
    }

    describe('valid values', () => {
        it('accepts a simple English name', async () => {
            expect(await validate_name('John Doe')).toBe(true);
        });

        it('accepts a hyphenated name', async () => {
            expect(await validate_name('Anne-Marie')).toBe(true);
        });

        it("accepts a name with apostrophe", async () => {
            expect(await validate_name("Anne-Marie O'Brien")).toBe(true);
        });

        it('accepts a name with period (Dr. Smith)', async () => {
            expect(await validate_name('Dr. Smith')).toBe(true);
        });

        it('accepts single letter', async () => {
            expect(await validate_name('A')).toBe(true);
        });
    });

    describe('invalid values — non-English characters', () => {
        it('rejects Vietnamese name with diacritic (Nguyễn)', async () => {
            expect(await validate_name('Nguyễn')).toBe(false);
        });

        it('rejects Turkish name with cedilla (Çağ)', async () => {
            expect(await validate_name('Çağ')).toBe(false);
        });

        it('rejects Portuguese name (João)', async () => {
            expect(await validate_name('João')).toBe(false);
        });

        it('rejects Cyrillic text', async () => {
            expect(await validate_name('Иван')).toBe(false);
        });

        it('rejects emoji', async () => {
            expect(await validate_name('John 😊')).toBe(false);
        });
    });

    describe('invalid values — disallowed ASCII', () => {
        it('rejects digits in a name', async () => {
            expect(await validate_name('John2')).toBe(false);
        });

        it('rejects at-sign', async () => {
            expect(await validate_name('John@Doe')).toBe(false);
        });
    });

    describe('optional field behaviour', () => {
        it('passes for undefined when @IsOptional is set', async () => {
            const dto = new OptionalNameDto();
            // value is undefined
            const errors = await validate(dto);
            expect(errors.length).toBe(0);
        });

        it('passes for empty string (constraint defers; @IsNotEmpty would catch)', async () => {
            const dto = new NameDto();
            dto.value = '';
            const errors = await validate(dto);
            // IsEnglishName passes on empty; IsString also passes → no errors from our decorator
            const nameErrors = errors.filter((e) =>
                e.constraints && 'IsEnglishName' in e.constraints,
            );
            expect(nameErrors.length).toBe(0);
        });
    });
});

// ─── IsEnglishText ────────────────────────────────────────────────────────────

describe('IsEnglishText', () => {
    async function validate_text(value: string): Promise<boolean> {
        const dto = new TextDto();
        dto.value = value;
        const errors = await validate(dto);
        return errors.length === 0;
    }

    describe('valid values', () => {
        it('accepts a street address with digits and punctuation', async () => {
            expect(await validate_text('12 Main St., #3')).toBe(true);
        });

        it('accepts all printable ASCII', async () => {
            expect(await validate_text('The quick brown fox jumps over the lazy dog!')).toBe(true);
        });

        it('accepts digits', async () => {
            expect(await validate_text('12345')).toBe(true);
        });

        it('accepts newlines (multiline essay)', async () => {
            expect(await validate_text('Line 1\nLine 2\r\nLine 3')).toBe(true);
        });

        it('accepts tab character', async () => {
            expect(await validate_text('col1\tcol2')).toBe(true);
        });

        it('accepts all punctuation characters', async () => {
            expect(await validate_text('!"#$%&\'()*+,-./:;<=>?@[\\]^_`{|}~')).toBe(true);
        });
    });

    describe('invalid values', () => {
        it('rejects accented character (café)', async () => {
            expect(await validate_text('café')).toBe(false);
        });

        it('rejects Cyrillic script', async () => {
            expect(await validate_text('Москва')).toBe(false);
        });

        it('rejects emoji', async () => {
            expect(await validate_text('Hello 🌍')).toBe(false);
        });

        it('rejects Chinese characters', async () => {
            expect(await validate_text('Tokyo 東京')).toBe(false);
        });

        it('rejects Arabic characters', async () => {
            expect(await validate_text('مرحبا')).toBe(false);
        });

        it('rejects control characters other than tab/newline/CR (BEL)', async () => {
            expect(await validate_text('Hello\x07World')).toBe(false);
        });
    });
});

// ─── IsSubmissionDataEnglish ──────────────────────────────────────────────────

describe('IsSubmissionDataEnglish', () => {
    async function validate_data(data: Record<string, unknown>): Promise<string[]> {
        const dto = new SubmissionDataDto();
        dto.data = data;
        const errors = await validate(dto);
        return errors.flatMap((e) => Object.values(e.constraints ?? {}));
    }

    describe('valid payloads', () => {
        it('accepts an English full_name', async () => {
            const msgs = await validate_data({ full_name: 'John Doe' });
            expect(msgs.length).toBe(0);
        });

        it('accepts English name with apostrophe', async () => {
            const msgs = await validate_data({ emergency_contact_name: "Anne-Marie O'Brien" });
            expect(msgs.length).toBe(0);
        });

        it('accepts general ASCII text for non-name field', async () => {
            const msgs = await validate_data({ occupation: 'Software Engineer, Level 3' });
            expect(msgs.length).toBe(0);
        });

        it('skips boolean values', async () => {
            const msgs = await validate_data({ preview_ready_to_join: true });
            expect(msgs.length).toBe(0);
        });

        it('skips numeric values', async () => {
            const msgs = await validate_data({ age: 25 });
            expect(msgs.length).toBe(0);
        });

        it('skips exempt keys (programId with UUID)', async () => {
            const msgs = await validate_data({
                programId: '123e4567-e89b-12d3-a456-426614174000',
            });
            expect(msgs.length).toBe(0);
        });

        it('skips empty strings', async () => {
            const msgs = await validate_data({ full_name: '' });
            expect(msgs.length).toBe(0);
        });
    });

    describe('invalid payloads', () => {
        it('rejects Vietnamese name in full_name', async () => {
            const msgs = await validate_data({ full_name: 'Nguyễn Văn A' });
            expect(msgs.length).toBeGreaterThan(0);
            expect(msgs[0]).toContain('full_name');
        });

        it('rejects Turkish chars in name field', async () => {
            const msgs = await validate_data({ emergency_contact_name: 'Çağ' });
            expect(msgs.length).toBeGreaterThan(0);
            expect(msgs[0]).toContain('emergency_contact_name');
        });

        it('rejects accented chars in general text field', async () => {
            const msgs = await validate_data({ occupation: 'Ingénieur' });
            expect(msgs.length).toBeGreaterThan(0);
            expect(msgs[0]).toContain('occupation');
        });

        it('rejects emoji in text field', async () => {
            const msgs = await validate_data({ motivation: 'I love this 🌍' });
            expect(msgs.length).toBeGreaterThan(0);
        });

        it('rejects Cyrillic in name field', async () => {
            const msgs = await validate_data({ name: 'Иван' });
            expect(msgs.length).toBeGreaterThan(0);
        });

        it('rejects digits in a name-keyed field', async () => {
            const msgs = await validate_data({ full_name: 'John2 Doe' });
            expect(msgs.length).toBeGreaterThan(0);
        });
    });
});
