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

        // Upsert ParticipantDocument
        // NOTE: TOCTOU risk — a native prisma.upsert() would be safer, but the
        // ParticipantDocument model has no @@unique([applicationId, templateId])
        // constraint (templateId is nullable), so Prisma's upsert() cannot be
        // used here. A DB-level unique partial index on (applicationId, templateId)
        // WHERE templateId IS NOT NULL would allow migrating to the atomic form.
        const existing = await this.prisma.participantDocument.findFirst({
            where: { applicationId: application.id, templateId },
        });

        // An approved document is locked: no re-upload once an admin has
        // signed off on it. Checked before the storage write so a locked
        // document never burns an upload. After rejected/revision_requested,
        // re-upload is allowed and resets the status to 'uploaded' for
        // re-review.
        if (existing?.submissionStatus === 'approved') {
            throw new BadRequestException('This document has already been approved and cannot be re-uploaded.');
        }

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

        const uploadedAt = new Date();

        if (existing) {
            await this.prisma.participantDocument.update({
                where: { id: existing.id },
                data: {
                    signedCopyUrl: uploadResult.url,
                    submissionStatus: 'uploaded',
                    submissionNote: null,
                    signedCopyUploadedAt: uploadedAt,
                    reviewedBy: null,
                    reviewedAt: null,
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
                    signedCopyUploadedAt: uploadedAt,
                    isPublic: false,
                },
            });
        }

        // Invalidate portal documents cache for every program variant, not just
        // the bare `:latest` key - the documents read is keyed by programId.
        await this.cacheService.invalidateByPattern(CACHE_KEYS.PORTAL_DOCUMENTS(userId, '*'));

        return { success: true, submissionStatus: 'uploaded' };
    }
}
