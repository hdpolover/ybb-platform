"""Image upload API routes for avatars, program images, etc."""
from fastapi import APIRouter, UploadFile, File, Form, Depends, HTTPException, status, Query
from fastapi.responses import StreamingResponse
from typing import Annotated, Optional
from io import BytesIO
from PIL import Image
import os
import uuid

from app.domain.exceptions.file_exceptions import (
    FileDomainException,
    InvalidFileTypeException,
    FileSizeLimitException
)
from app.presentation.dependencies.container import get_storage_service
from app.presentation.dependencies.internal_auth import require_internal_service_key
from app.utils.concurrency import run_in_threadpool


router = APIRouter(
    prefix="/images",
    tags=["Images"],
    dependencies=[Depends(require_internal_service_key)],
)

# Environment prefix for storage paths (matches FilePathService convention)
_ENV_PREFIX_MAP = {"development": "dev", "staging": "staging", "production": "prod"}
_ENV_PREFIX = _ENV_PREFIX_MAP.get(os.getenv("PYTHON_ENV", "development"), "dev")

# Image configuration
ALLOWED_IMAGE_TYPES = ['image/jpeg', 'image/png', 'image/gif', 'image/webp']
MAX_AVATAR_SIZE = 2 * 1024 * 1024  # 2MB
MAX_IMAGE_SIZE = 5 * 1024 * 1024  # 5MB
MAX_BANNER_SIZE = 10 * 1024 * 1024  # 10MB

# Thumbnail sizes
THUMBNAIL_SIZES = {
    'small': (150, 150),
    'medium': (300, 300),
    'large': (600, 600),
}

# Avatar dimensions
AVATAR_SIZE = (400, 400)

# Banner dimensions
BANNER_SIZES = {
    'program': (1200, 400),
    'brand': (1920, 400),
}


def validate_image(file: UploadFile, max_size: int) -> bytes:
    """Validate image file type and size."""
    if file.content_type not in ALLOWED_IMAGE_TYPES:
        raise InvalidFileTypeException(file.content_type, ALLOWED_IMAGE_TYPES)
    
    contents = file.file.read()
    if len(contents) > max_size:
        raise FileSizeLimitException(len(contents), max_size)
    
    file.file.seek(0)
    return contents


def process_image(
    image_data: bytes,
    target_size: tuple[int, int],
    output_format: str = 'JPEG',
    quality: int = 85,
    crop_to_fit: bool = False
) -> BytesIO:
    """
    Process image: resize, crop, and optimize.
    
    Args:
        image_data: Raw image bytes
        target_size: (width, height) tuple
        output_format: Output format (JPEG, PNG, WEBP)
        quality: Output quality (1-100)
        crop_to_fit: If True, crop to exact dimensions; if False, fit within dimensions
    """
    img = Image.open(BytesIO(image_data))
    
    # Convert to RGB if necessary (for JPEG output)
    if output_format == 'JPEG' and img.mode in ('RGBA', 'P'):
        img = img.convert('RGB')
    
    if crop_to_fit:
        # Crop to exact dimensions (center crop)
        img_ratio = img.width / img.height
        target_ratio = target_size[0] / target_size[1]
        
        if img_ratio > target_ratio:
            # Image is wider, crop width
            new_width = int(img.height * target_ratio)
            left = (img.width - new_width) // 2
            img = img.crop((left, 0, left + new_width, img.height))
        else:
            # Image is taller, crop height
            new_height = int(img.width / target_ratio)
            top = (img.height - new_height) // 2
            img = img.crop((0, top, img.width, top + new_height))
        
        img = img.resize(target_size, Image.Resampling.LANCZOS)
    else:
        # Fit within dimensions (maintain aspect ratio)
        img.thumbnail(target_size, Image.Resampling.LANCZOS)
    
    output = BytesIO()
    img.save(output, format=output_format, quality=quality, optimize=True)
    output.seek(0)
    return output


def get_extension(content_type: str) -> str:
    """Get file extension from content type."""
    extensions = {
        'image/jpeg': 'jpg',
        'image/png': 'png',
        'image/gif': 'gif',
        'image/webp': 'webp',
    }
    return extensions.get(content_type, 'jpg')


