import { ApplicationCategory, DocumentFile } from '@core/entities/participant-application.entity';

/**
 * Create Application Command
 * 
 * Application Layer - Command
 */
export class CreateApplicationCommand {
  constructor(
    public readonly participantId: string,
    public readonly programId: string,
    public readonly applicationCategory?: ApplicationCategory,
    public readonly motivationLetter?: string,
    public readonly achievements?: string,
    public readonly experiences?: string,
    public readonly documents?: Record<string, DocumentFile>,
    public readonly requirementFiles?: DocumentFile[],
    public readonly twibbonLink?: string,
    public readonly pricingTierId?: string,
  ) {}
}
