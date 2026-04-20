import { Injectable, Inject, NotFoundException } from '@nestjs/common';
import { DeactivateUserCommand } from '../deactivate-user.command';
import { UserResponseDto } from '@modules/users/presentation/dto/user-response.dto';
import { IUserRepository } from '@core/interfaces/repositories/user.repository.interface';
import { User } from '@core/entities/user.entity';
import { CacheService } from '@shared/infrastructure/cache/cache.service';

@Injectable()
export class DeactivateUserHandler {
  constructor(
    @Inject(IUserRepository)
    private readonly userRepository: IUserRepository,
    private readonly cacheService: CacheService,
  ) {}

  async execute(command: DeactivateUserCommand): Promise<UserResponseDto> {
    const user = await this.userRepository.findById(command.userId, command.brandId);
    if (!user) throw new NotFoundException(`User ${command.userId} not found.`);

    user.deactivate();
    const updated = await this.userRepository.update(user);

    await this.cacheService.invalidateByPattern(`user:list:${command.brandId}:*`);

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
