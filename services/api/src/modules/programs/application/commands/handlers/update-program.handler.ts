import { CommandHandler, ICommandHandler } from '@nestjs/cqrs';
import { Inject, NotFoundException } from '@nestjs/common';
import { UpdateProgramCommand } from '../update-program.command';
import { IProgramRepository } from '@core/interfaces/repositories/program.repository.interface';
import { Program } from '@core/entities/program.entity';
import { IUserActivityLogRepository } from '@core/interfaces/repositories/user-activity-log.repository.interface';
import { UserActivityLog } from '@core/entities/user-activity-log.entity';
import { LandingCacheInvalidationService } from '../../../../brands/application/services/landing-cache-invalidation.service';
import { assertProgramDeadlineOrder } from '../../validators/program-deadline-order.validator';

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

        if (updateProgramDto.name && !updateProgramDto.slug) {
            updateProgramDto.slug = this.generateSlug(updateProgramDto.name);
        }

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

    private generateSlug(text: string): string {
        // Cap at the Program.slug column limit (VarChar(255), see prisma/schema/program.prisma).
        // Not routed through shared/utils/auto-slug.ts: that util is separator-incompatible
        // here (underscore-joined, built for form-field keys) and would rewrite every
        // program slug off its established hyphenated convention (e.g. "world-youth-fest").
        // This transform chain only ever removes characters, so slicing after is a safe
        // hard cap, not a truncation that changes earlier chars.
        return text
            .toString()
            .toLowerCase()
            .trim()
            .replace(/\s+/g, '-')     // Replace spaces with -
            .replace(/[^\w\-]+/g, '') // Remove all non-word chars
            .replace(/\-\-+/g, '-')  // Replace multiple - with single -
            .slice(0, 255);
    }
}
