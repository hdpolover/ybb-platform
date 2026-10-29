// src/modules/brand-email/brand-email.service.spec.ts
import { BadGatewayException, NotFoundException, ServiceUnavailableException } from '@nestjs/common';
import { GUARDS_METADATA } from '@nestjs/common/constants';
import { JwtAuthGuard } from '@modules/auth/infrastructure/guards/jwt-auth.guard';
import { RolesGuard } from '@modules/auth/infrastructure/guards/roles.guard';
import { AdminScopeGuard, ADMIN_SCOPE_KEY } from '@shared/guards/admin-scope.guard';
import { UserRole } from '@core/entities/user.entity';
import { BrandEmailController } from './brand-email.controller';
import { BrandEmailService, sanitizeDisplayName } from './brand-email.service';
import { ListmonkClient, ListmonkError } from './listmonk.client';

const BRAND = {
    id: 'b1', name: 'Korea Youth Summit', slug: 'kys', tagline: null, websiteUrl: 'https://kys.example.com', primaryColor: '#112233',
    logoUrl: null, socialMediaLinks: {}, settings: { emailTheme: null as unknown, supportEmail: 'help@kys.example.com' },
};

function setup(configured = true) {
    // Stateful stand-in for the DB row so read-after-write behaves like Postgres.
    const row = { ...BRAND, settings: { ...BRAND.settings } };
    const prisma = {
        brand: { findFirst: jest.fn().mockImplementation(() => Promise.resolve({ ...row, settings: { ...row.settings } })) },
        program: { findFirst: jest.fn().mockResolvedValue({ id: 'p1', name: 'KYS 2027', brandId: 'b1' }) },
        brandSetting: {
            upsert: jest.fn().mockImplementation(({ update }: { update: { emailTheme: never } }) => {
                row.settings.emailTheme = update.emailTheme;
                return Promise.resolve({});
            }),
        },
    };
    const listmonk = {
        isConfigured: jest.fn().mockReturnValue(configured),
        fromDomain: jest.fn().mockReturnValue('news.example.com'),
        editUrl: jest.fn((id: number) => `https://lists.example.com/admin/campaigns/${id}`),
        upsertCampaignTemplate: jest.fn().mockResolvedValue({ id: 7, created: true }),
        findOrCreateProgramList: jest.fn().mockResolvedValue({ id: 3, created: false }),
        createDraftCampaign: jest.fn().mockResolvedValue({ id: 42 }),
    };
    const service = new BrandEmailService(prisma as never, listmonk as unknown as ListmonkClient);
    return { prisma, listmonk, service };
}

describe('BrandEmailService', () => {
    it('saves the theme and reports not_configured without calling Listmonk', async () => {
        const { service, prisma, listmonk } = setup(false);
        const res = await service.saveTheme('b1', { fromName: 'KYS Team' });
        expect(prisma.brandSetting.upsert).toHaveBeenCalledWith(expect.objectContaining({ where: { brandId: 'b1' }, create: { brandId: 'b1', emailTheme: { fromName: 'KYS Team' } } }));
        expect(listmonk.upsertCampaignTemplate).not.toHaveBeenCalled();
        expect(res.sync.state).toBe('not_configured');
        expect(res.effective.fromEmail).toBe('"KYS Team" <kys@news.example.com>');
    });

    it('syncs the template on save and records the template id', async () => {
        const { service, prisma, listmonk } = setup();
        await service.saveTheme('b1', { secondaryColor: '#00ff00' });
        expect(listmonk.upsertCampaignTemplate).toHaveBeenCalledWith('brand:kys', expect.stringContaining('{{ template "content" . }}'));
        const lastCall = prisma.brandSetting.upsert.mock.calls.at(-1)[0];
        expect(lastCall.update.emailTheme).toMatchObject({ secondaryColor: '#00ff00', sync: { state: 'synced', templateId: 7 } });
    });

    it('keeps the saved theme and records a failed sync when Listmonk errors', async () => {
        const { service, prisma, listmonk } = setup();
        listmonk.upsertCampaignTemplate.mockRejectedValue(new ListmonkError('boom', 500));
        const res = await service.saveTheme('b1', { fromName: 'X' });
        expect(prisma.brandSetting.upsert.mock.calls.at(-1)[0].update.emailTheme).toMatchObject({ fromName: 'X', sync: { state: 'failed', error: 'boom' } });
        expect(res.theme.fromName).toBe('X');
    });

    it('404s for an unknown brand', async () => {
        const { service, prisma } = setup();
        prisma.brand.findFirst.mockResolvedValue(null);
        await expect(service.getTheme('nope')).rejects.toBeInstanceOf(NotFoundException);
    });

    it('creates a draft campaign with brand template, program list and brand From', async () => {
        const { service, listmonk } = setup();
        const res = await service.createDraftCampaign('p1');
        expect(res).toEqual({ campaignId: 42, editUrl: 'https://lists.example.com/admin/campaigns/42' });
        expect(listmonk.findOrCreateProgramList).toHaveBeenCalledWith('p1', 'KYS 2027');
        expect(listmonk.createDraftCampaign).toHaveBeenCalledWith(
            expect.objectContaining({
                templateId: 7, listIds: [3], fromEmail: '"Korea Youth Summit" <kys@news.example.com>', replyTo: 'help@kys.example.com', subject: 'KYS 2027',
            }),
        );
    });

    it('maps Listmonk failures to 502 and missing config to 503', async () => {
        const a = setup();
        a.listmonk.upsertCampaignTemplate.mockRejectedValue(new ListmonkError('down', 500));
        await expect(a.service.createDraftCampaign('p1')).rejects.toBeInstanceOf(BadGatewayException);
        const b = setup(false);
        const { ListmonkNotConfiguredError } = jest.requireActual('./listmonk.client');
        b.listmonk.upsertCampaignTemplate.mockRejectedValue(new ListmonkNotConfiguredError());
        await expect(b.service.createDraftCampaign('p1')).rejects.toBeInstanceOf(ServiceUnavailableException);
    });

    it('strips header-breaking characters from the From display name', () => {
        expect(sanitizeDisplayName('Evil" <a@b.c>\r\nBcc: x')).toBe('Evil a@b.cBcc: x');
    });
});

describe('BrandEmailController guards', () => {
    const routes = ['getTheme', 'saveTheme', 'preview', 'resync', 'createDraftCampaign'] as const;

    it('applies JwtAuthGuard, RolesGuard and AdminScopeGuard at class level', () => {
        expect(Reflect.getMetadata(GUARDS_METADATA, BrandEmailController)).toEqual([JwtAuthGuard, RolesGuard, AdminScopeGuard]);
    });

    it('restricts to ADMIN and SUPER_ADMIN', () => {
        expect(Reflect.getMetadata('roles', BrandEmailController)).toEqual([UserRole.ADMIN, UserRole.SUPER_ADMIN]);
    });

    it.each(routes)('%s is brand/program scoped', (name) => {
        const meta = Reflect.getMetadata(ADMIN_SCOPE_KEY, BrandEmailController.prototype[name]);
        expect(meta).toEqual({ target: name === 'createDraftCampaign' ? 'program' : 'brand', paramName: 'id' });
    });
});
