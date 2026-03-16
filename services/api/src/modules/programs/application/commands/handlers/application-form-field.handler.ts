import { CommandHandler, ICommandHandler } from '@nestjs/cqrs';
import { Inject } from '@nestjs/common';
import { IProgramContentRepository } from '@core/interfaces/repositories/program-content.repository.interface';
import {
    CreateApplicationFormFieldCommand,
    UpdateApplicationFormFieldCommand,
    DeleteApplicationFormFieldCommand,
} from '../application-form-field.commands';
import { CreateApplicationFormFieldDto } from '../../dto/application-form-field/create-application-form-field.dto';

function buildValidationRules(dto: Partial<CreateApplicationFormFieldDto>) {
    if (dto.defaultValue === undefined) {
        return dto.validationRules;
    }

    return {
        ...(dto.validationRules && typeof dto.validationRules === 'object' ? dto.validationRules : {}),
        defaultValue: dto.defaultValue,
    };
}

function mapFormFieldDto(dto: Partial<CreateApplicationFormFieldDto>) {
    return {
        ...(dto.section !== undefined ? { section: dto.section } : {}),
        ...(dto.fieldName !== undefined ? { name: dto.fieldName } : {}),
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

@CommandHandler(CreateApplicationFormFieldCommand)
export class CreateApplicationFormFieldHandler implements ICommandHandler<CreateApplicationFormFieldCommand> {
    constructor(@Inject('IProgramContentRepository') private readonly repository: IProgramContentRepository) {}

    async execute(command: CreateApplicationFormFieldCommand) {
        const { programId, dto } = command;
        return this.repository.createFormField({
            ...mapFormFieldDto(dto),
            programId,
        });
    }
}

@CommandHandler(UpdateApplicationFormFieldCommand)
export class UpdateApplicationFormFieldHandler implements ICommandHandler<UpdateApplicationFormFieldCommand> {
    constructor(@Inject('IProgramContentRepository') private readonly repository: IProgramContentRepository) {}

    async execute(command: UpdateApplicationFormFieldCommand) {
        const { fieldId, dto } = command;
        return this.repository.updateFormField(fieldId, mapFormFieldDto(dto));
    }
}

@CommandHandler(DeleteApplicationFormFieldCommand)
export class DeleteApplicationFormFieldHandler implements ICommandHandler<DeleteApplicationFormFieldCommand> {
    constructor(@Inject('IProgramContentRepository') private readonly repository: IProgramContentRepository) {}

    async execute(command: DeleteApplicationFormFieldCommand) {
        const { fieldId } = command;
        return this.repository.deleteFormField(fieldId);
    }
}
