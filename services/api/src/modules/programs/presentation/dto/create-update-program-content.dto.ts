import { IsString, IsNotEmpty, IsOptional, IsDateString, IsNumber, IsBoolean, IsUUID, IsArray, IsEnum } from 'class-validator';
import { Transform } from 'class-transformer';
import { ApiProperty } from '@nestjs/swagger';
import { FaqCategory } from '@prisma/client';

// Timeline DTOs
export class CreateProgramTimelineDto {
    @ApiProperty()
    @IsUUID()
    @IsNotEmpty()
    programId: string;

    @ApiProperty()
    @IsDateString()
    @IsNotEmpty()
    date: string;

    @ApiProperty({ required: false, nullable: true })
    @IsDateString()
    @IsOptional()
    endDate?: string;

    @ApiProperty()
    @IsString()
    @IsNotEmpty()
    title: string;

    @ApiProperty({ required: false })
    @IsString()
    @IsOptional()
    description?: string;

    @ApiProperty({ required: false })
    @IsString()
    @IsOptional()
    icon?: string;

    @ApiProperty({ required: false })
    @IsNumber()
    @IsOptional()
    order?: number;
}

export class UpdateProgramTimelineDto {
    @ApiProperty({ required: false })
    @IsDateString()
    @IsOptional()
    date?: string;

    @ApiProperty({ required: false, nullable: true })
    @IsDateString()
    @IsOptional()
    endDate?: string;

    @ApiProperty({ required: false })
    @IsString()
    @IsOptional()
    title?: string;

    @ApiProperty({ required: false })
    @IsString()
    @IsOptional()
    description?: string;

    @ApiProperty({ required: false })
    @IsString()
    @IsOptional()
    icon?: string;

    @ApiProperty({ required: false })
    @IsNumber()
    @IsOptional()
    order?: number;

    @ApiProperty({ required: false })
    @IsBoolean()
    @IsOptional()
    isActive?: boolean;
}

// Schedule DTOs
export class CreateProgramScheduleDto {
    @ApiProperty()
    @IsUUID()
    @IsNotEmpty()
    programId: string;

    @ApiProperty()
    @IsString()
    @IsNotEmpty()
    day: string;

    @ApiProperty({ required: false })
    @IsString()
    @IsOptional()
    startTime?: string;

    @ApiProperty({ required: false })
    @IsString()
    @IsOptional()
    endTime?: string;

    @ApiProperty()
    @IsString()
    @IsNotEmpty()
    activity: string;

    @ApiProperty({ required: false })
    @IsString()
    @IsOptional()
    description?: string;

    @ApiProperty({ required: false })
    @IsString()
    @IsOptional()
    location?: string;

    @ApiProperty({ required: false })
    @IsString()
    @IsOptional()
    speaker?: string;

    @ApiProperty({ required: false })
    @IsNumber()
    @IsOptional()
    order?: number;
}

export class UpdateProgramScheduleDto {
    @ApiProperty({ required: false })
    @IsString()
    @IsOptional()
    day?: string;

    @ApiProperty({ required: false })
    @IsString()
    @IsOptional()
    startTime?: string;

    @ApiProperty({ required: false })
    @IsString()
    @IsOptional()
    endTime?: string;

    @ApiProperty({ required: false })
    @IsString()
    @IsOptional()
    activity?: string;

    @ApiProperty({ required: false })
    @IsString()
    @IsOptional()
    description?: string;

    @ApiProperty({ required: false })
    @IsString()
    @IsOptional()
    location?: string;

    @ApiProperty({ required: false })
    @IsString()
    @IsOptional()
    speaker?: string;

    @ApiProperty({ required: false })
    @IsNumber()
    @IsOptional()
    order?: number;

    @ApiProperty({ required: false })
    @IsBoolean()
    @IsOptional()
    isActive?: boolean;
}

// Speaker DTOs
export class CreateProgramSpeakerDto {
    @ApiProperty()
    @IsUUID()
    @IsNotEmpty()
    programId: string;

    @ApiProperty()
    @IsString()
    @IsNotEmpty()
    name: string;

    @ApiProperty({ required: false })
    @IsString()
    @IsOptional()
    title?: string;

