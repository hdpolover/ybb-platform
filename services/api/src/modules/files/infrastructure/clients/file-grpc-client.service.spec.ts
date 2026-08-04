import { BadRequestException, InternalServerErrorException } from '@nestjs/common';
import { status as GrpcStatus } from '@grpc/grpc-js';
import { throwError } from 'rxjs';
import { FileGrpcClient } from './file-grpc-client.service';

describe('FileGrpcClient.uploadFile error mapping', () => {
  function buildClient(uploadFileImpl: (...args: unknown[]) => unknown) {
    const fakeGrpcClient = { getService: () => ({ UploadFile: uploadFileImpl }) };
    const client = new FileGrpcClient(fakeGrpcClient as any);
    client.onModuleInit();
    return client;
  }

  function observableThatErrors(err: unknown) {
    return throwError(() => err);
  }

  it('surfaces a domain validation error (file too large) as a 400 with the real message, not a generic 500', async () => {
    // Mirrors what the Python file service actually sends today: the domain
    // exception message wrapped in a grpc.StatusCode.INTERNAL abort (see
    // grpc_main.py UploadFile's outer except-all clause).
    const grpcError = {
      code: GrpcStatus.INTERNAL,
      details: 'File size 15728640 bytes exceeds limit of 10485760 bytes',
      message: '13 INTERNAL: File size 15728640 bytes exceeds limit of 10485760 bytes',
    };
    const client = buildClient(() => observableThatErrors(grpcError));

    const call = client.uploadFile(Buffer.from('x'), { filename: 'a.jpg' } as any);
    await expect(call).rejects.toBeInstanceOf(BadRequestException);
    await expect(call).rejects.toMatchObject({
      message: 'File size 15728640 bytes exceeds limit of 10485760 bytes',
    });
  });

  it('surfaces a domain validation error (unsupported type) as a 400 with the real message', async () => {
    const grpcError = {
      code: GrpcStatus.INTERNAL,
      details: 'File type image/heic not allowed. Allowed types: image/jpeg, image/png',
      message: '13 INTERNAL: File type image/heic not allowed. Allowed types: image/jpeg, image/png',
    };
    const client = buildClient(() => observableThatErrors(grpcError));

    await expect(client.uploadFile(Buffer.from('x'), { filename: 'a.heic' } as any)).rejects.toBeInstanceOf(
      BadRequestException,
    );
  });

  it('maps an explicit INVALID_ARGUMENT gRPC status to a 400 regardless of message shape', async () => {
    const grpcError = { code: GrpcStatus.INVALID_ARGUMENT, details: 'bad request', message: 'bad request' };
    const client = buildClient(() => observableThatErrors(grpcError));

    await expect(client.uploadFile(Buffer.from('x'), { filename: 'a.jpg' } as any)).rejects.toBeInstanceOf(
      BadRequestException,
    );
  });

  it('still surfaces genuine internal failures as a 500, not a 400', async () => {
    const grpcError = { code: GrpcStatus.UNKNOWN, details: 'connection reset', message: 'connection reset' };
    const client = buildClient(() => observableThatErrors(grpcError));

    await expect(client.uploadFile(Buffer.from('x'), { filename: 'a.jpg' } as any)).rejects.toBeInstanceOf(
      InternalServerErrorException,
    );
  });
});
