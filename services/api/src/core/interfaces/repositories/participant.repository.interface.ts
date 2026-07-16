import { Participant } from '../../entities/participant.entity';

export interface IParticipantRepository {
    findByUserId(userId: string): Promise<Participant | null>;
    create(data: Partial<Participant>): Promise<Participant>;
    update(userId: string, data: Partial<Participant>): Promise<Participant>;
}
