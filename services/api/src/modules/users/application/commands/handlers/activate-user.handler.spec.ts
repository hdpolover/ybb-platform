import { Test, TestingModule } from '@nestjs/testing';
import { ActivateUserHandler } from './activate-user.handler';
import { ActivateUserCommand } from '../activate-user.command';
import { IUserRepository } from '@core/interfaces/repositories/user.repository.interface';
import { CacheService } from '@shared/infrastructure/cache/cache.service';
import { NotFoundException } from '@nestjs/common';
import { User } from '@core/entities/user.entity';

const mockUser = () =>
  new User('user-1', 'brand-1', 'test@example.com', false, true, new Date(), new Date());

const mockRepository = {
  findById: jest.fn(),
  update: jest.fn(),
};

const mockCacheService = {
  invalidateByPattern: jest.fn(),
};

describe('ActivateUserHandler', () => {
  let handler: ActivateUserHandler;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ActivateUserHandler,
        { provide: IUserRepository, useValue: mockRepository },
        { provide: CacheService, useValue: mockCacheService },
      ],
    }).compile();

    handler = module.get<ActivateUserHandler>(ActivateUserHandler);
    jest.clearAllMocks();
  });

  it('should activate user and invalidate cache', async () => {
    const user = mockUser();
    const command = new ActivateUserCommand('user-1', 'brand-1');

    mockRepository.findById.mockResolvedValue(user);
    mockRepository.update.mockResolvedValue({ ...user, isActive: true });

    const result = await handler.execute(command);

    expect(mockRepository.findById).toHaveBeenCalledWith('user-1', 'brand-1');
    expect(mockRepository.update).toHaveBeenCalled();
    expect(mockCacheService.invalidateByPattern).toHaveBeenCalledWith('user:list:brand-1:*');
    expect(result.isActive).toBe(true);
  });

  it('should throw NotFoundException when user not found', async () => {
    mockRepository.findById.mockResolvedValue(null);

    await expect(
      handler.execute(new ActivateUserCommand('missing', 'brand-1')),
    ).rejects.toThrow(NotFoundException);

    expect(mockRepository.update).not.toHaveBeenCalled();
  });
});
