import { Body, Controller, Get, Param, Post } from '@nestjs/common';
import { CommandBus, QueryBus } from '@nestjs/cqrs';
import { ApiOperation, ApiTags, ApiResponse } from '@nestjs/swagger';
import { GetPublicPartnershipsQuery } from '../../application/queries/get-public-partnerships.query';
import { SubmitPartnershipEnquiryCommand } from '../../application/commands/submit-partnership-enquiry.command';
import { SubmitEnquiryDto } from '../../application/dto/submit-enquiry.dto';
import { PartnershipResponseDto } from '../../application/dto/partnership-response.dto';

@ApiTags('Partnerships (Public)')
@Controller('public/brands/:brandSlug/partnerships')
export class PartnershipsPublicController {
  constructor(
    private readonly queryBus: QueryBus,
    private readonly commandBus: CommandBus
  ) {}

  @Get()
  @ApiOperation({ summary: 'Get partnership opportunities and sponsorship tiers for a brand' })
  @ApiResponse({ status: 200, type: PartnershipResponseDto })
  async getPartnerships(@Param('brandSlug') brandSlug: string): Promise<PartnershipResponseDto> {
    return this.queryBus.execute(new GetPublicPartnershipsQuery(brandSlug));
  }

  @Post('enquiry')
  @ApiOperation({ summary: 'Submit a partnership or sponsorship enquiry' })
  @ApiResponse({ status: 201, description: 'Enquiry submitted successfully' })
  async submitEnquiry(
    @Param('brandSlug') brandSlug: string, // Kept for route consistency, but ID in body is used
    @Body() dto: SubmitEnquiryDto
  ): Promise<void> {
    return this.commandBus.execute(new SubmitPartnershipEnquiryCommand(dto));
  }
}
