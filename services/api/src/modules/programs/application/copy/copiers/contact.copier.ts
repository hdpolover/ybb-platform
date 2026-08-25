// services/api/src/modules/programs/application/copy/copiers/contact.copier.ts
import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '@shared/infrastructure/prisma/prisma.service';
import { CopyInput, CopyMode, CopyPreviewItem, CopyResult, PrismaTx, ProgramCopier, TemplatePayload } from '../program-copier.interface';
import { parseTemplateItems } from '../template-payload.schemas';

/**
 * Scalar copier for the four Program-owned contact fields (Task 1's
 * migration: contactEmail/contactPhone/contactWhatsapp/contactAddress).
 * Structurally identical to ProgramDetailsCopier: no id, no order, no
 * dedupe key, no soft-delete — talks to tx.program directly rather than
 * through copyScopedRows.
 */
type ProgramContactScalars = {
  contactEmail: string | null;
  contactPhone: string | null;
  contactWhatsapp: string | null;
  contactAddress: string | null;
};

const SELECT = { contactEmail: true, contactPhone: true, contactWhatsapp: true, contactAddress: true } as const;

// Plain strings, not Tiptap HTML — contactAddress is @db.Text but free text
// (the admin editor is a plain <textarea>, not RichTextEditor), so a
// straight trim-and-check is enough here, unlike ProgramDetailsCopier's
// tag-stripping isBlankRichText.
function isBlank(value: string | null): boolean {
  return !value || value.trim().length === 0;
}

function contentFieldCount(program: ProgramContactScalars): number {
  return [program.contactEmail, program.contactPhone, program.contactWhatsapp, program.contactAddress].filter(
    (value) => !isBlank(value),
  ).length;
}

@Injectable()
export class ContactCopier implements ProgramCopier {
  readonly key = 'contact';
  readonly label = 'Contact Information';

  // Same reasoning as ProgramDetailsCopier: four scalars on the Program row,
  // nothing to append to, only something to overwrite.
  readonly supportsAppend = false;

  constructor(private readonly prisma: PrismaService) {}

  async countFor(programId: string): Promise<number> {
    const program = await this.prisma.program.findUnique({ where: { id: programId }, select: SELECT });
    if (!program) return 0;
    return contentFieldCount(program) > 0 ? 1 : 0;
  }

  async preview(programId: string): Promise<CopyPreviewItem[]> {
    const program = await this.prisma.program.findUnique({ where: { id: programId }, select: SELECT });
    if (!program) return [];
    const count = contentFieldCount(program);
    if (count === 0) return [];
    return [
      {
        id: programId,
        label: 'Contact Information',
        meta: `${count} field(s) with content`,
        // hasExternalMedia deliberately omitted — plain strings carry no
        // media references, unlike ProgramDetailsCopier's Tiptap fields.
      },
    ];
  }

  async copy(tx: PrismaTx, input: CopyInput): Promise<CopyResult> {
    if (input.mode !== 'replace') {
      throw new BadRequestException({
        code: 'append_not_supported',
        message: 'contact only supports replace mode.',
      });
    }

    const source = await tx.program.findUnique({ where: { id: input.sourceProgramId }, select: SELECT });
    if (!source) {
      throw new NotFoundException(`Program ${input.sourceProgramId} not found`);
    }

    // Same data-loss guard as ProgramDetailsCopier: a source with no content
    // in any of the four fields would overwrite the target's populated
    // contact info with four blanks, indistinguishable from wiping it.
    if (contentFieldCount(source) === 0) {
      throw new BadRequestException({
        code: 'empty_replace_source',
        message:
          'The source program has no contact information to copy. Add at least one contact field on the source program, then try again.',
      });
    }

    const target = await tx.program.findUnique({ where: { id: input.targetProgramId }, select: SELECT });
    const targetHadContent = target !== null && contentFieldCount(target) > 0;

    await tx.program.update({
      where: { id: input.targetProgramId },
      data: {
        contactEmail: source.contactEmail,
        contactPhone: source.contactPhone,
        contactWhatsapp: source.contactWhatsapp,
        contactAddress: source.contactAddress,
      },
    });

    return { created: 1, skipped: 0, replaced: targetHadContent ? 1 : 0 };
  }

  async exportTemplate(programId: string): Promise<TemplatePayload> {
    // itemIds is not accepted — this copier has exactly one exportable unit
    // (the whole four-field bundle), matching preview()'s single-item shape.
    const program = await this.prisma.program.findUnique({ where: { id: programId }, select: SELECT });
    if (!program) {
      throw new NotFoundException(`Program ${programId} not found`);
    }
    return {
      entityType: this.key,
      payloadVersion: 1,
      items: [
        {
          contactEmail: program.contactEmail,
          contactPhone: program.contactPhone,
          contactWhatsapp: program.contactWhatsapp,
          contactAddress: program.contactAddress,
        },
      ],
    };
  }

  async applyTemplate(tx: PrismaTx, payload: TemplatePayload, targetProgramId: string, mode: CopyMode): Promise<CopyResult> {
    if (mode !== 'replace') {
      throw new BadRequestException({
        code: 'append_not_supported',
        message: 'contact only supports replace mode.',
      });
    }

    const items = parseTemplateItems(this.key, payload.items) as unknown as ProgramContactScalars[];
    const item = items[0];

    // Same shape as copy()'s guard: a template with no content in any of
    // the four fields would overwrite the target's populated contact info
    // with four blanks. Reuses isBlank/contentFieldCount — no second
    // emptiness notion. Refused before any mutation.
    if (!item || contentFieldCount(item) === 0) {
      throw new BadRequestException({
        code: 'empty_replace_source',
        message: 'This template has no contact information to apply.',
      });
    }

    await tx.program.update({
      where: { id: targetProgramId },
      data: {
        contactEmail: item.contactEmail,
        contactPhone: item.contactPhone,
        contactWhatsapp: item.contactWhatsapp,
        contactAddress: item.contactAddress,
      },
    });

    // created: 1 on success, matching copy()'s semantics — see that
    // method's comment on the CopyResult contract for why.
    return { created: 1, skipped: 0, replaced: 0 };
  }
}
