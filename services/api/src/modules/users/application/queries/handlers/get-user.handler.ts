import { Injectable, Inject, NotFoundException } from '@nestjs/common';
import { GetUserQuery } from '../get-user.query';
import { UserResponseDto } from '@modules/users/presentation/dto/user-response.dto';
import { IUserRepository } from '@core/interfaces/repositories/user.repository.interface';
import { User } from '@core/entities/user.entity';
import { CacheService } from '@shared/infrastructure/cache/cache.service';
import { CACHE_KEYS, CACHE_TTL } from '@shared/constants/cache-keys';

@Injectable()
export class GetUserHandler {
  constructor(
    @Inject(IUserRepository)
    private readonly userRepository: IUserRepository,
    private readonly cacheService: CacheService,
  ) { }

  async execute(query: GetUserQuery): Promise<UserResponseDto> {
    const cacheKey = CACHE_KEYS.USER(query.id);

    // Check cache first
    const cached = await this.cacheService.get<UserResponseDto>(cacheKey);
    if (cached) {
      return cached;
    }

    // Fetch from database
    const user = await this.userRepository.findById(query.id, query.brandId);

    if (!user) {
      throw new NotFoundException(`User with id ${query.id} not found`);
    }

    const dto = this.toDto(user);

    // Cache for 5 minutes
    await this.cacheService.set(cacheKey, dto, CACHE_TTL.MEDIUM);

    return dto;
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

