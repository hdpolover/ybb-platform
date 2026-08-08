import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { DocumentFile } from '@core/entities/participant-application.entity';

/** Typed option for select/radio/checkbox fields */
export interface FieldOption {
    label: string;
    value: string;
    description?: string;
}

/** Validation constraints for a form field */
export interface FieldValidationRules {
    required?: boolean;
    minLength?: number;
    maxLength?: number;
    min?: number;
    max?: number;
    pattern?: string;
}

/** Supplementary guidance item shown beside a form field (example link, tutorial video, downloadable template) */
export interface HelpAsset {
    kind: 'link' | 'video' | 'file';
    label: string;
    url: string;
}

/**
 * Represents a single form field in a submission section
 */
export class SubmissionFormFieldDto {
    @ApiProperty({ example: 'field-uuid-123' })
    id: string;

    @ApiProperty({ example: 'full_name' })
    name: string;

    @ApiProperty({ example: 'Full Name' })
    label: string;

    @ApiProperty({ example: 'text', enum: ['text', 'email', 'number', 'date', 'textarea', 'file', 'select', 'checkbox', 'radio'] })
    type: string;

    @ApiPropertyOptional({ example: 'Enter your full name' })
    placeholder?: string;

    @ApiPropertyOptional({ example: 'As shown on your passport' })
    helpText?: string;

    @ApiPropertyOptional({ example: '/img/shirtSize.webp' })
    mediaUrl?: string;

    @ApiPropertyOptional({ example: 'T-shirt size guide' })
    mediaAlt?: string;

    @ApiPropertyOptional({
        description: 'Supplementary guidance items (example link, tutorial video, downloadable template).',
        example: [{ kind: 'video', label: 'How to make a twibbon', url: 'https://youtube.com/watch?v=x' }],
    })
    helpAssets?: HelpAsset[];

    @ApiPropertyOptional({ example: ['Option 1', 'Option 2'] })
    options?: string[] | FieldOption[];

    @ApiPropertyOptional({ example: { required: true, minLength: 2 } })
    validationRules?: FieldValidationRules;

    @ApiProperty({ example: true })
    isRequired: boolean;

    @ApiProperty({ example: 0 })
    order: number;
}

/**
 * Represents a section in the submission form with its fields and saved values
 */
export class SubmissionSectionDetailDto {
    @ApiProperty({ example: 'personal_info' })
    id: string;

    @ApiProperty({ example: 'Personal Information' })
    title: string;

    @ApiPropertyOptional({ example: 'Basic details and contact information' })
    description?: string;

    @ApiProperty({ type: [SubmissionFormFieldDto] })
    fields: SubmissionFormFieldDto[];

    @ApiProperty({ description: 'Saved values for this section', example: { full_name: 'John Doe' } })
    values: Record<string, unknown>;

    @ApiProperty({ enum: ['pending', 'in_progress', 'completed'] })
    status: string;
}

/**
 * Essay question with saved answer
 */
export class SubmissionEssayDto {
    @ApiProperty({ example: 'essay-uuid-123' })
    id: string;

    @ApiProperty({ example: 'Why do you want to join this program?' })
    question: string;

    @ApiProperty({ example: true })
    isRequired: boolean;

    @ApiPropertyOptional({ example: 500 })
    wordLimit?: number;

    @ApiProperty({ example: 0 })
    order: number;

    @ApiPropertyOptional({ example: 'I want to join because...' })
    answer?: string;
}

/**
 * Document requirement with upload status
 */
export class SubmissionRequirementDto {
    @ApiProperty({ example: 'req-uuid-123' })
    id: string;

    @ApiProperty({ example: 'Passport Copy' })
    name: string;

    @ApiPropertyOptional({ example: 'Upload a scanned copy of your passport' })
    description?: string;

    @ApiProperty({ example: 'document' })
    type: string;

    @ApiProperty({ example: true })
    isRequired: boolean;

    @ApiProperty({ example: 0 })
    order: number;

    @ApiPropertyOptional({ description: 'Uploaded file info if available' })
    uploadedFile?: DocumentFile;
}

/**
 * Preview checklist item for final confirmation step
 */
export class SubmissionPreviewChecklistItemDto {
    @ApiProperty({ example: 'ready_to_join' })
    key: string;

