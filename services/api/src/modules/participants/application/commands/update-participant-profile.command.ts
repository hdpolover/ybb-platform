import { UpdateParticipantProfileDto } from '../../presentation/dto/participant.dto';

export class UpdateParticipantProfileCommand {
    constructor(
        public readonly userId: string,
        public readonly updateDto: UpdateParticipantProfileDto,
    ) { }
}
