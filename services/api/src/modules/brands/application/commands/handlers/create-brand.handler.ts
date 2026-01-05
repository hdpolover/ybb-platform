import { CommandHandler, ICommandHandler } from '@nestjs/cqrs';
import { Inject } from '@nestjs/common';
import { CreateBrandCommand } from '../create-brand.command';
import { IBrandRepository } from '@core/interfaces/repositories/brand.repository.interface';
import { Brand } from '@core/entities/brand.entity';
import { IUserActivityLogRepository } from '@core/interfaces/repositories/user-activity-log.repository.interface';

@CommandHandler(CreateBrandCommand)
export class CreateBrandHandler implements ICommandHandler<CreateBrandCommand> {
    constructor(
        @Inject('IBrandRepository')
        private readonly brandRepository: IBrandRepository,
        @Inject(IUserActivityLogRepository)
        private readonly activityLogRepository: IUserActivityLogRepository,
    ) {}

    async execute(command: CreateBrandCommand): Promise<Brand> {
        const { dto, userId } = command;
        
        if (!dto.slug) {
            dto.slug = this.generateSlug(dto.name);
        }

        const brand = await this.brandRepository.create(dto);

        // Log activity
        await this.activityLogRepository.create({
            id: undefined, // Let DB generate ID
            userId: userId,
            activityType: 'CREATE_BRAND',
            activityCategory: 'BRAND',
            activityData: {
                brandId: brand.id,
                brandName: brand.name,
            },
            pageUrl: null,
            referrerUrl: null,
            sessionId: null,
            ipAddress: null,
            userAgent: null,
            deviceType: null,
            createdAt: new Date(),
        } as any);

        return brand;
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
