import { Controller, Get, Param, UseGuards } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth } from '@nestjs/swagger';
import { QueryBus } from '@nestjs/cqrs';
import { JwtAuthGuard } from '@modules/auth/infrastructure/guards/jwt-auth.guard';
import { CurrentUser } from '@shared/decorators/current-user.decorator';
import { ParticipantDocumentResponseDto, ParticipantAwardResponseDto } from './dto/achievements.dto';
import { ListApplicationDocumentsQuery } from '../application/queries/list-application-documents.query';
import { ListParticipantAwardsQuery } from '../application/queries/list-participant-awards.query';

@ApiTags('Achievements')
@Controller('achievements')
@UseGuards(JwtAuthGuard)
@ApiBearerAuth()
export class AchievementsController {
    constructor(private readonly queryBus: QueryBus) { }

    @Get('applications/:applicationId/documents')
    @ApiOperation({ summary: 'List generated documents for an application', operationId: 'listDocuments' })
    @ApiResponse({ status: 200, description: 'Return list of documents', type: [ParticipantDocumentResponseDto] })
    async listDocuments(
        @CurrentUser() user: any,
        @Param('applicationId') applicationId: string,
    ): Promise<ParticipantDocumentResponseDto[]> {
        return this.queryBus.execute(new ListApplicationDocumentsQuery(applicationId, user.id));
    }

    @Get('applications/:applicationId/awards')
    @ApiOperation({ summary: 'List awards for an application', operationId: 'listAwards' })
    @ApiResponse({ status: 200, description: 'Return list of awards', type: [ParticipantAwardResponseDto] })
    async listAwards(
        @CurrentUser() user: any,
        @Param('applicationId') applicationId: string,
    ): Promise<ParticipantAwardResponseDto[]> {
        return this.queryBus.execute(new ListParticipantAwardsQuery(applicationId, user.id));
    }
}
