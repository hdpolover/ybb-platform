import { IsString, IsObject, IsEnum } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

/**
 * Valid submission sections that can be saved independently
 */
export enum SubmissionSection {
    PERSONAL_INFO = 'personal_info',
    PERSONAL_DETAILS = 'personal_details',
    CONTACT_INFORMATION = 'contact_information',
    PROFESSIONAL_PROFILE = 'professional_profile',
    ENTRY_INFORMATION = 'entry_information',
    MISCELLANEOUS = 'miscellaneous',
    ADDITIONAL_INFO = 'additional_info',
    ESSAYS = 'essays',
    DOCUMENTS = 'documents',
}

/**
 * Request DTO for saving a submission section
 */
export class SaveSubmissionSectionDto {
    @ApiProperty({
        description: 'Section data as key-value pairs',
        example: { full_name: 'John Doe', email: 'john@example.com' },
    })
    @IsObject()
    data: Record<string, unknown>;
}
