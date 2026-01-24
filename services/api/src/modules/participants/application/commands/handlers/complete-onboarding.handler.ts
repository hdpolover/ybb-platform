import { CommandHandler, ICommandHandler } from '@nestjs/cqrs';
import { PrismaService } from '@shared/infrastructure/prisma/prisma.service';
import { CompleteOnboardingCommand } from '../complete-onboarding.command';
import { Gender } from '@prisma/client';

import { Logger } from '@nestjs/common';

@CommandHandler(CompleteOnboardingCommand)
export class CompleteOnboardingHandler implements ICommandHandler<CompleteOnboardingCommand> {
    private readonly logger = new Logger(CompleteOnboardingHandler.name);

    constructor(private readonly prisma: PrismaService) {}

    async execute(command: CompleteOnboardingCommand) {
        const { userId, dto } = command;

        // Validating Gender Enum manually if needed, or let Prisma handle it
        // We cast string to Gender if valid, otherwise undefined or null
        const gender = Object.values(Gender).includes(dto.gender as Gender) 
            ? (dto.gender as Gender) 
            : null;

        const result = await this.prisma.$transaction(async (tx) => {
            let participant = await tx.participant.upsert({
                where: { userId },
                create: {
                    userId,
                    fullName: dto.fullName,
                    gender: gender,
                    originCountry: dto.originCountry,
                    originCity: dto.originCity,
                    occupation: dto.occupation,
                    institution: dto.institution,
                    knowledgeSource: dto.knowledgeSource,
                    referralCode: dto.referralCode,
                    profileCompletedAt: new Date(),
                    profileCompletionPercentage: 20, // Base completion for basic info
                    currentCountry: dto.originCountry, // Default current to origin initially
                },
                update: {
                    fullName: dto.fullName,
                    gender: gender,
                    originCountry: dto.originCountry,
                    originCity: dto.originCity,
                    occupation: dto.occupation,
                    institution: dto.institution,
                    knowledgeSource: dto.knowledgeSource,
                    // Only set profileCompletedAt if it wasn't set before
                    profileCompletedAt: new Date(), 
                    // Only bump percentage if it was 0
                    profileCompletionPercentage: { set: 20 }
                },
            });

            // Handle Referral Logic if provided
            if (dto.referralCode) {
                // 1. Check if referral already exists
                const existingReferral = await tx.ambassadorReferral.findFirst({
                    where: { participantId: participant.id }
                });

                if (!existingReferral) {
                     // 2. Validate Ambassador
                     const ambassador = await tx.ambassador.findUnique({
                         where: { referralCode: dto.referralCode, isActive: true }
                     });

                     if (ambassador) {
                         try {
                              // 3. Create Link
                             await tx.ambassadorReferral.create({
                                 data: {
                                     ambassadorId: ambassador.id,
                                     participantId: participant.id,
                                     status: 'referred',
                                 }
                             });

                             // 4. Update Stats
                             await tx.ambassador.update({
                                 where: { id: ambassador.id },
                                 data: {
                                     totalReferrals: { increment: 1 },
                                     lastReferralAt: new Date(),
                                 }
                             });
                             
                             // 5. Ensure participant record has the code
                             if (participant.referralCode !== dto.referralCode) {
                                 participant = await tx.participant.update({
                                     where: { id: participant.id },
                                     data: { referralCode: dto.referralCode }
                                 });
                             }
                         } catch (e) {
                             this.logger.warn(`Failed to process referral for user ${userId}: ${e.message}`);
                         }
                     }
                }
            }

            await tx.user.update({
                where: { id: userId },
                data: { isOnboardingCompleted: true },
            });

            return participant;
        });

        return result;
    }
}
