import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { EmailTemplateController } from './presentation/email-template.controller';
import { EmailTemplateService } from './application/services/email-template.service';
import { EmailTemplateRepository } from './infrastructure/persistence/email-template.repository';

@Module({
    imports: [AuthModule],
    controllers: [EmailTemplateController],
    providers: [EmailTemplateService, EmailTemplateRepository],
    exports: [EmailTemplateService],
})
export class EmailTemplatesModule {}
