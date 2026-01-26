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
    HttpException
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth, ApiBody, ApiQuery } from '@nestjs/swagger';
import { HttpService } from '@nestjs/axios';
import { ConfigService } from '@nestjs/config';
import { firstValueFrom } from 'rxjs';
import { JwtAuthGuard } from '@modules/auth/infrastructure/guards/jwt-auth.guard';
import { RolesGuard } from '@modules/auth/infrastructure/guards/roles.guard';
import { Roles } from '@modules/auth/application/decorators/roles.decorator';
import { UserRole } from '@core/entities/user.entity';
import { CreatePaymentMethodDto, UpdatePaymentMethodDto } from './dto/admin-payment-method.dto';

@ApiTags('Admin Payments')
@Controller('admin/payments')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(UserRole.ADMIN, UserRole.SUPER_ADMIN)
@ApiBearerAuth()
export class PaymentAdminController {
    private readonly paymentServiceUrl: string;

    constructor(
        private readonly httpService: HttpService,
        private readonly configService: ConfigService,
    ) {
        console.log("Using HTTP Payment Admin Controller");
        this.paymentServiceUrl = this.configService.get<string>('PAYMENT_SERVICE_URL', 'http://payment-service:8002');
    }

    @Get('methods')
    @ApiOperation({ summary: 'List payment methods (Admin)' })
    @ApiQuery({ name: 'is_active', required: false, type: Boolean })
    @ApiResponse({ status: 200, description: 'List of payment methods' })
    async listMethods(@Query() query: any) {
        try {
            const { data } = await firstValueFrom(
                this.httpService.get(`${this.paymentServiceUrl}/api/v1/payment-methods`, { params: query })
            );
            return data;
        } catch (error) {
            this.handleError(error);
        }
    }

    @Post('methods')
    @ApiOperation({ summary: 'Create payment method' })
    @ApiBody({ type: CreatePaymentMethodDto })
    @ApiResponse({ status: 201, description: 'Payment method created' })
    async createMethod(@Body() body: CreatePaymentMethodDto) {
        try {
            const { data } = await firstValueFrom(
                this.httpService.post(`${this.paymentServiceUrl}/api/v1/payment-methods`, body)
            );
            return data;
        } catch (error) {
            this.handleError(error);
        }
    }

    @Get('methods/:id')
    @ApiOperation({ summary: 'Get payment method detail' })
    @ApiResponse({ status: 200, description: 'Payment method detail' })
    async getMethod(@Param('id') id: string) {
        try {
            const { data } = await firstValueFrom(
                this.httpService.get(`${this.paymentServiceUrl}/api/v1/payment-methods/${id}`)
            );
            return data;
        } catch (error) {
            this.handleError(error);
        }
    }

    @Put('methods/:id')
    @ApiOperation({ summary: 'Update payment method' })
    @ApiBody({ type: UpdatePaymentMethodDto })
    @ApiResponse({ status: 200, description: 'Payment method updated' })
    async updateMethod(@Param('id') id: string, @Body() body: UpdatePaymentMethodDto) {
        try {
            const { data } = await firstValueFrom(
                this.httpService.put(`${this.paymentServiceUrl}/api/v1/payment-methods/${id}`, body)
            );
            return data;
        } catch (error) {
            this.handleError(error);
        }
    }

    @Delete('methods/:id')
    @ApiOperation({ summary: 'Delete payment method' })
    @ApiResponse({ status: 200, description: 'Payment method deleted' })
    async deleteMethod(@Param('id') id: string) {
        try {
            const { data } = await firstValueFrom(
                this.httpService.delete(`${this.paymentServiceUrl}/api/v1/payment-methods/${id}`)
            );
            return data;
        } catch (error) {
            this.handleError(error);
        }
    }

    private handleError(error: any) {
        if (error.response) {
            throw new HttpException(error.response.data, error.response.status);
        }
        throw error;
    }
}
