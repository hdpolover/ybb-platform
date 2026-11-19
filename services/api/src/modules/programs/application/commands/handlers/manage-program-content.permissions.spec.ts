// services/api/src/modules/programs/application/commands/handlers/manage-program-content.permissions.spec.ts
//
// One handler per content family enforced in ef5491af: an in-scope admin
// without the family's write permission gets a 403 before any repository,
// storage or Prisma write; a holder of the set and the platform tier pass the
// check. Only the persistence edges are faked; the scope and permission checks
// run for real against a fake PrismaReadService.
import { ForbiddenException } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { PrismaReadService } from '@shared/infrastructure/prisma/prisma-read.service';
import { PrismaService } from '@shared/infrastructure/prisma/prisma.service';
import { CacheService } from '@shared/infrastructure/cache/cache.service';
import { IUserActivityLogRepository } from '@core/interfaces/repositories/user-activity-log.repository.interface';
import { StorageService } from '../../../../files/application/storage.service';
import { LandingCacheInvalidationService } from '../../../../brands/application/services/landing-cache-invalidation.service';
import { CONTENT_WRITE_PERMISSIONS } from '../../utils/program-content-access.util';
import {
    CreateDocumentTemplateHandler,
    CreateProgramEssayHandler,
    CreateProgramFaqHandler,
    CreateProgramGalleryHandler,
    CreateProgramPartnerHandler,
    CreateProgramPricingTierHandler,
    CreateProgramRequirementHandler,
    CreateProgramResourceHandler,
    CreateProgramSpeakerHandler,
    CreateProgramTestimonialHandler,
    CreateProgramTimelineHandler,
    CreateProgramTeamHandler,
    DeleteProgramFaqHandler,
    DeleteProgramTeamHandler,
    DeleteProgramTestimonialHandler,
    UpdateProgramScheduleHandler,
    UpdateProgramTeamHandler,
    UpdateProgramTestimonialHandler,
} from './manage-program-content.handlers';
import {
    CreateDocumentTemplateCommand,
    CreateProgramEssayCommand,
    CreateProgramFaqCommand,
    CreateProgramGalleryCommand,
    CreateProgramPartnerCommand,
    CreateProgramPricingTierCommand,
    CreateProgramRequirementCommand,
    CreateProgramResourceCommand,
    CreateProgramSpeakerCommand,
    CreateProgramTestimonialCommand,
    CreateProgramTimelineCommand,
    CreateProgramTeamCommand,
    DeleteProgramFaqCommand,
    DeleteProgramTeamCommand,
    DeleteProgramTestimonialCommand,
    UpdateProgramScheduleCommand,
    UpdateProgramTeamCommand,
    UpdateProgramTestimonialCommand,
} from '../program-content.commands';

const PROGRAM_ID = 'prog-1';
const actor = { userId: 'user-1', email: 'a@b.c', brandId: 'brand-1', adminId: 'adm-1' } as never;
const dto = { programId: PROGRAM_ID } as never;

type Family = keyof typeof CONTENT_WRITE_PERMISSIONS;
type Case = [string, Family, new (...args: never[]) => { execute(command: unknown): Promise<unknown> }, () => unknown];

