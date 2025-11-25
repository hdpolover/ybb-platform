import { Injectable, Inject } from '@nestjs/common';
import { GetUsersQuery } from '../get-users.query';
import { UserResponseDto } from '@modules/users/presentation/dto/user-response.dto';
import { IUserRepository } from '@core/interfaces/repositories/user.repository.interface';
import { User } from '@core/entities/user.entity';

@Injectable()
export class GetUsersHandler {
  constructor(
    @Inject(IUserRepository)
    private readonly userRepository: IUserRepository,
  ) {}

  async execute(query: GetUsersQuery): Promise<UserResponseDto[]> {
    const users = await this.userRepository.findAll(
      query.brandId,
      query.skip,
      query.take,
    );

    return users.map(user => this.toDto(user));
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
