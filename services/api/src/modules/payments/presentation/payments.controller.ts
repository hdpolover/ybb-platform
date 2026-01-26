import {
    Controller,
    Get,
    Post,
    Body,
    Param,
    UseGuards,
    UnauthorizedException,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth } from '@nestjs/swagger';
import { CommandBus, QueryBus } from '@nestjs/cqrs';
import { JwtAuthGuard } from '@modules/auth/infrastructure/guards/jwt-auth.guard';
import { CurrentUser } from '@shared/decorators/current-user.decorator';
import { ListUserPaymentsQuery } from '../application/queries/list-user-payments.query';
import { GetPaymentDetailQuery } from '../application/queries/get-payment-detail.query';
import { PaymentResponseDto } from './dto/payment.dto';
import { CreateIntentDto } from './dto/create-intent.dto';
import { ConfirmPaymentDto } from './dto/confirm-payment.dto';
import { CreateIntentCommand } from '../application/commands/create-intent.command';
import { ProcessPaymentCommand } from '../application/commands/process-payment.command';

@ApiTags('Payments')
@Controller('payments')
@UseGuards(JwtAuthGuard)
@ApiBearerAuth()
export class PaymentsController {
    constructor(
        private readonly commandBus: CommandBus,
        private readonly queryBus: QueryBus,
    ) { }

    @Post('intents')
    @ApiOperation({ summary: 'Create payment intent' })
    @ApiResponse({ status: 201, description: 'Intent created' })
    async createIntent(
        @Body() dto: CreateIntentDto,
        @CurrentUser() user: any,
    ): Promise<any> {
        if (!user || !user.id) throw new UnauthorizedException();
        return this.commandBus.execute(new CreateIntentCommand(user.id, dto));
    }

    @Post('intents/:id/confirm')
    @ApiOperation({ summary: 'Confirm payment (charge)' })
    @ApiResponse({ status: 200, description: 'Payment processing initiated' })
    async confirmPayment(
        @Param('id') id: string,
        @Body() dto: ConfirmPaymentDto,
        @CurrentUser() user: any,
    ): Promise<any> {
        if (!user || !user.id) throw new UnauthorizedException();
        return this.commandBus.execute(new ProcessPaymentCommand(id, dto, user.id));
    }

    @Get()
    @ApiOperation({ summary: 'List my payments' })
    @ApiResponse({ status: 200, description: 'Return list of payments', type: [PaymentResponseDto] })
    async listUserPayments(@CurrentUser() user: any): Promise<PaymentResponseDto[]> {
        if (!user || !user.id) throw new UnauthorizedException();
        return this.queryBus.execute(new ListUserPaymentsQuery(user.id));
    }

    @Get(':id')
    @ApiOperation({ summary: 'Get payment detail' })
    @ApiResponse({ status: 200, description: 'Return payment detail', type: PaymentResponseDto })
    @ApiResponse({ status: 404, description: 'Payment not found' })
    async getPaymentDetail(
        @Param('id') id: string,
        @CurrentUser() user: any,
    ): Promise<PaymentResponseDto> {
        if (!user || !user.id) throw new UnauthorizedException();
        return this.queryBus.execute(new GetPaymentDetailQuery(id, user.id));
    }
}
