import { Injectable, NotFoundException } from '@nestjs/common';
import { DatabaseService } from '../infrastructure/database.service';

type LandingPage =
  | 'home'
  | 'settings'
  | 'programs'
  | 'program-detail'
  | 'about'
  | 'partners-sponsors'
  | 'faqs'
  | 'announcements';

@Injectable()
export class PublicService {
  constructor(private readonly databaseService: DatabaseService) {}

  async getHome(brand: string) {
    return this.getSnapshotByPage(brand, 'home');
  }

  async getSettings(brand: string) {
    return this.getSnapshotByPage(brand, 'settings');
  }

  async getPrograms(brand: string) {
    return this.getSnapshotByPage(brand, 'programs');
  }

  async getProgramDetail(brand: string, slug: string) {
    return this.getSnapshotByPage(brand, 'program-detail', slug);
  }

  async getAbout(brand: string) {
    return this.getSnapshotByPage(brand, 'about');
  }

  async getPartners(brand: string) {
    return this.getSnapshotByPage(brand, 'partners-sponsors');
  }

  async getFaqs(brand: string) {
    return this.getSnapshotByPage(brand, 'faqs');
  }

  async getAnnouncements(brand: string) {
    return this.getSnapshotByPage(brand, 'announcements');
  }

  private normalizeBrandInput(input: string): string {
    return input.trim().toLowerCase().replace(/^https?:\/\//, '').replace(/^www\./, '').split('/')[0];
  }

  private async resolveBrandId(brandInput: string): Promise<string> {
    const normalized = this.normalizeBrandInput(brandInput);
    const rows = await this.databaseService.query<{ id: string }>(
      `
        SELECT b.id
        FROM brands b
        WHERE b.deleted_at IS NULL
          AND b.is_active = TRUE
          AND (
            lower(b.id::text) = $1
            OR lower(b.slug) = $1
            OR lower(split_part(replace(replace(coalesce(b.website_url, ''), 'https://', ''), 'http://', ''), '/', 1)) = $1
            OR lower(split_part(replace(replace(coalesce(b.landing_url, ''), 'https://', ''), 'http://', ''), '/', 1)) = $1
            OR lower(replace(split_part(replace(replace(coalesce(b.website_url, ''), 'https://', ''), 'http://', ''), '/', 1), 'www.', '')) = $1
            OR lower(replace(split_part(replace(replace(coalesce(b.landing_url, ''), 'https://', ''), 'http://', ''), '/', 1), 'www.', '')) = $1
          )
        LIMIT 1
      `,
      [normalized],
    );

    if (!rows[0]?.id) {
      throw new NotFoundException(`Brand '${brandInput}' was not found`);
    }

    return rows[0].id;
  }

  private async getSnapshotByPage(brandInput: string, page: LandingPage, slug = ''): Promise<unknown> {
    const brandId = await this.resolveBrandId(brandInput);

    const rows = await this.databaseService.query<{ payload_json: unknown }>(
      `
        SELECT payload_json
        FROM brand_landing_snapshots
        WHERE brand_id = $1
          AND page = $2
          AND slug = $3
        LIMIT 1
      `,
      [brandId, page, slug],
    );

    if (!rows[0]) {
      const suffix = slug ? `/${slug}` : '';
      throw new NotFoundException(`Snapshot not found for page '${page}${suffix}'`);
    }

    return rows[0].payload_json;
  }
}
