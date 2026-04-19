import {
    Controller,
    Get,
    Post,
    Put,
    Patch,
    Delete,
    Body,
    Param,
    UseGuards,
    HttpException,
    Logger,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth, ApiBody } from '@nestjs/swagger';
import { HttpService } from '@nestjs/axios';
import { ConfigService } from '@nestjs/config';
import { firstValueFrom } from 'rxjs';
import { JwtAuthGuard } from '@modules/auth/infrastructure/guards/jwt-auth.guard';
import { RolesGuard } from '@modules/auth/infrastructure/guards/roles.guard';
import { Roles } from '@modules/auth/application/decorators/roles.decorator';
import { UserRole } from '@core/entities/user.entity';
import { AuditTrail } from '@shared/decorators/audit-trail.decorator';
import { ChangeType } from '@prisma/client';
import {
    CreateGatewayConfigDto,
    UpdateGatewayConfigDto,
    SetGatewayActiveDto,
} from './dto/admin-gateway-config.dto';

// Thin forwarder to the Go payment service /gateway-configs endpoints.
// Credential fields flow through as plaintext on the wire (over TLS within
// the cluster) and are encrypted at rest by the payment service's repository.
@ApiTags('Admin Payment Gateways')
@Controller('admin/payment-gateways')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(UserRole.ADMIN, UserRole.SUPER_ADMIN)
@ApiBearerAuth()
export class GatewayAdminController {
    private readonly paymentServiceUrl: string;
    private readonly paymentServiceInternalKey: string;
    private readonly logger = new Logger(GatewayAdminController.name);

    constructor(
        private readonly httpService: HttpService,
        private readonly configService: ConfigService,
    ) {
        this.paymentServiceUrl = this.configService.get<string>('PAYMENT_SERVICE_URL', 'http://payment-service:8002');
        this.paymentServiceInternalKey = this.configService.get<string>('PAYMENT_SERVICE_INTERNAL_KEY', '');
    }

    @Get()
    @ApiOperation({ summary: 'List payment gateway configurations' })
    @ApiResponse({ status: 200 })
    async list() {
        try {
            const { data } = await firstValueFrom(
                this.httpService.get(`${this.paymentServiceUrl}/api/v1/gateway-configs`, {
                    headers: this.buildInternalHeaders(),
                }),
            );
            return data;
        } catch (error) {
            this.handleError(error);
        }
    }

    @Get(':id')
    @ApiOperation({ summary: 'Get a gateway configuration' })
    async getById(@Param('id') id: string) {
        try {
            const { data } = await firstValueFrom(
                this.httpService.get(`${this.paymentServiceUrl}/api/v1/gateway-configs/${id}`, {
                    headers: this.buildInternalHeaders(),
                }),
            );
            return data;
        } catch (error) {
            this.handleError(error);
        }
    }

    @Post()
    @AuditTrail({ entityType: 'GatewayConfig', action: ChangeType.create })
    @ApiOperation({ summary: 'Create a gateway configuration' })
    @ApiBody({ type: CreateGatewayConfigDto })
    @ApiResponse({ status: 201 })
    async create(@Body() body: CreateGatewayConfigDto) {
        try {
            const { data } = await firstValueFrom(
                this.httpService.post(`${this.paymentServiceUrl}/api/v1/gateway-configs`, body, {
                    headers: this.buildInternalHeaders(),
                }),
            );
            return data;
        } catch (error) {
            this.handleError(error);
        }
    }

    @Put(':id')
    @AuditTrail({ entityType: 'GatewayConfig', action: ChangeType.update })
    @ApiOperation({ summary: 'Update a gateway configuration' })
    @ApiBody({ type: UpdateGatewayConfigDto })
    async update(@Param('id') id: string, @Body() body: UpdateGatewayConfigDto) {
        try {
            const { data } = await firstValueFrom(
                this.httpService.put(`${this.paymentServiceUrl}/api/v1/gateway-configs/${id}`, body, {
                    headers: this.buildInternalHeaders(),
                }),
            );
            return data;
        } catch (error) {
            this.handleError(error);
        }
    }

    @Patch(':id/active')
    @AuditTrail({ entityType: 'GatewayConfig', action: ChangeType.update })
    @ApiOperation({ summary: 'Toggle is_active on a gateway configuration' })
    @ApiBody({ type: SetGatewayActiveDto })
    async setActive(@Param('id') id: string, @Body() body: SetGatewayActiveDto) {
        try {
            const { data } = await firstValueFrom(
                this.httpService.patch(`${this.paymentServiceUrl}/api/v1/gateway-configs/${id}/active`, body, {
                    headers: this.buildInternalHeaders(),
                }),
            );
            return data;
        } catch (error) {
            this.handleError(error);
        }
    }

    @Delete(':id')
    @AuditTrail({ entityType: 'GatewayConfig', action: ChangeType.delete })
    @ApiOperation({ summary: 'Delete a gateway configuration (blocked if referenced)' })
    async delete(@Param('id') id: string) {
        try {
            const { data } = await firstValueFrom(
                this.httpService.delete(`${this.paymentServiceUrl}/api/v1/gateway-configs/${id}`, {
                    headers: this.buildInternalHeaders(),
                }),
            );
            return data;
        } catch (error) {
            this.handleError(error);
        }
    }

    private handleError(error: unknown): never {
        const err = error as { response?: { status: number; data: unknown }; message?: string };
        if (err.response) {
            this.logger.error(`Payment Service Error: ${err.response.status} - ${JSON.stringify(err.response.data)}`);
            throw new HttpException(err.response.data as string | Record<string, unknown>, err.response.status);
        }
        this.logger.error(`Internal Error: ${err.message}`);
        throw new HttpException(err.message ?? 'Internal server error', 500);
    }

    private buildInternalHeaders(): Record<string, string> {
        if (!this.paymentServiceInternalKey) return {};
        return { 'X-Internal-Service-Key': this.paymentServiceInternalKey };
    }
}
