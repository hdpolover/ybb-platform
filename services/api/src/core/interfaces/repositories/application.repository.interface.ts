import { ParticipantApplication, ApplicationStatus } from '@core/entities/participant-application.entity';

/**
 * Application Repository Interface
 * 
 * Domain Layer - Repository Contract
 * Defines data access methods for applications
 */
export interface IApplicationRepository {
  /**
   * Find application by ID
   */
  findById(id: string): Promise<ParticipantApplication | null>;

  /**
   * Find application by participant and program
   */
  findByParticipantAndProgram(
    participantId: string,
    programId: string,
  ): Promise<ParticipantApplication | null>;

  /**
   * Find all applications for a participant
   */
  findByParticipant(participantId: string): Promise<ParticipantApplication[]>;

  /**
   * Find all applications for a program
   */
  findByProgram(
    programId: string,
    filters?: {
      status?: ApplicationStatus;
      category?: string;
      search?: string;
      limit?: number;
      offset?: number;
    },
  ): Promise<{ applications: ParticipantApplication[]; total: number }>;

  /**
   * Find applications by brand/category
   */
  findByBrand(
    brandId: string,
    filters?: {
      programId?: string;
      status?: ApplicationStatus;
      limit?: number;
      offset?: number;
    },
  ): Promise<{ applications: ParticipantApplication[]; total: number }>;

  /**
   * Create new application
   */
  create(application: ParticipantApplication): Promise<ParticipantApplication>;

  /**
   * Update existing application
   */
  update(application: ParticipantApplication): Promise<ParticipantApplication>;

  /**
   * Delete application (soft delete)
   */
  delete(id: string, deletedBy: string): Promise<void>;

  /**
   * Count applications by status for a program
   */
  countByStatus(
    programId: string,
  ): Promise<Record<ApplicationStatus, number>>;

  /**
   * Check if application exists
   */
  exists(participantId: string, programId: string): Promise<boolean>;
}
