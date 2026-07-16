import { DocumentFile } from '@core/entities/participant-application.entity';

/**
 * Update Application Command
 * 
 * Application Layer - Command
 */
export class UpdateApplicationCommand {
  constructor(
    public readonly applicationId: string,
    public readonly updates: {
      applicationCategory?: string;
      motivationLetter?: string;
      achievements?: string;
      experiences?: string;
      documents?: Record<string, DocumentFile>;
      requirementFiles?: DocumentFile[];
      twibbonLink?: string;
      pricingTierId?: string;
    },
  ) {}
}