const cases: Case[] = [
    ['timelines: CreateProgramTimelineHandler', 'programConfig', CreateProgramTimelineHandler, () => new CreateProgramTimelineCommand(dto, 'user-1', actor)],
    ['schedules: UpdateProgramScheduleHandler (row-keyed)', 'programConfig', UpdateProgramScheduleHandler, () => new UpdateProgramScheduleCommand('row-1', {} as never, 'user-1', actor)],
    ['speakers: CreateProgramSpeakerHandler', 'content', CreateProgramSpeakerHandler, () => new CreateProgramSpeakerCommand(dto, 'user-1', actor)],
    ['testimonials: CreateProgramTestimonialHandler', 'content', CreateProgramTestimonialHandler, () => new CreateProgramTestimonialCommand(dto, 'user-1', actor)],
    ['FAQs: CreateProgramFaqHandler', 'content', CreateProgramFaqHandler, () => new CreateProgramFaqCommand(dto, 'user-1', actor)],
    ['FAQs: DeleteProgramFaqHandler (row-keyed)', 'content', DeleteProgramFaqHandler, () => new DeleteProgramFaqCommand('row-1', 'user-1', actor)],
    ['gallery: CreateProgramGalleryHandler', 'gallery', CreateProgramGalleryHandler, () => new CreateProgramGalleryCommand(dto, 'user-1', actor)],
    ['partners: CreateProgramPartnerHandler', 'partners', CreateProgramPartnerHandler, () => new CreateProgramPartnerCommand(dto, 'user-1', actor)],
    ['resources: CreateProgramResourceHandler', 'documents', CreateProgramResourceHandler, () => new CreateProgramResourceCommand(dto, 'user-1', actor)],
    ['LOA templates: CreateDocumentTemplateHandler', 'documents', CreateDocumentTemplateHandler, () => new CreateDocumentTemplateCommand(dto, 'user-1', actor)],
    ['pricing: CreateProgramPricingTierHandler', 'pricing', CreateProgramPricingTierHandler, () => new CreateProgramPricingTierCommand(dto, 'user-1', actor)],
    ['submission form: CreateProgramEssayHandler', 'submissionForm', CreateProgramEssayHandler, () => new CreateProgramEssayCommand(dto, 'user-1', actor)],
    ['submission form: CreateProgramRequirementHandler', 'submissionForm', CreateProgramRequirementHandler, () => new CreateProgramRequirementCommand(dto, 'user-1', actor)],
];

// Every content write permission; each case drops its own family's set from it,
// so the refusal proves the family set is checked, not just "any write".
const ALL_WRITE_PERMISSIONS: string[] = [...new Set(Object.values(CONTENT_WRITE_PERMISSIONS).flat())];

const inScopeAdmin = (permissions: string[]) => ({
    accessLevel: 1,
    canManageAdmins: false,
    canAssignRoles: false,
    customPermissions: [],
    role: { name: 'Scoped', permissions },
    adminBrands: [],
    adminPrograms: [{ programId: PROGRAM_ID, permissions: [] }],
});
const PLATFORM_ACCESS_ADMIN = { ...inScopeAdmin(['platform_access']), adminPrograms: [] };

// Testimonials and team members can belong to a brand with no program: those
// branches only checked brand scope, so any brand admin could write them.
const BRAND_ID = 'brand-1';
const brandAdmin = (permissions: string[]) => ({ ...inScopeAdmin(permissions), accessLevel: 3, adminBrands: [{ brandId: BRAND_ID, permissions: [] }], adminPrograms: [] });
const brandDto = { brandId: BRAND_ID } as never;
const brandCases: Array<[string, Case[2], () => unknown]> = [
    ['CreateProgramTestimonialHandler', CreateProgramTestimonialHandler, () => new CreateProgramTestimonialCommand(brandDto, 'user-1', actor)],
    ['UpdateProgramTestimonialHandler', UpdateProgramTestimonialHandler, () => new UpdateProgramTestimonialCommand('row-1', {} as never, 'user-1', actor)],
    ['DeleteProgramTestimonialHandler', DeleteProgramTestimonialHandler, () => new DeleteProgramTestimonialCommand('row-1', 'user-1', actor)],
    ['CreateProgramTeamHandler', CreateProgramTeamHandler, () => new CreateProgramTeamCommand(brandDto, 'user-1', actor)],
    ['UpdateProgramTeamHandler', UpdateProgramTeamHandler, () => new UpdateProgramTeamCommand('row-1', {} as never, 'user-1', actor)],
    ['DeleteProgramTeamHandler', DeleteProgramTeamHandler, () => new DeleteProgramTeamCommand('row-1', 'user-1', actor)],
];

