import { Module } from '@nestjs/common';
import { CqrsModule } from '@nestjs/cqrs';
import { HttpModule } from '@nestjs/axios';
import { ConfigModule } from '@nestjs/config';
import { AuthModule } from '../auth/auth.module';
import { FilesModule } from '../files/files.module';
import { UsersModule } from '../users/users.module';
import { ProgramsModule } from '../programs/programs.module';
import { LandingRevalidationService } from './application/services/landing-revalidation.service';
import { LandingCacheInvalidationService } from './application/services/landing-cache-invalidation.service';
import { BrandLogoAssetsService } from './application/services/brand-logo-assets.service';
import { BrandsController } from './presentation/brands.controller';
import { SignatureAdminController } from './presentation/signature-admin.controller';
import { BrandRepository } from './infrastructure/persistence/brand.repository';
import { SponsorRepository } from './infrastructure/persistence/sponsor.repository';
import { ListBrandsHandler } from './application/queries/handlers/list-brands.handler';
import { GetBrandDetailHandler } from './application/queries/handlers/get-brand-detail.handler';
import { ListBrandSponsorsHandler } from './application/queries/handlers/list-brand-sponsors.handler';
import { ListBrandSocialFeedsHandler } from './application/queries/handlers/list-brand-social-feeds.handler';
import { ListBrandAdminsHandler } from './application/queries/handlers/list-brand-admins.handler';
import { GetBrandMetadataHandler } from './application/queries/handlers/get-brand-metadata.handler';
import { ListSignaturesHandler } from './application/queries/handlers/list-signatures.handler';
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
import { CreateSocialFeedHandler } from './application/commands/handlers/create-social-feed.handler';
import { UpdateSocialFeedHandler } from './application/commands/handlers/update-social-feed.handler';
import { DeleteSocialFeedHandler } from './application/commands/handlers/delete-social-feed.handler';
import { CreateSignatureHandler } from './application/commands/handlers/create-signature.handler';
import { UpdateSignatureHandler } from './application/commands/handlers/update-signature.handler';
import { DeleteSignatureHandler } from './application/commands/handlers/delete-signature.handler';

@Module({
    imports: [CqrsModule, HttpModule, ConfigModule, AuthModule, FilesModule, UsersModule, ProgramsModule],
    controllers: [BrandsController, SignatureAdminController],
    providers: [
        LandingRevalidationService,
        LandingCacheInvalidationService,
        BrandLogoAssetsService,
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
        ListBrandSocialFeedsHandler,
        ListBrandAdminsHandler,
        GetBrandMetadataHandler,
        ListSignaturesHandler,
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
        CreateSocialFeedHandler,
        UpdateSocialFeedHandler,
        DeleteSocialFeedHandler,
        CreateSignatureHandler,
        UpdateSignatureHandler,
        DeleteSignatureHandler,
    ],
})
export class BrandsModule { }
