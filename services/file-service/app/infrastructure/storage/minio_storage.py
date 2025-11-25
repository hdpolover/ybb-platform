"""MinIO storage implementation."""
import io
from typing import BinaryIO
from minio import Minio
from minio.error import S3Error
from app.domain.services.storage_service import IStorageService
from app.domain.exceptions.file_exceptions import StorageException


class MinIOStorage(IStorageService):
    """MinIO implementation of storage service."""
    
    def __init__(
        self, 
        endpoint: str, 
        access_key: str, 
        secret_key: str,
        secure: bool = False
    ):
        """
        Initialize MinIO client.
        
        Args:
            endpoint: MinIO server endpoint (e.g., 'localhost:9000')
            access_key: Access key
            secret_key: Secret key
            secure: Use HTTPS (default: False for local)
        """
        self.client = Minio(
            endpoint=endpoint,
            access_key=access_key,
            secret_key=secret_key,
            secure=secure
        )
    
    async def upload(
        self, 
        bucket: str, 
        object_name: str, 
        file_data: BinaryIO, 
        content_type: str,
        size: int
    ) -> str:
        """Upload file to MinIO."""
        try:
            # Ensure bucket exists
            if not self.client.bucket_exists(bucket_name=bucket):
                self.client.make_bucket(bucket_name=bucket)
            
            # Upload file
            self.client.put_object(
                bucket_name=bucket,
                object_name=object_name,
                data=file_data,
                length=size,
                content_type=content_type
            )
            
            return f"{bucket}/{object_name}"
            
        except S3Error as e:
            raise StorageException(f"MinIO upload failed: {e}")
        except Exception as e:
            raise StorageException(f"Upload error: {e}")
    
    async def download(self, bucket: str, object_name: str) -> bytes:
        """Download file from MinIO."""
        try:
            response = self.client.get_object(bucket, object_name)
            data = response.read()
            response.close()
            response.release_conn()
            return data
            
        except S3Error as e:
            raise StorageException(f"MinIO download failed: {e}")
        except Exception as e:
            raise StorageException(f"Download error: {e}")
    
    async def delete(self, bucket: str, object_name: str) -> bool:
        """Delete file from MinIO."""
        try:
            self.client.remove_object(bucket, object_name)
            return True
            
        except S3Error as e:
            raise StorageException(f"MinIO delete failed: {e}")
        except Exception as e:
            raise StorageException(f"Delete error: {e}")
    
    async def get_presigned_url(
        self, 
        bucket: str, 
        object_name: str, 
        expiry_seconds: int = 3600
    ) -> str:
        """Get presigned URL for direct download."""
        try:
            from datetime import timedelta
            url = self.client.presigned_get_object(
                bucket_name=bucket,
                object_name=object_name,
                expires=timedelta(seconds=expiry_seconds)
            )
            return url
            
        except S3Error as e:
            raise StorageException(f"MinIO presigned URL failed: {e}")
        except Exception as e:
            raise StorageException(f"Presigned URL error: {e}")
    
    async def exists(self, bucket: str, object_name: str) -> bool:
        """Check if object exists in MinIO."""
        try:
            self.client.stat_object(bucket, object_name)
            return True
        except S3Error:
            return False
        except Exception:
            return False
