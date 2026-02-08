"""Cache control middleware for image delivery."""
from fastapi import Request
from starlette.middleware.base import BaseHTTPMiddleware
from starlette.responses import Response


class CacheControlMiddleware(BaseHTTPMiddleware):
    """Add appropriate cache headers to image responses."""
    
    async def dispatch(self, request: Request, call_next) -> Response:
        response = await call_next(request)
        
        # Only apply to successful responses
        if response.status_code != 200:
            return response
        
        path = request.url.path
        
        # Long cache for program images (immutable, rarely change)
        if "/program/" in path and any(x in path for x in ["/banner", "/logo", "/gallery", "/thumbnail"]):
            response.headers["Cache-Control"] = "public, max-age=604800, immutable"  # 7 days
            response.headers["CDN-Cache-Control"] = "public, max-age=2592000"  # 30 days for CDN
        
        # Medium cache for avatars (can change occasionally)
        elif "/avatar" in path:
            response.headers["Cache-Control"] = "public, max-age=86400, stale-while-revalidate=3600"  # 1 day
        
        # Long cache for brand/sponsor logos (rarely change)
        elif any(x in path for x in ["/brand/", "/sponsor/"]):
            response.headers["Cache-Control"] = "public, max-age=604800, immutable"  # 7 days
            response.headers["CDN-Cache-Control"] = "public, max-age=2592000"  # 30 days
        
        # Medium cache for testimonial images
        elif "/testimonial/" in path:
            response.headers["Cache-Control"] = "public, max-age=86400"  # 1 day
        
        # Default cache for other images
        elif "/images/" in path:
            response.headers["Cache-Control"] = "public, max-age=3600"  # 1 hour
        
        # Add CORS headers for CDN
        response.headers["Access-Control-Allow-Origin"] = "*"
        response.headers["Timing-Allow-Origin"] = "*"
        
        # Add ETag for validation
        # Note: FastAPI/Starlette automatically adds ETag for StreamingResponse
        
        return response
