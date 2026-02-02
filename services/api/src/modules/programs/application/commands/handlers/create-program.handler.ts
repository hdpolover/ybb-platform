import { CommandHandler, ICommandHandler } from '@nestjs/cqrs';
import { Inject } from '@nestjs/common';
import { CreateProgramCommand } from '../create-program.command';
import { IProgramRepository } from '@core/interfaces/repositories/program.repository.interface';
import { Program } from '@core/entities/program.entity';
import { IUserActivityLogRepository } from '@core/interfaces/repositories/user-activity-log.repository.interface';

@CommandHandler(CreateProgramCommand)
export class CreateProgramHandler implements ICommandHandler<CreateProgramCommand> {
    constructor(
        @Inject('IProgramRepository')
        private readonly programRepository: IProgramRepository,
        @Inject(IUserActivityLogRepository)
        private readonly activityLogRepository: IUserActivityLogRepository,
    ) {}

    async execute(command: CreateProgramCommand): Promise<any> {
        const { createProgramDto, userId } = command;
        
        if (!createProgramDto.slug) {
            createProgramDto.slug = this.generateSlug(createProgramDto.name);
        }

        const programData: any = { ...createProgramDto };
        if (programData.startDate) programData.startDate = new Date(programData.startDate);
        if (programData.endDate) programData.endDate = new Date(programData.endDate);
        if (programData.applicationDeadline) programData.applicationDeadline = new Date(programData.applicationDeadline);
        if (programData.registrationOpenDate) programData.registrationOpenDate = new Date(programData.registrationOpenDate);
        if (programData.registrationCloseDate) programData.registrationCloseDate = new Date(programData.registrationCloseDate);
        
        // Map brandId to brandId
        if (programData.brandId) {
            programData.brandId = programData.brandId;
            delete programData.brandId;
        }

        const program = await this.programRepository.create(programData);

        // Log activity
        await this.activityLogRepository.create({
            id: undefined, // Let DB generate ID
            userId: userId,
            activityType: 'CREATE_PROGRAM',
            activityCategory: 'PROGRAM',
            activityData: {
                programId: program.id,
                programName: program.name,
            },
            pageUrl: null,
            referrerUrl: null,
            sessionId: null,
            ipAddress: null,
            userAgent: null,
            deviceType: null,
            createdAt: new Date(),
        } as any);

        const { brandId, ...rest } = program as any;
        return {
            ...rest,
            brandId: brandId,
        };
    }

    private generateSlug(text: string): string {
        return text
            .toString()
            .toLowerCase()
            .trim()
            .replace(/\s+/g, '-')     // Replace spaces with -
            .replace(/[^\w\-]+/g, '') // Remove all non-word chars
            .replace(/\-\-+/g, '-');  // Replace multiple - with single -
    }
}
