import { ApiProperty } from '@nestjs/swagger';

export class SubmissionSectionDto {
    @ApiProperty()
    id: string;

    @ApiProperty()
    title: string;

    @ApiProperty()
    description: string;

    @ApiProperty({ enum: ['pending', 'in_progress', 'completed', 'issues'] })
    status: string;

    @ApiProperty()
    isRequired: boolean;

    @ApiProperty({ required: false })
    updatedAt?: Date;
}

export class PortalSubmissionResponseDto {
    @ApiProperty()
    applicationId: string;

    @ApiProperty()
    programName: string;

    @ApiProperty()
    status: string;

    @ApiProperty()
    overallProgress: number;

    @ApiProperty({ type: [SubmissionSectionDto] })
    sections: SubmissionSectionDto[];
}
