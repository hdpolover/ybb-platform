// services/api/src/modules/programs/application/commands/content-template.commands.ts
import { CreateContentTemplateDto, UpdateContentTemplateDto } from '../../presentation/dto/content-template.dto';

export class CreateContentTemplateCommand {
  constructor(public readonly dto: CreateContentTemplateDto) {}
}

export class UpdateContentTemplateCommand {
  constructor(
    public readonly id: string,
    public readonly dto: UpdateContentTemplateDto,
  ) {}
}

export class DeleteContentTemplateCommand {
  constructor(public readonly id: string) {}
}