    @ApiProperty({ required: false })
    @IsString()
    @IsOptional()
    organization?: string;

    @ApiProperty({ required: false })
    @IsString()
    @IsOptional()
    bio?: string;

    @ApiProperty({ required: false })
    @IsString()
    @IsOptional()
    photoUrl?: string;

    @ApiProperty({ type: 'string', format: 'binary', required: false, description: 'Speaker Photo to upload' })
    @IsOptional()
    photo?: Express.Multer.File;

    @ApiProperty({ required: false })
    @IsString()
    @IsOptional()
    email?: string;


    @ApiProperty({ required: false })
    @IsString()
    @IsOptional()
    linkedinUrl?: string;

    @ApiProperty({ required: false })
    @IsString()
    @IsOptional()
    twitterUrl?: string;

    @ApiProperty({ required: false })
    @IsNumber()
    @IsOptional()
    order?: number;
}

export class UpdateProgramSpeakerDto {
    @ApiProperty({ required: false })
    @IsString()
    @IsOptional()
    name?: string;

    @ApiProperty({ required: false })
    @IsString()
    @IsOptional()
    title?: string;

    @ApiProperty({ required: false })
    @IsString()
    @IsOptional()
    organization?: string;

    @ApiProperty({ required: false })
    @IsString()
    @IsOptional()
    bio?: string;

    @ApiProperty({ required: false })
    @IsString()
    @IsOptional()
    photoUrl?: string;

    @ApiProperty({ required: false })
    @IsString()
    @IsOptional()
    email?: string;

    @ApiProperty({ required: false })
    @IsString()
    @IsOptional()
    linkedinUrl?: string;

    @ApiProperty({ required: false })
    @IsString()
    @IsOptional()
    twitterUrl?: string;

    @ApiProperty({ required: false })
    @IsNumber()
    @IsOptional()
    order?: number;

    @ApiProperty({ required: false })
    @IsBoolean()
    @IsOptional()
    isActive?: boolean;
}

// Gallery DTOs
export class CreateProgramGalleryDto {
    @ApiProperty()
    @IsUUID()
    @IsNotEmpty()
    programId: string;

    @ApiProperty({ required: false })
    @IsString()
    @IsOptional()
    imageUrl?: string;

    @ApiProperty({ type: 'string', format: 'binary', required: false, description: 'Gallery Image to upload' })
    @IsOptional()
    image?: Express.Multer.File;

    @ApiProperty({ required: false })
    @IsString()
    @IsOptional()
    title?: string;

    @ApiProperty({ required: false })
    @IsString()
    @IsOptional()
    description?: string;

    @ApiProperty({ required: false })
    @IsString()
    @IsOptional()
    type?: string;

    @ApiProperty({ required: false, description: 'Year the photo was taken' })
    @IsNumber()
    @IsOptional()
    @Transform(({ value }) => (value === undefined || value === null || value === '' ? undefined : Number(value)))
    year?: number;

    @ApiProperty({ required: false })
    @IsNumber()
    @IsOptional()
    @Transform(({ value }) => (value === undefined || value === null || value === '' ? undefined : Number(value)))
    order?: number;
}

export class UpdateProgramGalleryDto {
    @ApiProperty({ required: false })
    @IsString()
    @IsOptional()
    imageUrl?: string;

    @ApiProperty({ type: 'string', format: 'binary', required: false, description: 'Gallery Image to upload' })
    @IsOptional()
    image?: Express.Multer.File;

    @ApiProperty({ required: false })
    @IsString()
    @IsOptional()
    title?: string;

    @ApiProperty({ required: false })
    @IsString()
    @IsOptional()
    description?: string;

    @ApiProperty({ required: false })
    @IsString()
    @IsOptional()
    type?: string;

    @ApiProperty({ required: false, description: 'Year the photo was taken' })
    @IsNumber()
    @IsOptional()
    @Transform(({ value }) => (value === undefined || value === null || value === '' ? undefined : Number(value)))
    year?: number;

    @ApiProperty({ required: false })
    @IsNumber()
    @IsOptional()
    @Transform(({ value }) => (value === undefined || value === null || value === '' ? undefined : Number(value)))
    order?: number;

