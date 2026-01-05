import {
    Controller,
    Get,
    Put,
    Post,
    Body,
    UseGuards,
    UnauthorizedException,
} from '@nestjs/common';
import {
    ApiTags,
    ApiOperation,
    ApiResponse,
    ApiBearerAuth,
} from '@nestjs/swagger';
import { CommandBus, QueryBus } from '@nestjs/cqrs';
import { CurrentUser } from '@shared/decorators/current-user.decorator';
import { GetMyParticipantProfileQuery } from '../application/queries/get-my-participant-profile.query';
import { UpdateParticipantProfileCommand } from '../application/commands/update-participant-profile.command';
import { UpdateParticipantProfileDto, ParticipantResponseDto } from './dto/participant.dto';
import { ApplyAmbassadorDto, AmbassadorDashboardDto } from './dto/ambassador.dto';
import { ApplyAmbassadorCommand } from '../application/commands/apply-ambassador.command';
import { GetAmbassadorDashboardQuery } from '../application/queries/get-ambassador-dashboard.query';
import { JwtAuthGuard } from '@modules/auth/infrastructure/guards/jwt-auth.guard';

@ApiTags('participants')
@Controller('participants')
@UseGuards(JwtAuthGuard)
@ApiBearerAuth()
export class ParticipantsController {
    constructor(
        private readonly queryBus: QueryBus,
        private readonly commandBus: CommandBus,
    ) { }

    @Get('me')
    @ApiOperation({ summary: 'Get current user participant profile' })
    @ApiResponse({
        status: 200,
        description: 'Return participant profile',
        type: ParticipantResponseDto,
    })
    async getMyProfile(
        @CurrentUser() user: any,
    ): Promise<ParticipantResponseDto> {
        if (!user || !user.id) {
            throw new UnauthorizedException();
        }
        return this.queryBus.execute(new GetMyParticipantProfileQuery(user.id));
    }

    @Put('me')
    @ApiOperation({ summary: 'Update current user participant profile' })
    @ApiResponse({
        status: 200,
        description: 'Profile updated successfully',
        type: ParticipantResponseDto,
    })
    async updateMyProfile(
        @CurrentUser() user: any,
        @Body() updateDto: UpdateParticipantProfileDto,
    ): Promise<ParticipantResponseDto> {
        if (!user || !user.id) {
            throw new UnauthorizedException();
        }
        return this.commandBus.execute(
            new UpdateParticipantProfileCommand(user.id, updateDto),
        );
    }

    @Post('ambassador/apply')
    @ApiOperation({ summary: 'Apply to become an ambassador' })
    @ApiResponse({ status: 201, description: 'Application submitted' })
    async applyAmbassador(
        @CurrentUser() user: any,
        @Body() dto: ApplyAmbassadorDto,
    ): Promise<any> {
        if (!user || !user.id) throw new UnauthorizedException();
        return this.commandBus.execute(new ApplyAmbassadorCommand(user.id, dto));
    }

    @Get('ambassador/dashboard')
    @ApiOperation({ summary: 'Get ambassador dashboard stats' })
    @ApiResponse({ status: 200, description: 'Return stats', type: AmbassadorDashboardDto })
    async getAmbassadorDashboard(
        @CurrentUser() user: any,
    ): Promise<AmbassadorDashboardDto> {
        if (!user || !user.id) throw new UnauthorizedException();
        return this.queryBus.execute(new GetAmbassadorDashboardQuery(user.id));
    }
}
