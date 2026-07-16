import { CreateApplicationFormFieldDto } from '../dto/application-form-field/create-application-form-field.dto';
import { UpdateApplicationFormFieldDto } from '../dto/application-form-field/update-application-form-field.dto';

export class CreateApplicationFormFieldCommand {
  constructor(
    public readonly programId: string,
    public readonly dto: CreateApplicationFormFieldDto,
    public readonly userId: string,
  ) {}
}

export class UpdateApplicationFormFieldCommand {
  constructor(
    public readonly fieldId: string,
    public readonly dto: UpdateApplicationFormFieldDto,
    public readonly userId: string,
  ) {}
}

export class DeleteApplicationFormFieldCommand {
  constructor(
    public readonly fieldId: string,
    public readonly userId: string,
  ) {}
}

export class ReorderApplicationFormFieldCommand {
  constructor(
    public readonly programId: string,
    public readonly fieldId: string,
    public readonly newOrder: number,
    public readonly userId: string,
  ) {}
}
