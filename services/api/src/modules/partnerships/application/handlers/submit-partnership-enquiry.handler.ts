import { CommandHandler, ICommandHandler } from '@nestjs/cqrs';
import { PrismaService } from '../../../../shared/infrastructure/prisma/prisma.service';
import { SubmitPartnershipEnquiryCommand } from '../commands/submit-partnership-enquiry.command';
import { BadRequestException } from '@nestjs/common';

@CommandHandler(SubmitPartnershipEnquiryCommand)
export class SubmitPartnershipEnquiryHandler implements ICommandHandler<SubmitPartnershipEnquiryCommand> {
  constructor(private readonly prisma: PrismaService) {}

  async execute(command: SubmitPartnershipEnquiryCommand): Promise<void> {
    const { dto } = command;

    if (!dto.programCategoryId && !dto.programId) {
       throw new BadRequestException('Either programCategoryId or programId must be provided.');
    }

    await this.prisma.partnershipEnquiry.create({
      data: {
        programCategoryId: dto.programCategoryId,
        programId: dto.programId,
        partnershipType: dto.partnershipType,
        subCategory: dto.subCategory,
        fullName: dto.fullName,
        email: dto.email,
        whatsappNumber: dto.whatsappNumber,
        company: dto.company,
        subject: dto.subject,
        description: dto.description,
        status: 'pending'
      }
    });
  }
}
