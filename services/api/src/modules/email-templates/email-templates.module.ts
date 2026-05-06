import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { EmailTemplateController } from './presentation/email-template.controller';
import { EmailTemplateInternalController } from './presentation/email-template-internal.controller';
import { EmailTemplateService } from './application/services/email-template.service';
import { EmailTemplateRepository } from './infrastructure/persistence/email-template.repository';

@Module({
    imports: [AuthModule],
    controllers: [EmailTemplateController, EmailTemplateInternalController],
    providers: [EmailTemplateService, EmailTemplateRepository],
    exports: [EmailTemplateService],
})
export class EmailTemplatesModule {}
