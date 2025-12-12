import { Brand } from '../../entities/brand.entity';

export interface IBrandRepository {
    findAll(): Promise<Brand[]>;
    findById(id: string): Promise<Brand | null>;
    findBySlug(slug: string): Promise<Brand | null>;
}
