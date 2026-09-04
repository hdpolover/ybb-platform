import { CommandHandler, ICommandHandler } from '@nestjs/cqrs';
import { PrismaService } from '../../../../../shared/infrastructure/prisma/prisma.service';
import { ReviewDeletionRequestCommand } from '../review-deletion-request.command';
import { NotFoundException, BadRequestException } from '@nestjs/common';
import { DeletionStatus } from '@prisma/client';
import { restoreAccountDeletionRequest } from '../../utils/account-deletion-restore.util';

// Deletion requests no longer wait on an admin: CreateDeletionRequestHandler
// creates them straight into 'approved' (auto-scheduled). 'pending' rows are
// legacy only (created by the pre-self-service flow; prod had 0 rows at the
// time of this change, but this must not crash on a leftover one). This
// handler therefore now has two live jobs:
//  - legacy: approve/reject a still-'pending' row exactly as before.
//  - current: 'reject' an 'approved' row is now an ADMIN-INITIATED CANCEL
//    (e.g. a support agent acting for a user who called in) - it restores
//    the account, mirroring the public token-based self-service cancel.
//    'approve' on an already-'approved' row has nothing left to do.
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

    if (request.status === DeletionStatus.approved) {
      return this.handleApprovedRequest(request, action, adminId, notes);
    }

    if (request.status !== DeletionStatus.pending) {
      throw new BadRequestException(`Deletion request is already ${request.status}`);
    }

    return this.handlePendingRequest(request, action, adminId, notes);
  }

  // Legacy path: unchanged behaviour for any leftover 'pending' row from
  // before the self-service flow existed.
  private async handlePendingRequest(
    request: { id: string; userId: string },
    action: 'approve' | 'reject',
    adminId: string,
    notes?: string,
  ) {
    const newStatus = action === 'approve' ? DeletionStatus.approved : DeletionStatus.rejected;
    const scheduledDate = action === 'approve' ? new Date(Date.now() + 30 * 24 * 60 * 60 * 1000) : null;

    const updateRequest = this.prisma.accountDeletionRequest.update({
      where: { id: request.id },
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

  // Current path: the request is already auto-scheduled. 'approve' has
  // nothing left to do; 'reject' cancels it (restores the account) as an
  // admin-initiated equivalent of the self-service token cancel.
  private async handleApprovedRequest(
    request: { id: string; userId: string },
    action: 'approve' | 'reject',
    adminId: string,
    notes?: string,
  ) {
    if (action === 'approve') {
      throw new BadRequestException('This request was already scheduled automatically; there is nothing left to approve.');
    }

    await this.prisma.$transaction(async (tx) => {
      await restoreAccountDeletionRequest(tx, request.id, request.userId);
      await tx.accountDeletionRequest.update({
        where: { id: request.id },
        data: { reviewedBy: adminId, reviewedAt: new Date(), reviewNotes: notes },
      });
    });

    return this.prisma.accountDeletionRequest.findUnique({
      where: { id: request.id },
      include: {
        user: { select: { email: true, id: true } },
        reviewer: { select: { fullName: true, id: true } },
      },
    });
  }
}
