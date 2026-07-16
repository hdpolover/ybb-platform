import {
  Controller,
  Post,
  Body,
  Logger,
  Headers,
  UnauthorizedException,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiExcludeEndpoint } from '@nestjs/swagger';
import { FileGrpcClient } from '../infrastructure/clients/file-grpc-client.service';

/**
 * Storage Events Controller
 *
 * Receives webhooks from MinIO/S3 when files are uploaded/deleted.
 * Protected by MINIO_WEBHOOK_SECRET env var — set it in MinIO webhook config.
 */
@ApiTags('files')
@Controller('files/events')
export class StorageEventsController {
  private readonly logger = new Logger(StorageEventsController.name);

  constructor(
    private readonly fileGrpcClient: FileGrpcClient,
  ) {}

  @Post('minio')
  @ApiExcludeEndpoint()
  @ApiOperation({ summary: 'MinIO Webhook Handler' })
  @ApiResponse({ status: 200, description: 'Event processed' })
  async handleMinioEvent(
    @Body() payload: Record<string, unknown>,
    @Headers('authorization') authHeader?: string
  ) {
    const expectedSecret = process.env.MINIO_WEBHOOK_SECRET;
    if (expectedSecret && authHeader !== `Bearer ${expectedSecret}`) {
      throw new UnauthorizedException('Invalid webhook secret');
    }

    this.logger.log(`Received MinIO Event: ${JSON.stringify(payload)}`);

    // 2. Parse Event
    // MinIO / S3 Event structure
    if (!payload.Records && !payload.EventName) {
      // Sometimes MinIO sends a test event or simpler structure
      // Handle accordingly or ignore
      return { status: 'ignored', reason: 'no_records' };
    }

    const records = (payload.Records as Record<string, unknown>[] | undefined) || [];

    for (const record of records) {
      const eventName = (record.eventName as string) || '';
        
      if (eventName.startsWith('s3:ObjectCreated:')) {
        const s3 = record.s3 as Record<string, Record<string, unknown>> | undefined;
        const objectKey = s3?.object?.key;
        const bucketName = s3?.bucket?.name;
        if (!s3 || typeof objectKey !== 'string' || typeof bucketName !== 'string') {
          this.logger.warn(`Skipping malformed s3 event record: ${JSON.stringify(record)}`);
          continue;
        }
        const key = decodeURIComponent(objectKey.replace(/\+/g, ' '));
        const bucket = bucketName;
        const size = s3.object.size as number;

        this.logger.log(`Processing Upload Event: ${key} in ${bucket}`);

        // 3. Call Python Service to Confirm
        try {
          const result = await this.fileGrpcClient.confirmUpload({
            storage_path: key,
            bucket: bucket,
            size: size
          });
          
          if (result.success) {
            this.logger.log(`Confirmed upload for ${key}. File ID: ${result.file_id}`);
          } else {
             this.logger.warn(`Could not confirm upload for ${key}. Status: ${result.status}`);
          }
        } catch (err: unknown) {
          this.logger.error(`Error confirming upload for ${key}: ${err instanceof Error ? err.message : String(err)}`);
          // Don't throw, continue processing other records
        }
      }
    }

    return { status: 'processed', count: records.length };
  }
}
