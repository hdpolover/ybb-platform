import { PrismaTransactionClient } from '@shared/types/prisma-transaction.type';
import { PrismaService } from '@shared/infrastructure/prisma/prisma.service';
import { UserRepository } from '@modules/users/infrastructure/persistence/user.repository';
import { ParticipantRepository } from '@modules/participants/infrastructure/persistence/participant.repository';
import { AmbassadorRepository } from '@modules/participants/infrastructure/persistence/ambassador.repository';
import { ApplicationRepository } from '@modules/applications/infrastructure/persistence/application.repository';
import { SupportTicketRepository } from '@modules/support/infrastructure/persistence/support-ticket.repository';
import { ApplicationMapper } from '@modules/applications/infrastructure/mappers/application.mapper';

/**
 * Transactional Repositories
 * 
 * Factory class that creates repository instances bound to a transaction context.
 * All repositories created by this class share the same database transaction,
 * ensuring atomic operations across multiple entities.
 * 
 * This class is instantiated by the UnitOfWork service and passed to
 * transaction callbacks, providing type-safe access to all repositories
 * within the transaction scope.
 * 
 * @example
 * ```typescript
 * await unitOfWork.execute(async (repos) => {
 *   const user = await repos.users.create(userEntity);
 *   const participant = await repos.participants.create(participantEntity);
 *   // Both operations share the same transaction
 * });
 * ```
 */
export class TransactionalRepositories {
  /** User repository for user account operations */
  public readonly users: UserRepository;
  
  /** Participant repository for participant profile operations */
  public readonly participants: ParticipantRepository;
  
  /** Ambassador repository for ambassador program operations */
  public readonly ambassadors: AmbassadorRepository;
  
  /** Application repository for program application operations */
  public readonly applications: ApplicationRepository;
  
  /** Support ticket repository for support operations */
  public readonly supportTickets: SupportTicketRepository;

  /**
   * Raw transaction client for direct Prisma operations
   * 
   * Use this when you need to perform operations not covered by repositories,
   * or when you need direct access to Prisma for complex queries.
   * 
   * @example
   * ```typescript
   * await repos.tx.ambassadorReferral.create({
   *   data: { participantId, ambassadorId, ... }
   * });
   * ```
   */
  public readonly tx: PrismaTransactionClient;

  constructor(tx: PrismaTransactionClient) {
    this.tx = tx;

    // Initialize mapper for ApplicationRepository
    const applicationMapper = new ApplicationMapper();

    // Create repository instances with transaction client
    // We cast through unknown to PrismaService because PrismaTransactionClient
    // is structurally compatible for all repository operations within a transaction scope
    const txAsService = tx as unknown as PrismaService;
    this.users = new UserRepository(txAsService);
    this.participants = new ParticipantRepository(txAsService);
    this.ambassadors = new AmbassadorRepository(txAsService);
    this.applications = new ApplicationRepository(txAsService, applicationMapper);
    this.supportTickets = new SupportTicketRepository(txAsService);
  }

  /**
   * Helper method to create ambassador referral
   * 
   * Since AmbassadorReferral doesn't have its own repository yet,
   * this helper provides a type-safe way to create referrals within a transaction.
   */
  async createAmbassadorReferral(data: {
    participantId: string;
    ambassadorId: string;
    referredAt: Date;
  }) {
    return this.tx.ambassadorReferral.create({
      data: {
        participantId: data.participantId,
        ambassadorId: data.ambassadorId,
        referredAt: data.referredAt,
      },
    });
  }

  /**
   * Helper method to update ambassador stats
   * 
   * Increments the totalReferrals count for an ambassador.
   */
  async incrementAmbassadorReferrals(ambassadorId: string) {
    return this.tx.ambassador.update({
      where: { id: ambassadorId },
      data: { totalReferrals: { increment: 1 } },
    });
  }

  /**
   * Helper method to create admin profile
   * 
   * Used during admin registration flow.
   */
  async createAdmin(data: {
    id?: string;
    userId: string;
    fullName: string;
    phoneNumber?: string;
  }) {
    return this.tx.admin.create({
      data: {
        userId: data.userId,
        fullName: data.fullName,
        phoneNumber: data.phoneNumber,
      },
    });
  }

  /**
   * Helper method to update application status
   * 
   * Used in payment success flow.
   */
  async updateApplicationStatus(
    applicationId: string,
    status: string,
  ) {
    return this.tx.participantApplication.update({
      where: { id: applicationId },
      data: { status: status as import('@prisma/client').ApplicationStatus },
    });
  }
}
