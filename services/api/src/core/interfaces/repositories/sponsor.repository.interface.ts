import { Sponsor } from '../../entities/sponsor.entity';

export interface ISponsorRepository {
    findByBrandId(brandId: string): Promise<Sponsor[]>;
}
