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

class FileService(file_service_pb2_grpc.FileServiceServicer):
    def __init__(self):
        self.repo = get_file_repository()
        self.storage = get_storage_service()
        self.upload_handler = UploadFileHandler(self.storage, self.repo)
        self.get_handler = GetFileHandler(file_repository=self.repo, storage_service=self.storage)

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
                updated_at=str(result.uploaded_at) # TODO: fix if specific updated exists
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
