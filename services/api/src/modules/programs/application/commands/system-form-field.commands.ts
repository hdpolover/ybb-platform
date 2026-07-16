import {
  CreateSystemFormFieldDto,
  UpdateSystemFormFieldDto,
} from '../../presentation/dto/manage-system-form-field.dto';

export class CreateSystemFormFieldCommand {
  constructor(public readonly dto: CreateSystemFormFieldDto) {}
}

export class UpdateSystemFormFieldCommand {
  constructor(
    public readonly id: string,
    public readonly dto: UpdateSystemFormFieldDto,
  ) {}
}

export class DeleteSystemFormFieldCommand {
  constructor(public readonly id: string) {}
}
