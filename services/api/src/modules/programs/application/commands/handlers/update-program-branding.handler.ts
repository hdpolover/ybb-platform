import { CommandHandler, ICommandHandler } from '@nestjs/cqrs';
import { Inject, NotFoundException } from '@nestjs/common';
import { UpdateProgramBrandingCommand } from '../update-program-branding.command';
import { StorageService } from '../../../../files/application/storage.service';
import { PrismaService } from '@shared/infrastructure/prisma/prisma.service';
import { LandingCacheInvalidationService } from '../../../../brands/application/services/landing-cache-invalidation.service';

@CommandHandler(UpdateProgramBrandingCommand)
export class UpdateProgramBrandingHandler implements ICommandHandler<UpdateProgramBrandingCommand> {
    constructor(
        private readonly storageService: StorageService,
        private readonly prisma: PrismaService,
        private readonly landingCacheInvalidation: LandingCacheInvalidationService,
    ) {}

    async execute(command: UpdateProgramBrandingCommand) {
        const { programId, files, userId } = command;

        const program = await this.prisma.program.findUnique({
             where: { id: programId },
             include: { brand: true } 
        });

        if (!program) {
            throw new NotFoundException(`Program with ID ${programId} not found`);
        }

        const brandId = program.brandId;
        const updates: Record<string, string> = {};

        if (files.logo) {
            const result = await this.storageService.uploadFile(
                files.logo,
                userId,
                brandId,
                'programs/logos',
                programId
            );
            updates.logoUrl = result.url;
        }

        if (files.banner) {
            const result = await this.storageService.uploadFile(
                files.banner,
                userId,
                brandId,
                'programs/banners',
                programId
            );
            updates.bannerUrl = result.url;
        }
        
        if (files.thumbnail) {
            const result = await this.storageService.uploadFile(
                files.thumbnail,
                userId,
                brandId,
                'programs/thumbnails',
                programId
            );
            updates.thumbnailUrl = result.url;
        }

        if (Object.keys(updates).length > 0) {
            const updated = await this.prisma.program.update({
                where: { id: programId },
                data: updates
            });
            // Branding assets render on the program landing page. Bust all
            // three cache layers (audit found this handler never cleared the
            // Postgres snapshot and never fired the Next.js revalidate hook).
            await this.landingCacheInvalidation.invalidate(brandId, {
                clearSnapshot: true,
                bustProgramCache: true,
                swallowErrors: true,
                revalidate: { kind: 'homeAndSettings' },
            });
            return updated;
        }

        return program;
    }
}
