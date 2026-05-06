import {
    Controller,
    Get,
    Headers,
    Query,
    UnauthorizedException,
} from '@nestjs/common';
import { ApiExcludeEndpoint } from '@nestjs/swagger';
import { ConfigService } from '@nestjs/config';
import { EmailTemplateService } from '../application/services/email-template.service';

@Controller('internal/email-templates')
export class EmailTemplateInternalController {
    constructor(
        private readonly service: EmailTemplateService,
        private readonly configService: ConfigService,
    ) {}

    @Get('resolve')
    @ApiExcludeEndpoint()
    async resolve(
        @Query('type') type?: string,
        @Query('brandId') brandId?: string,
        @Query('programId') programId?: string,
        @Headers('authorization') authorization?: string,
    ) {
        const internalKey = this.configService
            .get<string>('NOTIFICATION_SERVICE_INTERNAL_KEY', '')
            .trim();

        if (internalKey && authorization !== `Bearer ${internalKey}`) {
            throw new UnauthorizedException('Invalid internal service key');
        }

        if (!type?.trim()) {
            return null;
        }

        return this.service.resolve(type.trim(), {
            brandId: brandId?.trim() || null,
            programId: programId?.trim() || null,
        });
    }
}
