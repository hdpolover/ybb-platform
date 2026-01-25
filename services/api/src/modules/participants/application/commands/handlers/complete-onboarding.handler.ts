import { CommandHandler, ICommandHandler } from '@nestjs/cqrs';
import { PrismaService } from '@shared/infrastructure/prisma/prisma.service';
import { CompleteOnboardingCommand } from '../complete-onboarding.command';
import { Gender } from '@prisma/client';
import { Country } from 'country-state-city';
import { Logger, BadRequestException } from '@nestjs/common';

@CommandHandler(CompleteOnboardingCommand)
export class CompleteOnboardingHandler implements ICommandHandler<CompleteOnboardingCommand> {
    private readonly logger = new Logger(CompleteOnboardingHandler.name);

    constructor(private readonly prisma: PrismaService) {}

    async execute(command: CompleteOnboardingCommand) {
        const { userId, dto } = command;

        // Validate Country Code
        const country = Country.getCountryByCode(dto.originCountry);
        if (!country) {
            throw new BadRequestException(`Invalid country code: ${dto.originCountry}`);
        }

        const result = await this.prisma.$transaction(async (tx) => {
            let participant = await tx.participant.upsert({
                where: { userId },
                create: {
                    userId,
                    fullName: dto.fullName,
                    gender: dto.gender as Gender,
                    originCountry: country.isoCode, // Ensure we save the standardized code
                    knowledgeSource: dto.knowledgeSource,
                    referralCode: dto.referralCode,
                    profileCompletedAt: new Date(),
                    profileCompletionPercentage: 20, // Base completion for basic info
                    currentCountry: country.isoCode, // Default current to origin initially
                },
                update: {
                    fullName: dto.fullName,
                    gender: dto.gender as Gender,
                    originCountry: country.isoCode,
                    knowledgeSource: dto.knowledgeSource,
                    // Only set profileCompletedAt if it wasn't set before
                    profileCompletedAt: new Date(), 
                    // Only bump percentage if it was 0
                    profileCompletionPercentage: { set: 20 },
                    lastProfileUpdate: new Date(),
                },
            });

            // 1. Sync User Data to Participant (Email Verified Status)
            const user = await tx.user.findUnique({ where: { id: userId } });
            if (user && user.emailVerifiedAt && !participant.emailVerifiedAt) {
                 participant = await tx.participant.update({
                     where: { id: participant.id },
                     data: { emailVerifiedAt: user.emailVerifiedAt }
                 });
            }

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
