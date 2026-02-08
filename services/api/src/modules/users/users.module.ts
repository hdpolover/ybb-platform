import { Module } from '@nestjs/common';
import { AuthModule } from '@modules/auth/auth.module';
import { PrismaModule } from '@shared/infrastructure/prisma/prisma.module';
import { UsersController } from './presentation/users.controller';
import { CreateUserHandler } from './application/commands/handlers/create-user.handler';
import { GetUserHandler } from './application/queries/handlers/get-user.handler';
import { GetUsersHandler } from './application/queries/handlers/get-users.handler';
import { UserRepository } from './infrastructure/persistence/user.repository';
import { UserPreferenceRepository } from './infrastructure/persistence/user-preference.repository';
import { IUserRepository } from '@core/interfaces/repositories/user.repository.interface';
import { IUserPreferenceRepository } from '@core/interfaces/repositories/user-preference.repository.interface';
import { GetUserPreferencesHandler } from './application/queries/handlers/get-user-preferences.handler';
import { UpdateUserPreferencesHandler } from './application/commands/handlers/update-user-preferences.handler';
import { UserNotificationRepository } from './infrastructure/persistence/user-notification.repository';
import { IUserNotificationRepository } from '@core/interfaces/repositories/user-notification.repository.interface';
import { ListUserNotificationsHandler } from './application/queries/handlers/list-user-notifications.handler';
import { MarkNotificationReadHandler } from './application/commands/handlers/mark-notification-read.handler';
import { UserActivityLogRepository } from './infrastructure/persistence/user-activity-log.repository';
import { IUserActivityLogRepository } from '@core/interfaces/repositories/user-activity-log.repository.interface';
import { UserSecurityLogRepository } from './infrastructure/persistence/user-security-log.repository';
import { IUserSecurityLogRepository } from '@core/interfaces/repositories/user-security-log.repository.interface';
import { ListUserActivityLogsHandler } from './application/queries/handlers/list-user-activity-logs.handler';
import { ListUserSecurityLogsHandler } from './application/queries/handlers/list-user-security-logs.handler';
import { AccountDeletionRequestRepository } from './infrastructure/persistence/account-deletion-request.repository';
import { IAccountDeletionRequestRepository } from '@core/interfaces/repositories/account-deletion-request.repository.interface';
import { CreateDeletionRequestHandler } from './application/commands/handlers/create-deletion-request.handler';
import { ReviewDeletionRequestHandler } from './application/commands/handlers/review-deletion-request.handler';
import { ListDeletionRequestsHandler } from './application/queries/handlers/list-deletion-requests.handler';
import { DeletionRequestsController } from './presentation/deletion-requests.controller';
import { RabbitMQModule } from '@shared/infrastructure/rabbitmq/rabbitmq.module';
import { CacheModule } from '@shared/infrastructure/cache/cache.module';

@Module({
  imports: [
    PrismaModule,
    AuthModule,
    RabbitMQModule,
    CacheModule,
  ],
  controllers: [UsersController, DeletionRequestsController],
  providers: [
    // Handlers
    CreateUserHandler,
    GetUserHandler,
    GetUsersHandler,
    GetUserPreferencesHandler,
    UpdateUserPreferencesHandler,
    ListUserNotificationsHandler,
    MarkNotificationReadHandler,
    ListUserActivityLogsHandler,
    ListUserSecurityLogsHandler,
    CreateDeletionRequestHandler,
    ReviewDeletionRequestHandler,
    ListDeletionRequestsHandler,

    // Repositories
    {
      provide: IUserRepository,
      useClass: UserRepository,
    },
    {
      provide: IUserPreferenceRepository,
      useClass: UserPreferenceRepository,
    },
    {
      provide: IUserNotificationRepository,
      useClass: UserNotificationRepository,
    },
    {
      provide: IUserActivityLogRepository,
      useClass: UserActivityLogRepository,
    },
    {
      provide: IUserSecurityLogRepository,
      useClass: UserSecurityLogRepository,
    },
    {
      provide: IAccountDeletionRequestRepository,
      useClass: AccountDeletionRequestRepository,
    },
  ],
  exports: [
    IUserRepository,
    IUserPreferenceRepository,
    IUserNotificationRepository,
    IUserActivityLogRepository,
    IUserSecurityLogRepository,
    IAccountDeletionRequestRepository,
  ],
})
export class UsersModule { }
