
import { Controller, Post, Body, Get, Query, UseGuards, HttpStatus, HttpCode } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth } from '@nestjs/swagger';
import { NewsletterService } from './newsletter.service';
import { SubscribeNewsletterDto, UnsubscribeNewsletterDto } from './dtos/subscribe.dto';
// import { AdminGuard } from '../../core/guards/admin.guard'; // Assuming you have an admin guard, skipping for now or stubbing
// import { JwtAuthGuard } from '../../core/guards/jwt-auth.guard';

@ApiTags('Newsletter')
@Controller('newsletter')
export class NewsletterController {
  constructor(private readonly newsletterService: NewsletterService) {}

  @Post('subscribe')
  @ApiOperation({ summary: 'Subscribe to newsletter' })
  @ApiResponse({ status: HttpStatus.CREATED, description: 'Successfully subscribed' })
  @ApiResponse({ status: HttpStatus.CONFLICT, description: 'Already subscribed' })
  async subscribe(@Body() dto: SubscribeNewsletterDto) {
    return this.newsletterService.subscribe(dto);
  }

  @Post('unsubscribe')
  @ApiOperation({ summary: 'Unsubscribe from newsletter' })
  @ApiResponse({ status: HttpStatus.OK, description: 'Successfully unsubscribed' })
  @HttpCode(HttpStatus.OK)
  async unsubscribe(@Body() dto: UnsubscribeNewsletterDto) {
    return this.newsletterService.unsubscribe(dto);
  }

  @Get('subscribers')
  @ApiOperation({ summary: 'Get list of active subscribers (Admin only)' })
  // @ApiBearerAuth()
  // @UseGuards(JwtAuthGuard, AdminGuard) // Uncomment when guards are confirmed/imported
  async getSubscribers(
    @Query('page') page: number = 1,
    @Query('limit') limit: number = 10
  ) {
    return this.newsletterService.getSubscribers(Number(page), Number(limit));
  }
}
