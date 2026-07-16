import { Module } from '@nestjs/common';
import { GalleryController } from './presentation/gallery.controller';
import { GalleryService } from './application/gallery.service';
import { FilesModule } from '@modules/files/files.module';
import { PrismaModule } from '@shared/infrastructure/prisma/prisma.module';
import { AuthModule } from '@modules/auth/auth.module';

@Module({
  imports: [FilesModule, PrismaModule, AuthModule],
  controllers: [GalleryController],
  providers: [GalleryService],
})
export class GalleryModule {}
