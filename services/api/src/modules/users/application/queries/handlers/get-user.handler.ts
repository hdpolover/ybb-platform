import { Injectable, Inject, NotFoundException } from '@nestjs/common';
import { GetUserQuery } from '../get-user.query';
import { UserResponseDto, UserRoleEnriched } from '@modules/users/presentation/dto/user-response.dto';
import { IUserRepository } from '@core/interfaces/repositories/user.repository.interface';
import { User } from '@core/entities/user.entity';
import { CacheService } from '@shared/infrastructure/cache/cache.service';
import { CACHE_KEYS, CACHE_TTL } from '@shared/constants/cache-keys';
import { PrismaService } from '@shared/infrastructure/prisma/prisma.service';

@Injectable()
export class GetUserHandler {
  constructor(
    @Inject(IUserRepository)
    private readonly userRepository: IUserRepository,
    private readonly cacheService: CacheService,
    private readonly prisma: PrismaService,
  ) { }

  async execute(query: GetUserQuery): Promise<UserResponseDto> {
    const cacheKey = CACHE_KEYS.USER(query.id);

    const cached = await this.cacheService.get<UserResponseDto>(cacheKey);
    // The cache key is the user id alone, so a warm entry would otherwise be
    // returned before findById's brand filter ever ran - serving another
    // brand's user to an admin the controller had only authorised for their
    // own. Re-check the brand the controller resolved against the cached row
    // rather than re-keying the cache, so entries written by a platform-scope
    // read stay usable by a brand-scoped one.
    if (cached && (!query.brandId || cached.brandId === query.brandId)) {
      return cached;
    }

    const user = await this.userRepository.findById(query.id, query.brandId);

    if (!user) {
      throw new NotFoundException(`User with id ${query.id} not found`);
    }

    const role = await this.resolveRole(user.id);
    const dto = this.toDto(user, role);

    await this.cacheService.set(cacheKey, dto, CACHE_TTL.MEDIUM);

    return dto;
  }

  private async resolveRole(userId: string): Promise<UserRoleEnriched> {
    const row = await this.prisma.user.findUnique({
      where: { id: userId, deletedAt: null },
      select: {
        admin: { select: { id: true } },
        participant: { select: { id: true } },
        ambassador: { select: { id: true } },
      },
    });
    if (!row) return 'none';
    if (row.admin) return 'admin';
    if (row.participant) return 'participant';
    if (row.ambassador) return 'ambassador';
    return 'none';
  }

  private toDto(user: User, role: UserRoleEnriched): UserResponseDto {
    return {
      id: user.id,
      brandId: user.brandId,
      email: user.email,
      isActive: user.isActive,
      emailVerified: user.emailVerified,
      role,
      createdAt: user.createdAt,
      updatedAt: user.updatedAt,
    };
  }
}

