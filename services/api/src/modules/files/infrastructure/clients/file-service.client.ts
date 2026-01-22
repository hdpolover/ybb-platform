import { Injectable, Logger } from '@nestjs/common';
import { HttpService } from '@nestjs/axios';
import { ConfigService } from '@nestjs/config';
import { firstValueFrom } from 'rxjs';
import { AxiosResponse } from 'axios';
import { MetricsService } from '@shared/infrastructure/monitoring/metrics.service';

export interface FileUploadResponse {
  file: any;
  message: string;
}

export interface FileResponse {
  [key: string]: any;
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

  constructor(
    private readonly httpService: HttpService,
    private readonly configService: ConfigService,
    private readonly metricsService: MetricsService,
  ) {
    this.fileServiceUrl = this.configService.get<string>(
      'FILE_SERVICE_URL',
      'http://file-service:8001',
    );
    this.logger.log(`File Service URL: ${this.fileServiceUrl}`);
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
    file: any,
    userId: string,
    brandId: string,
    bucket: string = 'documents',
  ): Promise<FileUploadResponse> {
    const FormData = require('form-data');
    const formData = new FormData();
    formData.append('file', file.buffer, file.originalname);
    formData.append('user_id', userId);
    formData.append('brand_id', brandId);
    formData.append('bucket', bucket);

    return this.executeRequest(async () => {
      try {
        const response: AxiosResponse<FileUploadResponse> = await firstValueFrom(
          this.httpService.post(
            `${this.fileServiceUrl}/api/v1/files/upload`,
            formData,
            {
              headers: formData.getHeaders(),
            },
          ),
        );
        return response.data;
      } catch (error: any) {
        this.logger.error(`Failed to upload file: ${error.message}`);
        throw error;
      }
    });
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
              params: { user_id: userId, brand_id: brandId },
            },
          ),
        );
        return response.data;
      } catch (error: any) {
        this.logger.error(`Failed to get file: ${error.message}`);
        throw error;
      }
    });
  }

  /**
   * Generate participant Excel report
   */
  async generateParticipantReport(data: {
    program_name: string;
    participants: any[];
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
    } catch (error: any) {
      this.logger.error(`Failed to generate participant report: ${error.message}`);
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
    payments: any[];
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
    } catch (error: any) {
      this.logger.error(`Failed to generate payment report: ${error.message}`);
      throw error;
    }
  }

  /**
   * Generate custom Excel report
   */
  async generateCustomReport(data: {
    title: string;
    headers: string[];
    data: any[];
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
    } catch (error: any) {
      this.logger.error(`Failed to generate custom report: ${error.message}`);
      throw error;
    }
  }

  /**
   * Generate payment receipt PDF
   */
  async generateReceipt(transactionData: any): Promise<Buffer> {
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
    } catch (error: any) {
      this.logger.error(`Failed to generate receipt: ${error.message}`);
      throw error;
    }
  }

  /**
   * Generate offer letter PDF
   */
  async generateOfferLetter(
    participantData: any,
    programData: any,
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
    } catch (error: any) {
      this.logger.error(`Failed to generate offer letter: ${error.message}`);
      throw error;
    }
  }

  /**
   * Generate certificate (completion or participation)
   */
  async generateCertificate(
    participantData: any,
    programData: any,
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
    } catch (error: any) {
      this.logger.error(`Failed to generate certificate: ${error.message}`);
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
    } catch (error: any) {
      this.logger.error(`Failed to verify certificate: ${error.message}`);
      throw error;
    }
  }
}
