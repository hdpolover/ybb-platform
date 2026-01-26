import { Controller, Get, Post, Param, Body, UseGuards } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth } from '@nestjs/swagger';
import { CommandBus, QueryBus } from '@nestjs/cqrs';
import { JwtAuthGuard } from '@modules/auth/infrastructure/guards/jwt-auth.guard';
import { CurrentUser } from '@shared/decorators/current-user.decorator';
import { CreateSupportTicketDto, ReplySupportTicketDto, SupportTicketResponseDto } from './dto/support-ticket.dto';
import { CreateSupportTicketCommand } from '../application/commands/create-support-ticket.command';
import { ReplySupportTicketCommand } from '../application/commands/reply-support-ticket.command';
import { ListSupportTicketsQuery } from '../application/queries/list-support-tickets.query';
import { GetSupportTicketQuery } from '../application/queries/get-support-ticket.query';

@ApiTags('Support')
@Controller('support/tickets')
@UseGuards(JwtAuthGuard)
@ApiBearerAuth()
export class SupportTicketsController {
    constructor(
        private readonly commandBus: CommandBus,
        private readonly queryBus: QueryBus,
    ) { }

    @Post()
    @ApiOperation({ summary: 'Create a new support ticket' })
    @ApiResponse({ status: 201, description: 'Ticket created successfully' })
    async createTicket(
        @CurrentUser() user: any,
        @Body() dto: CreateSupportTicketDto,
    ): Promise<{ id: string }> {
        const id = await this.commandBus.execute(
            new CreateSupportTicketCommand(user.id, dto),
        );
        return { id };
    }

    @Get()
    @ApiOperation({ summary: 'List my support tickets' })
    @ApiResponse({ status: 200, description: 'Return list of tickets', type: [SupportTicketResponseDto] })
    async listTickets(@CurrentUser() user: any): Promise<SupportTicketResponseDto[]> {
        return this.queryBus.execute(new ListSupportTicketsQuery(user.id));
    }

    @Get(':id')
    @ApiOperation({ summary: 'Get ticket detail' })
    @ApiResponse({ status: 200, description: 'Return ticket detail', type: SupportTicketResponseDto })
    async getTicket(
        @CurrentUser() user: any,
        @Param('id') id: string,
    ): Promise<SupportTicketResponseDto> {
        return this.queryBus.execute(new GetSupportTicketQuery(id, user.id));
    }

    @Post(':id/messages')
    @ApiOperation({ summary: 'Reply to a ticket' })
    @ApiResponse({ status: 201, description: 'Reply added successfully' })
    async replyTicket(
        @CurrentUser() user: any,
        @Param('id') id: string,
        @Body() dto: ReplySupportTicketDto,
    ): Promise<void> {
        return this.commandBus.execute(
            new ReplySupportTicketCommand(user.id, id, dto),
        );
    }
}
