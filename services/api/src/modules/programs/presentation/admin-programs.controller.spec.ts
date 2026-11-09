// services/api/src/modules/programs/presentation/admin-programs.controller.spec.ts
import { ValidationPipe } from '@nestjs/common';
import { AdminProgramsController } from './admin-programs.controller';
import { SetFundingDecisionDto } from './dto/funding-decision.dto';

const PROGRAM_ID = '11111111-1111-4111-8111-111111111111';
const APP_ID = '22222222-2222-4222-8222-222222222222';

describe('AdminProgramsController.setFundingDecision', () => {
    const updateMany = jest.fn();
    const controller = new AdminProgramsController({ participantApplication: { updateMany } } as never);

    beforeEach(() => {
        updateMany.mockReset().mockResolvedValue({ count: 3 });
    });

    it('only targets submitted, fully funded, live applications of the URL program', async () => {
        const result = await controller.setFundingDecision(PROGRAM_ID, { applicationIds: [APP_ID], decision: 'awarded' });

        expect(result).toEqual({ updated: 3 });
        expect(updateMany).toHaveBeenCalledWith({
            where: {
                id: { in: [APP_ID] },
                programId: PROGRAM_ID,
                applicationCategory: 'fully_funded',
                status: { not: 'draft' },
                deletedAt: null,
            },
            data: { fundingDecision: 'awarded', fundingDecidedAt: expect.any(Date) },
        });
    });

    it('clears both columns when decision is null', async () => {
        await controller.setFundingDecision(PROGRAM_ID, { applicationIds: [APP_ID], decision: null });

        expect(updateMany.mock.calls[0][0].data).toEqual({ fundingDecision: null, fundingDecidedAt: null });
    });
});

describe('SetFundingDecisionDto validation', () => {
    const pipe = new ValidationPipe({ whitelist: true, transform: true });
    const validate = (body: unknown) =>
        pipe.transform(body, { type: 'body', metatype: SetFundingDecisionDto });

    it('accepts awarded, not_awarded and null', async () => {
        for (const decision of ['awarded', 'not_awarded', null]) {
            await expect(validate({ applicationIds: [APP_ID], decision })).resolves.toBeDefined();
        }
    });

    it('rejects a missing decision key', async () => {
        await expect(validate({ applicationIds: [APP_ID] })).rejects.toThrow();
    });

    it('rejects an unknown decision', async () => {
        await expect(validate({ applicationIds: [APP_ID], decision: 'rejected' })).rejects.toThrow();
    });

    it('rejects an empty, oversized, duplicated or non-uuid id list', async () => {
        const tooMany = Array.from({ length: 1001 }, (_, i) => `00000000-0000-4000-8000-${String(i).padStart(12, '0')}`);
        await expect(validate({ applicationIds: [], decision: 'awarded' })).rejects.toThrow();
        await expect(validate({ applicationIds: tooMany, decision: 'awarded' })).rejects.toThrow();
        await expect(validate({ applicationIds: [APP_ID, APP_ID], decision: 'awarded' })).rejects.toThrow();
        await expect(validate({ applicationIds: ['nope'], decision: 'awarded' })).rejects.toThrow();
    });
});
