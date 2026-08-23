import { Module } from '@nestjs/common';
import { HttpModule } from '@nestjs/axios';
import { GalleryController } from './presentation/gallery.controller';
import { GalleryService } from './application/gallery.service';
import { FilesModule } from '@modules/files/files.module';
import { PrismaModule } from '@shared/infrastructure/prisma/prisma.module';
import { AuthModule } from '@modules/auth/auth.module';
import { LandingRevalidationService } from '@modules/brands/application/services/landing-revalidation.service';
import { LandingCacheInvalidationService } from '@modules/brands/application/services/landing-cache-invalidation.service';

@Module({
  // HttpModule is required here (not global) because LandingCacheInvalidationService
  // depends on LandingRevalidationService, which POSTs to the landing app's revalidate
  // routes via HttpService. BrandsModule can't be imported directly to get these services
  // instead — it imports ProgramsModule, and ProgramsModule already re-declares these same
  // classes as local providers rather than risk a cycle; gallery follows that convention.
  imports: [FilesModule, PrismaModule, AuthModule, HttpModule],
  controllers: [GalleryController],
  providers: [GalleryService, LandingRevalidationService, LandingCacheInvalidationService],
})
export class GalleryModule {}
