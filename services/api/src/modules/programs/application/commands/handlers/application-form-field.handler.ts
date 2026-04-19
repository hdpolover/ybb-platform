import { CommandHandler, ICommandHandler } from '@nestjs/cqrs';
import { ConflictException, Inject } from '@nestjs/common';
import { IProgramContentRepository } from '@core/interfaces/repositories/program-content.repository.interface';
import { PrismaService } from '@shared/infrastructure/prisma/prisma.service';
import {
  CreateApplicationFormFieldCommand,
  UpdateApplicationFormFieldCommand,
  DeleteApplicationFormFieldCommand,
} from '../application-form-field.commands';
import { CreateApplicationFormFieldDto } from '../../dto/application-form-field/create-application-form-field.dto';
import { ApplicationFormField } from '@prisma/client';
import {
  FormFieldKeyValidator,
  FieldKeyValidationError,
} from '../../validators/form-field-key.validator';

function buildValidationRules(dto: Partial<CreateApplicationFormFieldDto>) {
  if (dto.defaultValue === undefined) {
    return dto.validationRules;
  }
  return {
    ...(dto.validationRules && typeof dto.validationRules === 'object'
      ? dto.validationRules
      : {}),
    defaultValue: dto.defaultValue,
  };
}

function mapDtoToField(
  dto: Partial<CreateApplicationFormFieldDto>,
  nameOverride?: string,
) {
  return {
    ...(dto.section !== undefined ? { section: dto.section } : {}),
    ...(dto.fieldName !== undefined || nameOverride !== undefined
      ? { name: nameOverride ?? dto.fieldName }
      : {}),
    ...(dto.label !== undefined ? { label: dto.label } : {}),
    ...(dto.placeholder !== undefined ? { placeholder: dto.placeholder } : {}),
    ...(dto.helpText !== undefined ? { helpText: dto.helpText } : {}),
    ...(dto.mediaUrl !== undefined ? { mediaUrl: dto.mediaUrl } : {}),
    ...(dto.mediaAlt !== undefined ? { mediaAlt: dto.mediaAlt } : {}),
    ...(dto.fieldType !== undefined ? { type: dto.fieldType } : {}),
    ...(dto.isRequired !== undefined ? { isRequired: dto.isRequired } : {}),
    ...(dto.options !== undefined ? { options: dto.options } : {}),
    ...(dto.order !== undefined ? { order: dto.order } : {}),
    ...(dto.validationRules !== undefined || dto.defaultValue !== undefined
      ? { validationRules: buildValidationRules(dto) }
      : {}),
  };
}

function translateValidationError(err: unknown): ConflictException {
  if (err instanceof FieldKeyValidationError) {
    return new ConflictException({
      code: err.code,
      message: err.message,
    });
  }
  throw err;
}

@CommandHandler(CreateApplicationFormFieldCommand)
export class CreateApplicationFormFieldHandler
  implements ICommandHandler<CreateApplicationFormFieldCommand>
{
  constructor(
    @Inject('IProgramContentRepository')
    private readonly repository: IProgramContentRepository,
    private readonly keyValidator: FormFieldKeyValidator,
    private readonly prisma: PrismaService,
  ) {}

  async execute(command: CreateApplicationFormFieldCommand) {
    const { programId, dto } = command;
    const source = dto.source ?? 'custom';

    if (source === 'system') {
      if (!dto.systemFieldKey) {
        throw new ConflictException({
          code: 'missing_system_field_key',
          message: 'System fields require a systemFieldKey.',
        });
      }
      const definition = await this.prisma.systemFormFieldDefinition.findUnique({
        where: { key: dto.systemFieldKey },
      });
      if (!definition || !definition.isActive || definition.deletedAt) {
        throw new ConflictException({
          code: 'unknown_system_field_key',
          message: `Unknown or inactive system field key: ${dto.systemFieldKey}`,
        });
      }
      return this.repository.createFormField({
        ...mapDtoToField(dto, definition.key),
        source: 'system',
        systemFieldKey: definition.key,
        name: definition.key,
        programId,
      } as Partial<ApplicationFormField>);
    }

    // custom
    if (!dto.fieldName) {
      throw new ConflictException({
        code: 'missing_field_name',
        message: 'Custom fields require a fieldName.',
      });
    }
    try {
      await this.keyValidator.validateCustomKey(dto.fieldName);
    } catch (err) {
      throw translateValidationError(err);
    }
    return this.repository.createFormField({
      ...mapDtoToField(dto),
      source: 'custom',
      programId,
    } as Partial<ApplicationFormField>);
  }
}

@CommandHandler(UpdateApplicationFormFieldCommand)
export class UpdateApplicationFormFieldHandler
  implements ICommandHandler<UpdateApplicationFormFieldCommand>
{
  constructor(
    @Inject('IProgramContentRepository')
    private readonly repository: IProgramContentRepository,
    private readonly keyValidator: FormFieldKeyValidator,
  ) {}

  async execute(command: UpdateApplicationFormFieldCommand) {
    const { fieldId, dto } = command;
    if (dto.fieldName) {
      try {
        await this.keyValidator.validateCustomKey(dto.fieldName);
      } catch (err) {
        throw translateValidationError(err);
      }
    }
    return this.repository.updateFormField(
      fieldId,
      mapDtoToField(dto) as Partial<ApplicationFormField>,
    );
  }
}

@CommandHandler(DeleteApplicationFormFieldCommand)
export class DeleteApplicationFormFieldHandler
  implements ICommandHandler<DeleteApplicationFormFieldCommand>
{
  constructor(
    @Inject('IProgramContentRepository')
    private readonly repository: IProgramContentRepository,
  ) {}

  async execute(command: DeleteApplicationFormFieldCommand) {
    return this.repository.deleteFormField(command.fieldId);
  }
}
