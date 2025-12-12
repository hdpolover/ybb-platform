export interface IUserAnnouncementReadRepository {
    markAsRead(userId: string, announcementId: string): Promise<void>;
    markAsDismissed(userId: string, announcementId: string): Promise<void>;
}
