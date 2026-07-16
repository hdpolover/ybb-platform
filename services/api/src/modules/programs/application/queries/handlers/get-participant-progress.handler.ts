import { IQueryHandler, QueryHandler } from '@nestjs/cqrs';
import { PrismaService } from '../../../../../shared/infrastructure/prisma/prisma.service';
import { GetParticipantProgressQuery } from '../get-participant-progress.query';
import { ProgressStepDto } from '../../../presentation/dto/participant-progress-response.dto';
import { TimelineCompletionType, ApplicationStatus, TimelineType } from '@prisma/client';

@QueryHandler(GetParticipantProgressQuery)
export class GetParticipantProgressHandler implements IQueryHandler<GetParticipantProgressQuery> {
  constructor(private readonly prisma: PrismaService) {}

  async execute(query: GetParticipantProgressQuery): Promise<ProgressStepDto[]> {
    const { programId, userId } = query;

    // 1. Get Application with related data
    const application = await this.prisma.participantApplication.findFirst({
      where: {
        programId,
        participant: { userId },
      },
      include: {
        // transactions: {
        //   where: { status: 'paid' },
        //   include: { pricingTier: true },
        // },
        documents: true, // Only if we want to check for doc uploads later
      },
    });

    // 2. Get Ordered Timeline
    const timeline = await this.prisma.programTimeline.findMany({
      where: {
        programId,
        isActive: true,
      },
      orderBy: { order: 'asc' },
    });

    // 3. Map status
    return timeline.map((step, index) => {
      const now = new Date();
      const startDate = new Date(step.date);
      const endDate = step.endDate ? new Date(step.endDate) : null;
      
      let status: string = 'not_yet';

      // ---------------------------------------------------------
      // 1. Base Time-Based Logic (fallback)
      // ---------------------------------------------------------
      if (now < startDate) {
        status = 'not_yet';
      } else if (endDate) {
        // Range logic
        if (now >= startDate && now <= endDate) status = 'in_progress';
        if (now > endDate) status = 'completed';
      } else {
        // Point in time logic
        status = 'completed';
      }

      // ---------------------------------------------------------
      // 2. Override based on completionType logic
      // ---------------------------------------------------------
      if (!application && step.completionType !== TimelineCompletionType.date_passed) {
        // If no application exists, most things are strictly 'not_yet' or 'in_progress' (registration)
        if (step.type === TimelineType.registration) {
           status = 'in_progress';
        } else {
           status = 'locked'; // Cannot proceed without application
        }
      } else if (application) {
        // Check dynamic rules
        switch (step.completionType) {
          case TimelineCompletionType.status_change:
            const statusConfig = step.completionConfig as { status: string };
            if (statusConfig?.status) {
              if (application.status === statusConfig.status) {
                status = 'completed';
              } else if (status === 'completed' && application.status !== statusConfig.status) {
                // If date allows completion but status doesn't match?
                // Usually logic takes precedence.
                // e.g. "Announcement" is technically "completed" in time, but maybe user didn't get accepted?
                
                // Specific Logic for LoA / Acceptance:
                if (statusConfig.status === ApplicationStatus.accepted && application.status === ApplicationStatus.rejected) {
                  status = 'failed';
                } else if (application.status === ApplicationStatus.submitted || application.status === ApplicationStatus.under_review) {
                  status = 'in_progress';
                } else if (index > 0 && timeline[index-1].type === TimelineType.registration) {
                  // If prev step is done, this is likely next
                }
              }
              
              // Simple check: if we demanded "accepted" and user IS "accepted" -> Completed.
              if (application.status === statusConfig.status) status = 'completed';
              // If user is further along? (e.g. interview_scheduled > submitted) - Need status hierarchy helper
            }
            break;

          case TimelineCompletionType.payment_completed:
            const payConfig = step.completionConfig as { feeType: string };
            if (payConfig?.feeType) {
              const hasPaid = application.registrationPaymentStatus === 'paid' || application.programPaymentStatus === 'paid';
              /*
              const hasPaid = application.transactions.some(
                (t) => t.pricingTier?.feeType === payConfig.feeType
              );
              */
              
              if (hasPaid) {
                status = 'completed';
              } else {
                 // If not paid, and date is valid -> In Progress (Open for payment)
                 if (now >= startDate && (!endDate || now <= endDate)) {
                   status = 'in_progress';
                 } else if (endDate && now > endDate) {
                   status = 'expired'; // Or failed
                 } else {
                   status = 'locked'; // Not open yet
                 }
              }
            }
            break;
            
          case TimelineCompletionType.manual:
            // Logic: Not implemented yet. 
            // Could check a "ParticipantTimelineStatus" table.
            break;
        }
      }

      // ---------------------------------------------------------
      // 3. Specific Hardcoded Overrides for robustness
      if (step.type === TimelineType.registration && application) {
        status = 'completed';
      }

      return {
        id: step.id,
        stepNumber: index + 1,
        title: step.title,
        description: step.description || undefined, // Convert null to undefined
        date: startDate,
        endDate: endDate ? endDate : undefined,
        status,
        type: step.type,
      };
    });
  }
}
