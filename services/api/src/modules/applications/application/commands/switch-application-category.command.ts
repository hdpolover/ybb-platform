import { ApplicationCategory } from '@core/entities/participant-application.entity';

export class SwitchApplicationCategoryCommand {
  constructor(
    public readonly applicationId: string,
    public readonly targetCategory: ApplicationCategory,
    public readonly userId: string,
  ) {}
}