    @ApiProperty({ example: 'I am ready to join this program.' })
    label: string;

    @ApiProperty({ example: true })
    required: boolean;

    @ApiProperty({ example: false })
    checked: boolean;
}

/**
 * Primary CTA for preview step
 */
export class SubmissionPreviewPrimaryActionDto {
    @ApiProperty({ enum: ['submit_application', 'complete_payment'], example: 'submit_application' })
    type: 'submit_application' | 'complete_payment';

    @ApiProperty({ example: 'Submit Application' })
    label: string;

    @ApiProperty({ example: true })
    enabled: boolean;

    @ApiPropertyOptional({ example: 'Complete all required sections before submitting.' })
    reason?: string;

    // Distinguishes an unfixable block (deadline passed) from a fixable one (missing
    // sections, unpaid fee). The client hard-disables the button only for the former.
    @ApiPropertyOptional({ example: false, description: 'True when the program submission deadline has passed' })
    deadlinePassed?: boolean;
}

/**
 * Payment summary for preview step decision
 */
export class SubmissionPreviewPaymentDto {
    @ApiProperty({ example: true })
    required: boolean;

    @ApiProperty({ example: false })
    paid: boolean;

    @ApiProperty({ example: 'unpaid', enum: ['unpaid', 'paid', 'processing', 'failed', 'refunded'] })
    status: string;
}

/**
 * Final preview step configuration and state
 */
export class SubmissionPreviewDto {
    @ApiProperty({ example: 'Preview & Confirmation' })
    title: string;

    @ApiPropertyOptional({ example: 'Review your data before final submission.' })
    description?: string;

    @ApiPropertyOptional({ example: '<p>Terms and conditions...</p>' })
    termsAndConditionsHtml?: string;

    @ApiProperty({ type: [SubmissionPreviewChecklistItemDto] })
    checklists: SubmissionPreviewChecklistItemDto[];

    @ApiProperty({ type: SubmissionPreviewPrimaryActionDto })
    primaryAction: SubmissionPreviewPrimaryActionDto;

    @ApiProperty({ type: SubmissionPreviewPaymentDto })
    payment: SubmissionPreviewPaymentDto;

    @ApiProperty({ example: false })
    canSubmit: boolean;

    @ApiProperty({ type: [String], example: ['Complete required essays'] })
    pendingItems: string[];
}

/**
 * Full submission detail response — contains all data needed to render the submission form
 */
export class PortalSubmissionDetailResponseDto {
    @ApiProperty({ example: 'app-uuid-123' })
    applicationId: string;

    @ApiProperty({ example: 'prog-uuid-456' })
    programId: string;

    @ApiProperty({ example: 'YBB Summer Program 2026' })
    programName: string;

    @ApiProperty({ example: 'draft', enum: ['draft', 'submitted', 'under_review', 'accepted', 'rejected', 'withdrawn'] })
    status: string;

    @ApiProperty({ example: 33 })
    overallProgress: number;

    @ApiProperty({ description: 'Form fields grouped by section', type: [SubmissionSectionDetailDto] })
    sections: SubmissionSectionDetailDto[];

    @ApiProperty({ description: 'Essay questions with answers', type: [SubmissionEssayDto] })
    essays: SubmissionEssayDto[];

    @ApiPropertyOptional({ example: 'Please read the full essay guidelines before writing.' })
    essayGuidelineText?: string;

    @ApiPropertyOptional({ example: 'https://example.com/essay-guidelines' })
    essayGuidelineUrl?: string;

    @ApiProperty({ description: 'Document requirements with upload status', type: [SubmissionRequirementDto] })
    requirements: SubmissionRequirementDto[];

    @ApiProperty({ description: 'Final preview step data and action state', type: SubmissionPreviewDto })
    preview: SubmissionPreviewDto;

    @ApiPropertyOptional({ example: 'Jane Doe' })
    participantName?: string;

    @ApiPropertyOptional({ example: 'participant-uuid-123' })
    participantId?: string;

    @ApiPropertyOptional({ example: 'user-uuid-123' })
    participantAccountId?: string;

    @ApiPropertyOptional({ example: 'Istanbul, Turkey' })
    participantLocation?: string;

    @ApiPropertyOptional({ example: 'https://cdn.example.com/profiles/participant.jpg' })
    participantAvatarUrl?: string;
}
