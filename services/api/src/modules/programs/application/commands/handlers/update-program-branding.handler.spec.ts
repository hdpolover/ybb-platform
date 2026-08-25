import { Test, TestingModule } from '@nestjs/testing';
import { BadRequestException, NotFoundException } from '@nestjs/common';
import { UpdateProgramBrandingHandler } from './update-program-branding.handler';
import { UpdateProgramBrandingCommand } from '../update-program-branding.command';
import { StorageService } from '../../../../files/application/storage.service';
import { PrismaService } from '@shared/infrastructure/prisma/prisma.service';
import { LandingCacheInvalidationService } from '../../../../brands/application/services/landing-cache-invalidation.service';

describe('UpdateProgramBrandingHandler', () => {
    let handler: UpdateProgramBrandingHandler;
    let storageService: jest.Mocked<Partial<StorageService>>;
    let prisma: any;
    let landingCacheInvalidation: jest.Mocked<Partial<LandingCacheInvalidationService>>;

    beforeEach(async () => {
        storageService = {
            uploadFile: jest.fn(),
        };
        prisma = {
            program: { findUnique: jest.fn(), update: jest.fn() },
        };
        landingCacheInvalidation = {
            invalidate: jest.fn().mockResolvedValue(undefined),
        };

        const module: TestingModule = await Test.createTestingModule({
            providers: [
                UpdateProgramBrandingHandler,
                { provide: StorageService, useValue: storageService },
                { provide: PrismaService, useValue: prisma },
                { provide: LandingCacheInvalidationService, useValue: landingCacheInvalidation },
            ],
        }).compile();

        handler = module.get<UpdateProgramBrandingHandler>(UpdateProgramBrandingHandler);
    });

    it('throws NotFoundException when the program does not exist', async () => {
        prisma.program.findUnique.mockResolvedValue(null);
        const command = new UpdateProgramBrandingCommand('prog-missing', {}, 'user-1', {});

        await expect(handler.execute(command)).rejects.toThrow(NotFoundException);
    });

    it('returns the program unchanged and skips invalidation when no files are provided', async () => {
        const program = { id: 'prog-1', brandId: 'brand-1' };
        prisma.program.findUnique.mockResolvedValue(program);
        const command = new UpdateProgramBrandingCommand('prog-1', {}, 'user-1', {});

        const result = await handler.execute(command);

        expect(result).toBe(program);
        expect(landingCacheInvalidation.invalidate).not.toHaveBeenCalled();
    });

    // Audit: this handler cleared only the Redis brand + program:* keys with a
    // bare try/catch — it never cleared the Postgres snapshot and never fired
    // the Next.js revalidate hook, so a new logo/banner/thumbnail stayed
    // publicly stale past the cache TTL.
    it('invalidates landing caches via the shared service with the home+settings revalidate hook after a logo upload', async () => {
        const program = { id: 'prog-1', brandId: 'brand-42' };
        prisma.program.findUnique.mockResolvedValue(program);
        (storageService.uploadFile as jest.Mock).mockResolvedValue({ url: 'https://cdn.example/logo.png' });
        prisma.program.update.mockResolvedValue({ ...program, logoUrl: 'https://cdn.example/logo.png' });

        const logo = { originalname: 'logo.png' } as unknown as Express.Multer.File;
        const command = new UpdateProgramBrandingCommand('prog-1', {}, 'user-1', { logo });

        await handler.execute(command);

        expect(landingCacheInvalidation.invalidate).toHaveBeenCalledWith('brand-42', {
            clearSnapshot: true,
            bustProgramCache: true,
            swallowErrors: true,
            revalidate: { kind: 'homeAndSettings' },
        });
    });

    // --- Clear-logo/banner/thumbnail feature ---

    const runClear = (dto: Record<string, unknown>) =>
        handler.execute(new UpdateProgramBrandingCommand('prog-1', dto as any, 'user-1', {}));

    it('clear-only request writes null and invalidates via the shared cache service', async () => {
        const program = { id: 'prog-1', brandId: 'brand-1' };
        prisma.program.findUnique.mockResolvedValue(program);
        prisma.program.update.mockResolvedValue({ ...program, logoUrl: null });

        const result = await runClear({ clearLogo: true });

        expect(prisma.program.update).toHaveBeenCalledWith({
            where: { id: 'prog-1' },
            data: { logoUrl: null },
        });
        expect(landingCacheInvalidation.invalidate).toHaveBeenCalledWith('brand-1', {
            clearSnapshot: true,
            bustProgramCache: true,
            swallowErrors: true,
            revalidate: { kind: 'homeAndSettings' },
        });
        expect((result as any).logoUrl).toBeNull();
    });

    it('the string "false" does not clear the logo', async () => {
        // Simulates a DTO that was NOT run through the multipart boolean
        // Transform (or a caller passing the raw string) — must not be
        // treated as truthy.
        const program = { id: 'prog-1', brandId: 'brand-1' };
        prisma.program.findUnique.mockResolvedValue(program);

        await runClear({ clearLogo: 'false' as unknown as boolean });

        expect(prisma.program.update).not.toHaveBeenCalled();
        expect(landingCacheInvalidation.invalidate).not.toHaveBeenCalled();
    });

    it('rejects a request that both uploads and clears the same asset', async () => {
        const program = { id: 'prog-1', brandId: 'brand-1' };
        prisma.program.findUnique.mockResolvedValue(program);
        const files = { logo: { originalname: 'new.png' } as any };

        await expect(
            handler.execute(new UpdateProgramBrandingCommand('prog-1', { clearLogo: true } as any, 'user-1', files)),
        ).rejects.toThrow(BadRequestException);
        expect(prisma.program.update).not.toHaveBeenCalled();
    });

    it('clearing one asset leaves the others untouched', async () => {
        const program = { id: 'prog-1', brandId: 'brand-1' };
        prisma.program.findUnique.mockResolvedValue(program);
        prisma.program.update.mockResolvedValue({ ...program, bannerUrl: null });

        await runClear({ clearBanner: true });

        expect(prisma.program.update).toHaveBeenCalledWith({
            where: { id: 'prog-1' },
            data: { bannerUrl: null },
        });
        const data = prisma.program.update.mock.calls[0][0].data;
        expect(data).not.toHaveProperty('logoUrl');
        expect(data).not.toHaveProperty('thumbnailUrl');
    });
});