@router.post("/avatar")
async def upload_avatar(
    file: Annotated[UploadFile, File(description="Avatar image")],
    user_id: Annotated[str, Form(description="User ID")],
    brand_id: Annotated[str, Form(description="Brand ID")] = "ybb",
    storage_service = Depends(get_storage_service)
):
    """
    Upload user avatar image.
    
    - Accepts: JPEG, PNG, GIF, WebP
    - Max size: 2MB
    - Automatically resized to 400x400
    - Cropped to square (center crop)
    """
    try:
        contents = validate_image(file, MAX_AVATAR_SIZE)
        
        # Process avatar
        processed = await run_in_threadpool(
            process_image,
            contents,
            AVATAR_SIZE,
            output_format='JPEG',
            quality=90,
            crop_to_fit=True
        )
        
        # Generate unique filename
        file_id = str(uuid.uuid4())
        filename = f"{file_id}.jpg"
        storage_path = f"{_ENV_PREFIX}/{brand_id}/avatars/{user_id}/{filename}"
        
        # Upload to storage
        await storage_service.upload(
            bucket="avatars",
            object_name=storage_path,
            file_data=processed,
            content_type="image/jpeg",
            size=processed.getbuffer().nbytes
        )
        
        return {
            "success": True,
            "file_id": file_id,
            "filename": filename,
            "storage_path": storage_path,
            "bucket": "avatars",
            "size": processed.getbuffer().nbytes,
            "dimensions": {"width": AVATAR_SIZE[0], "height": AVATAR_SIZE[1]},
            "url": f"/api/v1/images/avatar/{user_id}?brand_id={brand_id}"
        }
        
    except InvalidFileTypeException as e:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))
    except FileSizeLimitException as e:
        raise HTTPException(status_code=status.HTTP_413_REQUEST_ENTITY_TOO_LARGE, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail=f"Upload failed: {str(e)}")


@router.post("/program/{program_id}/logo")
async def upload_program_logo(
    program_id: str,
    file: Annotated[UploadFile, File(description="Program logo image")],
    brand_id: Annotated[str, Form(description="Brand ID")] = "ybb",
    storage_service = Depends(get_storage_service)
):
    """
    Upload program logo image.
    
    - Accepts: JPEG, PNG, WebP
    - Max size: 5MB
    - Resized to fit within 600x600
    """
    try:
        contents = validate_image(file, MAX_IMAGE_SIZE)
        
        # Process logo (fit, no crop)
        processed = await run_in_threadpool(
            process_image,
            contents,
            (600, 600),
            output_format='PNG',
            quality=95,
            crop_to_fit=False
        )
        
        file_id = str(uuid.uuid4())
        filename = f"{file_id}.png"
        storage_path = f"{_ENV_PREFIX}/{brand_id}/programs/{program_id}/logo/{filename}"
        
        await storage_service.upload(
            bucket="programs",
            object_name=storage_path,
            file_data=processed,
            content_type="image/png",
            size=processed.getbuffer().nbytes
        )
        
        return {
            "success": True,
            "file_id": file_id,
            "filename": filename,
            "storage_path": storage_path,
            "bucket": "programs",
            "size": processed.getbuffer().nbytes,
            "url": f"/api/v1/images/program/{program_id}/logo?brand_id={brand_id}"
        }
        
    except InvalidFileTypeException as e:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))
    except FileSizeLimitException as e:
        raise HTTPException(status_code=status.HTTP_413_REQUEST_ENTITY_TOO_LARGE, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail=f"Upload failed: {str(e)}")