describe('content handlers refuse a missing write permission before any write', () => {
    const repo: Record<string, jest.Mock> = {};
    const storage = { uploadFile: jest.fn() };
    const prisma = { program: { findUnique: jest.fn() } };
    const prismaRead = {
        admin: { findUnique: jest.fn() },
        program: { findUnique: jest.fn().mockResolvedValue({ id: PROGRAM_ID, brandId: 'brand-1', name: 'P', deletedAt: null }) },
    };

    // Reads resolve the row to PROGRAM_ID (or `row`); anything else is a write and records the call.
    let row: Record<string, unknown> = { id: 'row-1', programId: PROGRAM_ID };
    const repository = new Proxy(repo, {
        get(target, key) {
            if (typeof key !== 'string' || key === 'then') return undefined;
            target[key] ??= jest.fn().mockImplementation(async () => row);
            return target[key];
        },
    });

    async function build(HandlerCtor: Case[2]) {
        const module = await Test.createTestingModule({
            providers: [
                HandlerCtor,
                { provide: 'IProgramContentRepository', useValue: repository },
                { provide: StorageService, useValue: storage },
                { provide: PrismaService, useValue: prisma },
                { provide: CacheService, useValue: { del: jest.fn(), delPattern: jest.fn(), invalidatePattern: jest.fn() } },
                { provide: LandingCacheInvalidationService, useValue: { invalidate: jest.fn() } },
                { provide: IUserActivityLogRepository, useValue: { create: jest.fn() } },
                { provide: PrismaReadService, useValue: prismaRead },
            ],
        }).compile();
        return module.get(HandlerCtor);
    }

    const writesMade = () =>
        Object.entries(repo)
            .filter(([name, fn]) => !name.startsWith('find') && fn.mock.calls.length > 0)
            .map(([name]) => name);

    beforeEach(() => {
        for (const key of Object.keys(repo)) delete repo[key];
        row = { id: 'row-1', programId: PROGRAM_ID };
        jest.clearAllMocks();
    });

    it.each(cases)('%s: 403 without its set, nothing written', async (_name, family, HandlerCtor, command) => {
        const required: readonly string[] = CONTENT_WRITE_PERMISSIONS[family];
        prismaRead.admin.findUnique.mockResolvedValue(inScopeAdmin(ALL_WRITE_PERMISSIONS.filter((p) => !required.includes(p)).concat('applications:write')));
        const handler = await build(HandlerCtor);

        await expect(handler.execute(command())).rejects.toBeInstanceOf(ForbiddenException);
        expect(writesMade()).toEqual([]);
        expect(storage.uploadFile).not.toHaveBeenCalled();
    });

    // Passing the check is all this asserts: what the handler does next is
    // covered by manage-program-content.handlers.spec.ts.
    it.each(cases)('%s: the permission check passes with its set and for the platform tier', async (_name, family, HandlerCtor, command) => {
        for (const admin of [inScopeAdmin([...CONTENT_WRITE_PERMISSIONS[family]]), PLATFORM_ACCESS_ADMIN]) {
            prismaRead.admin.findUnique.mockResolvedValue(admin);
            const handler = await build(HandlerCtor);
            const outcome = await handler.execute(command()).catch((error: unknown) => error);
            expect(outcome).not.toBeInstanceOf(ForbiddenException);
        }
    });

    describe('brand-level testimonials and team members (no program)', () => {
        beforeEach(() => {
            row = { id: 'row-1', programId: null, brandId: BRAND_ID };
        });

        it.each(brandCases)('%s: a brand admin without the content set gets 403, nothing written', async (_name, HandlerCtor, command) => {
            prismaRead.admin.findUnique.mockResolvedValue(brandAdmin(['applications:write', 'announcements:write']));
            const handler = await build(HandlerCtor);
            await expect(handler.execute(command())).rejects.toBeInstanceOf(ForbiddenException);
            expect(writesMade()).toEqual([]);
        });

        it.each(brandCases)('%s: content:write on the brand and the platform tier pass the check', async (_name, HandlerCtor, command) => {
            for (const admin of [brandAdmin(['content:write']), PLATFORM_ACCESS_ADMIN]) {
                prismaRead.admin.findUnique.mockResolvedValue(admin);
                const handler = await build(HandlerCtor);
                const outcome = await handler.execute(command()).catch((error: unknown) => error);
                expect(outcome).not.toBeInstanceOf(ForbiddenException);
            }
        });
    });
});
