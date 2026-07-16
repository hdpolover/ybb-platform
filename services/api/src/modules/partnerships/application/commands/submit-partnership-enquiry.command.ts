import { SubmitEnquiryDto } from '../dto/submit-enquiry.dto';

export class SubmitPartnershipEnquiryCommand {
  constructor(
    public readonly dto: SubmitEnquiryDto
  ) {}
}