    @ApiProperty({ required: false })
    @IsBoolean()
    @IsOptional()
    isActive?: boolean;
}

// Testimonial DTOs
export class CreateProgramTestimonialDto {
    @ApiProperty({ required: false })
    @IsUUID()
    @IsOptional()
    programId?: string;

    @ApiProperty({ required: false, description: 'Brand ID' })
    @IsUUID()
    @IsOptional()
    brandId?: string;

    @ApiProperty()
    @IsString()
    @IsNotEmpty()
    name: string;

    @ApiProperty({ required: false })
    @IsString()
    @IsOptional()
    role?: string;

    @ApiProperty({ required: false })
    @IsString()
    @IsOptional()
    company?: string;

    @ApiProperty()
    @IsString()
    @IsNotEmpty()
    testimonial: string;

    @ApiProperty({ required: false })
    @IsString()
    @IsOptional()
    type?: string;

    @ApiProperty({ required: false })
    @IsString()
    @IsOptional()
    videoUrl?: string;

    @ApiProperty({ required: false })
    @IsString()
    @IsOptional()
    thumbnailUrl?: string;

    @ApiProperty({ required: false })
    @IsString()
    @IsOptional()
    avatarUrl?: string;

    @ApiProperty({ required: false })
    @IsNumber()
    @IsOptional()
    rating?: number;

    @ApiProperty({ required: false })
    @IsBoolean()
    @IsOptional()
    isFeatured?: boolean;

    @ApiProperty({ required: false })
    @IsNumber()
    @IsOptional()
    order?: number;

    @ApiProperty({ required: false })
    @IsString()
    @IsOptional()
    category?: string;
}

export class UpdateProgramTestimonialDto {
    @ApiProperty({ required: false })
    @IsUUID()
    @IsOptional()
    brandId?: string;

    @ApiProperty({ required: false })
    @IsString()
    @IsOptional()
    category?: string;

    @ApiProperty({ required: false })
    @IsString()
    @IsOptional()
    name?: string;

    @ApiProperty({ required: false })
    @IsString()
    @IsOptional()
    role?: string;

    @ApiProperty({ required: false })
    @IsString()
    @IsOptional()
    company?: string;

    @ApiProperty({ required: false })
    @IsString()
    @IsOptional()
    testimonial?: string;

    @ApiProperty({ required: false })
    @IsString()
    @IsOptional()
    type?: string;

    @ApiProperty({ required: false })
    @IsString()
    @IsOptional()
    videoUrl?: string;

    @ApiProperty({ required: false })
    @IsString()
    @IsOptional()
    thumbnailUrl?: string;

    @ApiProperty({ required: false })
    @IsString()
    @IsOptional()
    avatarUrl?: string;

    @ApiProperty({ required: false })
    @IsNumber()
    @IsOptional()
    rating?: number;

    @ApiProperty({ required: false })
    @IsBoolean()
    @IsOptional()
    isFeatured?: boolean;

    @ApiProperty({ required: false })
    @IsNumber()
    @IsOptional()
    order?: number;

    @ApiProperty({ required: false })
    @IsBoolean()
    @IsOptional()
    isActive?: boolean;
}

// FAQ DTOs
export class CreateProgramFaqDto {
    @ApiProperty()
    @IsUUID()
    @IsNotEmpty()
    programId: string;

    @ApiProperty()
    @IsString()
    @IsNotEmpty()
    question: string;

    @ApiProperty()
    @IsString()
    @IsNotEmpty()
    answer: string;

    @ApiProperty({ required: false, enum: FaqCategory })
    @IsEnum(FaqCategory)
    @IsOptional()
    category?: FaqCategory;

    @ApiProperty({ required: false })
    @IsNumber()
    @IsOptional()
    order?: number;
}

export class UpdateProgramFaqDto {
    @ApiProperty({ required: false })
    @IsString()
    @IsOptional()
    question?: string;

    @ApiProperty({ required: false })
    @IsString()
    @IsOptional()
    answer?: string;

    @ApiProperty({ required: false, enum: FaqCategory })
    @IsEnum(FaqCategory)
    @IsOptional()
    category?: FaqCategory;

