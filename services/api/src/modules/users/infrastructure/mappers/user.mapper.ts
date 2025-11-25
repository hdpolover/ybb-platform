import { User as PrismaUser } from '@prisma/client';
import { User, UserRole } from '@core/entities/user.entity';

/**
 * User Mapper
 * 
 * Infrastructure Layer - Data Mapping
 * 
 * Maps between Prisma models (database layer) and Domain entities.
 * This is crucial for clean architecture - the domain layer should not
 * know about the database implementation.
 */
export class UserMapper {
  /**
   * Convert Prisma model to Domain entity
   */
  static toDomain(prismaUser: PrismaUser): User {
    return new User(
      prismaUser.id,
      prismaUser.programCategoryId,
      prismaUser.email,
      prismaUser.isActive,
      prismaUser.emailVerified,
      prismaUser.createdAt,
      prismaUser.updatedAt,
    );
  }
}
