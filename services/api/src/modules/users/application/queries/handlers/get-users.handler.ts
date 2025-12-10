import { Injectable, Inject } from '@nestjs/common';
import { GetUsersQuery } from '../get-users.query';
import { UserResponseDto } from '@modules/users/presentation/dto/user-response.dto';
import { IUserRepository } from '@core/interfaces/repositories/user.repository.interface';
import { User } from '@core/entities/user.entity';
import { CacheService } from '@shared/infrastructure/cache/cache.service';
import { CACHE_KEYS, CACHE_TTL } from '@shared/constants/cache-keys';

@Injectable()
export class GetUsersHandler {
  constructor(
    @Inject(IUserRepository)
    private readonly userRepository: IUserRepository,
    private readonly cacheService: CacheService,
  ) { }

  async execute(query: GetUsersQuery): Promise<UserResponseDto[]> {
    const skip = query.skip ?? 0;
    const take = query.take ?? 10;
    const cacheKey = CACHE_KEYS.USER_LIST(query.brandId, skip, take);

    // Check cache first
    const cached = await this.cacheService.get<UserResponseDto[]>(cacheKey);
    if (cached) {
      return cached;
    }

    // Fetch from database
    const users = await this.userRepository.findAll(
      query.brandId,
      skip,
      take,
    );

    const dtos = users.map(user => this.toDto(user));

    // Cache for 2 minutes (shorter for lists)
    await this.cacheService.set(cacheKey, dtos, CACHE_TTL.SHORT);

    return dtos;
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

