import { Module } from '@nestjs/common';
import { AuthModule } from '@modules/auth/auth.module';
import { PrismaModule } from '@shared/infrastructure/prisma/prisma.module';
import { UsersController } from './presentation/users.controller';
import { ClientsModule, Transport } from '@nestjs/microservices';
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

@Module({
  imports: [
    PrismaModule,
    AuthModule,
    ClientsModule.register([
      {
        name: 'NOTIFICATION_SERVICE',
        transport: Transport.RMQ,
        options: {
          urls: [process.env.RABBITMQ_URL || 'amqp://guest:guest@localhost:5672/'],
          queue: 'notification_queue',
          queueOptions: {
            durable: true,
          },
        },
      },
    ]),
  ],
  controllers: [UsersController],
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
