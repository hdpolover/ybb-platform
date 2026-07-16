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
