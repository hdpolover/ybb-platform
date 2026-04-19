import { ApiProperty } from '@nestjs/swagger';

export class ProgramTimelineResponseDto {
    @ApiProperty()
    id: string;

    @ApiProperty()
    date: Date;

    @ApiProperty()
    title: string;

    @ApiProperty({ required: false })
    description?: string;

    @ApiProperty({ required: false })
    icon?: string;
}

export class ProgramScheduleResponseDto {
    @ApiProperty()
    id: string;

    @ApiProperty()
    day: string;

    @ApiProperty({ required: false })
    startTime?: string;

    @ApiProperty({ required: false })
    endTime?: string;

    @ApiProperty()
    activity: string;

    @ApiProperty({ required: false })
    description?: string;

    @ApiProperty({ required: false })
    location?: string;

    @ApiProperty({ required: false })
    speaker?: string;
}

export class ProgramSpeakerResponseDto {
    @ApiProperty()
    id: string;

    @ApiProperty()
    name: string;

    @ApiProperty({ required: false })
    title?: string;

    @ApiProperty({ required: false })
    organization?: string;

    @ApiProperty({ required: false })
    bio?: string;

    @ApiProperty({ required: false })
    photoUrl?: string;

    @ApiProperty({ required: false })
    linkedinUrl?: string;

    @ApiProperty({ required: false })
    twitterUrl?: string;
}

export class ProgramGalleryResponseDto {
    @ApiProperty()
    id: string;

    @ApiProperty()
    imageUrl: string;

    @ApiProperty({ required: false })
    title?: string;

    @ApiProperty({ required: false })
    description?: string;

    @ApiProperty()
    type: string;
}

export class ProgramTestimonialResponseDto {
    @ApiProperty()
    id: string;

    @ApiProperty()
    name: string;

    @ApiProperty({ required: false })
    role?: string;

    @ApiProperty({ required: false })
    company?: string;

    @ApiProperty()
    testimonial: string;

    @ApiProperty()
    type: string;

    @ApiProperty({ required: false })
    avatarUrl?: string;

    @ApiProperty({ required: false })
    rating?: number;
}

export class ProgramFaqResponseDto {
    @ApiProperty()
    id: string;

    @ApiProperty()
    question: string;

    @ApiProperty()
    answer: string;
}

export class ProgramTeamResponseDto {
    @ApiProperty()
    id: string;

    @ApiProperty()
    name: string;

    @ApiProperty()
    role: string;

    @ApiProperty({ required: false })
    bio?: string;

    @ApiProperty({ required: false })
    photoUrl?: string;

    @ApiProperty({ required: false })
    linkedinUrl?: string;
}

export class ProgramPartnerResponseDto {
    @ApiProperty()
    id: string;

    @ApiProperty()
    name: string;

    @ApiProperty()
    type: string;

    @ApiProperty({ required: false })
    role?: string;

    @ApiProperty({ required: false })
    logoUrl?: string;

    @ApiProperty({ required: false })
    websiteUrl?: string;
}

export class ProgramResourceResponseDto {
    @ApiProperty()
    id: string;

    @ApiProperty()
    title: string;

    @ApiProperty({ required: false })
    description?: string;

    @ApiProperty()
    fileUrl: string;

    @ApiProperty({ required: false })
    fileSize?: number;

    @ApiProperty({ required: false })
    fileType?: string;

    @ApiProperty()
    type: string;
}


export class ProgramPricingTierValidityPeriodDto {
    @ApiProperty()
    startDate: Date;

    @ApiProperty()
    endDate: Date;
}

export class ProgramPricingTierResponseDto {
    @ApiProperty()
    id: string;

    @ApiProperty()
    name: string;

    @ApiProperty({ required: false })
    description?: string;

    @ApiProperty()
    price: number;

    @ApiProperty()
    currency: string;
    
    @ApiProperty({ required: false })
    feeType?: string;

    @ApiProperty({ required: false })
    allowedCategories?: string[];

    @ApiProperty({ required: false })
    capacity?: number;

    @ApiProperty()
    soldCount: number;

    @ApiProperty({ type: [ProgramPricingTierValidityPeriodDto], required: false })
    validityPeriods?: ProgramPricingTierValidityPeriodDto[];

    @ApiProperty({ required: false })
    benefits?: Record<string, unknown>;
    
    @ApiProperty({ required: false })
    icon?: string;
    
    @ApiProperty({ required: false })
    requirements?: Record<string, unknown>;
}


export class ProgramRequirementResponseDto {
    @ApiProperty()
    id: string;

    @ApiProperty()
    name: string;

    @ApiProperty({ required: false })
    description?: string;

    @ApiProperty()
    type: string;

    @ApiProperty()
    isRequired: boolean;
}

export class ApplicationFormFieldResponseDto {
    @ApiProperty()
    id: string;

    @ApiProperty({ required: false })
    section?: string;

    @ApiProperty()
    fieldName: string;

    @ApiProperty()
    label: string;

    @ApiProperty({ required: false })
    placeholder?: string;

    @ApiProperty({ required: false })
    helpText?: string;

    @ApiProperty({ required: false })
    mediaUrl?: string;

    @ApiProperty({ required: false })
    mediaAlt?: string;

    @ApiProperty()
    fieldType: string;

    @ApiProperty()
    isRequired: boolean;

    @ApiProperty({ required: false })
    options?: string[] | Record<string, unknown>[];

    @ApiProperty({ required: false })
    validationRules?: Record<string, unknown>;

    @ApiProperty({ required: false })
    defaultValue?: string;

    @ApiProperty()
    order: number;
}

export class ProgramEssayResponseDto {
    @ApiProperty()
    id: string;

    @ApiProperty()
    question: string;

    @ApiProperty({ required: false })
    description?: string;

    @ApiProperty({ required: false })
    wordLimit?: number;

    @ApiProperty()
    isRequired: boolean;
    
    @ApiProperty()
    order: number;

    @ApiProperty()
    isActive: boolean;
}

export class ProgramSubthemeResponseDto {
    @ApiProperty()
    id: string;

    @ApiProperty()
    programId: string;

    @ApiProperty()
    name: string;

    @ApiProperty({ required: false })
    description?: string;

    @ApiProperty()
    order: number;

    @ApiProperty()
    isActive: boolean;
}

export class ProgramParticipationCategoryResponseDto {
    @ApiProperty()
    id: string;

    @ApiProperty()
    programId: string;

    @ApiProperty()
    name: string;

    @ApiProperty({ required: false })
    description?: string;

    @ApiProperty({ required: false })
    benefits?: string;

    @ApiProperty({ required: false })
    eligibility?: string;

    @ApiProperty()
    order: number;

    @ApiProperty()
    isActive: boolean;
}
