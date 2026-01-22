import { Module } from '@nestjs/common';
import { CqrsModule } from '@nestjs/cqrs';
import { AuthModule } from '../auth/auth.module';
import { PrismaService } from '@shared/infrastructure/prisma/prisma.service';
import { SystemAnnouncementsController } from './presentation/system-announcements.controller';
import { SystemAnnouncementRepository } from './infrastructure/persistence/system-announcement.repository';
import { UserAnnouncementReadRepository } from './infrastructure/persistence/user-announcement-read.repository';
import { ListSystemAnnouncementsHandler } from './application/queries/handlers/list-system-announcements.handler';
import { GetSystemAnnouncementHandler } from './application/queries/handlers/get-system-announcement.handler';
import { MarkAnnouncementReadHandler } from './application/commands/handlers/mark-announcement-read.handler';

@Module({
    imports: [CqrsModule, AuthModule],
    controllers: [SystemAnnouncementsController],
    providers: [
        {
            provide: 'ISystemAnnouncementRepository',
            useClass: SystemAnnouncementRepository,
        },
        {
            provide: 'IUserAnnouncementReadRepository',
            useClass: UserAnnouncementReadRepository,
        },
        ListSystemAnnouncementsHandler,
        GetSystemAnnouncementHandler,
        MarkAnnouncementReadHandler,
    ],
})
export class SystemModule { }