@router.post("/program/{program_id}/banner")
async def upload_program_banner(
    program_id: str,
    file: Annotated[UploadFile, File(description="Program banner image")],
    brand_id: Annotated[str, Form(description="Brand ID")] = "ybb",
    storage_service = Depends(get_storage_service)
):
    """
    Upload program banner image.
    
    - Accepts: JPEG, PNG, WebP
    - Max size: 10MB
    - Resized to 1200x400 (cropped to fit)
    """
    try:
        contents = validate_image(file, MAX_BANNER_SIZE)
        
        # Process banner (crop to fit)
        processed = await run_in_threadpool(
            process_image,
            contents,
            BANNER_SIZES['program'],
            output_format='JPEG',
            quality=85,
            crop_to_fit=True
        )
        
        file_id = str(uuid.uuid4())
        filename = f"{file_id}.jpg"
        storage_path = f"{_ENV_PREFIX}/{brand_id}/programs/{program_id}/banner/{filename}"
        
        await storage_service.upload(
            bucket="programs",
            object_name=storage_path,
            file_data=processed,
            content_type="image/jpeg",
            size=processed.getbuffer().nbytes
        )
        
        return {
            "success": True,
            "file_id": file_id,
            "filename": filename,
            "storage_path": storage_path,
            "bucket": "programs",
            "size": processed.getbuffer().nbytes,
            "dimensions": {"width": BANNER_SIZES['program'][0], "height": BANNER_SIZES['program'][1]},
            "url": f"/api/v1/images/program/{program_id}/banner?brand_id={brand_id}"
        }
        
    except InvalidFileTypeException as e:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))
    except FileSizeLimitException as e:
        raise HTTPException(status_code=status.HTTP_413_REQUEST_ENTITY_TOO_LARGE, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail=f"Upload failed: {str(e)}")


@router.post("/program/{program_id}/thumbnail")
async def upload_program_thumbnail(
    program_id: str,
    file: Annotated[UploadFile, File(description="Program thumbnail image")],
    brand_id: Annotated[str, Form(description="Brand ID")] = "ybb",
    storage_service = Depends(get_storage_service)
):
    """
    Upload program thumbnail image.
    
    - Accepts: JPEG, PNG, WebP
    - Max size: 5MB
    - Resized to 600x400 (cropped to fit)
    """
    try:
        contents = validate_image(file, MAX_IMAGE_SIZE)
        
        # Process thumbnail
        processed = await run_in_threadpool(
            process_image,
            contents,
            (600, 400),
            output_format='JPEG',
            quality=85,
            crop_to_fit=True
        )
        
        file_id = str(uuid.uuid4())
        filename = f"{file_id}.jpg"
        storage_path = f"{_ENV_PREFIX}/{brand_id}/programs/{program_id}/thumbnail/{filename}"
        
        await storage_service.upload(
            bucket="programs",
            object_name=storage_path,
            file_data=processed,
            content_type="image/jpeg",
            size=processed.getbuffer().nbytes
        )
        
        return {
            "success": True,
            "file_id": file_id,
            "filename": filename,
            "storage_path": storage_path,
            "bucket": "programs",
            "size": processed.getbuffer().nbytes,
            "dimensions": {"width": 600, "height": 400},
            "url": f"/api/v1/images/program/{program_id}/thumbnail?brand_id={brand_id}"
        }
        
    except InvalidFileTypeException as e:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))
    except FileSizeLimitException as e:
        raise HTTPException(status_code=status.HTTP_413_REQUEST_ENTITY_TOO_LARGE, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail=f"Upload failed: {str(e)}")


