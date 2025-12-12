import { Injectable, Inject, ConflictException } from '@nestjs/common';
import { CreateDeletionRequestCommand } from '../create-deletion-request.command';
import { DeletionRequestResponseDto } from '../../../presentation/dto/deletion-request.dto';
import { IAccountDeletionRequestRepository } from '@core/interfaces/repositories/account-deletion-request.repository.interface';
import { AccountDeletionRequest } from '@core/entities/account-deletion-request.entity';

@Injectable()
export class CreateDeletionRequestHandler {
    constructor(
        @Inject(IAccountDeletionRequestRepository)
        private readonly repository: IAccountDeletionRequestRepository,
    ) { }

    async execute(command: CreateDeletionRequestCommand): Promise<DeletionRequestResponseDto> {
        const pending = await this.repository.findPendingByUserId(command.userId);
        if (pending) {
            throw new ConflictException('You already have a pending deletion request.');
        }

        const request = new AccountDeletionRequest(
            '',
            command.userId,
            command.dto.reason ?? null,
            command.dto.reasonCategory ?? null,
            'pending',
            null, null, null, null, null, null, {},
            command.ipAddress ?? null,
            command.userAgent ?? null,
            new Date(),
            new Date(),
        );

        const created = await this.repository.create(request);

        return {
            id: created.id,
            status: created.status,
            reason: created.reason ?? undefined,
            reasonCategory: created.reasonCategory ?? undefined,
            createdAt: created.createdAt,
        };
    }
}
