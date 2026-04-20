import { Injectable, Inject } from '@nestjs/common';
import { GetUsersQuery } from '../get-users.query';
import { UserResponseDto, UserRoleEnriched } from '@modules/users/presentation/dto/user-response.dto';
import { IUserRepository } from '@core/interfaces/repositories/user.repository.interface';
import { User } from '@core/entities/user.entity';
import { PrismaService } from '@shared/infrastructure/prisma/prisma.service';

@Injectable()
export class GetUsersHandler {
  constructor(
    @Inject(IUserRepository)
    private readonly userRepository: IUserRepository,
    private readonly prisma: PrismaService,
  ) {}

  async execute(query: GetUsersQuery): Promise<UserResponseDto[]> {
    const skip = query.skip ?? 0;
    const take = query.take ?? 10;

    const users = await this.userRepository.findAll(query.brandId, skip, take, query.role);
    return this.enrichWithRoles(users);
  }

  private async enrichWithRoles(users: User[]): Promise<UserResponseDto[]> {
    if (users.length === 0) return [];

    const ids = users.map((u) => u.id);

    const rows = await this.prisma.user.findMany({
      where: { id: { in: ids }, deletedAt: null },
      select: {
        id: true,
        admin: { select: { id: true } },
        participant: { select: { id: true } },
        ambassador: { select: { id: true } },
      },
    });

    const roleMap = new Map<string, UserRoleEnriched>();
    for (const row of rows) {
      if (row.admin) roleMap.set(row.id, 'admin');
      else if (row.participant) roleMap.set(row.id, 'participant');
      else if (row.ambassador) roleMap.set(row.id, 'ambassador');
      else roleMap.set(row.id, 'none');
    }

    return users.map((user) => ({
      id: user.id,
      brandId: user.brandId,
      email: user.email,
      isActive: user.isActive,
      emailVerified: user.emailVerified,
      role: roleMap.get(user.id) ?? 'none',
      createdAt: user.createdAt,
      updatedAt: user.updatedAt,
    }));
  }
}