@router.post("/program/{program_id}/gallery")
async def upload_program_gallery_image(
    program_id: str,
    file: Annotated[UploadFile, File(description="Gallery image")],
    brand_id: Annotated[str, Form(description="Brand ID")] = "ybb",
    caption: Annotated[Optional[str], Form(description="Image caption")] = None,
    storage_service = Depends(get_storage_service)
):
    """
    Upload program gallery image.
    
    - Accepts: JPEG, PNG, WebP
    - Max size: 10MB
    - Resized to max 1920px on longest side
    - Also generates a thumbnail
    """
    try:
        contents = validate_image(file, MAX_IMAGE_SIZE)
        
        # Process main image
        main_image = await run_in_threadpool(
            process_image,
            contents,
            (1920, 1920),
            output_format='JPEG',
            quality=85,
            crop_to_fit=False
        )
        
        file_id = str(uuid.uuid4())
        main_filename = f"{file_id}.jpg"
        main_path = f"{_ENV_PREFIX}/{brand_id}/programs/{program_id}/gallery/{main_filename}"
        
        # Process thumbnail
        thumbnail = await run_in_threadpool(
            process_image,
            contents,
            THUMBNAIL_SIZES['medium'],
            output_format='JPEG',
            quality=80,
            crop_to_fit=True
        )
        thumb_filename = f"{file_id}_thumb.jpg"
        thumb_path = f"{_ENV_PREFIX}/{brand_id}/programs/{program_id}/gallery/thumbnails/{thumb_filename}"
        
        # Upload main image
        await storage_service.upload(
            bucket="programs",
            object_name=main_path,
            file_data=main_image,
            content_type="image/jpeg",
            size=main_image.getbuffer().nbytes
        )
        
        # Upload thumbnail
        await storage_service.upload(
            bucket="programs",
            object_name=thumb_path,
            file_data=thumbnail,
            content_type="image/jpeg",
            size=thumbnail.getbuffer().nbytes
        )
        
        return {
            "success": True,
            "file_id": file_id,
            "main_image": {
                "filename": main_filename,
                "storage_path": main_path,
                "size": main_image.getbuffer().nbytes,
                "url": f"/api/v1/images/program/{program_id}/gallery/{file_id}?brand_id={brand_id}"
            },
            "thumbnail": {
                "filename": thumb_filename,
                "storage_path": thumb_path,
                "size": thumbnail.getbuffer().nbytes,
                "url": f"/api/v1/images/program/{program_id}/gallery/{file_id}/thumbnail?brand_id={brand_id}"
            },
            "caption": caption
        }
        
    except InvalidFileTypeException as e:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))
    except FileSizeLimitException as e:
        raise HTTPException(status_code=status.HTTP_413_REQUEST_ENTITY_TOO_LARGE, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail=f"Upload failed: {str(e)}")


@router.post("/sponsor/logo")
async def upload_sponsor_logo(
    file: Annotated[UploadFile, File(description="Sponsor logo image")],
    sponsor_id: Annotated[str, Form(description="Sponsor ID")],
    brand_id: Annotated[str, Form(description="Brand ID")] = "ybb",
    storage_service = Depends(get_storage_service)
):
    """
    Upload sponsor/partner logo.
    
    - Accepts: JPEG, PNG, WebP
    - Max size: 5MB
    - Resized to fit within 400x200 (maintains aspect ratio)
    - Preserves transparency for PNG
    """
    try:
        contents = validate_image(file, MAX_IMAGE_SIZE)
        
        # Process logo (fit, no crop, preserve transparency)
        processed = await run_in_threadpool(
            process_image,
            contents,
            (400, 200),
            output_format='PNG',
            quality=95,
            crop_to_fit=False
        )
        
        file_id = str(uuid.uuid4())
        filename = f"{file_id}.png"
        storage_path = f"{_ENV_PREFIX}/{brand_id}/sponsors/{sponsor_id}/{filename}"
        
        await storage_service.upload(
            bucket="sponsors",
            object_name=storage_path,
            file_data=processed,
            content_type="image/png",
            size=processed.getbuffer().nbytes
        )
        
        return {
            "success": True,
            "file_id": file_id,
            "filename": filename,
            "storage_path": storage_path,
            "bucket": "sponsors",
            "size": processed.getbuffer().nbytes,
            "url": f"/api/v1/images/sponsor/{sponsor_id}/logo?brand_id={brand_id}"
        }
        
    except InvalidFileTypeException as e:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))
    except FileSizeLimitException as e:
        raise HTTPException(status_code=status.HTTP_413_REQUEST_ENTITY_TOO_LARGE, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail=f"Upload failed: {str(e)}")


@router.post("/testimonial/avatar")
async def upload_testimonial_avatar(
    file: Annotated[UploadFile, File(description="Testimonial avatar image")],
    testimonial_id: Annotated[str, Form(description="Testimonial ID")],
    brand_id: Annotated[str, Form(description="Brand ID")] = "ybb",
    storage_service = Depends(get_storage_service)
):
    """
    Upload testimonial person avatar.
    
    - Accepts: JPEG, PNG, WebP
    - Max size: 2MB
    - Resized to 200x200 (square crop)
    """
    try:
        contents = validate_image(file, MAX_AVATAR_SIZE)
        
        # Process avatar (square crop)
        processed = await run_in_threadpool(
            process_image,
            contents,
            (200, 200),
            output_format='JPEG',
            quality=90,
            crop_to_fit=True
        )
        
        file_id = str(uuid.uuid4())
        filename = f"{file_id}.jpg"
        storage_path = f"{_ENV_PREFIX}/{brand_id}/testimonials/{testimonial_id}/avatar/{filename}"
        
        await storage_service.upload(
            bucket="testimonials",
            object_name=storage_path,
            file_data=processed,
            content_type="image/jpeg",
            size=processed.getbuffer().nbytes
        )
        
        return {
            "success": True,
            "file_id": file_id,
            "filename": filename,
            "storage_path": storage_path,
            "bucket": "testimonials",
            "size": processed.getbuffer().nbytes,
            "dimensions": {"width": 200, "height": 200},
            "url": f"/api/v1/images/testimonial/{testimonial_id}/avatar?brand_id={brand_id}"
        }
        
    except InvalidFileTypeException as e:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))
    except FileSizeLimitException as e:
        raise HTTPException(status_code=status.HTTP_413_REQUEST_ENTITY_TOO_LARGE, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail=f"Upload failed: {str(e)}")


