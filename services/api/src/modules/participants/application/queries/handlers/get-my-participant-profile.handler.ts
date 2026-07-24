import { QueryHandler, IQueryHandler } from '@nestjs/cqrs';
import { Inject, NotFoundException } from '@nestjs/common';
import { GetMyParticipantProfileQuery } from '../get-my-participant-profile.query';
import { IParticipantRepository } from '../../../../../core/interfaces/repositories/participant.repository.interface';
import { ParticipantResponseDto } from '../../../presentation/dto/participant.dto';

@QueryHandler(GetMyParticipantProfileQuery)
export class GetMyParticipantProfileHandler implements IQueryHandler<GetMyParticipantProfileQuery> {
    constructor(
        @Inject('IParticipantRepository')
        private readonly participantRepository: IParticipantRepository,
    ) { }

    async execute(query: GetMyParticipantProfileQuery): Promise<ParticipantResponseDto> {
        const { userId } = query;
        const participant = await this.participantRepository.findByUserId(userId);

        if (!participant) {
            throw new NotFoundException('Participant profile not found for this user.');
        }

        // Map to DTO
        // TODO: Use a mapper util
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
            originCountry: participant.originCountry ?? undefined,
            originCity: participant.originCity ?? undefined,
            institution: participant.institution ?? undefined,
            major: participant.major ?? undefined,
            occupation: participant.occupation ?? undefined,
            instagramUsername: participant.instagramUsername ?? undefined,
            linkedinUrl: participant.linkedinUrl ?? undefined,
            profilePictureUrl: participant.profilePictureUrl ?? undefined,
            tshirtSize: participant.tshirtSize ?? undefined,
            dietaryRestrictions: participant.dietaryRestrictions ?? undefined,
            knowledgeSource: participant.knowledgeSource ?? undefined,
            referralCode: participant.referralCode ?? undefined,
            profileCompletionPercentage: participant.profileCompletionPercentage ?? 0,
        };
    }
}
