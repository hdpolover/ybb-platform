// services/api/src/modules/programs/application/copy/copiers/photos.copier.ts
import { Injectable } from '@nestjs/common';
import { PrismaService } from '@shared/infrastructure/prisma/prisma.service';
import { CopyInput, CopyMode, CopyPreviewItem, CopyResult, PrismaTx, ProgramCopier, TemplatePayload } from '../program-copier.interface';
import { applyScopedTemplate, copyScopedRows, ScopedRowsDelegate } from '../copy-scoped-rows';
import { parseTemplateItems } from '../template-payload.schemas';

type PhotoRow = {
  id: string;
  imageUrl: string;
  videoUrl: string | null;
  title: string | null;
  description: string | null;
  year: number | null;
  type: string;
  order: number;
  isActive: boolean;
};

type TemplateItem = {
  imageUrl: string;
  videoUrl: string | null;
  title: string | null;
  description: string | null;
  year: number | null;
  type: string;
  isActive: boolean;
};

// ProgramGallery has no name-like field to key on (unlike speakers/faqs).
// imageUrl is the row's one required, effectively-unique field — the same
// asset URL copied twice from the same source is the natural definition of
// a duplicate here, mirroring how speakers/testimonials use their one
// human-authored identity field (name) rather than the row's id.
function dedupeKey(row: PhotoRow): string {
  return row.imageUrl;
}

@Injectable()
export class PhotosCopier implements ProgramCopier {
  readonly key = 'photos';
  readonly label = 'Photos';
  readonly supportsAppend = true;

  constructor(private readonly prisma: PrismaService) {}

  async countFor(programId: string): Promise<number> {
    return this.prisma.programGallery.count({ where: { programId, deletedAt: null } });
  }

  async preview(programId: string): Promise<CopyPreviewItem[]> {
    const items = await this.prisma.programGallery.findMany({
      where: { programId, deletedAt: null },
      orderBy: { order: 'asc' },
    });
    return (items as unknown as PhotoRow[]).map((p) => ({
      id: p.id,
      label: p.title ?? p.imageUrl,
      meta: p.year ? String(p.year) : undefined,
      // imageUrl/videoUrl are literal uploaded-asset references (not
      // embedded rich-text markup), so this mirrors speakers.copier.ts's
      // Boolean(photoUrl) check rather than the payments/
      // participation-categories regex-over-rich-text pattern. Every row
      // has an imageUrl (NOT NULL), so this is always true — kept as an
      // explicit Boolean() rather than a hardcoded `true` so the generic
      // dialog's warning derivation stays uniform across every copier.
      hasExternalMedia: Boolean(p.imageUrl) || Boolean(p.videoUrl),
    }));
  }

  async copy(tx: PrismaTx, input: CopyInput): Promise<CopyResult> {
    const delegate = tx.programGallery as unknown as ScopedRowsDelegate<PhotoRow>;
    return copyScopedRows<PhotoRow>({
      delegate,
      scopeField: 'programId',
      sourceProgramId: input.sourceProgramId,
      targetProgramId: input.targetProgramId,
      itemIds: input.itemIds,
      mode: input.mode,
      activeFilter: { deletedAt: null },
      idOf: (row) => row.id,
      dedupeKey,
      fields: (row, order) => ({
        programId: input.targetProgramId,
        imageUrl: row.imageUrl,
        videoUrl: row.videoUrl,
        title: row.title,
        description: row.description,
        year: row.year,
        type: row.type,
        order,
        isActive: row.isActive,
      }),
      replaceData: { deletedAt: new Date(), isActive: false },
    });
  }

  async exportTemplate(programId: string, itemIds?: string[]): Promise<TemplatePayload> {
    let rows = await this.prisma.programGallery.findMany({
      where: { programId, deletedAt: null },
      orderBy: { order: 'asc' },
    });
    if (itemIds && itemIds.length > 0) {
      const idSet = new Set(itemIds);
      rows = rows.filter((r) => idSet.has(r.id));
    }
    const items: TemplateItem[] = (rows as unknown as PhotoRow[]).map((r) => ({
      imageUrl: r.imageUrl,
      videoUrl: r.videoUrl,
      title: r.title,
      description: r.description,
      year: r.year,
      type: r.type,
      isActive: r.isActive,
    }));
    return { entityType: this.key, payloadVersion: 1, items: items as unknown as Record<string, unknown>[] };
  }

  async applyTemplate(tx: PrismaTx, payload: TemplatePayload, targetProgramId: string, mode: CopyMode): Promise<CopyResult> {
    const items = parseTemplateItems(this.key, payload.items) as unknown as TemplateItem[];
    const sourceRows: PhotoRow[] = items.map((item, index) => ({
      id: '',
      imageUrl: item.imageUrl,
      videoUrl: item.videoUrl,
      title: item.title,
      description: item.description,
      year: item.year,
      type: item.type,
      order: index,
      isActive: item.isActive,
    }));
    const delegate = tx.programGallery as unknown as ScopedRowsDelegate<PhotoRow>;
    return applyScopedTemplate<PhotoRow>({
      delegate,
      scopeField: 'programId',
      targetProgramId,
      sourceRows,
      mode,
      activeFilter: { deletedAt: null },
      idOf: (row) => row.id,
      dedupeKey,
      fields: (row, order) => ({
        programId: targetProgramId,
        imageUrl: row.imageUrl,
        videoUrl: row.videoUrl,
        title: row.title,
        description: row.description,
        year: row.year,
        type: row.type,
        order,
        isActive: row.isActive,
      }),
      replaceData: { deletedAt: new Date(), isActive: false },
    });
  }
}
