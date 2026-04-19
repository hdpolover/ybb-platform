import { Brand } from '../../entities/brand.entity';

export interface IBrandRepository {
    findAll(): Promise<Brand[]>;
    findById(id: string): Promise<Brand | null>;
    findBySlug(slug: string): Promise<Brand | null>;
    create(brand: Partial<Brand>): Promise<Brand>;
    update(id: string, brand: Partial<Brand>): Promise<Brand>;
    delete(id: string): Promise<void>;
    getMetadata(id: string): Promise<Record<string, unknown> | null>;
    updateMetadata(id: string, patch: Record<string, unknown>): Promise<Record<string, unknown>>;
}
