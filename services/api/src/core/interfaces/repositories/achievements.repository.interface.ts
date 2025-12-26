import { ParticipantDocument } from '../../entities/document.entity';
import { ParticipantAward } from '../../entities/award.entity';

export interface IAchievementsRepository {
    findDocumentsByApplicationId(applicationId: string): Promise<ParticipantDocument[]>;
    findAwardsByApplicationId(applicationId: string): Promise<ParticipantAward[]>;
}
