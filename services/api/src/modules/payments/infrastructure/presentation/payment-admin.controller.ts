import {
    Controller,
    Get,
    Post,
    Put,
    Delete,
    Body,
    Param,
    UseGuards,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { JwtAuthGuard } from '@modules/auth/infrastructure/guards/jwt-auth.guard';
import { RolesGuard } from '@modules/auth/infrastructure/guards/roles.guard';
import { Roles } from '@modules/auth/application/decorators/roles.decorator';
import { UserRole } from '@core/entities/user.entity';
import { PaymentGrpcClient } from '../services/payment-grpc.client';
import { CreatePaymentMethodDto, UpdatePaymentMethodDto } from '../../presentation/dto/admin-payment-method.dto';

@ApiTags('Admin Payments')
@Controller('admin/payments/methods')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(UserRole.ADMIN, UserRole.SUPER_ADMIN)
@ApiBearerAuth()
export class PaymentAdminController {
    constructor(
        private readonly paymentGrpcClient: PaymentGrpcClient,
    ) { }

    @Post()
    @ApiOperation({ summary: 'Create payment method' })
    async create(@Body() dto: CreatePaymentMethodDto) {
        return this.paymentGrpcClient.adminCreatePaymentMethod(dto);
    }

    @Put(':id')
    @ApiOperation({ summary: 'Update payment method' })
    async update(@Param('id') id: string, @Body() dto: UpdatePaymentMethodDto) {
        // We unpack the ID from param and spread the DTO. 
        // Note: DTO also has ID? No, DTO usually shouldn't have ID for update body if it's in Param.
        // But types overlap.
        return this.paymentGrpcClient.adminUpdatePaymentMethod({ id, ...dto });
    }

    @Delete(':id')
    @ApiOperation({ summary: 'Delete payment method' })
    async remove(@Param('id') id: string) {
        return this.paymentGrpcClient.adminDeletePaymentMethod({ id });
    }

    @Get(':id')
    @ApiOperation({ summary: 'Get payment method' })
    async findOne(@Param('id') id: string) {
        return this.paymentGrpcClient.adminGetPaymentMethod({ id });
    }

    @Get()
    @ApiOperation({ summary: 'List payment methods' })
    async findAll() {
        return this.paymentGrpcClient.adminListPaymentMethods({});
    }
}
