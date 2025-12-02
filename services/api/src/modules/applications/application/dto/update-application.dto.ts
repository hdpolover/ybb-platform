import { ApplicationCategory } from '@core/entities/participant-application.entity';

/**
 * Update Application DTO
 * 
 * Application Layer - Data Transfer Object
 */
export class UpdateApplicationDto {
  applicationCategory?: ApplicationCategory;
  motivationLetter?: string;
  achievements?: string;
  experiences?: string;
  documents?: Record<string, any>;
  requirementFiles?: any[];
  twibbonLink?: string;
  pricingTierId?: string;
}
