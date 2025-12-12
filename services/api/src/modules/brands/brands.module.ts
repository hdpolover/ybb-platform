import { Module } from '@nestjs/common';
import { CqrsModule } from '@nestjs/cqrs';
import { PrismaService } from '@shared/infrastructure/prisma/prisma.service';
import { BrandsController } from './presentation/brands.controller';
import { BrandRepository } from './infrastructure/persistence/brand.repository';
import { SponsorRepository } from './infrastructure/persistence/sponsor.repository';
import { ListBrandsHandler } from './application/queries/handlers/list-brands.handler';
import { GetBrandDetailHandler } from './application/queries/handlers/get-brand-detail.handler';
import { ListBrandSponsorsHandler } from './application/queries/handlers/list-brand-sponsors.handler';

@Module({
    imports: [CqrsModule],
    controllers: [BrandsController],
    providers: [
        PrismaService,
        {
            provide: 'IBrandRepository',
            useClass: BrandRepository,
        },
        {
            provide: 'ISponsorRepository',
            useClass: SponsorRepository,
        },
        ListBrandsHandler,
        GetBrandDetailHandler,
        ListBrandSponsorsHandler,
    ],
})
export class BrandsModule { }
