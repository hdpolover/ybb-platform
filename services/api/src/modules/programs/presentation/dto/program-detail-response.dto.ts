import { ApiProperty } from '@nestjs/swagger';

class BrandDto {
  @ApiProperty()
  id: string;

  @ApiProperty()
  name: string;

  @ApiProperty()
  slug: string;

  @ApiProperty()
  websiteUrl?: string;

  @ApiProperty()
  logoUrl?: string;

  @ApiProperty()
  about?: string;
}

class ProgramPaymentPeriodDto {
  @ApiProperty()
  id: string;

  @ApiProperty()
  name: string;

  @ApiProperty()
  startDate: Date;

  @ApiProperty()
  endDate: Date;

  @ApiProperty()
  amount: number;

  @ApiProperty()
  isActive: boolean;
}

class ProgramPaymentDto {
  @ApiProperty()
  id: string;

  @ApiProperty()
  name: string;

  @ApiProperty()
  description?: string;

  @ApiProperty()
  paymentType: string;

  @ApiProperty()
  amount: number;

  @ApiProperty()
  currency: string;

  @ApiProperty()
  isRequired: boolean;

  @ApiProperty()
  order: number;

  @ApiProperty({ type: [ProgramPaymentPeriodDto] })
  periods: ProgramPaymentPeriodDto[];

  @ApiProperty()
  currentPeriod?: ProgramPaymentPeriodDto;

  @ApiProperty()
  isCurrentlyAvailable: boolean;
}

class ProgramFaqDto {
  @ApiProperty()
  id: string;

  @ApiProperty()
  question: string;

  @ApiProperty()
  answer: string;

  @ApiProperty()
  order: number;
}

class ProgramSpeakerDto {
  @ApiProperty()
  id: string;

  @ApiProperty()
  name: string;

  @ApiProperty()
  title?: string;

  @ApiProperty()
  organization?: string;

  @ApiProperty()
  bio?: string;

  @ApiProperty()
  photoUrl?: string;

  @ApiProperty()
  linkedinUrl?: string;
}

class ProgramTimelineDto {
  @ApiProperty()
  id: string;

  @ApiProperty()
  date: Date;

  @ApiProperty()
  title: string;

  @ApiProperty()
  description?: string;

  @ApiProperty()
  icon?: string;
}

class ProgramTestimonialDto {
  @ApiProperty()
  id: string;

  @ApiProperty()
  name: string;

  @ApiProperty()
  role?: string;

  @ApiProperty()
  company?: string;

  @ApiProperty()
  testimonial: string;

  @ApiProperty()
  type: string;

  @ApiProperty()
  videoUrl?: string;

  @ApiProperty()
  avatarUrl?: string;

  @ApiProperty()
  rating?: number;

  @ApiProperty()
  isFeatured: boolean;
}

class ProgramRequirementDto {
  @ApiProperty()
  id: string;

  @ApiProperty()
  name: string;

  @ApiProperty()
  description?: string;

  @ApiProperty()
  type: string;

  @ApiProperty()
  isRequired: boolean;

  @ApiProperty()
  fileMaxSize?: number;

  @ApiProperty()
  fileAllowedTypes?: string;

  @ApiProperty()
  options?: any[];

  @ApiProperty()
  validationRules?: any;
}

class ApplicationFormFieldDto {
  @ApiProperty()
  id: string;

  @ApiProperty()
  fieldName: string;

  @ApiProperty()
  label: string;

  @ApiProperty()
  placeholder?: string;

  @ApiProperty()
  helpText?: string;

  @ApiProperty()
  fieldType: string;

  @ApiProperty()
  isRequired: boolean;

  @ApiProperty()
  options?: any[];

  @ApiProperty()
  validationRules?: any;

  @ApiProperty()
  defaultValue?: string;

  @ApiProperty()
  order: number;
}

class ProgramPartnerDto {
  @ApiProperty()
  id: string;

  @ApiProperty()
  name: string;

  @ApiProperty()
  type: string;

  @ApiProperty()
  role?: string;

  @ApiProperty()
  logoUrl?: string;

  @ApiProperty()
  websiteUrl?: string;

  @ApiProperty()
  description?: string;
}

