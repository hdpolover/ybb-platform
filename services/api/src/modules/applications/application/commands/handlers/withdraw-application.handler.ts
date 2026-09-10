import { Injectable, NotFoundException, BadRequestException, Inject } from '@nestjs/common';
import { IApplicationRepository } from '@core/interfaces/repositories/application.repository.interface';
import { WithdrawApplicationCommand } from '../withdraw-application.command';
import { ApplicationResponseDto } from '../../dto/application-response.dto';
import { ApplicationMapper } from '@modules/applications/infrastructure/mappers/application.mapper';
import { APPLICATION_REPOSITORY } from '@modules/applications/infrastructure/tokens';
import { CacheService } from '@shared/infrastructure/cache/cache.service';
import { PrismaService } from '@shared/infrastructure/prisma/prisma.service';
import { invalidateParticipantPortalCache } from '@shared/utils/invalidate-participant-portal-cache.util';

/**
 * Withdraw Application Handler
 *
 * Application Layer - Command Handler
 * Handles business logic for withdrawing applications
 */
@Injectable()
export class WithdrawApplicationHandler {
  constructor(
    @Inject(APPLICATION_REPOSITORY)
    private readonly applicationRepository: IApplicationRepository,
    private readonly applicationMapper: ApplicationMapper,
    private readonly cacheService: CacheService,
    private readonly prisma: PrismaService,
  ) {}

  async execute(command: WithdrawApplicationCommand): Promise<ApplicationResponseDto> {
    // Find application
    const application = await this.applicationRepository.findById(command.applicationId);

    if (!application) {
      throw new NotFoundException(`Application ${command.applicationId} not found`);
    }

    // Business rule: Can only withdraw in certain statuses
    if (!application.canWithdraw()) {
      throw new BadRequestException(
        `Cannot withdraw application in ${application.status} status`,
      );
    }

    // Withdraw application
    application.withdraw(command.userId);
    application.addStatusToHistory(application.status, command.userId, 'Application withdrawn');

    // Save to database. Audit M112: only status/statusHistory/withdrawnAt/
    // withdrawnBy are the columns THIS command changed - see
    // ApplicationMapper.toPrismaUpdate for why the field list is explicit now.
    const updated = await this.applicationRepository.update(application, [
      'status',
      'statusHistory',
      'withdrawnAt',
      'withdrawnBy',
    ]);

    // This route (POST /applications/:id/withdraw) is admin-only, so the
    // participant's portal cache must be busted by looking up their real
    // userId rather than via the (removed)
    // @CacheInvalidate(['portal:*:${userId}']) decorator, which resolved to
    // the acting admin's own JWT id and never matched a real key (audit
    // M103/M120, and the specific example the audit called out — a
    // participant kept seeing their withdrawn application as active).
    await invalidateParticipantPortalCache(this.prisma, this.cacheService, application.participantId);

    // Return DTO
    return this.applicationMapper.toDto(updated);
  }
}
