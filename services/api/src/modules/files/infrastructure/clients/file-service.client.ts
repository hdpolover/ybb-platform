import { Injectable, Logger } from '@nestjs/common';
import { HttpService } from '@nestjs/axios';
import FormData from 'form-data';
import { ConfigService } from '@nestjs/config';
import { firstValueFrom } from 'rxjs';
import { AxiosResponse } from 'axios';
import { MetricsService } from '@shared/infrastructure/monitoring/metrics.service';

export interface FileUploadResponse {
  file: Record<string, unknown>;
  message: string;
}

export type FileResponse = Record<string, unknown>;

export interface CreateUploadUrlRequest {
  filename: string;
  content_type: string;
  size: number;
  user_id: string;
  brand_id: string;
  bucket?: string;
  program_id?: string;
  participant_id?: string;
  asset_type?: string;
}

export interface CreateUploadUrlResponse {
  file_id: string;
  upload_url: string;
  storage_path: string;
  bucket: string;
  public_url: string | null;
  expires_in_seconds: number;
}

export interface UploadedBrandImageAsset {
  file_id: string;
  filename: string;
  storage_path: string;
  bucket: string;
  size: number;
  dimensions: { width: number; height: number };
  url: string;
}

export interface BrandLogoAssetsResponse {
  success: boolean;
  logo: UploadedBrandImageAsset;
  logo_icon: UploadedBrandImageAsset;
  favicon: UploadedBrandImageAsset;
  apple_icon: UploadedBrandImageAsset;
}

/**
 * File Service HTTP Client
 * 
 * Infrastructure Layer - External Service Communication
 * Handles all HTTP communication with the Python File Service
 */
@Injectable()
export class FileServiceClient {
  private readonly logger = new Logger(FileServiceClient.name);
  private readonly fileServiceUrl: string;
  private readonly internalServiceKey: string;

  constructor(
    private readonly httpService: HttpService,
    private readonly configService: ConfigService,
    private readonly metricsService: MetricsService,
  ) {
    this.fileServiceUrl = this.configService.get<string>(
      'FILE_SERVICE_URL',
      'http://file-service:8001',
    );
    this.internalServiceKey =
      this.configService.get<string>('FILE_SERVICE_INTERNAL_KEY') ||
      this.configService.get<string>('INTERNAL_SERVICE_KEY', '');
    this.logger.log(`File Service URL: ${this.fileServiceUrl}`);
  }

  private getInternalHeaders(extra?: Record<string, string>): Record<string, string> {
    const headers: Record<string, string> = { ...(extra ?? {}) };
    if (this.internalServiceKey) {
      headers['x-internal-service-key'] = this.internalServiceKey;
    }
    return headers;
  }

  private async executeRequest<T>(operation: () => Promise<T>, service: string = 'storage'): Promise<T> {
    const start = Date.now();
    try {
      return await operation();
    } finally {
      const duration = (Date.now() - start) / 1000;
        this.metricsService.externalApiDuration.observe({ service }, duration);
    }
  }

  /**
   * Upload file to file service
   */
  async uploadFile(
    file: Express.Multer.File,
    userId: string,
    brandId: string,
    bucket: string = 'documents',
    programId?: string,
    participantId?: string,
  ): Promise<FileUploadResponse> {
    const formData = new FormData();
    formData.append('file', file.buffer, file.originalname);
    formData.append('user_id', userId);
    formData.append('brand_id', brandId);
    formData.append('bucket', bucket);
    
    // Add optional context
    if (programId) {
      formData.append('program_id', programId);
    }
    if (participantId) {
      formData.append('participant_id', participantId);
    }

    return this.executeRequest(async () => {
      try {
        const response: AxiosResponse<FileUploadResponse> = await firstValueFrom(
          this.httpService.post(
            `${this.fileServiceUrl}/api/v1/files/upload`,
            formData,
            {
              headers: this.getInternalHeaders(formData.getHeaders() as Record<string, string>),
            },
          ),
        );
        return response.data;
      } catch (error: unknown) {
        this.logger.error(`Failed to upload file: ${error instanceof Error ? error.message : String(error)}`);
        throw error;
      }
    });
  }

  async uploadBrandLogoAssets(
    file: Express.Multer.File,
    brandId: string,
  ): Promise<BrandLogoAssetsResponse> {
    const formData = new FormData();
    formData.append('file', file.buffer, {
      filename: file.originalname,
      contentType: file.mimetype,
    });
    formData.append('brand_id', brandId);

    return this.executeRequest(async () => {
      try {
        const response: AxiosResponse<BrandLogoAssetsResponse> = await firstValueFrom(
          this.httpService.post(
            `${this.fileServiceUrl}/api/v1/images/brand/logo-assets`,
            formData,
            {
              headers: this.getInternalHeaders(formData.getHeaders() as Record<string, string>),
            },
          ),
        );
        return response.data;
      } catch (error: unknown) {
        this.logger.error(`Failed to upload brand logo assets: ${error instanceof Error ? error.message : String(error)}`);
        throw error;
      }
    }, 'brand-logo-assets');
  }

