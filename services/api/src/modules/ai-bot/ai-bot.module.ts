import { Module } from '@nestjs/common';
import { AiBotService } from './ai-bot.service';
import { AiBotController } from './ai-bot.controller';
import { PrismaModule } from '@shared/infrastructure/prisma/prisma.module';
import { AuthModule } from '../auth/auth.module';

@Module({
  imports: [PrismaModule, AuthModule],
  controllers: [AiBotController],
  providers: [AiBotService],
  exports: [AiBotService],
})
export class AiBotModule {}
