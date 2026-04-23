"""MinIO storage implementation."""
import io
import re
import asyncio
from typing import BinaryIO, Any
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

    async def _run_in_thread(self, func, *args, **kwargs) -> Any:
        """Run blocking function in a separate thread."""
        loop = asyncio.get_running_loop()
        return await loop.run_in_executor(None, lambda: func(*args, **kwargs))
    
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
            # Note: bucket_exists is blocking, moving to thread
            bucket_exists = await self._run_in_thread(self.client.bucket_exists, bucket_name=bucket)
            if not bucket_exists:
                await self._run_in_thread(self.client.make_bucket, bucket_name=bucket)
            
            # Prepare metadata
            metadata = {}
            if is_public:
                metadata["x-amz-acl"] = "public-read"

            # Upload file
            # Note: put_object is blocking, moving to thread
            await self._run_in_thread(
                self.client.put_object,
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
        """Get presigned URL for direct download.

        Returns the URL as signed by the SDK. We do NOT rewrite the host to
        a public CDN here — the AWS4 signature is bound to the signed host,
        and substituting hosts breaks signature validation (the server rejects
        the request with SignatureDoesNotMatch). Callers that need a CDN URL
        for unsigned public reads should call `get_public_url` instead.
        """
        try:
            from datetime import timedelta

            return self.client.presigned_get_object(
                bucket_name=bucket,
                object_name=object_name,
                expires=timedelta(seconds=expiry_seconds),
            )

        except S3Error as e:
            raise StorageException(f"MinIO presigned URL failed: {e}")
        except Exception as e:
            raise StorageException(f"Presigned URL error: {e}")

    async def get_presigned_upload_url(
        self,
        bucket: str,
        object_name: str,
        expiry_seconds: int = 3600
    ) -> str:
        """Get presigned URL for direct upload.

        Notes:
        - We do NOT call `bucket_exists` + `make_bucket`. On managed S3s (DO
          Spaces, R2) the API key typically lacks `HeadBucket` / `CreateBucket`
          on the Space, so that check fails with AccessDenied even though the
          bucket is valid. Buckets are provisioned out of band.
        - We do NOT rewrite the URL to the public endpoint here. The AWS4
          signature is bound to the host it was signed for — changing the host
          breaks the signature, causing DO Spaces to reject the PUT with
          SignatureDoesNotMatch. The public endpoint rewrite only applies to
          unsigned URLs (see `get_public_url`).
        """
        try:
            from datetime import timedelta

            return self.client.presigned_put_object(
                bucket_name=bucket,
                object_name=object_name,
                expires=timedelta(seconds=expiry_seconds),
            )

        except S3Error as e:
            raise StorageException(f"MinIO presigned PUT failed: {e}")
        except Exception as e:
            raise StorageException(f"Presigned PUT error: {e}")
    
    async def exists(self, bucket: str, object_name: str) -> bool:
        """Check if object exists in MinIO."""
        try:
            self.client.stat_object(bucket, object_name)
            return True
        except S3Error:
            return False
        except Exception:
            return False

    def get_public_url(self, bucket: str, object_name: str) -> str:
        """Construct a permanent public URL using the configured public endpoint.

        Builds the URL directly from the known path — no storage API call, no
        signed URL, no DNS dependency. The public endpoint (CDN or bucket
        subdomain) already encodes the bucket, so only the object path is
        appended.
        """
        public_protocol = "https" if self.public_secure else "http"
        base = f"{public_protocol}://{self.public_endpoint}".rstrip('/')
        path = object_name.lstrip('/')
        return f"{base}/{path}"