    @ApiProperty({ required: false })
    @IsNumber()
    @IsOptional()
    order?: number;

    @ApiProperty({ required: false })
    @IsBoolean()
    @IsOptional()
    isActive?: boolean;
}

// Team DTOs
export class CreateProgramTeamDto {
    @ApiProperty({ required: false })
    @IsUUID()
    @IsOptional()
    programId?: string;

    @ApiProperty({ required: false, description: 'Brand ID' })
    @IsUUID()
    @IsOptional()
    brandId?: string;

    @ApiProperty()
    @IsString()
    @IsNotEmpty()
    name: string;

    @ApiProperty()
    @IsString()
    @IsNotEmpty()
    role: string;

    @ApiProperty({ required: false })
    @IsString()
    @IsOptional()
    bio?: string;

    @ApiProperty({ required: false })
    @IsString()
    @IsOptional()
    photoUrl?: string;

    @ApiProperty({ type: 'string', format: 'binary', required: false, description: 'Member Photo to upload' })
    @IsOptional()
    photo?: Express.Multer.File;

    @ApiProperty({ required: false })
    @IsString()
    @IsOptional()
    email?: string;

    @ApiProperty({ required: false })
    @IsString()
    @IsOptional()
    phone?: string;

    @ApiProperty({ required: false })
    @IsString()
    @IsOptional()
    linkedinUrl?: string;

    @ApiProperty({ required: false })
    @IsNumber()
    @IsOptional()
    order?: number;
}

export class UpdateProgramTeamDto {
    @ApiProperty({ required: false })
    @IsString()
    @IsOptional()
    name?: string;

    @ApiProperty({ required: false })
    @IsString()
    @IsOptional()
    role?: string;

    @ApiProperty({ required: false })
    @IsString()
    @IsOptional()
    bio?: string;

    @ApiProperty({ required: false })
    @IsString()
    @IsOptional()
    photoUrl?: string;

    @ApiProperty({ required: false })
    @IsString()
    @IsOptional()
    email?: string;

    @ApiProperty({ required: false })
    @IsString()
    @IsOptional()
    phone?: string;

    @ApiProperty({ required: false })
    @IsString()
    @IsOptional()
    linkedinUrl?: string;

    @ApiProperty({ required: false })
    @IsNumber()
    @IsOptional()
    order?: number;

    @ApiProperty({ required: false })
    @IsBoolean()
    @IsOptional()
    isActive?: boolean;
}

// Partner DTOs
export class CreateProgramPartnerDto {
    @ApiProperty()
    @IsUUID()
    @IsNotEmpty()
    programId: string;

    @ApiProperty()
    @IsString()
    @IsNotEmpty()
    name: string;

    @ApiProperty()
    @IsString()
    @IsNotEmpty()
    type: string;

    @ApiProperty({ required: false })
    @IsString()
    @IsOptional()
    role?: string;

    @ApiProperty({ required: false })
    @IsString()
    @IsOptional()
    logoUrl?: string;

    @ApiProperty({ type: 'string', format: 'binary', required: false, description: 'Partner Logo to upload' })
    @IsOptional()
    logo?: Express.Multer.File;

    @ApiProperty({ required: false })
    @IsString()
    @IsOptional()
    websiteUrl?: string;

    @ApiProperty({ required: false })
    @IsString()
    @IsOptional()
    description?: string;

    @ApiProperty({ required: false })
    @IsNumber()
    @IsOptional()
    order?: number;
}

export class UpdateProgramPartnerDto {
    @ApiProperty({ required: false })
    @IsString()
    @IsOptional()
    name?: string;

    @ApiProperty({ required: false })
    @IsString()
    @IsOptional()
    type?: string;

    @ApiProperty({ required: false })
    @IsString()
    @IsOptional()
    role?: string;

    @ApiProperty({ required: false })
    @IsString()
    @IsOptional()
    logoUrl?: string;

    @ApiProperty({ required: false })
    @IsString()
    @IsOptional()
    websiteUrl?: string;

    @ApiProperty({ required: false })
    @IsString()
    @IsOptional()
    description?: string;

    @ApiProperty({ required: false })
    @IsNumber()
    @IsOptional()
    order?: number;

