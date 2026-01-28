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
 * Receives Webhooks from MinIO/S3 when files are uploaded/deleted.
 * Used to sync state (e.g., mark Pending uploads as Active).
 */
@ApiTags('files')
@Controller('files/events')
export class StorageEventsController {
  private readonly logger = new Logger(StorageEventsController.name);

  constructor(
    private readonly fileGrpcClient: FileGrpcClient,
  ) {}

  @Post('minio')
  @ApiOperation({ summary: 'MinIO Webhook Handler' })
  @ApiResponse({ status: 200, description: 'Event processed' })
  // @ApiExcludeEndpoint() // Ideally hide from public swagger or protect it
  async handleMinioEvent(
    @Body() payload: any,
    @Headers('authorization') authHeader?: string
  ) {
    // 1. (Optional) Validate Secret
    // If you configure MinIO webhook with an Auth Token, verify it here.
    // const expectedSecret = process.env.MINIO_WEBHOOK_SECRET;
    // if (expectedSecret && authHeader !== `Bearer ${expectedSecret}`) {
    //   throw new UnauthorizedException('Invalid Webhook Secret');
    // }

    this.logger.log(`Received MinIO Event: ${JSON.stringify(payload)}`);

    // 2. Parse Event
    // MinIO / S3 Event structure
    if (!payload.Records && !payload.EventName) {
      // Sometimes MinIO sends a test event or simpler structure
      // Handle accordingly or ignore
      return { status: 'ignored', reason: 'no_records' };
    }

    const records = payload.Records || [];

    for (const record of records) {
      const eventName = record.eventName;
        
      if (eventName.startsWith('s3:ObjectCreated:')) {
        const key = decodeURIComponent(record.s3.object.key.replace(/\+/g, ' '));
        const bucket = record.s3.bucket.name;
        const size = record.s3.object.size;

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
        } catch (err) {
          this.logger.error(`Error confirming upload for ${key}: ${err.message}`);
          // Don't throw, continue processing other records
        }
      }
    }

    return { status: 'processed', count: records.length };
  }
}
