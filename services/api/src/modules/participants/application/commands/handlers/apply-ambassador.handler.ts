import { CommandHandler, ICommandHandler } from '@nestjs/cqrs';
import { Inject, BadRequestException, ConflictException } from '@nestjs/common';
import { ApplyAmbassadorCommand } from '../apply-ambassador.command';
import { IAmbassadorRepository } from '../../../../../core/interfaces/repositories/ambassador.repository.interface';
import { Ambassador } from '../../../../../core/entities/ambassador.entity';
// import { customAlphabet } from 'nanoid'; // If nanoid is available, else use custom function

@CommandHandler(ApplyAmbassadorCommand)
export class ApplyAmbassadorHandler implements ICommandHandler<ApplyAmbassadorCommand> {
    constructor(
        @Inject('IAmbassadorRepository')
        private readonly ambassadorRepository: IAmbassadorRepository,
    ) { }

    async execute(command: ApplyAmbassadorCommand): Promise<Ambassador> {
        const { userId, dto } = command;

        // Check if already ambassador (optional: per program or global? Validating user unique constraint in schema)
        const existing = await this.ambassadorRepository.findByUserId(userId);
        if (existing) {
            throw new ConflictException('User is already an ambassador');
        }

        // Generate Referral Code
        const referralCode = await this.generateReferralCode(dto.fullName);

        // Create
        return this.ambassadorRepository.create({
            userId,
            programId: dto.programId,
            fullName: dto.fullName,
            phoneNumber: dto.phoneNumber,
            institution: dto.institution,
            referralCode,
        });
    }

    private async generateReferralCode(name: string): Promise<string> {
        // Simple generation logic: First name + random suffix
        // clean name
        const prefix = name.split(' ')[0].toUpperCase().replace(/[^A-Z]/g, '').substring(0, 5);
        const suffix = Math.floor(1000 + Math.random() * 9000); // 4 digit random
        return `${prefix}${suffix}`;
    }
}
