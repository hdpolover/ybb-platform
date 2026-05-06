import { Injectable } from '@nestjs/common';
import { FileServiceClient } from '@modules/files/infrastructure/clients/file-service.client';

export const BRAND_METADATA_FAVICON_URL = 'favicon_url';
export const BRAND_METADATA_APPLE_ICON_URL = 'apple_icon_url';

@Injectable()
export class BrandLogoAssetsService {
  constructor(private readonly fileServiceClient: FileServiceClient) {}

  async uploadBrandLogoAssets(file: Express.Multer.File, brandId: string): Promise<{
    logoUrl: string;
    logoIconUrl: string;
    metadataPatch: Record<string, string>;
  }> {
    const result = await this.fileServiceClient.uploadBrandLogoAssets(file, brandId);

    return {
      logoUrl: result.logo.url,
      logoIconUrl: result.logo_icon.url,
      metadataPatch: {
        [BRAND_METADATA_FAVICON_URL]: result.favicon.url,
        [BRAND_METADATA_APPLE_ICON_URL]: result.apple_icon.url,
      },
    };
  }
}
