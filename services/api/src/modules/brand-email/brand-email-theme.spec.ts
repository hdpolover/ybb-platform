// src/modules/brand-email/brand-email-theme.spec.ts
import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { NEUTRAL_COLOR, resolveEmailTheme } from './brand-email-theme';
import { BrandEmailThemeDto } from './dto/brand-email-theme.dto';

const brand = { name: 'Japan Youth Summit', slug: 'japan-youth-summit', primaryColor: '#AA0000', logoUrl: 'https://c.example.com/l.png', supportEmail: 'help@jys.example.com' };

describe('resolveEmailTheme', () => {
    it('falls back to brand fields when nothing is stored', () => {
        const t = resolveEmailTheme(brand, null);
        expect(t.fromName).toBe('Japan Youth Summit');
        expect(t.fromLocalPart).toBe('japan-youth-summit');
        expect(t.replyTo).toBe('help@jys.example.com');
        expect(t.primaryColor).toBe('#AA0000');
        expect(t.secondaryColor).toBe('#AA0000');
        expect(t.logoUrl).toBe(brand.logoUrl);
        expect(t.buttonStyle).toBe('rounded');
    });

    it('uses a neutral color when the brand has none or an invalid one', () => {
        expect(resolveEmailTheme({ ...brand, primaryColor: null }, null).primaryColor).toBe(NEUTRAL_COLOR);
        expect(resolveEmailTheme({ ...brand, primaryColor: 'blue' }, null).primaryColor).toBe(NEUTRAL_COLOR);
    });

    it('stored values win over defaults', () => {
        const t = resolveEmailTheme(brand, { fromName: 'JYS Team', fromLocalPart: 'jys', replyTo: 'x@y.com', secondaryColor: '#00FF00', buttonStyle: 'pill' });
        expect([t.fromName, t.fromLocalPart, t.replyTo, t.secondaryColor, t.buttonStyle]).toEqual(['JYS Team', 'jys', 'x@y.com', '#00FF00', 'pill']);
    });

    it('keeps only https-able social entries as raw pairs and ignores non-objects', () => {
        expect(resolveEmailTheme({ ...brand, socialMediaLinks: { instagram: 'https://i.example.com', facebook: '' } }, null).socialLinks).toHaveLength(1);
        expect(resolveEmailTheme({ ...brand, socialMediaLinks: [] }, null).socialLinks).toEqual([]);
    });
});

describe('BrandEmailThemeDto', () => {
    const check = async (payload: Record<string, unknown>) => validate(plainToInstance(BrandEmailThemeDto, payload));

    it('accepts an empty object and a full valid one', async () => {
        expect(await check({})).toHaveLength(0);
        expect(
            await check({ fromName: 'KYS', fromLocalPart: 'kys.news', replyTo: 'a@b.com', bannerUrl: 'https://c.example.com/b.png', footerText: 'hi', secondaryColor: '#12abEF', buttonStyle: 'square' }),
        ).toHaveLength(0);
    });

    it('treats empty strings as unset', async () => {
        const dto = plainToInstance(BrandEmailThemeDto, { fromName: '', replyTo: '', bannerUrl: null });
        expect(await validate(dto)).toHaveLength(0);
        expect(dto.replyTo).toBeUndefined();
    });

    it.each([
        ['fromName', 'x'.repeat(61)],
        ['fromLocalPart', 'Upper'],
        ['fromLocalPart', '-lead'],
        ['fromLocalPart', 'a'.repeat(32)],
        ['replyTo', 'not-an-email'],
        ['bannerUrl', 'http://insecure.example.com/b.png'],
        ['bannerUrl', 'javascript:alert(1)'],
        ['footerText', 'x'.repeat(501)],
        ['secondaryColor', '#abc'],
        ['secondaryColor', 'red'],
        ['buttonStyle', 'triangle'],
    ])('rejects invalid %s (%s)', async (field, value) => {
        const errors = await check({ [field]: value });
        expect(errors.map((e) => e.property)).toContain(field);
    });
});
