import { Injectable, Inject, NotFoundException } from '@nestjs/common';
import { GetUserQuery } from '../get-user.query';
import { UserResponseDto } from '@modules/users/presentation/dto/user-response.dto';
import { IUserRepository } from '@core/interfaces/repositories/user.repository.interface';
import { User } from '@core/entities/user.entity';

@Injectable()
export class GetUserHandler {
  constructor(
    @Inject(IUserRepository)
    private readonly userRepository: IUserRepository,
  ) {}

  async execute(query: GetUserQuery): Promise<UserResponseDto> {
    const user = await this.userRepository.findById(query.id, query.brandId);

    if (!user) {
      throw new NotFoundException(`User with id ${query.id} not found`);
    }

    return this.toDto(user);
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