    @ApiProperty({ required: false })
    @IsBoolean()
    @IsOptional()
    isActive?: boolean;
}

// Resource DTOs
export class CreateProgramResourceDto {
    @ApiProperty()
    @IsUUID()
    @IsNotEmpty()
    programId: string;

    @ApiProperty()
    @IsString()
    @IsNotEmpty()
    title: string;

    @ApiProperty({ required: false })
    @IsString()
    @IsOptional()
    description?: string;

    @ApiProperty({ required: false, description: 'URL of the file (if already uploaded)' })
    @IsString()
    @IsOptional()
    fileUrl?: string;
    
    @ApiProperty({ type: 'string', format: 'binary', required: false, description: 'File to upload' })
    @IsOptional()
    file?: Express.Multer.File;

    @ApiProperty({ required: false })
    @IsNumber()
    @IsOptional()
    fileSize?: number;

    @ApiProperty({ required: false })
    @IsString()
    @IsOptional()
    fileType?: string;

    @ApiProperty()
    @IsString()
    @IsNotEmpty()
    type: string;

    @ApiProperty({ required: false })
    @IsBoolean()
    @IsOptional()
    isPublic?: boolean;

    @ApiProperty({ required: false })
    @IsNumber()
    @IsOptional()
    order?: number;
}

export class UpdateProgramResourceDto {
    @ApiProperty({ required: false })
    @IsString()
    @IsOptional()
    title?: string;

    @ApiProperty({ required: false })
    @IsString()
    @IsOptional()
    description?: string;

    @ApiProperty({ required: false })
    @IsString()
    @IsOptional()
    fileUrl?: string;

    @ApiProperty({ required: false })
    @IsNumber()
    @IsOptional()
    fileSize?: number;

    @ApiProperty({ required: false })
    @IsString()
    @IsOptional()
    fileType?: string;

    @ApiProperty({ required: false })
    @IsString()
    @IsOptional()
    type?: string;

    @ApiProperty({ required: false })
    @IsBoolean()
    @IsOptional()
    isPublic?: boolean;

    @ApiProperty({ required: false })
    @IsNumber()
    @IsOptional()
    order?: number;

    @ApiProperty({ required: false })
    @IsBoolean()
    @IsOptional()
    isActive?: boolean;
}

// Pricing Tier DTOs
export class CreateProgramPricingTierDto {
    @ApiProperty()
    @IsUUID()
    @IsNotEmpty()
    programId: string;

    @ApiProperty()
    @IsString()
    @IsNotEmpty()
    name: string;

    @ApiProperty({ required: false })
    @IsString()
    @IsOptional()
    description?: string;

    @ApiProperty()
    @IsNumber()
    @IsNotEmpty()
    price: number;

    @ApiProperty()
    @IsString()
    @IsNotEmpty()
    currency: string;

    @ApiProperty({ required: false })
    @IsNumber()
    @IsOptional()
    capacity?: number;

    @ApiProperty()
    @IsDateString()
    @IsNotEmpty()
    validFrom: string;

    @ApiProperty()
    @IsDateString()
    @IsNotEmpty()
    validUntil: string;

    @ApiProperty({ required: false })
    @IsArray()
    @IsOptional()
    benefits?: Record<string, unknown>[];

    @ApiProperty({ required: false })
    @IsArray()
    @IsOptional()
    requirements?: Record<string, unknown>[];

    @ApiProperty({ required: false })
    @IsString()
    @IsOptional()
    feeType?: string;

    @ApiProperty({ required: false })
    @IsArray()
    @IsOptional()
    allowedCategories?: string[];

    @ApiProperty({ required: false })
    @IsString()
    @IsOptional()
    icon?: string;

    @ApiProperty({ required: false })
    @IsNumber()
    @IsOptional()
    order?: number;
}

// Validity Period DTOs
export class CreateValidityPeriodDto {
    @ApiProperty({ required: false })
    @IsUUID()
    @IsOptional()
    pricingTierId?: string;

    @ApiProperty()
    @IsDateString()
    @IsNotEmpty()
    startDate: string;

    @ApiProperty()
    @IsDateString()
    @IsNotEmpty()
    endDate: string;

