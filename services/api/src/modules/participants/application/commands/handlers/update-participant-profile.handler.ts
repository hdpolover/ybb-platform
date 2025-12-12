import { CommandHandler, ICommandHandler } from '@nestjs/cqrs';
import { Inject } from '@nestjs/common';
import { UpdateParticipantProfileCommand } from '../update-participant-profile.command';
import { IParticipantRepository } from '../../../../../core/interfaces/repositories/participant.repository.interface';
import { ParticipantResponseDto } from '../../../presentation/dto/participant.dto';

@CommandHandler(UpdateParticipantProfileCommand)
export class UpdateParticipantProfileHandler implements ICommandHandler<UpdateParticipantProfileCommand> {
    constructor(
        @Inject('IParticipantRepository')
        private readonly participantRepository: IParticipantRepository,
    ) { }

    async execute(command: UpdateParticipantProfileCommand): Promise<ParticipantResponseDto> {
        const { userId, updateDto } = command;

        // Check if participant exists
        let participant = await this.participantRepository.findByUserId(userId);

        if (!participant) {
            // If profile doesn't exist, create it.
            // The updateDto might not have fullName if it's optional, but CREATE usually requires it.
            // We'll enforce fullName for creation in Schema, but here we might need to fetch User to get a default name.
            // For simplicity, we'll try to create with active data.

            // Ideally we should have a CreateParticipantCommand separately, but "update" often acts as upsert for profiles.

            // Assuming we can create with basic data
            participant = await this.participantRepository.create({
                userId,
                ...updateDto,
                birthdate: updateDto.birthdate ? new Date(updateDto.birthdate) : undefined,
                fullName: updateDto.fullName || 'New Participant', // Fallback
            });
        } else {
            const updateData: any = { ...updateDto };
            if (updateData.birthdate) {
                updateData.birthdate = new Date(updateData.birthdate);
            }
            participant = await this.participantRepository.update(userId, updateData);
        }

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
            profileCompletionPercentage: participant.profileCompletionPercentage ?? 0,
        };
    }
}
