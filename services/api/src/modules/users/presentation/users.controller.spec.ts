
import { Test, TestingModule } from '@nestjs/testing';
import { UsersController } from './users.controller';

// Handlers
import { CreateUserHandler } from '../application/commands/handlers/create-user.handler';
import { GetUserHandler } from '../application/queries/handlers/get-user.handler';
import { GetUsersHandler } from '../application/queries/handlers/get-users.handler';
import { GetUserPreferencesHandler } from '../application/queries/handlers/get-user-preferences.handler';
import { UpdateUserPreferencesHandler } from '../application/commands/handlers/update-user-preferences.handler';
import { ListUserNotificationsHandler } from '../application/queries/handlers/list-user-notifications.handler';
import { MarkNotificationReadHandler } from '../application/commands/handlers/mark-notification-read.handler';
import { ListUserActivityLogsHandler } from '../application/queries/handlers/list-user-activity-logs.handler';
import { ListUserSecurityLogsHandler } from '../application/queries/handlers/list-user-security-logs.handler';
import { CreateDeletionRequestHandler } from '../application/commands/handlers/create-deletion-request.handler';
import { CancelDeletionRequestHandler } from '../application/commands/handlers/cancel-deletion-request.handler';
import { ActivateUserHandler } from '../application/commands/handlers/activate-user.handler';
import { DeactivateUserHandler } from '../application/commands/handlers/deactivate-user.handler';

// Commands & Queries
import { GetUserPreferencesQuery } from '../application/queries/get-user-preferences.query';
import { UpdateUserPreferencesCommand } from '../application/commands/update-user-preferences.command';
import { ListUserNotificationsQuery } from '../application/queries/list-user-notifications.query';
import { MarkNotificationReadCommand } from '../application/commands/mark-notification-read.command';

// Shared
import { CacheService } from '@shared/infrastructure/cache/cache.service';

// Guards
import { JwtAuthGuard } from '../../auth/infrastructure/guards/jwt-auth.guard';
import { PrismaReadService } from '@shared/infrastructure/prisma/prisma-read.service';