    @ApiProperty({ required: false })
    @IsString()
    @IsOptional()
    description?: string;
}

export class UpdateValidityPeriodDto {
    @ApiProperty({ required: false })
    @IsDateString()
    @IsOptional()
    startDate?: string;

    @ApiProperty({ required: false })
    @IsDateString()
    @IsOptional()
    endDate?: string;

    @ApiProperty({ required: false })
    @IsString()
    @IsOptional()
    description?: string;
}

export class UpdateProgramPricingTierDto {
    @ApiProperty({ required: false })
    @IsString()
    @IsOptional()
    name?: string;

    @ApiProperty({ required: false })
    @IsString()
    @IsOptional()
    description?: string;

    @ApiProperty({ required: false })
    @IsNumber()
    @IsOptional()
    price?: number;

    @ApiProperty({ required: false })
    @IsString()
    @IsOptional()
    currency?: string;

    @ApiProperty({ required: false })
    @IsNumber()
    @IsOptional()
    capacity?: number;

    @ApiProperty({ required: false })
    @IsDateString()
    @IsOptional()
    validFrom?: string;

    @ApiProperty({ required: false })
    @IsDateString()
    @IsOptional()
    validUntil?: string;

    @ApiProperty({ required: false })
    @IsArray()
    @IsOptional()
    benefits?: Record<string, unknown>[];

    @ApiProperty({ required: false })
    @IsArray()
    @IsOptional()
    requirements?: Record<string, unknown>[];

    @ApiProperty({ required: false })
    @IsString()
    @IsOptional()
    feeType?: string;

    @ApiProperty({ required: false })
    @IsArray()
    @IsOptional()
    allowedCategories?: string[];

    @ApiProperty({ required: false })
    @IsString()
    @IsOptional()
    icon?: string;

    @ApiProperty({ required: false })
    @IsNumber()
    @IsOptional()
    order?: number;

    @ApiProperty({ required: false })
    @IsBoolean()
    @IsOptional()
    isActive?: boolean;
}

// Requirement DTOs
export class CreateProgramRequirementDto {
    @ApiProperty()
    @IsUUID()
    @IsNotEmpty()
    programId: string;

    @ApiProperty()
    @IsString()
    @IsNotEmpty()
    name: string;

    @ApiProperty({ required: false })
    @IsString()
    @IsOptional()
    description?: string;

    @ApiProperty()
    @IsString()
    @IsNotEmpty()
    type: string;

    @ApiProperty({ required: false })
    @IsBoolean()
    @IsOptional()
    isRequired?: boolean;

    @ApiProperty({ required: false })
    @IsNumber()
    @IsOptional()
    fileMaxSize?: number;

    @ApiProperty({ required: false })
    @IsString()
    @IsOptional()
    fileAllowedTypes?: string;

    @ApiProperty({ required: false })
    @IsArray()
    @IsOptional()
    options?: string[] | Record<string, unknown>[];

    @ApiProperty({ required: false })
    @IsOptional()
    validationRules?: Record<string, unknown>;

    @ApiProperty({ required: false })
    @IsNumber()
    @IsOptional()
    order?: number;
}

export class UpdateProgramRequirementDto {
    @ApiProperty({ required: false })
    @IsString()
    @IsOptional()
    name?: string;

    @ApiProperty({ required: false })
    @IsString()
    @IsOptional()
    description?: string;

    @ApiProperty({ required: false })
    @IsString()
    @IsOptional()
    type?: string;

    @ApiProperty({ required: false })
    @IsBoolean()
    @IsOptional()
    isRequired?: boolean;

    @ApiProperty({ required: false })
    @IsNumber()
    @IsOptional()
    fileMaxSize?: number;

    @ApiProperty({ required: false })
    @IsString()
    @IsOptional()
    fileAllowedTypes?: string;

    @ApiProperty({ required: false })
    @IsArray()
    @IsOptional()
    options?: string[] | Record<string, unknown>[];

    @ApiProperty({ required: false })
    @IsOptional()
    validationRules?: Record<string, unknown>;

    @ApiProperty({ required: false })
    @IsNumber()
    @IsOptional()
    order?: number;

