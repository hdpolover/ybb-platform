import { Module } from '@nestjs/common';
import { CqrsModule } from '@nestjs/cqrs';
import { SharedModule } from '../../shared/shared.module';
import { PartnershipsPublicController } from './presentation/controllers/partnerships.public.controller';
import { GetPublicPartnershipsHandler } from './application/handlers/get-public-partnerships.handler';
import { SubmitPartnershipEnquiryHandler } from './application/handlers/submit-partnership-enquiry.handler';

@Module({
  imports: [CqrsModule, SharedModule],
  controllers: [PartnershipsPublicController],
  providers: [
    GetPublicPartnershipsHandler,
    SubmitPartnershipEnquiryHandler
  ],
})
export class PartnershipsModule {}
