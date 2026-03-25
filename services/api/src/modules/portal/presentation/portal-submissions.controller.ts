import {
    Controller,
    Get,
    Put,
    Post,
    Param,
    Body,
    Query,
    UseGuards,
    UnauthorizedException,
} from '@nestjs/common';
import {
    ApiTags,
    ApiOperation,
    ApiResponse,
    ApiBearerAuth,
    ApiParam,
    ApiBody,
    ApiQuery,
} from '@nestjs/swagger';
import { JwtAuthGuard } from '@modules/auth/infrastructure/guards/jwt-auth.guard';
import { CurrentUser, CurrentUserData } from '@shared/decorators/current-user.decorator';
import {
    GetPortalSubmissionDetailQuery,
    SaveSubmissionSectionCommand,
    PortalSubmitApplicationCommand,
} from '../application/queries/portal-queries';
import { GetPortalSubmissionDetailHandler } from '../application/queries/handlers/get-portal-submission-detail.handler';
import { SaveSubmissionSectionHandler } from '../application/commands/handlers/save-submission-section.handler';
import { PortalSubmitApplicationHandler } from '../application/commands/handlers/portal-submit-application.handler';
import { PortalSubmissionDetailResponseDto } from './dto/portal-submission-detail.dto';
import { SaveSubmissionSectionDto, SubmissionSection } from './dto/save-submission-section.dto';
import {
    SaveSectionResponseDto,
    SubmitApplicationResponseDto,
} from './dto/portal-submission-responses.dto';

/**
 * Portal Submissions Controller
 *
 * Handles submission form operations from the participant portal.
 * All endpoints resolve the participant from the JWT token.
 */
@ApiTags('Portal')
@Controller('portal/submissions')
@UseGuards(JwtAuthGuard)
@ApiBearerAuth()
export class PortalSubmissionsController {
    constructor(
        private readonly getSubmissionDetailHandler: GetPortalSubmissionDetailHandler,
        private readonly saveSubmissionSectionHandler: SaveSubmissionSectionHandler,
        private readonly portalSubmitHandler: PortalSubmitApplicationHandler,
    ) { }

    @Get('detail')
    @ApiOperation({
        summary: 'Get full submission form data with saved values',
        description: 'Returns the complete form definition (fields, essays, requirements) from the program, merged with the participant\'s saved values. Used to render the submission form on the FE.',
    })
    @ApiQuery({
        name: 'programId',
        required: false,
        description: 'Optional program ID to load submission data for a specific registered program. Falls back to the latest application when omitted.',
    })
    @ApiResponse({ status: 200, type: PortalSubmissionDetailResponseDto, description: 'Submission detail returned successfully' })
    @ApiResponse({ status: 401, description: 'Unauthorized — missing or invalid JWT' })
    @ApiResponse({ status: 404, description: 'Participant or active application not found' })
    async getSubmissionDetail(
        @CurrentUser() user: CurrentUserData,
        @Query('programId') programId?: string,
    ): Promise<PortalSubmissionDetailResponseDto> {
        const userId = user.userId;
        if (!userId) throw new UnauthorizedException();
        return this.getSubmissionDetailHandler.execute(
            new GetPortalSubmissionDetailQuery(userId, programId),
        );
    }

    @Put('sections/:section')
    @ApiOperation({
        summary: 'Save/update data for a submission section',
        description: 'Merges the provided data into the specified section. Partial saves are supported — existing values are preserved, new values are added or overwritten.',
    })
    @ApiParam({
        name: 'section',
        enum: SubmissionSection,
        description: 'The section to save data for (personal_info → personalData, essays → essayAnswers, documents → uploadedFiles)',
        example: 'personal_info',
    })
    @ApiBody({ type: SaveSubmissionSectionDto })
    @ApiResponse({ status: 200, type: SaveSectionResponseDto, description: 'Section data saved successfully' })
    @ApiResponse({ status: 400, description: 'Invalid section name or application not in draft status' })
    @ApiResponse({ status: 401, description: 'Unauthorized — missing or invalid JWT' })
    @ApiResponse({ status: 404, description: 'Participant or active application not found' })
    async saveSection(
        @CurrentUser() user: CurrentUserData,
        @Param('section') section: string,
        @Body() dto: SaveSubmissionSectionDto,
        @Query('programId') programId?: string,
    ): Promise<SaveSectionResponseDto> {
        const userId = user.userId;
        if (!userId) throw new UnauthorizedException();
        return this.saveSubmissionSectionHandler.execute(
            new SaveSubmissionSectionCommand(userId, section, dto.data, programId),
        );
    }

    @Post('submit')
    @ApiOperation({
        summary: 'Submit the application (final submit)',
        description: 'Transitions the application from draft to submitted. Validates payment status for non-fully-funded applicants. Cannot be undone — use withdraw endpoint after submission.',
    })
    @ApiResponse({ status: 201, type: SubmitApplicationResponseDto, description: 'Application submitted successfully' })
    @ApiResponse({ status: 400, description: 'Application not in draft status, or registration fee not paid' })
    @ApiResponse({ status: 401, description: 'Unauthorized — missing or invalid JWT' })
    @ApiResponse({ status: 404, description: 'Participant or active application not found' })
    async submitApplication(
        @CurrentUser() user: CurrentUserData,
    ): Promise<SubmitApplicationResponseDto> {
        const userId = user.userId;
        if (!userId) throw new UnauthorizedException();
        return this.portalSubmitHandler.execute(
            new PortalSubmitApplicationCommand(userId),
        );
    }
}
