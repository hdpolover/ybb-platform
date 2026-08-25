import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { UploadProgramBrandingDto } from './upload-content.dto';

// Multipart form fields always arrive as strings, never real booleans.
// `Boolean("false")` is `true`, so a naive DTO would clear an asset on
// every request that merely echoes the field back as "false". These specs
// pin the explicit string-literal parsing in place.

const build = (body: Record<string, unknown>) =>
    plainToInstance(UploadProgramBrandingDto, body, { enableImplicitConversion: true });

describe('UploadProgramBrandingDto (multipart boolean parsing)', () => {
    it('parses the string "true" as true', async () => {
        const dto = build({ clearLogo: 'true' });
        expect(dto.clearLogo).toBe(true);
        expect(await validate(dto)).toHaveLength(0);
    });

    it('parses the string "false" as false, not truthy', async () => {
        const dto = build({ clearLogo: 'false' });
        expect(dto.clearLogo).toBe(false);
        expect(dto.clearLogo).not.toBeTruthy();
        expect(await validate(dto)).toHaveLength(0);
    });

    it('leaves the field undefined when omitted', async () => {
        const dto = build({});
        expect(dto.clearLogo).toBeUndefined();
        expect(await validate(dto)).toHaveLength(0);
    });

    it('fails validation on a garbage string instead of silently coercing', async () => {
        const dto = build({ clearBanner: 'yes' });
        const errors = await validate(dto);
        expect(errors.some((e) => e.property === 'clearBanner')).toBe(true);
    });

    it('parses clearLogo, clearBanner, clearThumbnail independently', async () => {
        const dto = build({ clearLogo: 'true', clearBanner: 'false', clearThumbnail: 'true' });
        expect(dto.clearLogo).toBe(true);
        expect(dto.clearBanner).toBe(false);
        expect(dto.clearThumbnail).toBe(true);
        expect(await validate(dto)).toHaveLength(0);
    });
});
