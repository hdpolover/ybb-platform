import {
    Controller,
    Get,
    Put,
    Post,
    Body,
    UseGuards,
    UnauthorizedException,
    Param,
    Query,
    BadRequestException,
} from '@nestjs/common';
import {
    ApiTags,
    ApiOperation,
    ApiResponse,
    ApiBearerAuth,
} from '@nestjs/swagger';
import { CommandBus, QueryBus } from '@nestjs/cqrs';
import { CurrentUser, CurrentUserData } from '@shared/decorators/current-user.decorator';
import { GetMyParticipantProfileQuery } from '../application/queries/get-my-participant-profile.query';
import { GetParticipantDashboardQuery } from '../application/queries/get-participant-dashboard.query';
import { UpdateParticipantProfileCommand } from '../application/commands/update-participant-profile.command';
import { CompleteOnboardingCommand } from '../application/commands/complete-onboarding.command';
import { OnboardingDto } from './dto/onboarding.dto';
import { UpdateParticipantProfileDto, ParticipantResponseDto } from './dto/participant.dto';
import { ParticipantDashboardResponseDto } from './dto/participant-dashboard.dto';
import { ApplyAmbassadorDto, AmbassadorDashboardDto, AmbassadorShareTokenResolutionDto, ReferralCodeValidationDto } from './dto/ambassador.dto';
import { ApplyAmbassadorCommand } from '../application/commands/apply-ambassador.command';
import { GetAmbassadorDashboardQuery } from '../application/queries/get-ambassador-dashboard.query';
import { JwtAuthGuard } from '@modules/auth/infrastructure/guards/jwt-auth.guard';
import { Public } from '@shared/decorators/public.decorator';
import { ResolveAmbassadorShareTokenQuery } from '../application/queries/resolve-ambassador-share-token.query';
import { ValidateReferralCodeQuery } from '../application/queries/validate-referral-code.query';

@ApiTags('Participants')
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
        @CurrentUser() user: CurrentUserData,
    ): Promise<ParticipantResponseDto> {
        const userId = user.userId;
        if (!userId) {
            throw new UnauthorizedException();
        }
        return this.queryBus.execute(new GetMyParticipantProfileQuery(userId));
    }

    @Post('onboarding')
    @ApiOperation({ summary: 'Complete participant onboarding (first-time setup)' })
    @ApiResponse({
        status: 201,
        description: 'Onboarding data saved successfully',
        type: ParticipantResponseDto,
    })
    async completeOnboarding(
        @CurrentUser() user: CurrentUserData,
        @Body() dto: OnboardingDto,
    ): Promise<ParticipantResponseDto> {
        const userId = user.userId;
        if (!userId) {
            throw new UnauthorizedException();
        }
        return this.commandBus.execute(
            new CompleteOnboardingCommand(userId, dto),
        );
    }

    @Put('me')
    @ApiOperation({ summary: 'Update current user participant profile' })
    @ApiResponse({
        status: 200,
        description: 'Profile updated successfully',
        type: ParticipantResponseDto,
    })
    async updateMyProfile(
        @CurrentUser() user: CurrentUserData,
        @Body() updateDto: UpdateParticipantProfileDto,
    ): Promise<ParticipantResponseDto> {
        const userId = user.userId;
        if (!userId) {
            throw new UnauthorizedException();
        }
        return this.commandBus.execute(
            new UpdateParticipantProfileCommand(userId, updateDto),
        );
    }

    @Post('ambassador/apply')
    @ApiOperation({ summary: 'Apply to become an ambassador' })
    @ApiResponse({ status: 201, description: 'Application submitted' })
    async applyAmbassador(
        @CurrentUser() user: CurrentUserData,
        @Body() dto: ApplyAmbassadorDto,
    ): Promise<unknown> {
        const userId = user.userId;
        if (!userId) throw new UnauthorizedException();
        return this.commandBus.execute(new ApplyAmbassadorCommand(userId, dto));
    }

    @Get('dashboard')
    @ApiOperation({ summary: 'Get participant dashboard summary' })
    @ApiResponse({ status: 200, type: ParticipantDashboardResponseDto })
    async getDashboard(
        @CurrentUser() user: CurrentUserData,
        @Query('participantId') participantId?: string,
    ): Promise<ParticipantDashboardResponseDto> {
        const userId = user.userId;
        if (!userId) throw new UnauthorizedException();
        return this.queryBus.execute(new GetParticipantDashboardQuery(userId, participantId));
    }

    @Get('ambassador/dashboard')
    @ApiOperation({ summary: 'Get ambassador dashboard stats' })
    @ApiResponse({ status: 200, description: 'Return stats', type: AmbassadorDashboardDto })
    async getAmbassadorDashboard(
        @CurrentUser() user: CurrentUserData,
    ): Promise<AmbassadorDashboardDto> {
        const userId = user.userId;
        if (!userId) throw new UnauthorizedException();
        return this.queryBus.execute(new GetAmbassadorDashboardQuery(userId));
    }

    @Public()
    @Get('ambassador/share-token/resolve')
    @ApiOperation({ summary: 'Resolve ambassador share token into an internal referral code' })
    @ApiResponse({ status: 200, type: AmbassadorShareTokenResolutionDto })
    async resolveAmbassadorShareToken(
        @Query('token') token?: string,
    ): Promise<AmbassadorShareTokenResolutionDto> {
        if (!token?.trim()) {
            throw new BadRequestException('token is required');
        }
        return this.queryBus.execute(new ResolveAmbassadorShareTokenQuery(token));
    }

    @Public()
    @Get('ambassador/referral-codes/:code')
    @ApiOperation({ summary: 'Check whether an ambassador referral code is usable' })
    @ApiResponse({ status: 200, type: ReferralCodeValidationDto })
    @ApiResponse({ status: 404, description: 'Unknown, inactive, or deleted referral code' })
    async validateReferralCode(
        @Param('code') code: string,
    ): Promise<ReferralCodeValidationDto> {
        return this.queryBus.execute(new ValidateReferralCodeQuery(code));
    }
}
