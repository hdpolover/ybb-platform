import { CommandHandler, ICommandHandler } from '@nestjs/cqrs';
import { Inject } from '@nestjs/common';
import { IProgramContentRepository } from '@core/interfaces/repositories/program-content.repository.interface';
import {
    CreateApplicationFormFieldCommand,
    UpdateApplicationFormFieldCommand,
    DeleteApplicationFormFieldCommand,
} from '../application-form-field.commands';

@CommandHandler(CreateApplicationFormFieldCommand)
export class CreateApplicationFormFieldHandler implements ICommandHandler<CreateApplicationFormFieldCommand> {
    constructor(@Inject('IProgramContentRepository') private readonly repository: IProgramContentRepository) {}

    async execute(command: CreateApplicationFormFieldCommand) {
        const { programId, dto } = command;
        return this.repository.createFormField({
            ...dto,
            programId,
        });
    }
}

@CommandHandler(UpdateApplicationFormFieldCommand)
export class UpdateApplicationFormFieldHandler implements ICommandHandler<UpdateApplicationFormFieldCommand> {
    constructor(@Inject('IProgramContentRepository') private readonly repository: IProgramContentRepository) {}

    async execute(command: UpdateApplicationFormFieldCommand) {
        const { fieldId, dto } = command;
        return this.repository.updateFormField(fieldId, dto);
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
