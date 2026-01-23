"""MinIO storage implementation."""
import io
import re
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
        secure: bool = False,
        public_endpoint: str = None,
        public_secure: bool = None,
        region: str = None
    ):
        """
        Initialize MinIO client.
        
        Args:
            endpoint: MinIO server endpoint for internal operations (e.g., 'minio:9000' or 'sgp1.digitaloceanspaces.com')
            access_key: Access key
            secret_key: Secret key
            secure: Use HTTPS (default: False for local)
            public_endpoint: Public endpoint for presigned URLs (e.g., 'localhost:9000' or 'files.example.com')
            public_secure: Use HTTPS for public URLs (defaults to secure if not set)
            region: Region name (optional, important for S3/DO Spaces)
        """
        self.endpoint = endpoint
        self.secure = secure
        
        # Internal client for upload/download operations
        self.client = Minio(
            endpoint=endpoint,
            access_key=access_key,
            secret_key=secret_key,
            secure=secure,
            region=region
        )
        
        # Store public endpoint config for URL rewriting
        self.public_endpoint = public_endpoint or endpoint
        self.public_secure = public_secure if public_secure is not None else secure
    
    async def upload(
        self, 
        bucket: str, 
        object_name: str, 
        file_data: BinaryIO, 
        content_type: str,
        size: int,
        is_public: bool = False
    ) -> str:
        """Upload file to MinIO."""
        try:
            # Ensure bucket exists
            if not self.client.bucket_exists(bucket_name=bucket):
                self.client.make_bucket(bucket_name=bucket)
            
            # Prepare metadata
            metadata = {}
            if is_public:
                metadata["x-amz-acl"] = "public-read"

            # Upload file
            self.client.put_object(
                bucket_name=bucket,
                object_name=object_name,
                data=file_data,
                length=size,
                content_type=content_type,
                metadata=metadata
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
        """
        Get presigned URL for direct download.
        
        Generates URL using internal client, then rewrites the endpoint
        to the public endpoint for browser accessibility.
        """
        try:
            from datetime import timedelta
            
            # Generate presigned URL using internal client
            url = self.client.presigned_get_object(
                bucket_name=bucket,
                object_name=object_name,
                expires=timedelta(seconds=expiry_seconds)
            )
            
            # Rewrite URL to use public endpoint if different
            if self.public_endpoint and self.public_endpoint != self.endpoint:
                # Determine the protocols
                internal_protocol = "https" if self.secure else "http"
                public_protocol = "https" if self.public_secure else "http"
                
                # Replace the internal endpoint with public endpoint
                internal_base = f"{internal_protocol}://{self.endpoint}"
                public_base = f"{public_protocol}://{self.public_endpoint}"
                
                # Try to replace endpoint + bucket first (e.g. https://do.com/bucket -> https://cdn.com)
                # This handles the case where the custom domain maps directly to the bucket
                internal_base_with_bucket = f"{internal_base}/{bucket}"
                if internal_base_with_bucket in url:
                    url = url.replace(internal_base_with_bucket, public_base, 1)
                else:
                    url = url.replace(internal_base, public_base, 1)
            
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
