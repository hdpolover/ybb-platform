import grpc
import logging
import asyncio
from concurrent import futures
from io import BytesIO
import os
import sys

# Fix import path for generated protos
sys.path.insert(0, os.path.join(os.path.dirname(__file__), 'protos'))

# Import generated classes
from app.protos import file_service_pb2
from app.protos import file_service_pb2_grpc

# Import Logic
from app.presentation.dependencies.container import get_file_repository, get_storage_service
from app.application.commands.handlers.upload_file_handler import UploadFileHandler
from app.application.queries.handlers.get_file_handler import GetFileHandler
from app.application.commands.upload_file_command import UploadFileCommand
from app.application.queries.get_file_query import GetFileQuery
from app.infrastructure.persistence.postgres.database import connect_db, disconnect_db
from app.infrastructure.processors.certificate_generator import CertificateGeneratorService
from app.infrastructure.processors.pdf_generator import PDFGeneratorService
from app.application.services.file_path_service import FilePathService
from app.domain.entities.file import File
import uuid
from datetime import datetime

class FileService(file_service_pb2_grpc.FileServiceServicer):
    def __init__(self):
        self.repo = get_file_repository()
        self.storage = get_storage_service()
        self.upload_handler = UploadFileHandler(self.storage, self.repo)
        self.get_handler = GetFileHandler(file_repository=self.repo, storage_service=self.storage)
        
        # Initialize processors
        self.cert_generator = CertificateGeneratorService(
            signing_key=os.getenv("CERT_SIGNING_KEY", "dev-secret-key"),
            verification_url=os.getenv("CERT_VERIFY_URL", "http://localhost:3000")
        )
        self.pdf_generator = PDFGeneratorService()

    async def GenerateCertificate(self, request, context):
        try:
            # Prepare data
            participant_data = {
                "name": request.participant_name,
                "metadata": dict(request.metadata)
            }
            program_data = {
                "name": request.program_name,
                "completion_date": request.issued_at,
                "metadata": dict(request.metadata)
            }
            
            # Use metadata to get template path if provided (e.g. customized background)
            template_path = request.metadata.get("template_path")

            # Generate (Generic method handles types: "completion", "participation", "award", "speaker")
            output = await self.cert_generator.generate_certificate(
                participant_data, 
                program_data,
                template_type=request.template_type,
                template_path=template_path
            )
            
            return file_service_pb2.GenerateDocumentResponse(
                file_data=output.getvalue(),
                filename=f"certificate_{uuid.uuid4()}.png", # Cert generator returns PNG
                content_type="image/png"
            )
        except Exception as e:
            logging.error(f"Certificate generation failed: {e}")
            await context.abort(grpc.StatusCode.INTERNAL, str(e))

    async def GenerateReceipt(self, request, context):
        try:
            # Map request to dictionary
            transaction_data = {
                "receipt_number": request.receipt_number,
                "transaction_id": request.transaction_id,
                "amount": request.amount,
                "currency": request.currency,
                "payer_name": request.payer_name,
                "payer_email": request.additional_data.get("email", ""),
                "payer_phone": request.additional_data.get("phone", ""),
                "date": request.date,
                "payment_method": request.payment_method,
                "status": request.status,
                "description": request.additional_data.get("description", "Program Fee")
            }
            
            output = await self.pdf_generator.generate_receipt(transaction_data)
            
            return file_service_pb2.GenerateDocumentResponse(
                file_data=output.getvalue(),
                filename=f"receipt_{request.receipt_number}.pdf",
                content_type="application/pdf"
            )
        except Exception as e:
            logging.error(f"Receipt generation failed: {e}")
            await context.abort(grpc.StatusCode.INTERNAL, str(e))

    async def GetPresignedUploadUrl(self, request, context):
        try:
            file_id = str(uuid.uuid4())
            extension = request.filename.split('.')[-1] if '.' in request.filename else ''
            storage_filename = f"{file_id}.{extension}" if extension else file_id

            # Use shared service to generate path
            storage_path, real_bucket, path_metadata = FilePathService.get_storage_path(
                brand_id=request.brand_id,
                user_id=request.user_id,
                bucket=request.bucket,
                filename=storage_filename,
                program_id=request.program_id,
                participant_id=request.participant_id
            )

            url = await self.storage.get_presigned_upload_url(
                bucket=real_bucket,
                object_name=storage_path,
                expiry_seconds=3600
            )

            # Define file entity with PENDING status
            # Since user cannot migrate DB now, we store status in metadata
            file_metadata = {
                "status": "PENDING",
                "program_id": request.program_id if request.program_id else None,
                "participant_id": request.participant_id if request.participant_id else None
            }
            path_metadata.update(file_metadata)

            # Determine file type
            file_type = 'other'
            if request.content_type.startswith('image/'): file_type = 'image'
            elif request.content_type == 'application/pdf': file_type = 'document'
            
            file_entity = File(
                id=file_id,
                filename=storage_filename,
                original_filename=request.filename,
                file_type=file_type,
                mime_type=request.content_type,
                file_size=request.size,
                storage_path=storage_path,
                bucket=real_bucket,
                user_id=request.user_id,
                brand_id=request.brand_id,
                uploaded_at=datetime.utcnow(),
                metadata=path_metadata
            )

            # Save PENDING file
            await self.repo.save(file_entity)
            logging.info(f"Created PENDING file record: {file_id} at {storage_path}")

            return file_service_pb2.GetPresignedUploadUrlResponse(
                upload_url=url,
                file_id=file_id,
                storage_path=storage_path,
                bucket=real_bucket
            )
        except Exception as e:
            logging.error(f"Presigned URL generation failed: {e}")
            await context.abort(grpc.StatusCode.INTERNAL, str(e))

    async def ConfirmUpload(self, request, context):
        try:
            # S3/MinIO Event only gives storage_path (key) in most cases
            file = await self.repo.find_by_storage_path(request.storage_path)
            
            if not file:
                logging.warning(f"ConfirmUpload: File not found for path {request.storage_path}")
                # We return success=False but dont error out, maybe retrying?
                return file_service_pb2.ConfirmUploadResponse(success=False, status="NOT_FOUND")

            if not file.metadata:
                file.metadata = {}
            
            # Update status
            current_status = file.metadata.get("status")
            if current_status == "ACTIVE":
                 logging.info(f"ConfirmUpload: File {file.id} already ACTIVE.")
                 return file_service_pb2.ConfirmUploadResponse(
                     success=True, 
                     file_id=file.id, 
                     status="ACTIVE"
                 )

            file.metadata["status"] = "ACTIVE"
            
            # Update size if provided by event (S3 event contains size)
            if request.HasField("size") and request.size > 0:
                file.file_size = request.size
            
            await self.repo.save(file)
            logging.info(f"ConfirmUpload: File {file.id} marked ACTIVE.")
            
            return file_service_pb2.ConfirmUploadResponse(
                success=True, 
                file_id=file.id, 
                status="ACTIVE"
            )
        except Exception as e:
            logging.error(f"ConfirmUpload failed: {e}")
            await context.abort(grpc.StatusCode.INTERNAL, str(e))

    async def UploadFile(self, request_iterator, context):
        metadata = None
        read_fd, write_fd = os.pipe()
        
        # Get first request for metadata
        try:
            first_request = await request_iterator.__anext__()
            if first_request.HasField('metadata'):
                metadata = first_request.metadata
            else:
                os.close(read_fd)
                os.close(write_fd)
                await context.abort(grpc.StatusCode.INVALID_ARGUMENT, "First message must be metadata")
        except StopAsyncIteration:
            os.close(read_fd)
            os.close(write_fd)
            await context.abort(grpc.StatusCode.INVALID_ARGUMENT, "Empty request")

        file_size = metadata.size if metadata.size > 0 else -1
        
        # Create reader for MinIO (it will run in a separate thread)
        file_reader = os.fdopen(read_fd, 'rb')

        command = UploadFileCommand(
            file_data=file_reader,
            filename=metadata.filename,
            content_type=metadata.content_type,
            size=metadata.size,
            user_id=metadata.user_id,
            brand_id=metadata.brand_id,
            bucket=metadata.bucket,
            program_id=metadata.program_id if metadata.program_id else None,
            participant_id=metadata.participant_id if metadata.participant_id else None,
            metadata={} 
        )

        try:
            # Start Upload Task (Consumer) - Logic runs in thread because of MinIOStorage update
            upload_task = asyncio.create_task(self.upload_handler.execute(command))
            
            # Start Streaming (Producer)
            with os.fdopen(write_fd, 'wb') as writer:
                async for request in request_iterator:
                    if request.HasField('chunk_data'):
                        writer.write(request.chunk_data)
            
            # Start awaiting result
            result = await upload_task
            
            # Cleanup
            file_reader.close()

            return file_service_pb2.UploadFileResponse(
                id=result.id,
                url=result.download_url or "",
                storage_path=result.storage_path,
                original_filename=result.original_filename,
                content_type=result.content_type,
                size=result.size,
                bucket=result.bucket
            )
        except Exception as e:
            logging.error(f"Streaming upload failed: {e}")
            if not file_reader.closed:
                file_reader.close()
            # Ensure write_fd is closed if error happened before with block exit?
            # os.fdopen(write_fd) context manager handles it.
            await context.abort(grpc.StatusCode.INTERNAL, str(e))

    async def GetFile(self, request, context):
        query = GetFileQuery(
            file_id=request.file_id,
            user_id=request.user_id,
            brand_id=request.brand_id,
            generate_download_url=True
        )
        try:
            result = await self.get_handler.execute(query)
            return file_service_pb2.FileResponse(
                id=result.id,
                original_filename=result.original_filename,
                content_type=result.content_type,
                size=result.size,
                url=result.download_url or "",
                bucket=result.bucket,
                storage_path=result.storage_path,
                created_at=str(result.uploaded_at),
                updated_at=str(result.updated_at) if result.updated_at else str(result.uploaded_at)
            )
        except Exception as e:
            await context.abort(grpc.StatusCode.NOT_FOUND, str(e))

    async def DownloadFile(self, request, context):
        # 1. Get metadata to check permissions and get path
        query = GetFileQuery(
            file_id=request.file_id,
            user_id=request.user_id,
            brand_id=request.brand_id,
            generate_download_url=False
        )
        
        try:
            file_dto = await self.get_handler.execute(query)
            
            # 2. Download content (this loads into memory currently in storage_service.download)
            content = await self.storage.download(
                bucket=file_dto.bucket,
                object_name=file_dto.storage_path
            )
            
            # 3. Stream back
            chunk_size = 64 * 1024
            for i in range(0, len(content), chunk_size):
                yield file_service_pb2.DownloadFileResponse(
                    chunk_data=content[i:i + chunk_size]
                )
                
        except Exception as e:
             await context.abort(grpc.StatusCode.NOT_FOUND, str(e))


async def serve():
    await connect_db()
    server = grpc.aio.server(futures.ThreadPoolExecutor(max_workers=10))
    file_service_pb2_grpc.add_FileServiceServicer_to_server(FileService(), server)
    port = os.getenv("GRPC_PORT", "50052")
    server.add_insecure_port(f'[::]:{port}')
    logging.info(f"Starting gRPC server on port {port}...")
    await server.start()
    try:
        await server.wait_for_termination()
    finally:
        await disconnect_db()

if __name__ == '__main__':
    logging.basicConfig(level=logging.INFO)
    asyncio.run(serve())
