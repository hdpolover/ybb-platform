import { CommandHandler, ICommandHandler } from '@nestjs/cqrs';
import { ConflictException, Inject, Logger } from '@nestjs/common';
import { IProgramContentRepository } from '@core/interfaces/repositories/program-content.repository.interface';
import { PrismaService } from '@shared/infrastructure/prisma/prisma.service';
import {
  CreateApplicationFormFieldCommand,
  UpdateApplicationFormFieldCommand,
  DeleteApplicationFormFieldCommand,
} from '../application-form-field.commands';
import { CreateApplicationFormFieldDto } from '../../dto/application-form-field/create-application-form-field.dto';
import { ApplicationCategory, ApplicationFormField, Prisma } from '@prisma/client';
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
    ...(dto.helpAssets !== undefined ? { helpAssets: dto.helpAssets } : {}),
    ...(dto.fieldType !== undefined ? { type: dto.fieldType } : {}),
    ...(dto.isRequired !== undefined ? { isRequired: dto.isRequired } : {}),
    ...(dto.options !== undefined ? { options: dto.options } : {}),
    ...(dto.order !== undefined ? { order: dto.order } : {}),
    ...(dto.validationRules !== undefined || dto.defaultValue !== undefined
      ? { validationRules: buildValidationRules(dto) }
      : {}),
    ...(dto.allowedCategories !== undefined
      ? { allowedCategories: dto.allowedCategories as ApplicationCategory[] }
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

      const systemDto: Partial<CreateApplicationFormFieldDto> = {
        ...dto,
        options:
          dto.options !== undefined
            ? dto.options
            : ((Array.isArray(definition.defaultOptions)
                ? (definition.defaultOptions as unknown[])
                : []) as string[] | Record<string, unknown>[]),
        placeholder: dto.placeholder ?? definition.placeholder ?? undefined,
        helpText: dto.helpText ?? definition.helpText ?? undefined,
      };

      return this.repository.createFormField({
        ...mapDtoToField(systemDto, definition.key),
        // The system catalog is the single source of truth for a system
        // field's type. A stale or wrong client fieldType must not downgrade
        // e.g. a phone field to text (which breaks the country-code dropdown
        // on the participant submission form).
        type: definition.type,
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
  private readonly logger = new Logger(UpdateApplicationFormFieldHandler.name);

  constructor(
    @Inject('IProgramContentRepository')
    private readonly repository: IProgramContentRepository,
    private readonly keyValidator: FormFieldKeyValidator,
    private readonly prisma: PrismaService,
  ) {}

  async execute(command: UpdateApplicationFormFieldCommand) {
    const { fieldId, dto } = command;

    // Only validate the key when it's actually changing. Grandfathers legacy
    // custom fields whose key later collided with a new catalog entry — they
    // must remain editable without being forced through the catalog picker.
    let existing: ApplicationFormField | null = null;
    let keyChanged = false;
    if (dto.fieldName) {
      existing = await this.repository.findFormFieldById(fieldId);
      keyChanged = !existing || existing.name !== dto.fieldName;
      if (keyChanged) {
        try {
          await this.keyValidator.validateCustomKey(dto.fieldName);
        } catch (err) {
          throw translateValidationError(err);
        }
      }
    }

    const updateData = mapDtoToField(dto) as Partial<ApplicationFormField>;

    // Renaming a live field's key is not cosmetic: participant answers are
    // stored in personal_data keyed by the OLD name via an exact-key lookup
    // (get-portal-submission-detail.handler.ts). Without migrating the JSON
    // keys, every already-submitted application would silently lose its
    // answer to this field the moment the key changes. Do the migration in
    // the same transaction as the rename so the schema and the data can never
    // drift apart.
    if (existing && keyChanged && dto.fieldName) {
      return this.renameAndMigrateAnswers(existing, dto.fieldName, updateData);
    }

    return this.repository.updateFormField(fieldId, updateData);
  }

  private async renameAndMigrateAnswers(
    existing: ApplicationFormField,
    newKey: string,
    updateData: Partial<ApplicationFormField>,
  ): Promise<ApplicationFormField> {
    const oldKey = existing.name;
    const programId = existing.programId;

    return this.prisma.$transaction(async (tx) => {
      const updated = await tx.applicationFormField.update({
        where: { id: existing.id },
        data: updateData as Prisma.ApplicationFormFieldUncheckedUpdateInput,
      });

      // Applications that already hold a value under the new key would lose
      // either the old or the new answer if we blindly overwrote one with
      // the other. Least-destructive choice: leave both keys untouched on
      // those rows (the existing new-key value already wins on read, see
      // preferValue in get-portal-submission-detail.handler.ts) and log for
      // manual review instead of guessing which value is correct.
      const collisions = await tx.$queryRaw<{ id: string }[]>`
        SELECT id FROM participant_applications
        WHERE program_id = ${programId}::uuid
          AND jsonb_exists(personal_data::jsonb, ${oldKey})
          AND jsonb_exists(personal_data::jsonb, ${newKey})
      `;
      if (collisions.length > 0) {
        this.logger.warn(
          `Form field rename "${oldKey}" -> "${newKey}" on program ${programId}: ` +
            `${collisions.length} application(s) already have personal_data under both keys ` +
            `(ids: ${collisions.map((row) => row.id).join(', ')}). Left untouched; the existing ` +
            `"${newKey}" value keeps winning on read and the orphaned "${oldKey}" value needs manual review.`,
        );
      }

      const migratedCount = await tx.$executeRaw`
        UPDATE participant_applications
        SET personal_data = (
          (personal_data::jsonb - ${oldKey}) ||
          jsonb_build_object(${newKey}, personal_data::jsonb -> ${oldKey})
        )::json
        WHERE program_id = ${programId}::uuid
          AND jsonb_exists(personal_data::jsonb, ${oldKey})
          AND NOT jsonb_exists(personal_data::jsonb, ${newKey})
      `;
      this.logger.log(
        `Form field rename "${oldKey}" -> "${newKey}" on program ${programId}: ` +
          `migrated personal_data key on ${migratedCount} application(s).`,
      );

      return updated;
    });
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
