import { ConflictException } from '@nestjs/common';
import { IBrandRepository } from '@core/interfaces/repositories/brand.repository.interface';

const MAX_BRAND_NAME_LENGTH = 100;
const MAX_BRAND_SLUG_LENGTH = 100;

function buildDeletedIdentityValue(baseValue: string, suffix: string, maxLength: number): string {
    const normalizedBase = baseValue.trim() || 'brand';
    const allowedBaseLength = Math.max(1, maxLength - suffix.length);
    return `${normalizedBase.slice(0, allowedBaseLength)}${suffix}`;
}

export function buildDeletedBrandName(name: string, brandId: string): string {
    return buildDeletedIdentityValue(name, ` [deleted ${brandId.slice(0, 8)}]`, MAX_BRAND_NAME_LENGTH);
}

export function buildDeletedBrandSlug(slug: string, brandId: string): string {
    return buildDeletedIdentityValue(slug, `-deleted-${brandId.slice(0, 8)}`, MAX_BRAND_SLUG_LENGTH);
}

export async function ensureBrandIdentityAvailable(
    repository: Pick<IBrandRepository, 'findByName' | 'findBySlug' | 'update'>,
    identity: { name: string; slug: string; currentBrandId?: string },
): Promise<void> {
    const pendingUpdates = new Map<string, { name?: string; slug?: string }>();

    const registerConflict = (
        conflict: Awaited<ReturnType<IBrandRepository['findBySlug']>>,
        field: 'name' | 'slug',
    ) => {
        if (!conflict || conflict.id === identity.currentBrandId) {
            return;
        }

        if (!conflict.deletedAt) {
            throw new ConflictException(`Brand with this ${field} already exists.`);
        }

        const nextPatch = pendingUpdates.get(conflict.id) ?? {};
        if (field === 'name') {
            nextPatch.name = buildDeletedBrandName(conflict.name, conflict.id);
        } else {
            nextPatch.slug = buildDeletedBrandSlug(conflict.slug, conflict.id);
        }

        pendingUpdates.set(conflict.id, nextPatch);
    };

    registerConflict(await repository.findByName(identity.name), 'name');
    registerConflict(await repository.findBySlug(identity.slug), 'slug');

    for (const [brandId, patch] of pendingUpdates.entries()) {
        await repository.update(brandId, patch);
    }
}
