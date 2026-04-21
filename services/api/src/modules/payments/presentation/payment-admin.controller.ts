import {
    Controller,
    Get,
    Post,
    Put,
    Delete,
    Body,
    Param,
    UseGuards,
    Query,
    HttpException,
    Logger
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth, ApiBody, ApiQuery } from '@nestjs/swagger';
import { HttpService } from '@nestjs/axios';
import { ConfigService } from '@nestjs/config';
import { JwtAuthGuard } from '@modules/auth/infrastructure/guards/jwt-auth.guard';
import { RolesGuard } from '@modules/auth/infrastructure/guards/roles.guard';
import { Roles } from '@modules/auth/application/decorators/roles.decorator';
import { UserRole } from '@core/entities/user.entity';
import { CreatePaymentMethodDto, UpdatePaymentMethodDto } from './dto/admin-payment-method.dto';
import { FileServiceClient } from '@modules/files/infrastructure/clients/file-service.client';
import { CurrentUser, CurrentUserData } from '@shared/decorators/current-user.decorator';
import { AuditTrail } from '@shared/decorators/audit-trail.decorator';
import { ChangeType } from '@prisma/client';

import { CacheService } from '@shared/infrastructure/cache/cache.service';
import { CACHE_KEYS, CACHE_TTL } from '@shared/constants/cache-keys';
import { PaymentServiceHttpClient } from '../infrastructure/services/payment-service-http.client';

@ApiTags('Admin Payments')
@Controller('admin/payments')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(UserRole.ADMIN, UserRole.SUPER_ADMIN)
@ApiBearerAuth()
export class PaymentAdminController {
    private readonly paymentServiceInternalKey: string;
    private readonly logger = new Logger(PaymentAdminController.name);

    constructor(
        private readonly paymentServiceClient: PaymentServiceHttpClient,
        private readonly configService: ConfigService,
        private readonly fileService: FileServiceClient,
        private readonly cacheService: CacheService,
    ) {
        this.logger.log("Using HTTP Payment Admin Controller");
        this.paymentServiceInternalKey = this.configService.get<string>('PAYMENT_SERVICE_INTERNAL_KEY', '');
    }

    @Get('methods')
    @ApiOperation({ summary: 'List payment methods (Admin)' })
    @ApiQuery({ name: 'is_active', required: false, type: Boolean })
    @ApiResponse({ status: 200, description: 'List of payment methods' })
    async listMethods(@Query() query: Record<string, string>) {
        try {
            const queryParams = JSON.stringify(query);
            const cacheKey = CACHE_KEYS.PAYMENT_METHODS(queryParams);

            const cached = await this.cacheService.get(cacheKey);
            if (cached) return cached;

            const { data } = await this.paymentServiceClient.get('/api/v1/payment-methods', {
                params: query,
                headers: this.buildInternalHeaders(),
            });

            await this.cacheService.set(cacheKey, data, CACHE_TTL.MEDIUM);

            return data;
        } catch (error) {
            this.handleError(error);
        }
    }

    @Post('methods')
    @AuditTrail({ entityType: 'PaymentMethod', action: ChangeType.create })
    @ApiOperation({ summary: 'Create payment method' })
    @ApiBody({ type: CreatePaymentMethodDto })
    @ApiResponse({ status: 201, description: 'Payment method created' })
    async createMethod(@Body() body: CreatePaymentMethodDto, @CurrentUser() user: CurrentUserData) {
        try {
            if (body.icon) {
                body.icon = await this.resolveIconUrl(body.icon, user);
            }

            this.logger.log(`Creating payment method with icon: ${body.icon}`);

            const { data } = await this.paymentServiceClient.post('/api/v1/payment-methods', body, {
                headers: this.buildInternalHeaders(),
            });

            await this.cacheService.invalidateByPattern('payment:methods:*');

            return data;
        } catch (error) {
            this.logger.error(`Create method failed: ${error.message}`, error.stack);
            this.handleError(error);
        }
    }