describe('UsersController', () => {
  let controller: UsersController;

  // Mocks
  const mockCreateUserHandler = { execute: jest.fn() };
  const mockGetUserHandler = { execute: jest.fn() };
  const mockGetUsersHandler = { execute: jest.fn() };
  const mockGetUserPreferencesHandler = { execute: jest.fn() };
  const mockUpdateUserPreferencesHandler = { execute: jest.fn() };
  const mockListUserNotificationsHandler = { execute: jest.fn() };
  const mockMarkNotificationReadHandler = { execute: jest.fn() };
  const mockListUserActivityLogsHandler = { execute: jest.fn() };
  const mockListUserSecurityLogsHandler = { execute: jest.fn() };
  const mockCreateDeletionRequestHandler = { execute: jest.fn() };
  const mockCancelDeletionRequestHandler = { execute: jest.fn() };
  const mockActivateUserHandler = { execute: jest.fn() };
  const mockDeactivateUserHandler = { execute: jest.fn() };
  const mockCacheService = {
    get: jest.fn(),
    set: jest.fn(),
    del: jest.fn(),
    invalidateByPattern: jest.fn(),
  };
  // The brand-scope and outrank checks read the admin tables directly from the
  // controller, above the users-list cache read - a check placed in the handler
  // would be skipped entirely on a warm cache entry.
  const mockPrismaRead = {
    admin: { findUnique: jest.fn(), findFirst: jest.fn() },
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [UsersController],
      providers: [
        { provide: PrismaReadService, useValue: mockPrismaRead },
        { provide: CreateUserHandler, useValue: mockCreateUserHandler },
        { provide: GetUserHandler, useValue: mockGetUserHandler },
        { provide: GetUsersHandler, useValue: mockGetUsersHandler },
        { provide: GetUserPreferencesHandler, useValue: mockGetUserPreferencesHandler },
        { provide: UpdateUserPreferencesHandler, useValue: mockUpdateUserPreferencesHandler },
        { provide: ListUserNotificationsHandler, useValue: mockListUserNotificationsHandler },
        { provide: MarkNotificationReadHandler, useValue: mockMarkNotificationReadHandler },
        { provide: ListUserActivityLogsHandler, useValue: mockListUserActivityLogsHandler },
        { provide: ListUserSecurityLogsHandler, useValue: mockListUserSecurityLogsHandler },
        { provide: CreateDeletionRequestHandler, useValue: mockCreateDeletionRequestHandler },
        { provide: CancelDeletionRequestHandler, useValue: mockCancelDeletionRequestHandler },
        { provide: ActivateUserHandler, useValue: mockActivateUserHandler },
        { provide: DeactivateUserHandler, useValue: mockDeactivateUserHandler },
        { provide: CacheService, useValue: mockCacheService },
      ],
    })
    .overrideGuard(JwtAuthGuard)
    .useValue({ canActivate: () => true })
    .compile();

    controller = module.get<UsersController>(UsersController);
    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  describe('getMyPreferences', () => {
    it('should execute GetUserPreferencesQuery', async () => {
      const user = { userId: 'u-1' } as unknown as import('@shared/decorators/current-user.decorator').CurrentUserData;
      await controller.getMyPreferences(user);
      expect(mockGetUserPreferencesHandler.execute).toHaveBeenCalledWith(
        expect.any(GetUserPreferencesQuery)
      );
      const query = mockGetUserPreferencesHandler.execute.mock.calls[0][0];
      expect(query.userId).toBe('u-1');
    });
  });

  describe('updateMyPreferences', () => {
    it('should execute UpdateUserPreferencesCommand', async () => {
      const user = { userId: 'u-1' } as unknown as import('@shared/decorators/current-user.decorator').CurrentUserData;
      const dto = { language: 'id' };
      await controller.updateMyPreferences(user, dto);
      expect(mockUpdateUserPreferencesHandler.execute).toHaveBeenCalledWith(
          expect.any(UpdateUserPreferencesCommand)
      );
      const cmd = mockUpdateUserPreferencesHandler.execute.mock.calls[0][0];
      expect(cmd.userId).toBe('u-1');
      expect(cmd.updates).toEqual(dto);
    });
  });

  describe('getMyNotifications', () => {
      it('should execute ListUserNotificationsQuery with defaults', async () => {
          const user = { userId: 'u-1' } as unknown as import('@shared/decorators/current-user.decorator').CurrentUserData;
          await controller.getMyNotifications(user);
          expect(mockListUserNotificationsHandler.execute).toHaveBeenCalledWith(
              expect.any(ListUserNotificationsQuery)
          );
          const query = mockListUserNotificationsHandler.execute.mock.calls[0][0];
          expect(query.userId).toBe('u-1');
          expect(query.page).toBe(1);
          expect(query.limit).toBe(10);
      });

      it('should pass pagination params', async () => {
        const user = { userId: 'u-1' } as unknown as import('@shared/decorators/current-user.decorator').CurrentUserData;
        await controller.getMyNotifications(user, 2, 5, 'info', false);
        const query = mockListUserNotificationsHandler.execute.mock.calls[0][0];
        expect(query.page).toBe(2);
        expect(query.limit).toBe(5);
        expect(query.type).toBe('info');
        expect(query.isRead).toBe(false);
      });
  });

  describe('markNotificationRead', () => {
      it('should execute MarkNotificationReadCommand', async () => {
          const user = { userId: 'u-1' } as unknown as import('@shared/decorators/current-user.decorator').CurrentUserData;
          await controller.markNotificationRead(user, 'notif-1');
          expect(mockMarkNotificationReadHandler.execute).toHaveBeenCalledWith(
              expect.any(MarkNotificationReadCommand)
          );
          const cmd = mockMarkNotificationReadHandler.execute.mock.calls[0][0];
          expect(cmd.userId).toBe('u-1');
          expect(cmd.notificationId).toBe('notif-1');
      });
  });
});
