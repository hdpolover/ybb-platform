import { CommandHandler, ICommandHandler } from '@nestjs/cqrs';
import { Inject, NotFoundException } from '@nestjs/common';
import { DeleteProgramCommand } from '../delete-program.command';
import { IProgramRepository } from '@core/interfaces/repositories/program.repository.interface';
import { IUserActivityLogRepository } from '@core/interfaces/repositories/user-activity-log.repository.interface';

@CommandHandler(DeleteProgramCommand)
export class DeleteProgramHandler implements ICommandHandler<DeleteProgramCommand> {
    constructor(
        @Inject('IProgramRepository')
        private readonly programRepository: IProgramRepository,
        @Inject(IUserActivityLogRepository)
        private readonly activityLogRepository: IUserActivityLogRepository,
    ) {}

    async execute(command: DeleteProgramCommand): Promise<void> {
        const { programId, userId } = command;

        const existingProgram = await this.programRepository.findById(programId);
        if (!existingProgram) {
            throw new NotFoundException(`Program with ID ${programId} not found`);
        }

        await this.programRepository.delete(programId);

        // Log activity
        await this.activityLogRepository.create({
            id: undefined,
            userId: userId,
            activityType: 'DELETE_PROGRAM',
            activityCategory: 'PROGRAM',
            activityData: {
                programId: programId,
                programName: existingProgram.name,
            },
            pageUrl: null,
            referrerUrl: null,
            sessionId: null,
            ipAddress: null,
            userAgent: null,
            deviceType: null,
            createdAt: new Date(),
        } as any);
    }
}
