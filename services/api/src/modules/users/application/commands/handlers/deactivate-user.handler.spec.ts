import { Test, TestingModule } from '@nestjs/testing';
import { DeactivateUserHandler } from './deactivate-user.handler';
import { DeactivateUserCommand } from '../deactivate-user.command';
import { IUserRepository } from '@core/interfaces/repositories/user.repository.interface';
import { CacheService } from '@shared/infrastructure/cache/cache.service';
import { NotFoundException } from '@nestjs/common';
import { User } from '@core/entities/user.entity';

const mockUser = () =>
  new User('user-1', 'brand-1', 'test@example.com', true, true, new Date(), new Date());

const mockRepository = {
  findById: jest.fn(),
  update: jest.fn(),
};

const mockCacheService = {
  invalidateByPattern: jest.fn(),
};

describe('DeactivateUserHandler', () => {
  let handler: DeactivateUserHandler;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        DeactivateUserHandler,
        { provide: IUserRepository, useValue: mockRepository },
        { provide: CacheService, useValue: mockCacheService },
      ],
    }).compile();

    handler = module.get<DeactivateUserHandler>(DeactivateUserHandler);
    jest.clearAllMocks();
  });

  it('should deactivate user and invalidate cache', async () => {
    const user = mockUser();
    const command = new DeactivateUserCommand('user-1', 'brand-1');

    mockRepository.findById.mockResolvedValue(user);
    mockRepository.update.mockResolvedValue({ ...user, isActive: false });

    const result = await handler.execute(command);

    expect(mockRepository.findById).toHaveBeenCalledWith('user-1', 'brand-1');
    expect(mockRepository.update).toHaveBeenCalledWith(
      expect.objectContaining({ isActive: false }),
    );
    expect(mockCacheService.invalidateByPattern).toHaveBeenCalledWith('user:list:brand-1:*');
    expect(result.isActive).toBe(false);
  });

  it('should throw NotFoundException when user not found', async () => {
    mockRepository.findById.mockResolvedValue(null);

    await expect(
      handler.execute(new DeactivateUserCommand('missing', 'brand-1')),
    ).rejects.toThrow(NotFoundException);

    expect(mockRepository.update).not.toHaveBeenCalled();
  });
});
