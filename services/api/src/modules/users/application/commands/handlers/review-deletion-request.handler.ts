import { CommandHandler, ICommandHandler } from '@nestjs/cqrs';
import { PrismaService } from '../../../../../shared/infrastructure/prisma/prisma.service';
import { ReviewDeletionRequestCommand } from '../review-deletion-request.command';
import { NotFoundException, BadRequestException } from '@nestjs/common';
import { DeletionStatus } from '@prisma/client';

@CommandHandler(ReviewDeletionRequestCommand)
export class ReviewDeletionRequestHandler implements ICommandHandler<ReviewDeletionRequestCommand> {
  constructor(private readonly prisma: PrismaService) {}

  async execute(command: ReviewDeletionRequestCommand) {
    const { requestId, adminId, action, notes } = command;

    const request = await this.prisma.accountDeletionRequest.findUnique({
      where: { id: requestId },
    });

    if (!request) {
      throw new NotFoundException(`Deletion request ${requestId} not found`);
    }

    if (request.status !== DeletionStatus.pending) {
      throw new BadRequestException(`Deletion request is already ${request.status}`);
    }

    const newStatus = action === 'approve' ? DeletionStatus.approved : DeletionStatus.rejected;
    const scheduledDate = action === 'approve' ? new Date(Date.now() + 30 * 24 * 60 * 60 * 1000) : null; // 30 days retention if approved

    // Approving a deletion request previously updated the request row only -
    // the account itself stayed isActive: true forever, so a participant who
    // deleted their own account kept receiving exports/emails indefinitely.
    // Mirrors DeactivateUserHandler: isActive: false only, deletedAt stays
    // null (that field means an actual hard/soft delete, which this request
    // only schedules 30 days out, it doesn't perform).
    const updateRequest = this.prisma.accountDeletionRequest.update({
      where: { id: requestId },
      data: {
        status: newStatus,
        reviewedBy: adminId,
        reviewedAt: new Date(),
        reviewNotes: notes,
        scheduledDeletionDate: scheduledDate,
      },
      include: {
        user: { select: { email: true, id: true } },
        reviewer: { select: { fullName: true, id: true } }
      }
    });

    if (action !== 'approve') {
      return updateRequest;
    }

    const [updatedRequest] = await this.prisma.$transaction([
      updateRequest,
      this.prisma.user.update({ where: { id: request.userId }, data: { isActive: false } }),
    ]);

    return updatedRequest;
  }
}
