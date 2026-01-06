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
    target?: string;

    @ApiProperty({ required: false })
    capacity?: number;

    @ApiProperty()
    soldCount: number;

    @ApiProperty({ type: [ProgramPricingTierValidityPeriodDto], required: false })
    validityPeriods?: ProgramPricingTierValidityPeriodDto[];

    @ApiProperty({ required: false })
    benefits?: any;
    
    @ApiProperty({ required: false })
    icon?: string;
    
    @ApiProperty({ required: false })
    requirements?: any;
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
