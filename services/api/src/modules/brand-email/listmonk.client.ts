// src/modules/brand-email/listmonk.client.ts
import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { DEFAULT_FROM_DOMAIN } from './brand-email-theme';

const REQUEST_TIMEOUT_MS = 10_000;
const DOMAIN_PATTERN = /^[a-z0-9]([a-z0-9-]*[a-z0-9])?(\.[a-z0-9]([a-z0-9-]*[a-z0-9])?)+$/i;

export class ListmonkError extends Error {
    constructor(message: string, readonly status?: number) {
        super(message);
        this.name = 'ListmonkError';
    }
}

export class ListmonkNotConfiguredError extends ListmonkError {
    constructor() {
        super('Listmonk is not configured (set LISTMONK_URL, LISTMONK_API_USER, LISTMONK_API_TOKEN)');
        this.name = 'ListmonkNotConfiguredError';
    }
}

interface ListmonkConfig {
    baseUrl: string;
    user: string;
    token: string;
}

export interface CreateDraftCampaignInput {
    name: string;
    subject: string;
    fromEmail: string;
    templateId: number;
    listIds: number[];
    body: string;
    replyTo?: string | null;
    tags?: string[];
}

/**
 * Thin native-fetch wrapper over the Listmonk v6 REST API. Config is optional:
 * with any of the three vars unset the app boots and callers see
 * `isConfigured() === false`.
 */
@Injectable()
export class ListmonkClient implements OnModuleInit {
    private readonly logger = new Logger(ListmonkClient.name);

    constructor(private readonly config: ConfigService) {}

    onModuleInit(): void {
        const vars = ['LISTMONK_URL', 'LISTMONK_API_USER', 'LISTMONK_API_TOKEN'].map((k) => this.env(k));
        const setCount = vars.filter(Boolean).length;
        if (setCount > 0 && setCount < 3) {
            this.logger.warn('Listmonk partially configured (need LISTMONK_URL, LISTMONK_API_USER and LISTMONK_API_TOKEN); email sync disabled');
        } else if (setCount === 3 && !this.resolveConfig()) {
            this.logger.warn('LISTMONK_URL is not a valid https/http URL; email sync disabled');
        }
        if (!DOMAIN_PATTERN.test(this.fromDomain())) {
            this.logger.warn('MARKETING_FROM_DOMAIN is not a valid domain; From addresses will be rejected by SES');
        }
    }

    isConfigured(): boolean {
        return this.resolveConfig() !== null;
    }

    fromDomain(): string {
        return this.env('MARKETING_FROM_DOMAIN') || DEFAULT_FROM_DOMAIN;
    }

    editUrl(campaignId: number): string {
        const cfg = this.requireConfig();
        return `${cfg.baseUrl}/admin/campaigns/${campaignId}`;
    }

    /** Find the campaign template named `name` and update it, else create it. */
    async upsertCampaignTemplate(name: string, body: string): Promise<{ id: number; created: boolean }> {
        const payload = { name, type: 'campaign', subject: '', body };
        const existing = await this.request<{ data: Array<{ id: number; name: string }> }>('GET', '/api/templates');
        const match = Array.isArray(existing.data) ? existing.data.find((t) => t.name === name) : undefined;
        if (match) {
            await this.request('PUT', `/api/templates/${match.id}`, payload);
            return { id: match.id, created: false };
        }
        const created = await this.request<{ data: { id: number } }>('POST', '/api/templates', payload);
        return { id: created.data.id, created: true };
    }

    /** Lists are matched by tag `ybb-program:<uuid>` (same convention as ybb-mailer). */
    async findOrCreateProgramList(programId: string, listName: string): Promise<{ id: number; created: boolean }> {
        const tag = `ybb-program:${programId}`;
        const found = await this.request<{ data: { results: Array<{ id: number; tags?: string[] }> } }>(
            'GET',
            `/api/lists?tag=${encodeURIComponent(tag)}&per_page=all&minimal=true`,
        );
        const match = found.data?.results?.find((l) => l.tags?.includes(tag));
        if (match) return { id: match.id, created: false };
        const created = await this.request<{ data: { id: number } }>('POST', '/api/lists', {
            name: listName,
            type: 'private',
            optin: 'single',
            tags: [tag],
        });
        return { id: created.data.id, created: true };
    }

    /** Creates a campaign; Listmonk creates it as `draft`. */
    async createDraftCampaign(input: CreateDraftCampaignInput): Promise<{ id: number }> {
        const payload: Record<string, unknown> = {
            name: input.name,
            subject: input.subject,
            lists: input.listIds,
            from_email: input.fromEmail,
            type: 'regular',
            content_type: 'richtext',
            messenger: 'email',
            template_id: input.templateId,
            body: input.body,
            tags: input.tags ?? [],
        };
        // Listmonk has no native reply-to field; it goes out as an SMTP header.
        if (input.replyTo) payload.headers = [{ 'Reply-To': input.replyTo }];
        const res = await this.request<{ data: { id: number } }>('POST', '/api/campaigns', payload);
        return { id: res.data.id };
    }

    private env(key: string): string {
        return (this.config.get<string>(key) ?? '').trim();
    }

    private resolveConfig(): ListmonkConfig | null {
        const url = this.env('LISTMONK_URL');
        const user = this.env('LISTMONK_API_USER');
        const token = this.env('LISTMONK_API_TOKEN');
        if (!url || !user || !token) return null;
        try {
            const parsed = new URL(url);
            if (parsed.protocol !== 'https:' && parsed.protocol !== 'http:') return null;
            return { baseUrl: parsed.origin + parsed.pathname.replace(/\/+$/, ''), user, token };
        } catch {
            return null;
        }
    }

    private requireConfig(): ListmonkConfig {
        const cfg = this.resolveConfig();
        if (!cfg) throw new ListmonkNotConfiguredError();
        return cfg;
    }

    private async request<T>(method: string, path: string, body?: unknown): Promise<T> {
        const cfg = this.requireConfig();
        let res: Response;
        try {
            res = await fetch(`${cfg.baseUrl}${path}`, {
                method,
                headers: {
                    Authorization: `token ${cfg.user}:${cfg.token}`,
                    Accept: 'application/json',
                    ...(body !== undefined ? { 'Content-Type': 'application/json' } : {}),
                },
                body: body !== undefined ? JSON.stringify(body) : undefined,
                signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
            });
        } catch (err) {
            const timedOut = err instanceof Error && (err.name === 'TimeoutError' || err.name === 'AbortError');
            throw new ListmonkError(
                timedOut ? `Listmonk ${method} ${path} timed out after ${REQUEST_TIMEOUT_MS}ms` : `Listmonk ${method} ${path} failed: network error`,
            );
        }
        if (!res.ok) {
            const detail = await res.text().catch(() => '');
            // Body is Listmonk's own error JSON; never echo request headers/token.
            throw new ListmonkError(`Listmonk ${method} ${path} returned ${res.status}: ${detail.slice(0, 300)}`, res.status);
        }
        return (await res.json()) as T;
    }
}
