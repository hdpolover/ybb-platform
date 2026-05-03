import { Controller, Get, Param } from '@nestjs/common';
import { PublicService } from './public.service';

type ApiEnvelope<T> = {
  statusCode: number;
  message: string;
  data: T;
};

@Controller('public/:brand')
export class PublicController {
  constructor(private readonly publicService: PublicService) {}

  @Get('home')
  async getHome(@Param('brand') brand: string) {
    return this.success(await this.publicService.getHome(brand));
  }

  @Get('settings')
  async getSettings(@Param('brand') brand: string) {
    return this.success(await this.publicService.getSettings(brand));
  }

  @Get('programs')
  async getPrograms(@Param('brand') brand: string) {
    return this.success(await this.publicService.getPrograms(brand));
  }

  @Get('programs/:slug')
  async getProgramDetail(@Param('brand') brand: string, @Param('slug') slug: string) {
    return this.success(await this.publicService.getProgramDetail(brand, slug));
  }

  @Get('about')
  async getAbout(@Param('brand') brand: string) {
    return this.success(await this.publicService.getAbout(brand));
  }

  @Get('partners')
  async getPartners(@Param('brand') brand: string) {
    return this.success(await this.publicService.getPartners(brand));
  }

  @Get('faqs')
  async getFaqs(@Param('brand') brand: string) {
    return this.success(await this.publicService.getFaqs(brand));
  }

  @Get('announcements')
  async getAnnouncements(@Param('brand') brand: string) {
    return this.success(await this.publicService.getAnnouncements(brand));
  }

  private success<T>(data: T): ApiEnvelope<T> {
    return {
      statusCode: 200,
      message: 'Success',
      data,
    };
  }
}
