import { CommandHandler, ICommandHandler } from '@nestjs/cqrs';
import { Inject, NotFoundException } from '@nestjs/common';
import { UpdateProgramCommand } from '../update-program.command';
import { IProgramRepository } from '@core/interfaces/repositories/program.repository.interface';
import { Program } from '@core/entities/program.entity';
import { IUserActivityLogRepository } from '@core/interfaces/repositories/user-activity-log.repository.interface';
import { UserActivityLog } from '@core/entities/user-activity-log.entity';
import { CacheService } from '../../../../../shared/infrastructure/cache/cache.service';
import { PrismaService } from '../../../../../shared/infrastructure/prisma/prisma.service';
import { LandingRevalidationService } from '../../../../brands/application/services/landing-revalidation.service';

@CommandHandler(UpdateProgramCommand)
export class UpdateProgramHandler implements ICommandHandler<UpdateProgramCommand> {
    constructor(
        @Inject('IProgramRepository')
        private readonly programRepository: IProgramRepository,
        @Inject(IUserActivityLogRepository)
        private readonly activityLogRepository: IUserActivityLogRepository,
        private readonly cacheService: CacheService,
        private readonly prisma: PrismaService,
        private readonly landingRevalidation: LandingRevalidationService,
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

        // Invalidate all landing page caches for this brand
        await this.invalidateLandingCaches(updatedProgram.brandId);

        // Proactively revalidate the participant frontend's Next.js unstable_cache
        // for this brand's home and settings pages so changes reflect immediately.
        await this.landingRevalidation.revalidateHomeAndSettingsForBrand(updatedProgram.brandId);

        const { brandId, ...rest } = updatedProgram as unknown as Record<string, unknown>;
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
            await Promise.all([
                this.prisma.brandLandingSnapshot.deleteMany({ where: { brandId } }),
                this.cacheService.invalidateBrandLandingCaches(brandId),
                this.cacheService.invalidateByPattern('program:*'),
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
