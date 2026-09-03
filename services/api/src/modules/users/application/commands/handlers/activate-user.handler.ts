import { Injectable, Inject, NotFoundException } from '@nestjs/common';
import { ActivateUserCommand } from '../activate-user.command';
import { UserResponseDto } from '@modules/users/presentation/dto/user-response.dto';
import { IUserRepository } from '@core/interfaces/repositories/user.repository.interface';
import { User } from '@core/entities/user.entity';
import { CacheService } from '@shared/infrastructure/cache/cache.service';

@Injectable()
export class ActivateUserHandler {
  constructor(
    @Inject(IUserRepository)
    private readonly userRepository: IUserRepository,
    private readonly cacheService: CacheService,
  ) {}

  async execute(command: ActivateUserCommand): Promise<UserResponseDto> {
    const user = await this.userRepository.findById(command.userId, command.brandId);
    if (!user) throw new NotFoundException(`User ${command.userId} not found.`);

    user.activate();
    const updated = await this.userRepository.update(user);

    // Also clears the platform-wide listing. That entry is keyed `user:list:all:*`
    // and a brand-specific pattern never matched it, so a cross-brand list stayed
    // stale after a status change.
    await Promise.all([
      this.cacheService.invalidateByPattern(`user:list:${command.brandId ?? 'all'}:*`),
      this.cacheService.invalidateByPattern('user:list:all:*'),
    ]);

    return this.toDto(updated);
  }

  private toDto(user: User): UserResponseDto {
    return {
      id: user.id,
      brandId: user.brandId,
      email: user.email,
      isActive: user.isActive,
      emailVerified: user.emailVerified,
      createdAt: user.createdAt,
      updatedAt: user.updatedAt,
    };
  }
}
