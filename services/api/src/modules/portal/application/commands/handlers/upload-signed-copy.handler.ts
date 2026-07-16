import { CommandHandler, ICommandHandler } from '@nestjs/cqrs';
import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '@shared/infrastructure/prisma/prisma.service';
import { StorageService } from '@modules/files/application/storage.service';
import { CacheService } from '@shared/infrastructure/cache/cache.service';
import { CACHE_KEYS } from '@shared/constants/cache-keys';
import { UploadSignedCopyCommand } from '../../queries/portal-queries';

@Injectable()
@CommandHandler(UploadSignedCopyCommand)
export class UploadSignedCopyHandler implements ICommandHandler<UploadSignedCopyCommand> {
    constructor(
        private readonly prisma: PrismaService,
        private readonly storageService: StorageService,
        private readonly cacheService: CacheService,
    ) {}

    async execute(command: UploadSignedCopyCommand) {
        const { templateId, userId, file } = command;

        // Resolve participant
        const participant = await this.prisma.participant.findFirst({
            where: { userId },
        });
        if (!participant) throw new NotFoundException('Participant not found');

        // Resolve template
        const template = await this.prisma.documentTemplate.findFirst({
            where: { id: templateId, deletedAt: null },
        });
        if (!template) throw new NotFoundException('Document template not found');
        if (template.type !== 'agreement_letter') {
            throw new BadRequestException('Signed copy upload only applies to agreement letters');
        }

        // Resolve application
        const application = await this.prisma.participantApplication.findFirst({
            where: { participantId: participant.id, programId: template.programId },
        });
        if (!application) throw new NotFoundException('Application not found');

        // Upload file
        const program = await this.prisma.program.findUnique({
            where: { id: template.programId },
        });
        if (!program) throw new NotFoundException('Program not found');

        const uploadResult = await this.storageService.uploadFile(
            file,
            userId,
            program.brandId,
            'signed-copies',
            program.id,
        );

        // Upsert ParticipantDocument
        // NOTE: TOCTOU risk — a native prisma.upsert() would be safer, but the
        // ParticipantDocument model has no @@unique([applicationId, templateId])
        // constraint (templateId is nullable), so Prisma's upsert() cannot be
        // used here. A DB-level unique partial index on (applicationId, templateId)
        // WHERE templateId IS NOT NULL would allow migrating to the atomic form.
        const existing = await this.prisma.participantDocument.findFirst({
            where: { applicationId: application.id, templateId },
        });

        if (existing) {
            await this.prisma.participantDocument.update({
                where: { id: existing.id },
                data: {
                    signedCopyUrl: uploadResult.url,
                    submissionStatus: 'uploaded',
                    submissionNote: null,
                },
            });
        } else {
            await this.prisma.participantDocument.create({
                data: {
                    applicationId: application.id,
                    templateId,
                    name: template.name,
                    type: 'agreement_letter',
                    fileUrl: template.templateUrl ?? '',
                    signedCopyUrl: uploadResult.url,
                    submissionStatus: 'uploaded',
                    isPublic: false,
                },
            });
        }

        // Invalidate portal documents cache
        await this.cacheService.invalidateKey(CACHE_KEYS.PORTAL_DOCUMENTS(userId));

        return { success: true, submissionStatus: 'uploaded' };
    }
}
