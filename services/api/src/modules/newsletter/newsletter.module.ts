
import { Module } from '@nestjs/common';
import { NewsletterController } from './newsletter.controller';
import { NewsletterService } from './newsletter.service';
import { PrismaModule } from '../../shared/infrastructure/prisma/prisma.module';
import { AuthModule } from '../auth/auth.module';

@Module({
  imports: [PrismaModule, AuthModule],
  controllers: [NewsletterController],
  providers: [NewsletterService],
  exports: [NewsletterService]
})
export class NewsletterModule {}
