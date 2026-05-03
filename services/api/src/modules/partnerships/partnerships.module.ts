import { Module } from '@nestjs/common';
import { CqrsModule } from '@nestjs/cqrs';
import { PrismaModule } from '@shared/infrastructure/prisma/prisma.module';
import { AuthModule } from '@modules/auth/auth.module';
import { PartnershipsPublicController } from './presentation/controllers/partnerships.public.controller';
import { PartnershipsAdminController } from './presentation/controllers/partnerships.admin.controller';
import { GetPublicPartnershipsHandler } from './application/handlers/get-public-partnerships.handler';
import { SubmitPartnershipEnquiryHandler } from './application/handlers/submit-partnership-enquiry.handler';

@Module({
  imports: [CqrsModule, PrismaModule, AuthModule],
  controllers: [PartnershipsPublicController, PartnershipsAdminController],
  providers: [
    GetPublicPartnershipsHandler,
    SubmitPartnershipEnquiryHandler
  ],
})
export class PartnershipsModule {}
