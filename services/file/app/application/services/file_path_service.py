import os
from typing import Optional

class FilePathService:
    @staticmethod
    def get_storage_path(
        brand_id: str,
        user_id: str,
        bucket: str,
        filename: str,
        program_id: Optional[str] = None,
        participant_id: Optional[str] = None
    ) -> tuple[str, str, dict]:
        """
        Generate the storage path (object key), real bucket name, and metadata.
        
        Returns:
            tuple[str, str, dict]: (storage_path, real_bucket, file_metadata)
        """
        file_metadata = {}
        
        # Resolve bucket and storage path
        # Strategy: Single Physical Bucket (e.g., ybb-assets-dev) -> Virtual Folders
        real_bucket = os.getenv("MINIO_BUCKET", "ybb-assets-dev")
        env = os.getenv("PYTHON_ENV", "development")
        prefix_map = {
            "development": "dev",
            "staging": "staging",
            "production": "prod"
        }
        env_prefix = prefix_map.get(env, "dev")
        
        # Path Construction Logic
        # Strategy: Namespaced Hierarchy
        # Root: /{env}/{brand}/
        
        root_path = f"{env_prefix}/{brand_id}"
        
        # Determine unique file ID if filename not provided or needs processing
        # Assuming filename is already processed (e.g. file_id.ext)
        storage_filename = filename

        # Virtual bucket name defaults to "uploads" if not provided
        virtual_bucket = bucket or "uploads"
        
        # Context 1: Program Participant
        # Path: .../programs/{program_id}/participants/{participant_id}/{category}/{filename}
        if program_id and participant_id:
            namespace = "programs"
            storage_path = f"{root_path}/{namespace}/{program_id}/participants/{participant_id}/{virtual_bucket}/{storage_filename}"
            
            # Enrich metadata
            file_metadata.update({
                "namespace": namespace,
                "program_id": program_id,
                "participant_id": participant_id,
                "context": "program_participation"
            })

        # Context 2: Program Global (e.g. Gallery, Banners)
        # Path: .../programs/{program_id}/{category}/{filename}
        elif program_id:
            namespace = "programs"
            storage_path = f"{root_path}/{namespace}/{program_id}/{virtual_bucket}/{storage_filename}"
            
            # Enrich metadata
            file_metadata.update({
                "namespace": namespace,
                "program_id": program_id,
                "context": "program_global"
            })
        
        # Context 3: Global User
        # Path: .../users/{user_id}/{category}/{filename}
        else:
            namespace = "users"
            storage_path = f"{root_path}/{namespace}/{user_id}/{virtual_bucket}/{storage_filename}"
            
            # Enrich metadata
            file_metadata.update({
                "namespace": namespace,
                "context": "user_global"
            })
            
        return storage_path, real_bucket, file_metadata
