import {
  CreateFormTemplateDto,
  UpdateFormTemplateDto,
} from '../../presentation/dto/form-template.dto';

export class CreateFormTemplateCommand {
  constructor(public readonly dto: CreateFormTemplateDto) {}
}

export class UpdateFormTemplateCommand {
  constructor(
    public readonly id: string,
    public readonly dto: UpdateFormTemplateDto,
  ) {}
}

export class DeleteFormTemplateCommand {
  constructor(public readonly id: string) {}
}
