import { PrivateFileUrlResolver, PRIVATE_FILE_UNAVAILABLE } from './private-file-url-resolver.service';
import { FileGrpcClient } from '../infrastructure/clients/file-grpc-client.service';

describe('PrivateFileUrlResolver', () => {
  let mockFileGrpcClient: { getPresignedUrlInternal: jest.Mock };
  let resolver: PrivateFileUrlResolver;

  beforeEach(() => {
    mockFileGrpcClient = { getPresignedUrlInternal: jest.fn() };
    resolver = new PrivateFileUrlResolver(mockFileGrpcClient as unknown as FileGrpcClient);
  });

  it('returns a fresh presigned url for a private-category file', async () => {
    const storedUrl = 'https://cdn.ybbhub.com/prod/brandx/programs/prog1/documents/file1.pdf';
    mockFileGrpcClient.getPresignedUrlInternal.mockResolvedValue({
      presigned_url: 'https://storage.example.com/signed?X-Amz-Signature=abc',
      expires_at_unix: 1234567890,
    });

    const result = await resolver.resolve(storedUrl);

    expect(result).toBe('https://storage.example.com/signed?X-Amz-Signature=abc');
    expect(mockFileGrpcClient.getPresignedUrlInternal).toHaveBeenCalledWith(
      'prod/brandx/programs/prog1/documents/file1.pdf',
      undefined,
    );
  });

  it('returns the unavailable sentinel (never the stored url) when the RPC errors', async () => {
    const storedUrl = 'https://cdn.ybbhub.com/prod/brandx/programs/prog1/signed-copies/file2.pdf';
    mockFileGrpcClient.getPresignedUrlInternal.mockRejectedValue(new Error('UNAVAILABLE'));

    const result = await resolver.resolve(storedUrl);

    expect(result).toBe(PRIVATE_FILE_UNAVAILABLE);
    expect(result).not.toBe(storedUrl);
  });

  it('returns null for a non-private-category file and does not call the RPC', async () => {
    const storedUrl = 'https://cdn.ybbhub.com/prod/brandx/programs/prog1/gallery/photo.jpg';

    const result = await resolver.resolve(storedUrl);

    expect(result).toBeNull();
    expect(mockFileGrpcClient.getPresignedUrlInternal).not.toHaveBeenCalled();
  });

  it('returns null when the url has no derivable storage key', async () => {
    const storedUrl = 'https://cdn.ybbhub.com/v1/files/123e4567-e89b-12d3-a456-426614174000/download';

    const result = await resolver.resolve(storedUrl);

    expect(result).toBeNull();
    expect(mockFileGrpcClient.getPresignedUrlInternal).not.toHaveBeenCalled();
  });

  it('fails closed (unavailable sentinel) when the storage key is unparseable but the url still looks private', async () => {
    // No /prod|staging|dev/ segment, so deriveStorageKeyFromUrl returns null — but the
    // url still visibly lives under /documents/, so this must NOT fall through as
    // "not private" (which would let a caller serve/mask the raw permanent url).
    const storedUrl = 'https://some-other-cdn.example.net/unexpected-format/documents/file1.pdf';

    const result = await resolver.resolve(storedUrl);

    expect(result).toBe(PRIVATE_FILE_UNAVAILABLE);
    expect(mockFileGrpcClient.getPresignedUrlInternal).not.toHaveBeenCalled();
  });

  it('returns null when the storage key is unparseable and the url does not look private', async () => {
    const storedUrl = 'https://some-other-cdn.example.net/unexpected-format/gallery/photo.jpg';

    const result = await resolver.resolve(storedUrl);

    expect(result).toBeNull();
    expect(mockFileGrpcClient.getPresignedUrlInternal).not.toHaveBeenCalled();
  });
});
