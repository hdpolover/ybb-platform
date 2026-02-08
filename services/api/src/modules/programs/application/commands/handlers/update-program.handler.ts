import { CommandHandler, ICommandHandler } from '@nestjs/cqrs';
import { Inject, NotFoundException } from '@nestjs/common';
import { UpdateProgramCommand } from '../update-program.command';
import { IProgramRepository } from '@core/interfaces/repositories/program.repository.interface';
import { Program } from '@core/entities/program.entity';
import { IUserActivityLogRepository } from '@core/interfaces/repositories/user-activity-log.repository.interface';
import { CacheService } from '../../../../../shared/infrastructure/cache/cache.service';

@CommandHandler(UpdateProgramCommand)
export class UpdateProgramHandler implements ICommandHandler<UpdateProgramCommand> {
    constructor(
        @Inject('IProgramRepository')
        private readonly programRepository: IProgramRepository,
        @Inject(IUserActivityLogRepository)
        private readonly activityLogRepository: IUserActivityLogRepository,
        private readonly cacheService: CacheService,
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

        const programData: any = { ...updateProgramDto };
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

        const updatedProgram = await this.programRepository.update(programId, programData);

        // Log activity
        await this.activityLogRepository.create({
            id: undefined,
            userId: userId,
            activityType: 'UPDATE_PROGRAM',
            activityCategory: 'PROGRAM',
            activityData: {
                programId: updatedProgram.id,
                programName: updatedProgram.name,
                changes: updateProgramDto,
            },
            pageUrl: null,
            referrerUrl: null,
            sessionId: null,
            ipAddress: null,
            userAgent: null,
            deviceType: null,
            createdAt: new Date(),
        } as any);

        // Invalidate all landing page caches for this brand
        await this.invalidateLandingCaches(updatedProgram.brandId);

        const { brandId, ...rest } = updatedProgram as any;
        return {
            ...rest,
            brandId: brandId,
        };
    }

    /**
     * Invalidate all landing page caches when program is updated
     */
    private async invalidateLandingCaches(brandId: string): Promise<void> {
        try {
            await this.cacheService.invalidateByPatterns([
                `landing:*:${brandId}`,      // All landing pages for this brand
                `program:*`,                  // All program caches
            ]);
        } catch (error) {
            // Log but don't throw - cache invalidation failures shouldn't break updates
            console.error('Failed to invalidate landing caches:', error);
        }
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
