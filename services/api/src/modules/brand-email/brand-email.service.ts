// src/modules/brand-email/brand-email.service.ts
import { BadGatewayException, Injectable, Logger, NotFoundException, ServiceUnavailableException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '@shared/infrastructure/prisma/prisma.service';
import { BrandEmailThemeDto } from './dto/brand-email-theme.dto';
import { EffectiveEmailTheme, StoredEmailTheme, resolveEmailTheme } from './brand-email-theme';
import { escapeHtml, renderBrandEmailTemplate, renderCtaButton, renderPreviewHtml } from './brand-email-template.renderer';
import { ListmonkClient, ListmonkError, ListmonkNotConfiguredError } from './listmonk.client';

export type SyncState = 'not_configured' | 'never' | 'synced' | 'failed';

export interface ListmonkSyncStatus {
    state: SyncState;
    templateId?: number;
    syncedAt?: string;
    error?: string;
}

export interface BrandEmailThemeResponse {
    theme: StoredEmailTheme;
    effective: EffectiveEmailTheme & { fromEmail: string };
    sync: ListmonkSyncStatus;
}

export interface DraftCampaignResponse {
    campaignId: number;
    editUrl: string;
}

const THEME_KEYS = ['fromName', 'fromLocalPart', 'replyTo', 'bannerUrl', 'footerText', 'secondaryColor', 'accentColor', 'buttonStyle'] as const;

/** Display name goes inside "..." in a From header: drop quote, backslash, angle brackets and control chars. */
export function sanitizeDisplayName(name: string): string {
    // eslint-disable-next-line no-control-regex
    return name.replace(/["\\<>\u0000-\u001f\u007f]/g, '').trim();
}

@Injectable()
export class BrandEmailService {
    private readonly logger = new Logger(BrandEmailService.name);

    constructor(
        private readonly prisma: PrismaService,
        private readonly listmonk: ListmonkClient,
    ) {}

    async getTheme(brandId: string): Promise<BrandEmailThemeResponse> {
        return this.toResponse(await this.loadBrand(brandId));
    }

    async saveTheme(brandId: string, dto: BrandEmailThemeDto): Promise<BrandEmailThemeResponse> {
        const brand = await this.loadBrand(brandId);
        const theme = this.pickTheme(dto);
        const previous = this.readStored(brand.settings?.emailTheme);
        const emailTheme = { ...theme, ...(previous.sync ? { sync: previous.sync } : {}) };
        await this.persist(brandId, emailTheme);
        // Template regeneration is best effort: a Listmonk outage must not lose the admin's edit.
        return this.resync(brandId);
    }

    async preview(brandId: string): Promise<string> {
        const brand = await this.loadBrand(brandId);
        return renderPreviewHtml(this.effective(brand));
    }

    /** Re-renders and pushes the brand template; failures are recorded, not thrown. */
    async resync(brandId: string): Promise<BrandEmailThemeResponse> {
        const brand = await this.loadBrand(brandId);
        if (this.listmonk.isConfigured()) {
            try {
                await this.syncTemplate(brand);
            } catch (err) {
                const message = err instanceof Error ? err.message : 'Unknown Listmonk error';
                this.logger.warn(`Listmonk template sync failed for brand ${brand.slug}: ${message}`);
                const sync: ListmonkSyncStatus = { state: 'failed', error: message, syncedAt: new Date().toISOString() };
                await this.persist(brandId, { ...this.readStored(brand.settings?.emailTheme).theme, sync });
            }
        }
        return this.toResponse(await this.loadBrand(brandId));
    }

    async createDraftCampaign(programId: string): Promise<DraftCampaignResponse> {
        const program = await this.prisma.program.findFirst({
            where: { id: programId, deletedAt: null },
            select: { id: true, name: true, brandId: true },
        });
        if (!program) throw new NotFoundException(`Program with ID ${programId} not found`);

        const brand = await this.loadBrand(program.brandId);
        const effective = this.effective(brand);
        try {
            const templateId = await this.syncTemplate(brand);
            const list = await this.listmonk.findOrCreateProgramList(program.id, program.name);
            const campaign = await this.listmonk.createDraftCampaign({
                name: `${program.name} - ${new Date().toISOString().slice(0, 10)}`,
                subject: program.name,
                fromEmail: this.fromEmail(effective),
                templateId,
                listIds: [list.id],
                body: this.starterBody(effective),
                replyTo: effective.replyTo,
                tags: [`ybb-brand:${brand.slug}`],
            });
            return { campaignId: campaign.id, editUrl: this.listmonk.editUrl(campaign.id) };
        } catch (err) {
            throw this.toHttpError(err);
        }
    }

    private async syncTemplate(brand: BrandWithSettings): Promise<number> {
        const html = renderBrandEmailTemplate(this.effective(brand));
        const { id } = await this.listmonk.upsertCampaignTemplate(`brand:${brand.slug}`, html);
        const stored = this.readStored(brand.settings?.emailTheme);
        await this.persist(brand.id, { ...stored.theme, sync: { state: 'synced', templateId: id, syncedAt: new Date().toISOString() } });
        return id;
    }

    private toHttpError(err: unknown): Error {
        if (err instanceof ListmonkNotConfiguredError) return new ServiceUnavailableException(err.message);
        if (err instanceof ListmonkError) return new BadGatewayException(err.message);
        return err instanceof Error ? err : new Error('Unexpected error');
    }

    private starterBody(theme: EffectiveEmailTheme): string {
        const cta = theme.websiteUrl ? renderCtaButton(theme, 'Learn more', theme.websiteUrl) : '';
        return `<p>Hi {{ .Subscriber.FirstName }},</p><p>Write your message here.</p>${cta}<p>${escapeHtml(theme.brandName)} team</p>`;
    }

    private fromEmail(theme: EffectiveEmailTheme): string {
        return `"${sanitizeDisplayName(theme.fromName)}" <${theme.fromLocalPart}@${this.listmonk.fromDomain()}>`;
    }

    private effective(brand: BrandWithSettings): EffectiveEmailTheme {
        return resolveEmailTheme(
            { ...brand, supportEmail: brand.settings?.supportEmail },
            this.readStored(brand.settings?.emailTheme).theme,
        );
    }

    private toResponse(brand: BrandWithSettings): BrandEmailThemeResponse {
        const { theme, sync } = this.readStored(brand.settings?.emailTheme);
        const effective = this.effective(brand);
        return {
            theme,
            effective: { ...effective, fromEmail: this.fromEmail(effective) },
            sync: this.listmonk.isConfigured() ? (sync ?? { state: 'never' }) : { state: 'not_configured' },
        };
    }

    private pickTheme(dto: BrandEmailThemeDto): StoredEmailTheme {
        const out: Record<string, unknown> = {};
        for (const key of THEME_KEYS) {
            if (dto[key] !== undefined) out[key] = dto[key];
        }
        return out as StoredEmailTheme;
    }

    /** Stored JSON is `{...theme, sync?}`; only whitelisted keys leave this function. */
    private readStored(raw: unknown): { theme: StoredEmailTheme; sync?: ListmonkSyncStatus } {
        if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return { theme: {} };
        const obj = raw as Record<string, unknown>;
        const theme = this.pickTheme(obj as BrandEmailThemeDto);
        return { theme, sync: obj.sync as ListmonkSyncStatus | undefined };
    }

    private async persist(brandId: string, emailTheme: Record<string, unknown>): Promise<void> {
        const value = emailTheme as Prisma.InputJsonValue;
        await this.prisma.brandSetting.upsert({
            where: { brandId },
            create: { brandId, emailTheme: value },
            update: { emailTheme: value },
        });
    }

    private async loadBrand(brandId: string): Promise<BrandWithSettings> {
        const brand = await this.prisma.brand.findFirst({
            where: { id: brandId, deletedAt: null },
            include: { settings: { select: { emailTheme: true, supportEmail: true } } },
        });
        if (!brand) throw new NotFoundException(`Brand with ID ${brandId} not found`);
        return brand;
    }
}

type BrandWithSettings = Prisma.BrandGetPayload<{ include: { settings: { select: { emailTheme: true; supportEmail: true } } } }>;
