// services/api/src/modules/programs/application/copy/copiers/speakers.copier.ts
import { Injectable } from '@nestjs/common';
import { PrismaService } from '@shared/infrastructure/prisma/prisma.service';
import { CopyInput, CopyMode, CopyPreviewItem, CopyResult, PrismaTx, ProgramCopier, TemplatePayload } from '../program-copier.interface';
import { applyScopedTemplate, copyScopedRows, ScopedRowsDelegate } from '../copy-scoped-rows';
import { parseTemplateItems } from '../template-payload.schemas';

type SpeakerRow = {
  id: string;
  name: string;
  title: string | null;
  organization: string | null;
  bio: string | null;
  photoUrl: string | null;
  email: string | null;
  linkedinUrl: string | null;
  twitterUrl: string | null;
  instagramUrl: string | null;
  sessionTitle: string | null;
  sessionDescription: string | null;
  sessionTime: Date | null;
  isKeynote: boolean;
  expertiseAreas: string | null;
  order: number;
  isActive: boolean;
};

type TemplateItem = {
  name: string;
  title: string | null;
  organization: string | null;
  bio: string | null;
  photoUrl: string | null;
  email: string | null;
  linkedinUrl: string | null;
  twitterUrl: string | null;
  instagramUrl: string | null;
  sessionTitle: string | null;
  sessionDescription: string | null;
  sessionTime: string | null;
  isKeynote: boolean;
  expertiseAreas: string | null;
  isActive: boolean;
};

@Injectable()
export class SpeakersCopier implements ProgramCopier {
  readonly key = 'speakers';
  readonly label = 'Speakers';
  readonly supportsAppend = true;

  constructor(private readonly prisma: PrismaService) {}

  async countFor(programId: string): Promise<number> {
    return this.prisma.programSpeaker.count({ where: { programId, deletedAt: null } });
  }

  async preview(programId: string): Promise<CopyPreviewItem[]> {
    const items = await this.prisma.programSpeaker.findMany({
      where: { programId, deletedAt: null },
      orderBy: { order: 'asc' },
    });
    return (items as unknown as SpeakerRow[]).map((s) => ({
      id: s.id,
      label: s.name,
      meta: s.organization ?? s.title ?? undefined,
      // photoUrl is a literal uploaded-asset reference (not embedded
      // rich-text markup), so this mirrors form-fields.copier.ts's
      // Boolean(f.mediaUrl) check rather than the payments/
      // participation-categories regex-over-rich-text pattern.
      hasExternalMedia: Boolean(s.photoUrl),
    }));
  }

  async copy(tx: PrismaTx, input: CopyInput): Promise<CopyResult> {
    const delegate = tx.programSpeaker as unknown as ScopedRowsDelegate<SpeakerRow>;
    return copyScopedRows<SpeakerRow>({
      delegate,
      scopeField: 'programId',
      sourceProgramId: input.sourceProgramId,
      targetProgramId: input.targetProgramId,
      itemIds: input.itemIds,
      mode: input.mode,
      activeFilter: { deletedAt: null },
      idOf: (row) => row.id,
      dedupeKey: (row) => row.name,
      fields: (row, order) => ({
        programId: input.targetProgramId,
        name: row.name,
        title: row.title,
        organization: row.organization,
        bio: row.bio,
        photoUrl: row.photoUrl,
        email: row.email,
        linkedinUrl: row.linkedinUrl,
        twitterUrl: row.twitterUrl,
        instagramUrl: row.instagramUrl,
        sessionTitle: row.sessionTitle,
        sessionDescription: row.sessionDescription,
        sessionTime: row.sessionTime,
        isKeynote: row.isKeynote,
        expertiseAreas: row.expertiseAreas,
        order,
        isActive: row.isActive,
      }),
      replaceData: { deletedAt: new Date(), isActive: false },
    });
  }

  async exportTemplate(programId: string, itemIds?: string[]): Promise<TemplatePayload> {
    let rows = await this.prisma.programSpeaker.findMany({
      where: { programId, deletedAt: null },
      orderBy: { order: 'asc' },
    });
    if (itemIds && itemIds.length > 0) {
      const idSet = new Set(itemIds);
      rows = rows.filter((r) => idSet.has(r.id));
    }
    const items: TemplateItem[] = (rows as unknown as SpeakerRow[]).map((r) => ({
      name: r.name,
      title: r.title,
      organization: r.organization,
      bio: r.bio,
      photoUrl: r.photoUrl,
      email: r.email,
      linkedinUrl: r.linkedinUrl,
      twitterUrl: r.twitterUrl,
      instagramUrl: r.instagramUrl,
      sessionTitle: r.sessionTitle,
      sessionDescription: r.sessionDescription,
      sessionTime: r.sessionTime ? r.sessionTime.toISOString() : null,
      isKeynote: r.isKeynote,
      expertiseAreas: r.expertiseAreas,
      isActive: r.isActive,
    }));
    return { entityType: this.key, payloadVersion: 1, items: items as unknown as Record<string, unknown>[] };
  }

  async applyTemplate(tx: PrismaTx, payload: TemplatePayload, targetProgramId: string, mode: CopyMode): Promise<CopyResult> {
    const items = parseTemplateItems(this.key, payload.items) as unknown as TemplateItem[];
    const sourceRows: SpeakerRow[] = items.map((item, index) => ({
      id: '',
      name: item.name,
      title: item.title,
      organization: item.organization,
      bio: item.bio,
      photoUrl: item.photoUrl,
      email: item.email,
      linkedinUrl: item.linkedinUrl,
      twitterUrl: item.twitterUrl,
      instagramUrl: item.instagramUrl,
      sessionTitle: item.sessionTitle,
      sessionDescription: item.sessionDescription,
      sessionTime: item.sessionTime ? new Date(item.sessionTime) : null,
      isKeynote: item.isKeynote,
      expertiseAreas: item.expertiseAreas,
      order: index,
      isActive: item.isActive,
    }));
    const delegate = tx.programSpeaker as unknown as ScopedRowsDelegate<SpeakerRow>;
    return applyScopedTemplate<SpeakerRow>({
      delegate,
      scopeField: 'programId',
      targetProgramId,
      sourceRows,
      mode,
      activeFilter: { deletedAt: null },
      idOf: (row) => row.id,
      dedupeKey: (row) => row.name,
      fields: (row, order) => ({
        programId: targetProgramId,
        name: row.name,
        title: row.title,
        organization: row.organization,
        bio: row.bio,
        photoUrl: row.photoUrl,
        email: row.email,
        linkedinUrl: row.linkedinUrl,
        twitterUrl: row.twitterUrl,
        instagramUrl: row.instagramUrl,
        sessionTitle: row.sessionTitle,
        sessionDescription: row.sessionDescription,
        sessionTime: row.sessionTime,
        isKeynote: row.isKeynote,
        expertiseAreas: row.expertiseAreas,
        order,
        isActive: row.isActive,
      }),
      replaceData: { deletedAt: new Date(), isActive: false },
    });
  }
}
