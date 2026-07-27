import { Injectable, Logger } from '@nestjs/common';
import { FileGrpcClient } from '../infrastructure/clients/file-grpc-client.service';
import { deriveStorageKeyFromUrl, isPrivateCategoryKey, looksLikePrivateCategoryUrl } from '@shared/utils/private-file-key';

/** Sentinel: the file IS private, but a fresh presigned URL could not be minted.
 *  Callers must fail closed on this — never fall back to the stored url. */
export const PRIVATE_FILE_UNAVAILABLE = Symbol('PRIVATE_FILE_UNAVAILABLE');

/**
 * - string              -> fresh presigned URL
 * - null                -> not a private-category file; caller keeps its existing behavior
 * - PRIVATE_FILE_UNAVAILABLE -> private, but presign failed; caller must omit the url
 */
export type PrivateFileResolution = string | null | typeof PRIVATE_FILE_UNAVAILABLE;

@Injectable()
export class PrivateFileUrlResolver {
  private readonly logger = new Logger(PrivateFileUrlResolver.name);

  constructor(private readonly fileGrpcClient: FileGrpcClient) {}

  /** Resolve from a stored CDN url (documents/signedCopyUrl style fields). */
  async resolve(storedUrl: string, expirySeconds?: number): Promise<PrivateFileResolution> {
    const storageKey = deriveStorageKeyFromUrl(storedUrl);
    if (!storageKey) {
      // Fail closed: the env-segment regex couldn't parse this url (e.g. host/path
      // format changed), but it still visibly lives under a private category folder.
      // Don't silently treat it as "not private" and let it fall through to the
      // legacy masked-link/raw-url path.
      return looksLikePrivateCategoryUrl(storedUrl) ? PRIVATE_FILE_UNAVAILABLE : null;
    }

    return this.resolveByKey(storageKey, expirySeconds);
  }

  /** Resolve when the storage key is already known (e.g. media library rows). */
  async resolveByKey(storageKey: string, expirySeconds?: number): Promise<PrivateFileResolution> {
    if (!isPrivateCategoryKey(storageKey)) return null;

    try {
      const response = await this.fileGrpcClient.getPresignedUrlInternal(storageKey, expirySeconds);
      return response.presigned_url;
    } catch (error) {
      this.logger.error(
        `Failed to presign private file (key=${storageKey}): ${error instanceof Error ? error.message : String(error)}`,
      );
      return PRIVATE_FILE_UNAVAILABLE;
    }
  }
}
