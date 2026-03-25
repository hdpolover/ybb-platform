import { CommandHandler, ICommandHandler } from '@nestjs/cqrs';
import { Inject } from '@nestjs/common';
import { UpdateParticipantProfileCommand } from '../update-participant-profile.command';
import { IParticipantRepository } from '../../../../../core/interfaces/repositories/participant.repository.interface';
import { ParticipantResponseDto } from '../../../presentation/dto/participant.dto';
import { CacheService } from '@shared/infrastructure/cache/cache.service';
import { CACHE_KEYS } from '@shared/constants/cache-keys';

@CommandHandler(UpdateParticipantProfileCommand)
export class UpdateParticipantProfileHandler implements ICommandHandler<UpdateParticipantProfileCommand> {
    constructor(
        @Inject('IParticipantRepository')
        private readonly participantRepository: IParticipantRepository,
        private readonly cacheService: CacheService,
    ) { }

    async execute(command: UpdateParticipantProfileCommand): Promise<ParticipantResponseDto> {
        const { userId, updateDto } = command;

        // Check if participant exists
        let participant = await this.participantRepository.findByUserId(userId);

        if (!participant) {
            // Create with basic default if missing
            participant = await this.participantRepository.create({
                userId,
                ...updateDto,
                birthdate: updateDto.birthdate ? new Date(updateDto.birthdate) : undefined,
                fullName: updateDto.fullName || 'New Participant',
                profileCompletionPercentage: 0,
            });
        }

        // Prepare Update Data
        const updateData: Record<string, unknown> = { ...updateDto };
        if (updateData['birthdate']) {
            updateData['birthdate'] = new Date(updateData['birthdate'] as string);
        }

        // Calculate New Completion Score
        // We merge existing data with the update to check total completeness
        const mergedData = { ...participant, ...updateData };
        const newScore = this.calculateCompletionPercentage(mergedData);

        // Apply metadata updates
        updateData.profileCompletionPercentage = newScore;
        updateData.lastProfileUpdate = new Date(); // Track when it was last updated

        participant = await this.participantRepository.update(userId, updateData);

        // Invalidate all related caches
        await this.invalidateParticipantCaches(userId, participant.id);

        // Return updated DTO
        return {
            id: participant.id,
            fullName: participant.fullName,
            nickName: participant.nickName ?? undefined,
            displayName: participant.displayName ?? undefined,
            birthdate: participant.birthdate ?? undefined,
            gender: participant.gender ?? undefined,
            phoneCountryCode: participant.phoneCountryCode ?? undefined,
            phoneNumber: participant.phoneNumber ?? undefined,
            phoneVerified: participant.phoneVerified,
            nationality: participant.nationality ?? undefined,
            currentCity: participant.currentCity ?? undefined,
            currentCountry: participant.currentCountry ?? undefined,
            institution: participant.institution ?? undefined,
            major: participant.major ?? undefined,
            occupation: participant.occupation ?? undefined,
            instagramUsername: participant.instagramUsername ?? undefined,
            linkedinUrl: participant.linkedinUrl ?? undefined,
            tshirtSize: participant.tshirtSize ?? undefined,
            dietaryRestrictions: participant.dietaryRestrictions ?? undefined,
            emergencyContactName: participant.emergencyContactName ?? undefined,
            emergencyContactRelation: participant.emergencyContactRelation ?? undefined,
            emergencyContactPhone: participant.emergencyContactPhone ?? undefined,
            emergencyContactCountryCode: participant.emergencyContactCountryCode ?? undefined,
            profileCompletionPercentage: participant.profileCompletionPercentage ?? 0,
        };
    }

    private calculateCompletionPercentage(data: Record<string, unknown>): number {
        let score = 20; // Base score for Onboarding (Name, Origin, etc.)

        // 1. Personal Details (+20%)
        if (data.birthdate) score += 5;
        if (data.gender) score += 5;
        if (data.phoneNumber) score += 5;
        if (data.nationality) score += 5;

        // 2. Location (+20%)
        if (data.currentCity) score += 10;
        if (data.currentCountry) score += 10;

        // 3. Education / Work (+20%)
        if (data.institution) score += 10;
        if (data.major || data.occupation) score += 10;

        // 4. Socials (+10%)
        if (data.instagramUsername || data.linkedinUrl) score += 10;

        // 5. Emergency Contact (+10%)
        if (data.emergencyContactName && data.emergencyContactPhone) score += 10;

        return Math.min(score, 100);
    }

    /**
     * Invalidate all participant-related caches when profile is updated
     */
    private async invalidateParticipantCaches(userId: string, participantId: string): Promise<void> {
        try {
            await Promise.all([
                // Portal caches
                this.cacheService.invalidateKey(CACHE_KEYS.PORTAL_DASHBOARD(userId)),
                this.cacheService.invalidateKey(CACHE_KEYS.PORTAL_SUBMISSIONS(userId)),
                this.cacheService.invalidateKey(CACHE_KEYS.PORTAL_PAYMENTS(userId)),
                this.cacheService.invalidateKey(CACHE_KEYS.PORTAL_DOCUMENTS(userId)),
                // Participant data caches
                this.cacheService.invalidateKey(CACHE_KEYS.PARTICIPANT_PROFILE(userId)),
                this.cacheService.invalidateKey(CACHE_KEYS.PARTICIPANT_STATS(participantId)),
            ]);
        } catch (error) {
            // Log but don't throw - cache invalidation failures shouldn't break updates
            console.error(`Failed to invalidate caches for participant ${participantId}:`, error);
        }
    }
}