  /**
   * Get file information and download URL
   */
  async getFile(
    fileId: string,
    userId: string,
    brandId: string,
  ): Promise<FileResponse> {
    return this.executeRequest(async () => {
      try {
        const response: AxiosResponse<FileResponse> = await firstValueFrom(
          this.httpService.get(
            `${this.fileServiceUrl}/api/v1/files/${fileId}`,
            {
              headers: this.getInternalHeaders(),
              params: { user_id: userId, brand_id: brandId },
            },
          ),
        );
        return response.data;
      } catch (error: unknown) {
        this.logger.error(`Failed to get file: ${error instanceof Error ? error.message : String(error)}`);
        throw error;
      }
    });
  }

  /**
   * Generate participant Excel report
   */
  async generateParticipantReport(data: {
    program_name: string;
    participants: Record<string, unknown>[];
  }): Promise<Buffer> {
    try {
      const response: AxiosResponse<ArrayBuffer> = await firstValueFrom(
        this.httpService.post(
          `${this.fileServiceUrl}/api/v1/documents/export/participants`,
          data,
          {
            responseType: 'arraybuffer',
          },
        ),
      );
      return Buffer.from(response.data);
    } catch (error: unknown) {
      this.logger.error(`Failed to generate participant report: ${error instanceof Error ? error.message : String(error)}`);
      throw error;
    }
  }

  /**
   * Generate payment Excel report
   */
  async generatePaymentReport(data: {
    program_name: string;
    start_date: string;
    end_date: string;
    payments: Record<string, unknown>[];
  }): Promise<Buffer> {
    try {
      const response: AxiosResponse<ArrayBuffer> = await firstValueFrom(
        this.httpService.post(
          `${this.fileServiceUrl}/api/v1/documents/export/payments`,
          data,
          {
            responseType: 'arraybuffer',
          },
        ),
      );
      return Buffer.from(response.data);
    } catch (error: unknown) {
      this.logger.error(`Failed to generate payment report: ${error instanceof Error ? error.message : String(error)}`);
      throw error;
    }
  }

  /**
   * Generate custom Excel report
   */
  async generateCustomReport(data: {
    title: string;
    headers: string[];
    data: Record<string, unknown>[];
    sheet_name?: string;
  }): Promise<Buffer> {
    try {
      const response: AxiosResponse<ArrayBuffer> = await firstValueFrom(
        this.httpService.post(
          `${this.fileServiceUrl}/api/v1/documents/export/custom`,
          data,
          {
            responseType: 'arraybuffer',
          },
        ),
      );
      return Buffer.from(response.data);
    } catch (error: unknown) {
      this.logger.error(`Failed to generate custom report: ${error instanceof Error ? error.message : String(error)}`);
      throw error;
    }
  }

  /**
   * Generate payment receipt PDF
   */
  async generateReceipt(transactionData: Record<string, unknown>): Promise<Buffer> {
    try {
      const response: AxiosResponse<ArrayBuffer> = await firstValueFrom(
        this.httpService.post(
          `${this.fileServiceUrl}/api/v1/documents/generate/receipt`,
          { transaction_data: transactionData },
          {
            responseType: 'arraybuffer',
          },
        ),
      );
      return Buffer.from(response.data);
    } catch (error: unknown) {
      this.logger.error(`Failed to generate receipt: ${error instanceof Error ? error.message : String(error)}`);
      throw error;
    }
  }

  /**
   * Generate offer letter PDF
   */
  async generateOfferLetter(
    participantData: Record<string, unknown>,
    programData: Record<string, unknown>,
  ): Promise<Buffer> {
    try {
      const response: AxiosResponse<ArrayBuffer> = await firstValueFrom(
        this.httpService.post(
          `${this.fileServiceUrl}/api/v1/documents/generate/offer-letter`,
          {
            participant_data: participantData,
            program_data: programData,
          },
          {
            responseType: 'arraybuffer',
          },
        ),
      );
      return Buffer.from(response.data);
    } catch (error: unknown) {
      this.logger.error(`Failed to generate offer letter: ${error instanceof Error ? error.message : String(error)}`);
      throw error;
    }
  }

  /**
   * Generate certificate (completion or participation)
   */
  async generateCertificate(
    participantData: Record<string, unknown>,
    programData: Record<string, unknown>,
    certificateType: 'completion' | 'participation' = 'completion',
  ): Promise<Buffer> {
    try {
      const response: AxiosResponse<ArrayBuffer> = await firstValueFrom(
        this.httpService.post(
          `${this.fileServiceUrl}/api/v1/documents/generate/certificate`,
          {
            participant_data: participantData,
            program_data: programData,
            certificate_type: certificateType,
          },
          {
            responseType: 'arraybuffer',
          },
        ),
      );
      return Buffer.from(response.data);
    } catch (error: unknown) {
      this.logger.error(`Failed to generate certificate: ${error instanceof Error ? error.message : String(error)}`);
      throw error;
    }
  }

