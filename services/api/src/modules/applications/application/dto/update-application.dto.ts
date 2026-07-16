import { ApplicationCategory, DocumentFile } from '@core/entities/participant-application.entity';

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
  documents?: Record<string, DocumentFile>;
  requirementFiles?: DocumentFile[];
  twibbonLink?: string;
  pricingTierId?: string;
}
