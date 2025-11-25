import { Injectable } from '@nestjs/common';
import { IUserRepository } from '@core/interfaces/repositories/user.repository.interface';
import { User, UserRole } from '@core/entities/user.entity';
import { PrismaService } from '@shared/infrastructure/prisma/prisma.service';
import { UserMapper } from '../mappers/user.mapper';

/**
 * User Repository Implementation
 * 
 * Infrastructure Layer - Data Access
 * 
 * This repository implements the IUserRepository interface from the domain layer.
 * It uses Prisma to interact with the database but the domain layer doesn't know this.
 * 
 * Clean Architecture Pattern:
 * - Domain defines the interface (IUserRepository)
 * - Infrastructure implements it (UserRepository)
 * - Application layer depends on the interface, not the implementation
 */
@Injectable()
export class UserRepository implements IUserRepository {
  constructor(private readonly prisma: PrismaService) {}

  async findById(id: string, brandId: string): Promise<User | null> {
    const user = await this.prisma.user.findFirst({
      where: { 
        id,
        programCategoryId: brandId,
        deletedAt: null,
      },
    });

    return user ? UserMapper.toDomain(user) : null;
  }

  async findByEmail(email: string, brandId: string): Promise<User | null> {
    const user = await this.prisma.user.findFirst({
      where: { 
        email,
        programCategoryId: brandId,
        deletedAt: null,
      },
    });

    return user ? UserMapper.toDomain(user) : null;
  }

  async findAll(brandId: string, skip?: number, take?: number): Promise<User[]> {
    const users = await this.prisma.user.findMany({
      where: {
        programCategoryId: brandId,
        deletedAt: null,
      },
      skip,
      take,
      orderBy: { createdAt: 'desc' },
    });

    return users.map(user => UserMapper.toDomain(user));
  }

  async create(user: User, passwordHash: string): Promise<User> {
    const createdUser = await this.prisma.user.create({
      data: {
        programCategoryId: user.brandId,
        email: user.email,
        passwordHash,
        isActive: user.isActive,
        emailVerified: user.emailVerified,
      },
    });

    return UserMapper.toDomain(createdUser);
  }

  async update(user: User): Promise<User> {
    const updatedUser = await this.prisma.user.update({
      where: { id: user.id },
      data: {
        email: user.email,
        isActive: user.isActive,
        emailVerified: user.emailVerified,
        updatedAt: new Date(),
      },
    });

    return UserMapper.toDomain(updatedUser);
  }

  async delete(id: string, brandId: string): Promise<boolean> {
    const result = await this.prisma.user.updateMany({
      where: { 
        id, 
        programCategoryId: brandId,
      },
      data: { deletedAt: new Date() },
    });

    return result.count > 0;
  }

  async exists(email: string, brandId: string): Promise<boolean> {
    const count = await this.prisma.user.count({
      where: { 
        email,
        programCategoryId: brandId,
        deletedAt: null,
      },
    });

    return count > 0;
  }

  async count(brandId: string): Promise<number> {
    return this.prisma.user.count({
      where: {
        programCategoryId: brandId,
        deletedAt: null,
      },
    });
  }
}