    @ApiProperty({ required: false })
    @IsBoolean()
    @IsOptional()
    isActive?: boolean;
}

// Essay DTOs
export class CreateProgramEssayDto {
    @ApiProperty()
    @IsUUID()
    @IsNotEmpty()
    programId: string;

    @ApiProperty()
    @IsString()
    @IsNotEmpty()
    question: string;

    @ApiProperty({ required: false })
    @IsString()
    @IsOptional()
    description?: string;

    @ApiProperty({ required: false })
    @IsNumber()
    @IsOptional()
    wordLimit?: number;

    @ApiProperty({ required: false })
    @IsBoolean()
    @IsOptional()
    isRequired?: boolean;

    @ApiProperty({ required: false })
    @IsNumber()
    @IsOptional()
    order?: number;

    @ApiProperty({ required: false })
    @IsBoolean()
    @IsOptional()
    isActive?: boolean;
}

export class UpdateProgramEssayDto {
    @ApiProperty({ required: false })
    @IsString()
    @IsOptional()
    question?: string;

    @ApiProperty({ required: false })
    @IsString()
    @IsOptional()
    description?: string;

    @ApiProperty({ required: false })
    @IsNumber()
    @IsOptional()
    wordLimit?: number;

    @ApiProperty({ required: false })
    @IsBoolean()
    @IsOptional()
    isRequired?: boolean;

    @ApiProperty({ required: false })
    @IsNumber()
    @IsOptional()
    order?: number;

    @ApiProperty({ required: false })
    @IsBoolean()
    @IsOptional()
    isActive?: boolean;
}

// Participation Category DTOs
export class CreateProgramParticipationCategoryDto {
    @ApiProperty()
    @IsUUID()
    @IsNotEmpty()
    programId: string;

    @ApiProperty()
    @IsString()
    @IsNotEmpty()
    name: string;

    @ApiProperty({ required: false })
    @IsString()
    @IsOptional()
    description?: string;

    @ApiProperty({ required: false })
    @IsString()
    @IsOptional()
    benefits?: string;

    @ApiProperty({ required: false })
    @IsString()
    @IsOptional()
    eligibility?: string;

    @ApiProperty({ required: false })
    @IsNumber()
    @IsOptional()
    order?: number;

    @ApiProperty({ required: false })
    @IsBoolean()
    @IsOptional()
    isActive?: boolean;
}

export class UpdateProgramParticipationCategoryDto {
    @ApiProperty({ required: false })
    @IsString()
    @IsOptional()
    name?: string;

    @ApiProperty({ required: false })
    @IsString()
    @IsOptional()
    description?: string;

    @ApiProperty({ required: false })
    @IsString()
    @IsOptional()
    benefits?: string;

    @ApiProperty({ required: false })
    @IsString()
    @IsOptional()
    eligibility?: string;

    @ApiProperty({ required: false })
    @IsNumber()
    @IsOptional()
    order?: number;

    @ApiProperty({ required: false })
    @IsBoolean()
    @IsOptional()
    isActive?: boolean;
}

// Subtheme DTOs
export class CreateProgramSubthemeDto {
    @ApiProperty()
    @IsUUID()
    @IsNotEmpty()
    programId: string;

    @ApiProperty()
    @IsString()
    @IsNotEmpty()
    name: string;

    @ApiProperty({ required: false })
    @IsString()
    @IsOptional()
    description?: string;

    @ApiProperty({ required: false })
    @IsNumber()
    @IsOptional()
    @Transform(({ value }) => (value === undefined || value === null || value === '' ? undefined : Number(value)))
    order?: number;
}

export class UpdateProgramSubthemeDto {
    @ApiProperty({ required: false })
    @IsString()
    @IsOptional()
    name?: string;

    @ApiProperty({ required: false })
    @IsString()
    @IsOptional()
    description?: string;

    @ApiProperty({ required: false })
    @IsNumber()
    @IsOptional()
    @Transform(({ value }) => (value === undefined || value === null || value === '' ? undefined : Number(value)))
    order?: number;

    @ApiProperty({ required: false })
    @IsBoolean()
    @IsOptional()
    isActive?: boolean;
}
