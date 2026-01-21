import { Module } from '@nestjs/common';
import { AiBotService } from './ai-bot.service';
import { AiBotController } from './ai-bot.controller';
import { PrismaModule } from '@shared/infrastructure/prisma/prisma.module';

@Module({
  imports: [PrismaModule],
  controllers: [AiBotController],
  providers: [AiBotService],
  exports: [AiBotService],
})
export class AiBotModule {}
