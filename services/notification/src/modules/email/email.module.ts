import { Module } from '@nestjs/common';
import { EmailService } from './email.service';
import { ConfigModule } from '@nestjs/config';
import { ReceiptService } from './receipt.service';

@Module({
  imports: [ConfigModule],
  providers: [EmailService, ReceiptService],
  exports: [EmailService, ReceiptService],
})
export class EmailModule {}
