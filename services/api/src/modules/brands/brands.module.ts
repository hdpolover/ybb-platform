import { Module } from '@nestjs/common';
import { CqrsModule } from '@nestjs/cqrs';
import { AuthModule } from '../auth/auth.module';
import { FilesModule } from '../files/files.module';
import { UsersModule } from '../users/users.module';
import { PrismaService } from '@shared/infrastructure/prisma/prisma.service';
import { BrandsController } from './presentation/brands.controller';
import { BrandRepository } from './infrastructure/persistence/brand.repository';
import { SponsorRepository } from './infrastructure/persistence/sponsor.repository';
import { ListBrandsHandler } from './application/queries/handlers/list-brands.handler';
import { GetBrandDetailHandler } from './application/queries/handlers/get-brand-detail.handler';
import { ListBrandSponsorsHandler } from './application/queries/handlers/list-brand-sponsors.handler';
import { CreateBrandHandler } from './application/commands/handlers/create-brand.handler';
import { UpdateBrandHandler } from './application/commands/handlers/update-brand.handler';
import { DeleteBrandHandler } from './application/commands/handlers/delete-brand.handler';

@Module({
    imports: [CqrsModule, AuthModule, FilesModule, UsersModule],
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
        // Query Handlers
        ListBrandsHandler,
        GetBrandDetailHandler,
        ListBrandSponsorsHandler,
        // Command Handlers
        CreateBrandHandler,
        UpdateBrandHandler,
        DeleteBrandHandler,
    ],
})
export class BrandsModule { }
