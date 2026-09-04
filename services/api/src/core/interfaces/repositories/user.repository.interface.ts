import { User } from '@core/entities/user.entity';

/**
 * User Repository Interface
 * 
 * Defines the contract for user data persistence.
 * Implementations should be in infrastructure layer.
 */

export interface IUserRepository {
  findById(id: string, brandId?: string): Promise<User | null>;
  
  findByEmail(email: string, brandId: string): Promise<User | null>;
  
  findAll(brandId?: string, skip?: number, take?: number, role?: string): Promise<User[]>;
  
  create(user: User, passwordHash: string): Promise<User>;
  
  update(user: User): Promise<User>;

  exists(email: string, brandId: string): Promise<boolean>;
  
  count(brandId: string): Promise<number>;
}

export const IUserRepository = Symbol('IUserRepository');
