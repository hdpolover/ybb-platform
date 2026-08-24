// services/api/src/modules/programs/application/commands/handlers/content-template.handler.ts
import { CommandHandler, ICommandHandler } from '@nestjs/cqrs';
import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '@shared/infrastructure/prisma/prisma.service';
import { CreateContentTemplateCommand, UpdateContentTemplateCommand, DeleteContentTemplateCommand } from '../content-template.commands';
import { ProgramCopierRegistry } from '../../copy/program-copier.registry';
import { parseTemplateItems } from '../../copy/template-payload.schemas';

@Injectable()
@CommandHandler(CreateContentTemplateCommand)
export class CreateContentTemplateHandler implements ICommandHandler<CreateContentTemplateCommand> {
  constructor(
    private readonly prisma: PrismaService,
    private readonly registry: ProgramCopierRegistry,
  ) {}

  async execute({ dto }: CreateContentTemplateCommand) {
    const copier = this.registry.get(dto.entityType);
    const payload = await copier.exportTemplate(dto.programId, dto.itemIds);
    // Write-path validation the spec requires — even though exportTemplate is
    // trusted, this catches a malformed shape immediately rather than
    // letting it sit stored until an applyTemplate call fails on it later.
    const validatedItems = parseTemplateItems(dto.entityType, payload.items);

    // Deliberate design decision (this task's "known open question"): a
    // zero-item template can never apply anything meaningful — for the five
    // list copiers and payments, applyTemplate's own empty_replace_source
    // guard would reject it in replace mode anyway (and append mode against
    // zero items is a silent no-op, not useful either); for program-details
    // specifically, exportTemplate has no blank-content guard of its own
    // (unlike its sibling copy()/applyTemplate), so it always exports
    // exactly one item and this items.length check does not catch an
    // all-blank program there — see the report for that residual gap.
    // Guard fires before any mutation, matching every other empty-source
    // guard in this codebase (copy-scoped-rows.ts, program-details.copier.ts).
    if (validatedItems.length === 0) {
      throw new BadRequestException({
        code: 'empty_template_payload',
        message:
          'No content was found to save as a template. Add content to the source program (or widen your item selection) before saving.',
      });
    }

    if (dto.isDefault) {
      await this.prisma.contentTemplate.updateMany({
        where: { entityType: dto.entityType, isDefault: true, deletedAt: null },
        data: { isDefault: false },
      });
    }

    return this.prisma.contentTemplate.create({
      data: {
        name: dto.name,
        description: dto.description ?? null,
        entityType: dto.entityType,
        payload: { entityType: dto.entityType, payloadVersion: payload.payloadVersion, items: validatedItems } as never,
        payloadVersion: payload.payloadVersion,
        isDefault: dto.isDefault ?? false,
      },
    });
  }
}

@Injectable()
@CommandHandler(UpdateContentTemplateCommand)
export class UpdateContentTemplateHandler implements ICommandHandler<UpdateContentTemplateCommand> {
  constructor(private readonly prisma: PrismaService) {}

  async execute({ id, dto }: UpdateContentTemplateCommand) {
    const existing = await this.prisma.contentTemplate.findFirst({ where: { id, deletedAt: null } });
    if (!existing) throw new NotFoundException(`Content template ${id} not found`);

    if (dto.isDefault) {
      await this.prisma.contentTemplate.updateMany({
        where: { entityType: existing.entityType, isDefault: true, deletedAt: null, NOT: { id } },
        data: { isDefault: false },
      });
    }

    return this.prisma.contentTemplate.update({
      where: { id },
      data: {
        ...(dto.name !== undefined && { name: dto.name }),
        ...(dto.description !== undefined && { description: dto.description }),
        ...(dto.isDefault !== undefined && { isDefault: dto.isDefault }),
      },
    });
  }
}

@Injectable()
@CommandHandler(DeleteContentTemplateCommand)
export class DeleteContentTemplateHandler implements ICommandHandler<DeleteContentTemplateCommand> {
  constructor(private readonly prisma: PrismaService) {}

  async execute({ id }: DeleteContentTemplateCommand) {
    const existing = await this.prisma.contentTemplate.findFirst({ where: { id, deletedAt: null } });
    if (!existing) throw new NotFoundException(`Content template ${id} not found`);
    return this.prisma.contentTemplate.update({ where: { id }, data: { deletedAt: new Date() } });
  }
}