class ProgramResourceDto {
  @ApiProperty()
  id: string;

  @ApiProperty()
  title: string;

  @ApiProperty()
  description?: string;

  @ApiProperty()
  fileUrl: string;

  @ApiProperty()
  fileSize?: number;

  @ApiProperty()
  fileType?: string;

  @ApiProperty()
  type: string;

  @ApiProperty()
  isPublic: boolean;

  @ApiProperty()
  downloads: number;
}

class ProgramTagDto {
  @ApiProperty()
  id: string;

  @ApiProperty()
  name: string;

  @ApiProperty()
  slug: string;

  @ApiProperty()
  color?: string;
}

class ProgramAnnouncementDto {
  @ApiProperty()
  id: string;

  @ApiProperty()
  title: string;

  @ApiProperty()
  content: string;

  @ApiProperty()
  targetAudience: string;

  @ApiProperty()
  isPinned: boolean;

  @ApiProperty()
  publishDate: Date;
}

class ProgramParticipationCategoryDto {
  @ApiProperty()
  id: string;

  @ApiProperty()
  name: string;

  @ApiProperty()
  description?: string;

  @ApiProperty()
  benefits?: string;

  @ApiProperty()
  eligibility?: string;

  @ApiProperty()
  order: number;
}

export class ProgramDetailResponseDto {
  @ApiProperty()
  id: string;

  @ApiProperty()
  name: string;

  @ApiProperty()
  slug: string;

  @ApiProperty()
  description?: string;

  @ApiProperty()
  shortDescription?: string;

  @ApiProperty()
  startDate?: Date;

  @ApiProperty()
  endDate?: Date;

  @ApiProperty()
  registrationOpenDate?: Date;

  @ApiProperty()
  registrationCloseDate?: Date;

  @ApiProperty()
  location?: string;

  @ApiProperty()
  thumbnailUrl?: string;

  @ApiProperty()
  bannerUrl?: string;

  @ApiProperty()
  videoUrl?: string;

  @ApiProperty()
  status: string;

  @ApiProperty()
  isVisibleToUsers: boolean;

  @ApiProperty()
  allowRegistration: boolean;

  @ApiProperty()
  requirePayment: boolean;

  @ApiProperty()
  currency?: string;

  @ApiProperty()
  requirementsDescription?: string;

  @ApiProperty()
  benefitsDescription?: string;

  @ApiProperty()
  termsAndConditions?: string;

  @ApiProperty()
  metaTitle?: string;

  @ApiProperty()
  metaDescription?: string;

  @ApiProperty({ type: BrandDto })
  brand: BrandDto;

  @ApiProperty({ type: [ProgramPaymentDto] })
  payments?: ProgramPaymentDto[];

  @ApiProperty()
  totalCost?: number;

  @ApiProperty({ type: [ProgramFaqDto] })
  faqs?: ProgramFaqDto[];

  @ApiProperty({ type: [ProgramSpeakerDto] })
  speakers?: ProgramSpeakerDto[];

  @ApiProperty({ type: [ProgramTimelineDto] })
  timeline?: ProgramTimelineDto[];

  @ApiProperty({ type: [ProgramTestimonialDto] })
  testimonials?: ProgramTestimonialDto[];

  @ApiProperty({ type: [ProgramRequirementDto] })
  requirements?: ProgramRequirementDto[];

  @ApiProperty({ type: [ProgramParticipationCategoryDto] })
  participationCategories?: ProgramParticipationCategoryDto[];

  @ApiProperty({ type: [ApplicationFormFieldDto] })
  formFields?: ApplicationFormFieldDto[];

  @ApiProperty({ type: [ProgramPartnerDto] })
  partners?: ProgramPartnerDto[];

  @ApiProperty({ type: [ProgramResourceDto] })
  resources?: ProgramResourceDto[];

  @ApiProperty({ type: [ProgramTagDto] })
  tags?: ProgramTagDto[];

  @ApiProperty({ type: [ProgramAnnouncementDto] })
  announcements?: ProgramAnnouncementDto[];

  @ApiProperty()
  createdAt: Date;

  @ApiProperty()
  updatedAt: Date;
}
