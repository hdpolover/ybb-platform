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

export interface FileService {
  UploadFile(request: Observable<UploadFileRequest>): Observable<UploadFileResponse>;
  DownloadFile(request: DownloadFileRequest): Observable<DownloadFileResponse>;
  GetFile(request: GetFileRequest): Observable<FileResponse>;
}
