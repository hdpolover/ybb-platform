import { Program } from '../../entities/program.entity';

export interface FindAllProgramsParams {
    brandId?: string;
    url?: string;
    year?: number;
    isPublished?: boolean;
    isActive?: boolean;
    isVisibleToUsers?: boolean;
    status?: string;
    page?: number;
    limit?: number;
    // Audit M13: an anonymous or non-admin caller must never see draft/unpublished
    // programs regardless of what isPublished/isActive/isVisibleToUsers/status they
    // pass in — the repository forces the public-safe filters when this is falsy.
    // Admin dashboard's programs list (services/admin-dashboard/app/platform/api.ts
    // listPlatformPrograms) relies on the opposite: an admin caller's filters must
    // still be honoured as-is, including requesting drafts.
    isAdmin?: boolean;
}

export interface FindAllProgramsResult {
    programs: Program[];
    total: number;
}

export interface IProgramRepository {
    findAll(params: FindAllProgramsParams): Promise<FindAllProgramsResult>;

    findById(id: string): Promise<Program | null>;
    findBySlug(slug: string, brandId?: string): Promise<Program | null>;

    create(data: Partial<Program>): Promise<Program>;
    update(id: string, data: Partial<Program>): Promise<Program>;
    delete(id: string): Promise<void>;
}

export const IProgramRepository = Symbol('IProgramRepository');
