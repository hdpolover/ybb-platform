/**
 * User Domain Entity
 * 
 * Represents a user in the system.
 * Pure domain object with no framework dependencies.
 * 
 * Note: firstName/lastName are in Admin/Participant/Ambassador models
 * This is just the core authentication user.
 */

export class User {
  constructor(
    public readonly id: string,
    public readonly brandId: string,
    public email: string,
    public isActive: boolean,
    public emailVerified: boolean,
    public readonly createdAt: Date,
    public updatedAt: Date,
  ) {}

  activate(): void {
    this.isActive = true;
    this.updatedAt = new Date();
  }

  deactivate(): void {
    this.isActive = false;
    this.updatedAt = new Date();
  }

  verifyEmail(): void {
    this.emailVerified = true;
    this.updatedAt = new Date();
  }
}

// Keep enum for backwards compatibility
export enum UserRole {
  SUPER_ADMIN = 'super_admin',
  ADMIN = 'admin',
  PROGRAM_MANAGER = 'program_manager',
  REVIEWER = 'reviewer',
  PARTICIPANT = 'participant',
  AMBASSADOR = 'ambassador',
}
