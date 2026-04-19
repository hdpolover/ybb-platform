import { CommandHandler, ICommandHandler } from '@nestjs/cqrs';
import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '@shared/infrastructure/prisma/prisma.service';
import {
  CreateSystemFormFieldCommand,
  UpdateSystemFormFieldCommand,
  DeleteSystemFormFieldCommand,
} from '../system-form-field.commands';
import { isMagicFormFieldKey } from '../../constants/magic-form-fields';

@Injectable()
@CommandHandler(CreateSystemFormFieldCommand)
export class CreateSystemFormFieldHandler
  implements ICommandHandler<CreateSystemFormFieldCommand>
{
  constructor(private readonly prisma: PrismaService) {}

  async execute({ dto }: CreateSystemFormFieldCommand) {
    if (isMagicFormFieldKey(dto.key)) {
      throw new ConflictException({
        code: 'reserved_magic_key',
        message: `"${dto.key}" is a magic key and cannot be managed as a catalog entry.`,
      });
    }
    const existing = await this.prisma.systemFormFieldDefinition.findUnique({
      where: { key: dto.key },
    });
    if (existing && existing.isActive && !existing.deletedAt) {
      throw new ConflictException({
        code: 'duplicate_key',
        message: `System field "${dto.key}" already exists.`,
      });
    }
    return this.prisma.systemFormFieldDefinition.create({
      data: {
        key: dto.key,
        label: dto.label,
        category: dto.category,
        type: dto.type,
        defaultOptions: (dto.defaultOptions as never) ?? [],
        helpText: dto.helpText ?? null,
        order: dto.order ?? 0,
      },
    });
  }
}

@Injectable()
@CommandHandler(UpdateSystemFormFieldCommand)
export class UpdateSystemFormFieldHandler
  implements ICommandHandler<UpdateSystemFormFieldCommand>
{
  constructor(private readonly prisma: PrismaService) {}

  async execute({ id, dto }: UpdateSystemFormFieldCommand) {
    const row = await this.prisma.systemFormFieldDefinition.findUnique({
      where: { id },
    });
    if (!row) throw new NotFoundException(`System field ${id} not found`);
    return this.prisma.systemFormFieldDefinition.update({
      where: { id },
      data: {
        ...(dto.label !== undefined && { label: dto.label }),
        ...(dto.category !== undefined && { category: dto.category }),
        ...(dto.type !== undefined && { type: dto.type }),
        ...(dto.defaultOptions !== undefined && {
          defaultOptions: dto.defaultOptions as never,
        }),
        ...(dto.helpText !== undefined && { helpText: dto.helpText }),
        ...(dto.isActive !== undefined && { isActive: dto.isActive }),
        ...(dto.order !== undefined && { order: dto.order }),
      },
    });
  }
}

@Injectable()
@CommandHandler(DeleteSystemFormFieldCommand)
export class DeleteSystemFormFieldHandler
  implements ICommandHandler<DeleteSystemFormFieldCommand>
{
  constructor(private readonly prisma: PrismaService) {}

  async execute({ id }: DeleteSystemFormFieldCommand) {
    const row = await this.prisma.systemFormFieldDefinition.findUnique({
      where: { id },
    });
    if (!row) throw new NotFoundException(`System field ${id} not found`);
    if (row.isMagic) {
      throw new ConflictException({
        code: 'cannot_delete_magic',
        message: `"${row.key}" is a magic field and cannot be deleted.`,
      });
    }
    return this.prisma.systemFormFieldDefinition.update({
      where: { id },
      data: { deletedAt: new Date(), isActive: false },
    });
  }
}
