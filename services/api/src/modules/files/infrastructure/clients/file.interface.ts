import { Observable } from 'rxjs';

export interface FileMetadata {
  filename: string;
  content_type: string;
  user_id: string;
  brand_id: string;
  bucket: string;
  program_id?: string;
  participant_id?: string;
  size?: number;
}

export interface UploadFileRequest {
  metadata?: FileMetadata;
  chunk_data?: Buffer;
}

export interface UploadFileResponse {
  id: string;
  url: string;
  storage_path: string;
  original_filename: string;
  content_type: string;
  size: number;
  bucket: string;
}

export interface DownloadFileRequest {
  file_id: string;
  user_id: string;
  brand_id: string;
}

export interface DownloadFileResponse {
  chunk_data: Buffer;
}

export interface GetFileRequest {
  file_id: string;
  user_id: string;
  brand_id: string;
}

export interface FileResponse {
  id: string;
  original_filename: string;
  content_type: string;
  size: number;
  url: string;
  bucket: string;
  storage_path: string;
  created_at: string;
  updated_at: string;
}

export interface GenerateCertificateRequest {
  participant_name: string;
  program_name: string;
  issued_at: string;
  template_type: string;
  metadata?: Record<string, string>;
}

export interface GenerateReceiptRequest {
  receipt_number: string;
  transaction_id: string;
  amount: number;
  currency: string;
  payer_name: string;
  date: string;
  payment_method: string;
  status: string;
  additional_data?: Record<string, string>;
}

export interface GenerateDocumentResponse {
  file_data: Buffer; // or string (base64) depending on how grpc-js handles it, typically Uint8Array/Buffer
  filename: string;
  content_type: string;
}

export interface GetPresignedUploadUrlRequest {
  filename: string;
  content_type: string;
  user_id: string;
  brand_id: string;
  bucket: string;
  program_id?: string;
  participant_id?: string;
  size?: number;
}

export interface GetPresignedUploadUrlResponse {
  upload_url: string;
  file_id: string;
  storage_path: string;
  bucket: string;
}

export interface ConfirmUploadRequest {
  storage_path: string;
  bucket: string;
  size?: number;
}

export interface ConfirmUploadResponse {
  success: boolean;
  file_id: string;
  status: string;
}

export interface FileService {
  UploadFile(request: Observable<UploadFileRequest>): Observable<UploadFileResponse>;
  DownloadFile(request: DownloadFileRequest): Observable<DownloadFileResponse>;
  GetFile(request: GetFileRequest): Observable<FileResponse>;
  GenerateCertificate(request: GenerateCertificateRequest): Observable<GenerateDocumentResponse>;
  GenerateReceipt(request: GenerateReceiptRequest): Observable<GenerateDocumentResponse>;
  GetPresignedUploadUrl(request: GetPresignedUploadUrlRequest): Observable<GetPresignedUploadUrlResponse>;
  ConfirmUpload(request: ConfirmUploadRequest): Observable<ConfirmUploadResponse>;
}
