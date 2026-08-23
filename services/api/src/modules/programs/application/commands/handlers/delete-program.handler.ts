import { CommandHandler, ICommandHandler } from '@nestjs/cqrs';
import { Inject, NotFoundException } from '@nestjs/common';
import { DeleteProgramCommand } from '../delete-program.command';
import { IProgramRepository } from '@core/interfaces/repositories/program.repository.interface';
import { IUserActivityLogRepository } from '@core/interfaces/repositories/user-activity-log.repository.interface';
import { UserActivityLog } from '@core/entities/user-activity-log.entity';
import { LandingCacheInvalidationService } from '../../../../brands/application/services/landing-cache-invalidation.service';

@CommandHandler(DeleteProgramCommand)
export class DeleteProgramHandler implements ICommandHandler<DeleteProgramCommand> {
    constructor(
        @Inject('IProgramRepository')
        private readonly programRepository: IProgramRepository,
        @Inject(IUserActivityLogRepository)
        private readonly activityLogRepository: IUserActivityLogRepository,
        private readonly landingCacheInvalidation: LandingCacheInvalidationService,
    ) {}

    async execute(command: DeleteProgramCommand): Promise<void> {
        const { programId, userId } = command;

        const existingProgram = await this.programRepository.findById(programId);
        if (!existingProgram) {
            throw new NotFoundException(`Program with ID ${programId} not found`);
        }

        await this.programRepository.delete(programId);

        // Bust all three landing cache layers. Audit found this handler
        // only cleared Redis and never fired the Next.js revalidate hook, so
        // a deleted program stayed visible on the public landing page.
        await this.landingCacheInvalidation.invalidate(existingProgram.brandId, {
            clearSnapshot: true,
            bustProgramCache: true,
            swallowErrors: true,
            revalidate: { kind: 'homeAndSettings' },
        });

        // Log activity
        await this.activityLogRepository.create(new UserActivityLog(
            undefined as unknown as string,
            userId,
            'DELETE_PROGRAM',
            'PROGRAM',
            {
                programId: programId,
                programName: existingProgram.name,
            },
            null,
            null,
            null,
            null,
            null,
            null,
            new Date(),
        ));
    }
}
