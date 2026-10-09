// src/modules/portal/application/commands/handlers/join-portal-program.handler.spec.ts
import { Test, TestingModule } from '@nestjs/testing';
import { BadRequestException } from '@nestjs/common';
import { JoinPortalProgramHandler } from './join-portal-program.handler';
import { PrismaService } from '@shared/infrastructure/prisma/prisma.service';
import { CacheService } from '@shared/infrastructure/cache/cache.service';
import { MetaCapiService } from '../../../../meta/meta-capi.service';
import { JoinPortalProgramCommand } from '../../queries/portal-queries';
import {
    ensureParticipantExists,
    ensureProgramApplication,
} from '../../../../auth/application/services/auth-program-linking.util';
import { invalidateParticipantPortalCache } from '@shared/utils/invalidate-participant-portal-cache.util';

jest.mock('../../../../auth/application/services/auth-program-linking.util', () => ({
    ...jest.requireActual('../../../../auth/application/services/auth-program-linking.util'),
    ensureParticipantExists: jest.fn(),
    ensureProgramApplication: jest.fn(),
}));
jest.mock('@shared/utils/invalidate-participant-portal-cache.util', () => ({
    invalidateParticipantPortalCache: jest.fn().mockResolvedValue(undefined),
}));

const program = { id: 'program-1', name: 'MEYS 7th' };
const command = new JoinPortalProgramCommand('user-1', 'brand-1', 'a@b.co', 'program-1');

describe('JoinPortalProgramHandler', () => {
    let handler: JoinPortalProgramHandler;
    const metaCapi = {} as MetaCapiService;

    beforeEach(async () => {
        jest.clearAllMocks();
        const module: TestingModule = await Test.createTestingModule({
            providers: [
                JoinPortalProgramHandler,
                { provide: PrismaService, useValue: {} },
                { provide: CacheService, useValue: {} },
                { provide: MetaCapiService, useValue: metaCapi },
            ],
        }).compile();
        handler = module.get(JoinPortalProgramHandler);
        (ensureParticipantExists as jest.Mock).mockResolvedValue({ id: 'participant-1' });
    });

    it('creates the application without the login guard and busts the portal cache', async () => {
        (ensureProgramApplication as jest.Mock).mockResolvedValue({
            status: 'created',
            program,
            applicationId: 'app-1',
        });

        const result = await handler.execute(command);

        expect(result).toEqual({ status: 'created', programId: 'program-1', programName: 'MEYS 7th' });
        const params = (ensureProgramApplication as jest.Mock).mock.calls[0][1];
        expect(params).toEqual({
            participantId: 'participant-1',
            brandId: 'brand-1',
            programId: 'program-1',
            metaCapiService: metaCapi,
            userEmail: 'a@b.co',
            userId: 'user-1',
        });
        expect(params.skipCreateIfBrandApplicationExists).toBeUndefined();
        expect(invalidateParticipantPortalCache).toHaveBeenCalledTimes(1);
        expect((invalidateParticipantPortalCache as jest.Mock).mock.calls[0].slice(2)).toEqual([
            'participant-1',
            'user-1',
        ]);
    });

    it('returns existing without touching the cache', async () => {
        (ensureProgramApplication as jest.Mock).mockResolvedValue({ status: 'existing', program });

        const result = await handler.execute(command);

        expect(result.status).toBe('existing');
        expect(invalidateParticipantPortalCache).not.toHaveBeenCalled();
    });

    it('returns closed without touching the cache', async () => {
        (ensureProgramApplication as jest.Mock).mockResolvedValue({ status: 'closed', program });

        const result = await handler.execute(command);

        expect(result.status).toBe('closed');
        expect(invalidateParticipantPortalCache).not.toHaveBeenCalled();
    });

    it('propagates the rejection for a program from another brand', async () => {
        (ensureProgramApplication as jest.Mock).mockRejectedValue(
            new BadRequestException('Program does not belong to the selected brand'),
        );

        await expect(handler.execute(command)).rejects.toThrow(BadRequestException);
        expect(invalidateParticipantPortalCache).not.toHaveBeenCalled();
    });

    it('rejects defensively on missing_target', async () => {
        (ensureProgramApplication as jest.Mock).mockResolvedValue({ status: 'missing_target' });

        await expect(handler.execute(command)).rejects.toThrow(BadRequestException);
        expect(invalidateParticipantPortalCache).not.toHaveBeenCalled();
    });
});