    @Get('methods/:id')
    @ApiOperation({ summary: 'Get payment method detail' })
    @ApiResponse({ status: 200, description: 'Payment method detail' })
    async getMethod(@Param('id') id: string) {
        try {
            const { data } = await this.paymentServiceClient.get(`/api/v1/payment-methods/${id}`, {
                headers: this.buildInternalHeaders(),
            });
            return data;
        } catch (error) {
            this.handleError(error);
        }
    }

    @Put('methods/:id')
    @AuditTrail({ entityType: 'PaymentMethod', action: ChangeType.update })
    @ApiOperation({ summary: 'Update payment method' })
    @ApiBody({ type: UpdatePaymentMethodDto })
    @ApiResponse({ status: 200, description: 'Payment method updated' })
    async updateMethod(@Param('id') id: string, @Body() body: UpdatePaymentMethodDto, @CurrentUser() user: CurrentUserData) {
        try {
            if (body.icon) {
                body.icon = await this.resolveIconUrl(body.icon, user);
            }

            const { data } = await this.paymentServiceClient.put(`/api/v1/payment-methods/${id}`, body, {
                headers: this.buildInternalHeaders(),
            });

            await this.cacheService.invalidateByPattern('payment:methods:*');

            return data;
        } catch (error) {
            this.handleError(error);
        }
    }

    @Delete('methods/:id')
    @AuditTrail({ entityType: 'PaymentMethod', action: ChangeType.delete })
    @ApiOperation({ summary: 'Delete payment method' })
    @ApiResponse({ status: 200, description: 'Payment method deleted' })
    async deleteMethod(@Param('id') id: string) {
        try {
            const { data } = await this.paymentServiceClient.delete(`/api/v1/payment-methods/${id}`, {
                headers: this.buildInternalHeaders(),
            });

            await this.cacheService.invalidateByPattern('payment:methods:*');

            return data;
        } catch (error) {
            this.handleError(error);
        }
    }

    /**
     * Helper to resolve File ID (UUID) to full public URL.
     * If the icon string is already a URL or not a UUID, it is returned as is.
     */
    private async resolveIconUrl(icon: string, user: CurrentUserData): Promise<string> {
        this.logger.log(`Resolving icon UUID: ${icon}. User: ${user.userId}, Brand: ${user.brandId}`);
        if (!this.isValidUUID(icon)) {
            this.logger.debug(`Icon ${icon} is not a valid UUID, returning as is`);
            return icon;
        }

        try {
            const fileInfo = await this.fileService.getFile(icon, user.userId, user.brandId);
            this.logger.log(`Resolved file info received`);

            // Handle various possible response structures from File Service
            // It might return { data: { url: ... } } or just { url: ... }
            const data = (fileInfo.data || fileInfo) as Record<string, string | undefined>;
            const resolvedUrl = data.url || data.display_url;

            if (resolvedUrl) {
                this.logger.log(`Resolved URL: ${resolvedUrl}`);
                return resolvedUrl;
            }

            if (data.download_url) {
                this.logger.log(`Using download URL: ${data.download_url}`);
                return data.download_url;
            }

            this.logger.warn(`File info found but no URL property. Keys: ${Object.keys(data)}`);
            return icon;

        } catch (e) {
            this.logger.warn(`Failed to resolve icon UUID: ${icon}. Error: ${e.message}`);
            if (e.response) {
                this.logger.warn(`Error details: ${e.response.status} ${JSON.stringify(e.response.data)}`);
            }
            return icon;
        }
    }

    private isValidUUID(uuid: string): boolean {
        const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-5][0-9a-f]{3}-[089ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
        return uuidRegex.test(uuid);
    }

    private handleError(error: unknown) {
        const err = error as { response?: { status: number; data: unknown }; message?: string };
        if (err.response) {
            this.logger.error(`Payment Service Error: ${err.response.status} - ${JSON.stringify(err.response.data)}`);
            throw new HttpException(err.response.data as string | Record<string, unknown>, err.response.status);
        }
        this.logger.error(`Internal Error: ${err.message}`);
        throw new HttpException(err.message ?? 'Internal server error', 500);
    }

    private buildInternalHeaders(): Record<string, string> {
        if (!this.paymentServiceInternalKey) {
            return {};
        }

        return {
            'X-Internal-Service-Key': this.paymentServiceInternalKey,
        };
    }
}
