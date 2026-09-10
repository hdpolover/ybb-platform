import { CommandHandler, ICommandHandler } from '@nestjs/cqrs';
import { Inject, NotFoundException, BadRequestException } from '@nestjs/common';
import { UpdateProgramCommand } from '../update-program.command';
import { IProgramRepository } from '@core/interfaces/repositories/program.repository.interface';
import { IUserActivityLogRepository } from '@core/interfaces/repositories/user-activity-log.repository.interface';
import { UserActivityLog } from '@core/entities/user-activity-log.entity';
import { LandingCacheInvalidationService } from '../../../../brands/application/services/landing-cache-invalidation.service';
import { assertProgramDeadlineOrder } from '../../validators/program-deadline-order.validator';
import { deriveProgramStatus } from '../../validators/derive-program-status.util';

const DEADLINE_ORDER_FIELDS = ['registrationOpenDate', 'registrationCloseDate', 'applicationDeadline'] as const;

@CommandHandler(UpdateProgramCommand)
export class UpdateProgramHandler implements ICommandHandler<UpdateProgramCommand> {
    constructor(
        @Inject('IProgramRepository')
        private readonly programRepository: IProgramRepository,
        @Inject(IUserActivityLogRepository)
        private readonly activityLogRepository: IUserActivityLogRepository,
        private readonly landingCacheInvalidation: LandingCacheInvalidationService,
    ) { }

    async execute(command: UpdateProgramCommand): Promise<any> {
        const { programId, updateProgramDto, userId } = command;

        const existingProgram = await this.programRepository.findById(programId);
        if (!existingProgram) {
            throw new NotFoundException(`Program with ID ${programId} not found`);
        }

        // Audit M8: this used to regenerate the slug from `name` on every
        // update that omitted an explicit slug, so renaming a program
        // silently rewrote its already-shared public/admin URL. The slug now
        // only ever changes when the client explicitly sends `slug`.
        const programData: Record<string, unknown> = { ...updateProgramDto };
        if (programData.startDate) programData.startDate = new Date(programData.startDate as string);
        if (programData.endDate) programData.endDate = new Date(programData.endDate as string);
        if (programData.applicationDeadline) programData.applicationDeadline = new Date(programData.applicationDeadline as string);
        if (programData.registrationOpenDate) programData.registrationOpenDate = new Date(programData.registrationOpenDate as string);
        if (programData.registrationCloseDate) programData.registrationCloseDate = new Date(programData.registrationCloseDate as string);

        // Only validate when this request actually touches one of the three date
        // fields; an already-misconfigured program must stay editable on unrelated
        // fields. `in` (not truthiness) so an explicit `null` still counts as touched.
        const touchesDeadlineFields = DEADLINE_ORDER_FIELDS.some((field) => field in updateProgramDto);
        if (touchesDeadlineFields) {
            const mergedDate = (field: typeof DEADLINE_ORDER_FIELDS[number]): Date | null | undefined =>
                field in updateProgramDto
                    ? (programData[field] as Date | null | undefined)
                    : existingProgram[field];
            assertProgramDeadlineOrder({
                registrationOpenDate: mergedDate('registrationOpenDate'),
                registrationCloseDate: mergedDate('registrationCloseDate'),
                applicationDeadline: mergedDate('applicationDeadline'),
            });
        }

        // Publishing moved to POST /programs/:id/publish so it can run the
        // readiness guard. Any caller still sending isPublished here is a caller
        // that would silently bypass that guard.
        if ('isPublished' in (updateProgramDto as Record<string, unknown>)) {
            throw new BadRequestException(
                'isPublished is no longer accepted here. Use POST /programs/:id/publish or /unpublish.',
            );
        }

        // If this request flips isPublished/isActive true without also sending
        // status, and the program is still 'draft', advance status alongside
        // it so the two can't drift apart (see derive-program-status.util.ts —
        // this is the write path that caused the MEYS 7th incident).
        const derivedStatus = deriveProgramStatus(existingProgram.status, updateProgramDto);
        if (derivedStatus !== undefined) {
            programData.status = derivedStatus;
        }

        // A slug collision surfaces as a 409 from the global
        // HttpExceptionFilter's P2002 mapping, which names the offending field.
        // Catching it here would relabel every unique violation on this write
        // as a slug collision, so it is deliberately left to the filter.
        const updatedProgram = await this.programRepository.update(programId, programData);

        // Log activity
        await this.activityLogRepository.create(new UserActivityLog(
            undefined as unknown as string,
            userId,
            'UPDATE_PROGRAM',
            'PROGRAM',
            {
                programId: updatedProgram.id,
                programName: updatedProgram.name,
                changes: updateProgramDto,
            },
            null,
            null,
            null,
            null,
            null,
            null,
            new Date(),
        ));

        // Bust all three landing cache layers (Postgres snapshot, Redis
        // including program:*, and the participant frontend's Next.js
        // unstable_cache home+settings pages) so the update is immediately
        // visible instead of waiting out the cache TTL.
        await this.landingCacheInvalidation.invalidate(updatedProgram.brandId, {
            clearSnapshot: true,
            bustProgramCache: true,
            swallowErrors: true,
            revalidate: { kind: 'homeAndSettings' },
        });

        const { brandId, ...rest } = updatedProgram as unknown as Record<string, unknown>;
        return {
            ...rest,
            brandId: brandId,
        };
    }
}
