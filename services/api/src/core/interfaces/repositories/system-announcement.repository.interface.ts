import { SystemAnnouncement } from '../../entities/system-announcement.entity';

export interface ISystemAnnouncementRepository {
    findAll(filters?: { isPublished?: boolean; targetAudience?: string }): Promise<SystemAnnouncement[]>;
    findById(id: string): Promise<SystemAnnouncement | null>;
}
