import {
  Controller,
  Post,
  Body,
  Logger,
  Headers,
  ServiceUnavailableException,
  UnauthorizedException,
} from '@nestjs/common';
import { createHash, timingSafeEqual } from 'crypto';
import { ApiTags, ApiOperation, ApiResponse, ApiExcludeEndpoint } from '@nestjs/swagger';
import { FileGrpcClient } from '../infrastructure/clients/file-grpc-client.service';

/**
 * Storage Events Controller
 *
 * Receives webhooks from MinIO/S3 when files are uploaded/deleted.
 *
 * Requires MINIO_WEBHOOK_SECRET. The guard used to be written as
 * `if (expectedSecret && ...)`, so leaving the variable unset did not weaken the
 * check — it removed it, and the variable was set nowhere: not in .env, not in
 * any compose file, not on the running container. The endpoint was an
 * unauthenticated POST that writes file state.
 *
 * It now refuses to serve at all without the secret. That is free rather than
 * risky here: the handler has logged zero events in seven days of production
 * logs, and object storage is DigitalOcean Spaces rather than MinIO, so nothing
 * is calling this today. If it is ever wired up, set the secret FIRST — an
 * unset secret is now a 503, by design.
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
    const expectedSecret = process.env.MINIO_WEBHOOK_SECRET?.trim();
    if (!expectedSecret) {
      // Fail CLOSED. An unconfigured secret must never mean "no authentication".
      this.logger.error(
        'MINIO_WEBHOOK_SECRET is not configured; refusing the storage webhook. ' +
          'Set it on the API and in the bucket notification config before enabling this.',
      );
      throw new ServiceUnavailableException('Storage webhook is not configured');
    }

    if (!matchesWebhookSecret(authHeader, expectedSecret)) {
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

/**
 * Constant-time bearer comparison.
 *
 * Compares SHA-256 digests rather than raw bytes: timingSafeEqual throws on a
 * length mismatch, so raw values would need a length pre-check, which is itself
 * a fast, length-leaking compare on an endpoint an attacker can retry freely.
 * Digests are always 32 bytes, so one comparison covers content and length.
 */
function matchesWebhookSecret(authHeader: string | undefined, expected: string): boolean {
  const prefix = 'Bearer ';
  if (!authHeader || !authHeader.startsWith(prefix)) return false;
  const presented = authHeader.slice(prefix.length);
  return timingSafeEqual(
    createHash('sha256').update(presented, 'utf8').digest(),
    createHash('sha256').update(expected, 'utf8').digest(),
  );
}
