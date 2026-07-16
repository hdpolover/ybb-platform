import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, VersioningType } from '@nestjs/common';
import * as request from 'supertest';
import { FilesController } from '../src/modules/files/presentation/files.controller';
import { StorageService } from '../src/modules/files/application/storage.service';
import { FileGrpcClient } from '../src/modules/files/infrastructure/clients/file-grpc-client.service';
import { FileServiceClient } from '../src/modules/files/infrastructure/clients/file-service.client';
import { MetricsService } from '../src/shared/infrastructure/monitoring/metrics.service';
import { ConfigService } from '@nestjs/config';
import { JwtAuthGuard } from '../src/modules/auth/infrastructure/guards/jwt-auth.guard';

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
  };

  const mockFileServiceClient = {
    uploadFile: jest.fn(),
    getFile: jest.fn(),
  };

  const mockMetricsService = {
    fileUploadsTotal: {
      inc: jest.fn(),
    },
  };

  const mockConfigService = {
    get: jest.fn((key) => {
      if (key === 'STORAGE_PUBLIC_URL') return 'http://cdn.ybbhub.com';
      return null;
    }),
  };

  beforeEach(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      controllers: [FilesController],
      providers: [
        StorageService, // Real service
        { provide: FileGrpcClient, useValue: mockFileGrpcClient },
        { provide: FileServiceClient, useValue: mockFileServiceClient },
        { provide: MetricsService, useValue: mockMetricsService },
        { provide: ConfigService, useValue: mockConfigService },
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

  describe('/v1/files/upload (POST)', () => {
    it('should upload a file successfully via gRPC chain', () => {
      return request(app.getHttpServer())
        .post('/v1/files/upload')
        .field('user_id', 'user-123')
        .field('brand_id', 'brand-123')
        .attach('file', Buffer.from('test-content'), 'test.pdf')
        .expect(201)
        .expect((res) => {
          // Response structure matches FilesController.uploadFile return
          expect(res.body.success).toBe(true);
          expect(res.body.data.url).toBe('http://test-url.com/file.pdf');
          expect(mockFileGrpcClient.uploadFile).toHaveBeenCalled();
        });
    });
  });

  describe('/v1/files/:id (GET)', () => {
    it('should retrieve file metadata via gRPC', () => {
      return request(app.getHttpServer())
        .get('/v1/files/test-file-id?user_id=user-123&brand_id=brand-123')
        .expect(200)
        .expect((res) => {
          expect(res.body.success).toBe(true);
          expect(res.body.data.id).toBe('test-file-id');
          expect(mockFileGrpcClient.getFile).toHaveBeenCalled();
        });
    });
  });
});