  /**
   * Generate LOA PDF from Tiptap HTML via WeasyPrint.
   */
  async generateLoa(params: {
    html_content: string;
    header_html: string;
    footer_html: string;
    page_size: string;
    margins: { top: number; right: number; bottom: number; left: number };
    placeholder_data: Record<string, string>;
    document_number: string;
    logo_url?: string;
    signature_url?: string;
    stamp_url?: string;
    signer_name?: string;
    signer_title?: string;
    header?: {
      program_name: string;
      batch: string;
      tagline: string;
      website: string;
      email: string;
      phone: string;
    };
  }): Promise<Buffer> {
    try {
      const response: AxiosResponse<ArrayBuffer> = await firstValueFrom(
        this.httpService.post(
          `${this.fileServiceUrl}/api/v1/documents/generate/loa`,
          params,
          { responseType: 'arraybuffer' },
        ),
      );
      return Buffer.from(response.data);
    } catch (error: unknown) {
      this.logger.error(`Failed to generate LOA: ${error instanceof Error ? error.message : String(error)}`);
      throw error;
    }
  }

  /**
   * Verify certificate by hash
   */
  async verifyCertificate(verificationHash: string): Promise<FileResponse> {
    try {
      const response: AxiosResponse<FileResponse> = await firstValueFrom(
        this.httpService.get(
          `${this.fileServiceUrl}/api/v1/documents/verify/${verificationHash}`,
        ),
      );
      return response.data;
    } catch (error: unknown) {
      this.logger.error(`Failed to verify certificate: ${error instanceof Error ? error.message : String(error)}`);
      throw error;
    }
  }

  // ─── Media Library ────────────────────────────────────────────────────────

  /**
   * List media files for a program (media library query).
   */
  async listProgramMedia(params: {
    programId: string;
    brandId: string;
    assetType?: string;
    bucket?: string;
    page?: number;
    limit?: number;
  }): Promise<Record<string, unknown>> {
    return this.executeRequest(async () => {
      try {
        const response: AxiosResponse<Record<string, unknown>> = await firstValueFrom(
          this.httpService.get(
            `${this.fileServiceUrl}/api/v1/media/program/${params.programId}`,
            {
              headers: this.getInternalHeaders(),
              params: {
                brand_id: params.brandId,
                asset_type: params.assetType,
                bucket: params.bucket,
                page: params.page ?? 1,
                limit: params.limit ?? 50,
              },
            },
          ),
        );
        return response.data;
      } catch (error: unknown) {
        this.logger.error(`Failed to list program media: ${error instanceof Error ? error.message : String(error)}`);
        throw error;
      }
    });
  }

  /**
   * Request a presigned PUT URL so the client can upload bytes directly to Spaces.
   * Pairs with markFileReady() — this call reserves a File row in PROCESSING state;
   * markFileReady() flips it to READY once the browser's PUT completes.
   */
  async createUploadUrl(request: CreateUploadUrlRequest): Promise<CreateUploadUrlResponse> {
    return this.executeRequest(async () => {
      try {
        const response: AxiosResponse<CreateUploadUrlResponse> = await firstValueFrom(
          this.httpService.post(
            `${this.fileServiceUrl}/api/v1/files/upload-url`,
            request,
            {
              headers: this.getInternalHeaders(),
            },
          ),
        );
        return response.data;
      } catch (error: unknown) {
        this.logger.error(
          `Failed to request upload URL: ${error instanceof Error ? error.message : String(error)}`,
        );
        throw error;
      }
    });
  }

  /**
   * Mark a PROCESSING file as READY after the client-side PUT to the presigned URL succeeded.
   * Idempotent — safe to retry if the client isn't sure the first call landed.
   */
  async markFileReady(
    fileId: string,
    userId: string,
    brandId: string,
    actualSize?: number,
  ): Promise<FileResponse> {
    return this.executeRequest(async () => {
      try {
        const response: AxiosResponse<FileResponse> = await firstValueFrom(
          this.httpService.patch(
            `${this.fileServiceUrl}/api/v1/files/${fileId}/ready`,
            null,
            {
              params: {
                user_id: userId,
                brand_id: brandId,
                ...(actualSize !== undefined ? { actual_size: actualSize } : {}),
              },
              headers: this.getInternalHeaders(),
            },
          ),
        );
        return response.data;
      } catch (error: unknown) {
        this.logger.error(
          `Failed to mark file ready (${fileId}): ${error instanceof Error ? error.message : String(error)}`,
        );
        throw error;
      }
    });
  }

  /**
   * Soft-delete a media file.
   */
  async deleteMediaFile(fileId: string, brandId: string): Promise<void> {
    return this.executeRequest(async () => {
      try {
        await firstValueFrom(
          this.httpService.delete(
            `${this.fileServiceUrl}/api/v1/media/${fileId}`,
            {
              headers: this.getInternalHeaders(),
              params: { brand_id: brandId },
            },
          ),
        );
      } catch (error: unknown) {
        this.logger.error(`Failed to delete media file ${fileId}: ${error instanceof Error ? error.message : String(error)}`);
        throw error;
      }
    });
  }
}
