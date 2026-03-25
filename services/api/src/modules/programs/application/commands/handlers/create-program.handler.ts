import { CommandHandler, ICommandHandler } from '@nestjs/cqrs';
import { Inject } from '@nestjs/common';
import { CreateProgramCommand } from '../create-program.command';
import { IProgramRepository } from '@core/interfaces/repositories/program.repository.interface';
import { Program } from '@core/entities/program.entity';
import { IUserActivityLogRepository } from '@core/interfaces/repositories/user-activity-log.repository.interface';
import { UserActivityLog } from '@core/entities/user-activity-log.entity';

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

        const programData: Partial<Program> = { ...createProgramDto } as unknown as Partial<Program>;
        const mutableData = programData as Record<string, unknown>;
        if (mutableData.startDate) mutableData.startDate = new Date(mutableData.startDate as string);
        if (mutableData.endDate) mutableData.endDate = new Date(mutableData.endDate as string);
        if (mutableData.applicationDeadline) mutableData.applicationDeadline = new Date(mutableData.applicationDeadline as string);
        if (mutableData.registrationOpenDate) mutableData.registrationOpenDate = new Date(mutableData.registrationOpenDate as string);
        if (mutableData.registrationCloseDate) mutableData.registrationCloseDate = new Date(mutableData.registrationCloseDate as string);

        const program = await this.programRepository.create(mutableData as Partial<Program>);

        // Log activity
        await this.activityLogRepository.create(new UserActivityLog(
            undefined as unknown as string, // Let DB generate ID
            userId,
            'CREATE_PROGRAM',
            'PROGRAM',
            {
                programId: program.id,
                programName: program.name,
            },
            null,
            null,
            null,
            null,
            null,
            null,
            new Date(),
        ));

        const { brandId, ...rest } = program as unknown as Record<string, unknown>;
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