@router.post("/brand/logo")
async def upload_brand_logo(
    file: Annotated[UploadFile, File(description="Brand logo image")],
    brand_id: Annotated[str, Form(description="Brand ID")],
    storage_service = Depends(get_storage_service)
):
    """
    Upload brand logo.
    
    - Accepts: PNG (for transparency), JPEG, WebP
    - Max size: 5MB
    - Resized to fit within 500x200
    """
    try:
        contents = validate_image(file, MAX_IMAGE_SIZE)
        
        # Process logo (preserve transparency)
        processed = await run_in_threadpool(
            process_image,
            contents,
            (500, 200),
            output_format='PNG',
            quality=95,
            crop_to_fit=False
        )
        
        file_id = str(uuid.uuid4())
        filename = f"{file_id}.png"
        storage_path = f"{_ENV_PREFIX}/{brand_id}/brands/logo/{filename}"
        
        await storage_service.upload(
            bucket="brands",
            object_name=storage_path,
            file_data=processed,
            content_type="image/png",
            size=processed.getbuffer().nbytes
        )
        
        return {
            "success": True,
            "file_id": file_id,
            "filename": filename,
            "storage_path": storage_path,
            "bucket": "brands",
            "size": processed.getbuffer().nbytes,
            "url": f"/api/v1/images/brand/{brand_id}/logo"
        }
        
    except InvalidFileTypeException as e:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))
    except FileSizeLimitException as e:
        raise HTTPException(status_code=status.HTTP_413_REQUEST_ENTITY_TOO_LARGE, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail=f"Upload failed: {str(e)}")


@router.post("/brand/banner")
async def upload_brand_banner(
    file: Annotated[UploadFile, File(description="Brand banner image")],
    brand_id: Annotated[str, Form(description="Brand ID")],
    storage_service = Depends(get_storage_service)
):
    """
    Upload brand banner image.
    
    - Accepts: JPEG, PNG, WebP
    - Max size: 10MB
    - Resized to 1920x400 (cropped to fit)
    """
    try:
        contents = validate_image(file, MAX_BANNER_SIZE)
        
        # Process banner
        processed = await run_in_threadpool(
            process_image,
            contents,
            BANNER_SIZES['brand'],
            output_format='JPEG',
            quality=85,
            crop_to_fit=True
        )
        
        file_id = str(uuid.uuid4())
        filename = f"{file_id}.jpg"
        storage_path = f"{_ENV_PREFIX}/{brand_id}/brands/banner/{filename}"
        
        await storage_service.upload(
            bucket="brands",
            object_name=storage_path,
            file_data=processed,
            content_type="image/jpeg",
            size=processed.getbuffer().nbytes
        )
        
        return {
            "success": True,
            "file_id": file_id,
            "filename": filename,
            "storage_path": storage_path,
            "bucket": "brands",
            "size": processed.getbuffer().nbytes,
            "dimensions": {"width": BANNER_SIZES['brand'][0], "height": BANNER_SIZES['brand'][1]},
            "url": f"/api/v1/images/brand/{brand_id}/banner"
        }
        
    except InvalidFileTypeException as e:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))
    except FileSizeLimitException as e:
        raise HTTPException(status_code=status.HTTP_413_REQUEST_ENTITY_TOO_LARGE, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail=f"Upload failed: {str(e)}")
