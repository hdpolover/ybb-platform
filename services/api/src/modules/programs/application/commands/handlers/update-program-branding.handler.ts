import { CommandHandler, ICommandHandler } from '@nestjs/cqrs';
import { BadRequestException, NotFoundException } from '@nestjs/common';
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
        const { programId, files, userId, dto } = command;

        const program = await this.prisma.program.findUnique({
             where: { id: programId },
             include: { brand: true }
        });

        if (!program) {
            throw new NotFoundException(`Program with ID ${programId} not found`);
        }

        // Defense in depth: the DTO's @Transform already turns the multipart
        // "true"/"false" strings into real booleans and @IsBoolean rejects
        // anything else, but check with strict `=== true` here too rather
        // than truthiness — a raw string "false" is truthy in JS, and this
        // handler has no guarantee every future caller goes through the
        // ValidationPipe.
        const clearLogo = dto.clearLogo === true;
        const clearBanner = dto.clearBanner === true;
        const clearThumbnail = dto.clearThumbnail === true;

        // Uploading a new asset and clearing it in the same request is a
        // contradiction. Reject rather than silently pick a winner — silently
        // ignoring one of two explicit instructions is how the original
        // "program logo can never be cleared" bug class happened.
        if (files.logo && clearLogo) {
            throw new BadRequestException('Cannot upload a new logo and clear it in the same request');
        }
        if (files.banner && clearBanner) {
            throw new BadRequestException('Cannot upload a new banner and clear it in the same request');
        }
        if (files.thumbnail && clearThumbnail) {
            throw new BadRequestException('Cannot upload a new thumbnail and clear it in the same request');
        }

        const brandId = program.brandId;
        const updates: Record<string, string | null> = {};

        if (files.logo) {
            const result = await this.storageService.uploadFile(
                files.logo,
                userId,
                brandId,
                'programs/logos',
                programId
            );
            updates.logoUrl = result.url;
        } else if (clearLogo) {
            updates.logoUrl = null;
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
        } else if (clearBanner) {
            updates.bannerUrl = null;
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
        } else if (clearThumbnail) {
            updates.thumbnailUrl = null;
        }

        if (Object.keys(updates).length > 0) {
            const updated = await this.prisma.program.update({
                where: { id: programId },
                data: updates
            });
            // Branding assets render on the program landing page. Bust all
            // three cache layers (audit found this handler never cleared the
            // Postgres snapshot and never fired the Next.js revalidate hook) —
            // a clear-only request needs exactly the same invalidation an
            // upload gets, since `updates` is non-empty either way.
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
