import { Module } from '@nestjs/common';
import { CqrsModule } from '@nestjs/cqrs';
import { AuthModule } from '../auth/auth.module';
import { FilesModule } from '../files/files.module';
import { UsersModule } from '../users/users.module';
import { PrismaService } from '@shared/infrastructure/prisma/prisma.service';
import { ProgramsModule } from '../programs/programs.module';
import { BrandsController } from './presentation/brands.controller';
import { BrandRepository } from './infrastructure/persistence/brand.repository';
import { SponsorRepository } from './infrastructure/persistence/sponsor.repository';
import { ListBrandsHandler } from './application/queries/handlers/list-brands.handler';
import { GetBrandDetailHandler } from './application/queries/handlers/get-brand-detail.handler';
import { ListBrandSponsorsHandler } from './application/queries/handlers/list-brand-sponsors.handler';
import { ListBrandAdminsHandler } from './application/queries/handlers/list-brand-admins.handler';
import { GetBrandMetadataHandler } from './application/queries/handlers/get-brand-metadata.handler';
import { CreateBrandHandler } from './application/commands/handlers/create-brand.handler';
import { UpdateBrandHandler } from './application/commands/handlers/update-brand.handler';
import { DeleteBrandHandler } from './application/commands/handlers/delete-brand.handler';
import { UpdateBrandDetailsHandler } from './application/commands/handlers/update-brand-details.handler';
import { UpdateBrandSettingsHandler } from './application/commands/handlers/update-brand-settings.handler';
import { UpdateBrandMetadataHandler } from './application/commands/handlers/update-brand-metadata.handler';
import { AssignBrandAdminHandler } from './application/commands/handlers/assign-brand-admin.handler';
import { RemoveBrandAdminHandler } from './application/commands/handlers/remove-brand-admin.handler';
import { CreateSponsorHandler } from './application/commands/handlers/create-sponsor.handler';
import { UpdateSponsorHandler } from './application/commands/handlers/update-sponsor.handler';
import { DeleteSponsorHandler } from './application/commands/handlers/delete-sponsor.handler';

@Module({
    imports: [CqrsModule, AuthModule, FilesModule, UsersModule, ProgramsModule],
    controllers: [BrandsController],
    providers: [
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
        ListBrandAdminsHandler,
        GetBrandMetadataHandler,
        // Command Handlers
        CreateBrandHandler,
        UpdateBrandHandler,
        DeleteBrandHandler,
        UpdateBrandDetailsHandler,
        UpdateBrandSettingsHandler,
        UpdateBrandMetadataHandler,
        AssignBrandAdminHandler,
        RemoveBrandAdminHandler,
        CreateSponsorHandler,
        UpdateSponsorHandler,
        DeleteSponsorHandler,
    ],
})
export class BrandsModule { }
