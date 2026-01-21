import { CommandHandler, ICommandHandler } from '@nestjs/cqrs';
import { PrismaService } from '@shared/infrastructure/prisma/prisma.service';
import { CompleteOnboardingCommand } from '../complete-onboarding.command';
import { Gender } from '@prisma/client';

@CommandHandler(CompleteOnboardingCommand)
export class CompleteOnboardingHandler implements ICommandHandler<CompleteOnboardingCommand> {
    constructor(private readonly prisma: PrismaService) {}

    async execute(command: CompleteOnboardingCommand) {
        const { userId, dto } = command;

        // Validating Gender Enum manually if needed, or let Prisma handle it
        // We cast string to Gender if valid, otherwise undefined or null
        const gender = Object.values(Gender).includes(dto.gender as Gender) 
            ? (dto.gender as Gender) 
            : null;

        return this.prisma.participant.upsert({
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
    }
}
