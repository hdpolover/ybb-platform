// services/api/src/modules/programs/application/copy/copiers/testimonials.copier.ts
import { Injectable } from '@nestjs/common';
import { PrismaService } from '@shared/infrastructure/prisma/prisma.service';
import { CopyInput, CopyMode, CopyPreviewItem, CopyResult, PrismaTx, ProgramCopier, TemplatePayload } from '../program-copier.interface';
import { applyScopedTemplate, copyScopedRows, ScopedRowsDelegate } from '../copy-scoped-rows';
import { parseTemplateItems } from '../template-payload.schemas';

type TestimonialRow = {
  id: string;
  name: string;
  role: string | null;
  company: string | null;
  testimonial: string;
  category: string;
  type: string;
  videoUrl: string | null;
  thumbnailUrl: string | null;
  avatarUrl: string | null;
  rating: number | null;
  alumniYear: number | null;
  isFeatured: boolean;
  order: number;
  isActive: boolean;
};

type TemplateItem = {
  name: string;
  role: string | null;
  company: string | null;
  testimonial: string;
  category: string;
  type: string;
  videoUrl: string | null;
  thumbnailUrl: string | null;
  avatarUrl: string | null;
  rating: number | null;
  alumniYear: number | null;
  isFeatured: boolean;
  isActive: boolean;
};

// ProgramTestimonial.type ('text' | 'video') distinguishes a plain
// testimonial from a video testimonial on the same model (content.prisma) —
// one copier covers both, there is no separate video-testimonial table.
// A single person can legitimately have both a text and a video testimonial
// on the same program, so dedupe can't key on `name` alone (unlike
// faqs.copier.ts's single-field `question` key). Mirrors
// rundowns.copier.ts's length-prefixed composite key: `type` is always
// "text" or "video" today, but `name` is a free-text VarChar(255) with no
// separator restriction, so length-prefixing keeps the boundary unambiguous
// regardless of content instead of assuming a fixed separator is absent.
function dedupeKey(row: TestimonialRow): string {
  return `${row.name.length}:${row.name}:${row.type}`;
}

@Injectable()
export class TestimonialsCopier implements ProgramCopier {
  readonly key = 'testimonials';
  readonly label = 'Testimonials';
  readonly supportsAppend = true;

  constructor(private readonly prisma: PrismaService) {}

  async countFor(programId: string): Promise<number> {
    return this.prisma.programTestimonial.count({ where: { programId, deletedAt: null } });
  }

  async preview(programId: string): Promise<CopyPreviewItem[]> {
    const items = await this.prisma.programTestimonial.findMany({
      where: { programId, deletedAt: null },
      orderBy: { order: 'asc' },
    });
    return (items as unknown as TestimonialRow[]).map((t) => ({
      id: t.id,
      label: t.name,
      meta: t.type,
      // avatarUrl/videoUrl/thumbnailUrl are literal uploaded-asset
      // references (not embedded rich-text markup), so this mirrors
      // form-fields.copier.ts's Boolean(f.mediaUrl) check rather than the
      // payments/participation-categories regex-over-rich-text pattern.
      hasExternalMedia: Boolean(t.avatarUrl) || Boolean(t.videoUrl) || Boolean(t.thumbnailUrl),
    }));
  }

  async copy(tx: PrismaTx, input: CopyInput): Promise<CopyResult> {
    const delegate = tx.programTestimonial as unknown as ScopedRowsDelegate<TestimonialRow>;
    return copyScopedRows<TestimonialRow>({
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
        name: row.name,
        role: row.role,
        company: row.company,
        testimonial: row.testimonial,
        category: row.category,
        type: row.type,
        videoUrl: row.videoUrl,
        thumbnailUrl: row.thumbnailUrl,
        avatarUrl: row.avatarUrl,
        rating: row.rating,
        alumniYear: row.alumniYear,
        isFeatured: row.isFeatured,
        order,
        isActive: row.isActive,
      }),
      replaceData: { deletedAt: new Date(), isActive: false },
    });
  }

  async exportTemplate(programId: string, itemIds?: string[]): Promise<TemplatePayload> {
    let rows = await this.prisma.programTestimonial.findMany({
      where: { programId, deletedAt: null },
      orderBy: { order: 'asc' },
    });
    if (itemIds && itemIds.length > 0) {
      const idSet = new Set(itemIds);
      rows = rows.filter((r) => idSet.has(r.id));
    }
    const items: TemplateItem[] = (rows as unknown as TestimonialRow[]).map((r) => ({
      name: r.name,
      role: r.role,
      company: r.company,
      testimonial: r.testimonial,
      category: r.category,
      type: r.type,
      videoUrl: r.videoUrl,
      thumbnailUrl: r.thumbnailUrl,
      avatarUrl: r.avatarUrl,
      rating: r.rating,
      alumniYear: r.alumniYear,
      isFeatured: r.isFeatured,
      isActive: r.isActive,
    }));
    return { entityType: this.key, payloadVersion: 1, items: items as unknown as Record<string, unknown>[] };
  }

  async applyTemplate(tx: PrismaTx, payload: TemplatePayload, targetProgramId: string, mode: CopyMode): Promise<CopyResult> {
    const items = parseTemplateItems(this.key, payload.items) as unknown as TemplateItem[];
    const sourceRows: TestimonialRow[] = items.map((item, index) => ({
      id: '',
      name: item.name,
      role: item.role,
      company: item.company,
      testimonial: item.testimonial,
      category: item.category,
      type: item.type,
      videoUrl: item.videoUrl,
      thumbnailUrl: item.thumbnailUrl,
      avatarUrl: item.avatarUrl,
      rating: item.rating,
      alumniYear: item.alumniYear,
      isFeatured: item.isFeatured,
      order: index,
      isActive: item.isActive,
    }));
    const delegate = tx.programTestimonial as unknown as ScopedRowsDelegate<TestimonialRow>;
    return applyScopedTemplate<TestimonialRow>({
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
        name: row.name,
        role: row.role,
        company: row.company,
        testimonial: row.testimonial,
        category: row.category,
        type: row.type,
        videoUrl: row.videoUrl,
        thumbnailUrl: row.thumbnailUrl,
        avatarUrl: row.avatarUrl,
        rating: row.rating,
        alumniYear: row.alumniYear,
        isFeatured: row.isFeatured,
        order,
        isActive: row.isActive,
      }),
      replaceData: { deletedAt: new Date(), isActive: false },
    });
  }
}
