import { ApplicationCategory } from '@core/entities/participant-application.entity';

/**
 * Create Application DTO
 * 
 * Application Layer - Data Transfer Object
 */
export class CreateApplicationDto {
  participantId: string;
  programId: string;
  applicationCategory?: ApplicationCategory;
  motivationLetter?: string;
  achievements?: string;
  experiences?: string;
  documents?: Record<string, any>;
  requirementFiles?: any[];
  twibbonLink?: string;
  pricingTierId?: string;
}
