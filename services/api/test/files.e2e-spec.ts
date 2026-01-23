import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import * as request from 'supertest';
import { GrpcFilesTestController } from '../src/modules/files/presentation/grpc-files-test.controller';
import { FileGrpcClient } from '../src/modules/files/infrastructure/clients/file-grpc-client.service';
import { JwtAuthGuard } from '../src/modules/auth/infrastructure/guards/jwt-auth.guard';
import { APP_GUARD } from '@nestjs/core';

import { VersioningType } from '@nestjs/common';

describe('FilesController (e2e)', () => {
  let app: INestApplication;
  const mockFileGrpcClient = {
    uploadFile: jest.fn().mockResolvedValue({
      id: 'test-file-id',
      url: 'http://test-url.com/file.pdf',
      storage_path: 'files/test.pdf',
      original_filename: 'test.pdf',
      content_type: 'application/pdf',
      size: 1024,
      bucket: 'documents',
    }),
    getFile: jest.fn().mockResolvedValue({
      id: 'test-file-id',
      original_filename: 'test.pdf',
      content_type: 'application/pdf',
      size: 1024,
      url: 'http://test-url.com/file.pdf',
      bucket: 'documents',
      storage_path: 'files/test.pdf',
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    }),
    downloadFile: jest.fn().mockResolvedValue(Buffer.from('test-file-content')),
  };

  beforeEach(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      controllers: [GrpcFilesTestController],
      providers: [
        {
          provide: FileGrpcClient,
          useValue: mockFileGrpcClient,
        },
      ],
    })
      .overrideGuard(JwtAuthGuard)
      .useValue({ canActivate: () => true })
      .compile();

    app = moduleFixture.createNestApplication();
    app.enableVersioning({
      type: VersioningType.URI,
      defaultVersion: '1',
    });
    await app.init();
  });

  afterAll(async () => {
    await app.close();
  });

  describe('/v1/grpc-files/upload (POST)', () => {
    it('should upload a file successfully via gRPC', () => {
      return request(app.getHttpServer())
        .post('/v1/grpc-files/upload')
        .field('user_id', 'user-123')
        .field('brand_id', 'brand-123')
        .attach('file', Buffer.from('test-content'), 'test.pdf')
        .expect(201)
        .expect((res) => {
          expect(res.body).toEqual({
            id: 'test-file-id',
            url: 'http://test-url.com/file.pdf',
            storage_path: 'files/test.pdf',
            original_filename: 'test.pdf',
            content_type: 'application/pdf',
            size: 1024,
            bucket: 'documents',
          });
          expect(mockFileGrpcClient.uploadFile).toHaveBeenCalled();
        });
    });

    it('should fail if no file provided', () => {
      return request(app.getHttpServer())
        .post('/v1/grpc-files/upload')
        .field('user_id', 'user-123')
        .field('brand_id', 'brand-123')
        .expect(400);
    });
  });

  describe('/v1/grpc-files/:id (GET)', () => {
    it('should retrieve file metadata', () => {
      return request(app.getHttpServer())
        .get('/v1/grpc-files/test-file-id?user_id=user-123&brand_id=brand-123')
        .expect(200)
        .expect((res) => {
          expect(res.body.id).toBe('test-file-id');
          expect(mockFileGrpcClient.getFile).toHaveBeenCalledWith(
            'test-file-id',
            'user-123',
            'brand-123',
          );
        });
    });
  });

  describe('/v1/grpc-files/:id/download (GET)', () => {
    it('should download file content', () => {
      return request(app.getHttpServer())
        .get(
          '/v1/grpc-files/test-file-id/download?user_id=user-123&brand_id=brand-123',
        )
        .expect(200)
        .expect('Content-Type', 'application/pdf')
        .expect('Content-Disposition', 'attachment; filename="test.pdf"')
        .expect((res) => {
          expect(res.body).toEqual(Buffer.from('test-file-content'));
          expect(mockFileGrpcClient.downloadFile).toHaveBeenCalledWith(
            'test-file-id',
            'user-123',
            'brand-123',
          );
        });
    });
  });
});
