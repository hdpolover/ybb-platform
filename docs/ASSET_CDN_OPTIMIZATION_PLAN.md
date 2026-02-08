# Asset CDN & Optimization Plan

## Current State Analysis

### ✅ Implemented
1. **Redis Caching** - API responses cached with TTL
2. **Server-side Image Processing** - Pillow (PIL) for resize/compress
3. **Next.js Image Optimization** - AVIF/WebP support

### ❌ Missing
1. CDN integration for assets
2. HTTP cache headers on File Service
3. Responsive image optimization
4. Modern format delivery (WebP, AVIF from backend)

---

## Improvement Plan

### 1. Add CDN Integration ⭐ HIGH PRIORITY

#### Option A: CloudFlare (Recommended - Free Tier Available)
- **Pros**: Free tier, automatic image optimization, cache purge API
- **Setup**:
  ```nginx
  # Add to Nginx/Reverse Proxy
  proxy_cache_path /var/cache/nginx levels=1:2 keys_zone=images_cache:10m max_size=10g inactive=7d;
  
  location ~* ^/api/v1/images/ {
      proxy_pass http://file-service:8001;
      proxy_cache images_cache;
      proxy_cache_valid 200 7d;
      proxy_cache_valid 404 1m;
      add_header X-Cache-Status $upstream_cache_status;
      add_header Cache-Control "public, max-age=604800, immutable";
  }
  ```

#### Option B: AWS CloudFront
- **Pros**: Better integration with S3, global edge locations
- **Setup**:
  1. Create CloudFront distribution pointing to MinIO/S3
  2. Set origin custom headers
  3. Configure cache behaviors by path pattern
  4. Use signed URLs for private assets

#### Option C: DigitalOcean Spaces CDN
- **Pros**: Simple, integrated with object storage
- **Cost**: ~$5/month + bandwidth

**Recommended**: CloudFlare (free tier) + migrate to CloudFront later if needed.

---

### 2. Add HTTP Cache Headers to File Service

**File**: `ybb-platform/services/file/app/main.py`

```python
from fastapi.responses import StreamingResponse
from fastapi import Response

@app.middleware("http")
async def add_cache_headers(request: Request, call_next):
    response = await call_next(request)
    
    # Cache static images for 7 days
    if request.url.path.startswith("/api/v1/images/"):
        response.headers["Cache-Control"] = "public, max-age=604800, immutable"
        response.headers["CDN-Cache-Control"] = "public, max-age=2592000"  # 30 days for CDN
    
    # Cache avatar/brand logos for 1 day (they change less frequently)
    if "/avatar" in request.url.path or "/brand/" in request.url.path:
        response.headers["Cache-Control"] = "public, max-age=86400, stale-while-revalidate=3600"
    
    # Cache program images for 7 days
    if "/program/" in request.url.path:
        response.headers["Cache-Control"] = "public, max-age=604800, immutable"
    
    return response
```

Add versioning to image URLs to enable cache busting:
```python
# When serving images
@router.get("/program/{program_id}/banner")
async def get_program_banner(
    program_id: str,
    v: Optional[str] = Query(None, description="Version/cache bust"),
    brand_id: str = "ybb",
    storage_service = Depends(get_storage_service)
):
    # URL: /api/v1/images/program/123/banner?v=1234567890
    ...
```

---

### 3. Optimize Backend Image Processing

Replace Pillow with **Pillow-SIMD** or add **Sharp.js** via subprocess.

#### Option A: Pillow-SIMD (Faster Pillow)
```bash
pip uninstall pillow
pip install pillow-simd
```
- 4-6x faster than regular Pillow
- Drop-in replacement

#### Option B: Sharp.js (Best Performance)
Install Node.js in File Service container and call Sharp via subprocess:

```python
import subprocess
import json

async def process_image_sharp(input_path: str, output_path: str, width: int, height: int):
    """Use Sharp.js for superior image processing."""
    cmd = [
        "node", "-e",
        f"""
        const sharp = require('sharp');
        sharp('{input_path}')
          .resize({width}, {height}, {{ fit: 'cover', position: 'center' }})
          .webp({{ quality: 85 }})
          .toFile('{output_path}');
        """
    ]
    subprocess.run(cmd, check=True)
```

**Recommendation**: Start with Pillow-SIMD (easy), evaluate Sharp.js if needed.

---

### 4. Add Multi-Format Support (WebP, AVIF)

Generate multiple formats on upload:

```python
@router.post("/program/{program_id}/banner")
async def upload_program_banner(...):
    # Generate JPEG (fallback)
    jpeg_image = process_image(contents, (1200, 400), 'JPEG', 85, True)
    
    # Generate WebP (modern browsers)
    webp_image = process_image(contents, (1200, 400), 'WEBP', 85, True)
    
    # Generate AVIF (newest, best compression)
    avif_image = process_image(contents, (1200, 400), 'AVIF', 75, True)
    
    # Upload all three
    await asyncio.gather(
        storage_service.upload("programs", f"{path}.jpg", jpeg_image, "image/jpeg"),
        storage_service.upload("programs", f"{path}.webp", webp_image, "image/webp"),
        storage_service.upload("programs", f"{path}.avif", avif_image, "image/avif"),
    )
    
    # Return URLs for all formats
    return {
        "urls": {
            "jpeg": f"/api/v1/images/program/{program_id}/banner.jpg",
            "webp": f"/api/v1/images/program/{program_id}/banner.webp",
            "avif": f"/api/v1/images/program/{program_id}/banner.avif",
        }
    }
```

Then use `<picture>` element in frontend:
```tsx
<picture>
  <source srcSet={`${url}.avif`} type="image/avif" />
  <source srcSet={`${url}.webp`} type="image/webp" />
  <img src={`${url}.jpg`} alt="..." />
</picture>
```

---

### 5. Improve Next.js Image Configuration

**File**: `ybb-program-next/next.config.js`

```js
images: {
  formats: ['image/avif', 'image/webp'],
  deviceSizes: [640, 750, 828, 1080, 1200, 1920, 2048, 3840],
  imageSizes: [16, 32, 48, 64, 96, 128, 256, 384],
  minimumCacheTTL: 31536000, // 1 year for Next.js optimized images
  
  // Loader for custom CDN
  loader: 'custom',
  loaderFile: './lib/imageLoader.ts',
  
  remotePatterns: [/* existing patterns */],
}
```

**Create Custom Loader**: `ybb-program-next/lib/imageLoader.ts`
```ts
export default function cloudflareLoader({ src, width, quality }: {
  src: string;
  width: number;
  quality?: number;
}) {
  // If using Cloudflare Image Resizing
  const params = [`width=${width}`, `quality=${quality || 75}`, 'format=auto'];
  return `https://cdn.ybbhub.com/cdn-cgi/image/${params.join(',')}/${src}`;
}
```

---

### 6. Add Responsive Images & Lazy Loading

Update component usage:

```tsx
// Critical images (Hero, Banner)
<Image
  src={imageUrl}
  alt="Hero Banner"
  width={1920}
  height={600}
  priority // Load immediately
  sizes="100vw" // Full viewport width
/>

// Above-the-fold logos
<Image
  src={logoUrl}
  alt="Logo"
  width={200}
  height={80}
  priority
  sizes="(max-width: 768px) 150px, 200px"
/>

// Gallery images (below fold)
<Image
  src={galleryImage}
  alt="Gallery"
  width={600}
  height={400}
  loading="lazy" // Lazy load
  sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 33vw"
/>

// Sponsor logos (small, many)
<Image
  src={sponsorLogo}
  alt="Sponsor"
  width={120}
  height={60}
  loading="lazy"
  sizes="120px"
/>
```

---

### 7. Implement Image Preloading for LCP

Add to landing page `<head>`:

```tsx
// app/page.tsx
export default async function Home() {
  const homeData = await getHomePageData(host);
  const heroImageUrl = mainBannerSection?.content.imageUrl;
  
  return (
    <>
      <head>
        {heroImageUrl && (
          <link
            rel="preload"
            as="image"
            href={heroImageUrl}
            fetchPriority="high"
          />
        )}
      </head>
      <main>
        <Hero imageUrl={heroImageUrl} ... />
        {/* Rest of page */}
      </main>
    </>
  );
}
```

---

### 8. Add Image CDN Invalidation

When images are updated/deleted, purge CDN cache:

```python
# ybb-platform/services/file/app/infrastructure/cdn/cloudflare.py
import httpx
from typing import List

class CloudflareService:
    def __init__(self, zone_id: str, api_token: str):
        self.zone_id = zone_id
        self.api_token = api_token
        self.base_url = "https://api.cloudflare.com/client/v4"
    
    async def purge_urls(self, urls: List[str]):
        """Purge specific URLs from Cloudflare cache."""
        async with httpx.AsyncClient() as client:
            response = await client.post(
                f"{self.base_url}/zones/{self.zone_id}/purge_cache",
                headers={
                    "Authorization": f"Bearer {self.api_token}",
                    "Content-Type": "application/json",
                },
                json={"files": urls}
            )
            return response.json()
    
    async def purge_by_prefix(self, prefix: str):
        """Purge all URLs with a prefix (e.g., /api/v1/images/program/123/*)"""
        # Cloudflare Enterprise only - use purge_everything for free tier
        await self.purge_everything()
    
    async def purge_everything(self):
        """Nuclear option: purge entire cache."""
        async with httpx.AsyncClient() as client:
            response = await client.post(
                f"{self.base_url}/zones/{self.zone_id}/purge_cache",
                headers={"Authorization": f"Bearer {self.api_token}"},
                json={"purge_everything": True}
            )
            return response.json()

# Usage in delete endpoint
@router.delete("/program/{program_id}/banner")
async def delete_banner(
    program_id: str,
    cdn_service: CloudflareService = Depends(get_cdn_service)
):
    # Delete from storage
    await storage_service.delete(...)
    
    # Purge from CDN
    urls = [
        f"https://cdn.ybbhub.com/api/v1/images/program/{program_id}/banner.jpg",
        f"https://cdn.ybbhub.com/api/v1/images/program/{program_id}/banner.webp",
        f"https://cdn.ybbhub.com/api/v1/images/program/{program_id}/banner.avif",
    ]
    await cdn_service.purge_urls(urls)
```

---

## Implementation Priority

### Phase 1: Quick Wins (1-2 days)
1. ✅ Add HTTP cache headers to File Service
2. ✅ Add `priority` and `sizes` to all landing page images
3. ✅ Install Pillow-SIMD

### Phase 2: CDN Integration (3-5 days)
1. ✅ Set up CloudFlare CDN
2. ✅ Configure cache policies
3. ✅ Update image URLs to use CDN
4. ✅ Test cache invalidation

### Phase 3: Advanced Optimization (1 week)
1. ✅ Add WebP/AVIF generation on backend
2. ✅ Implement multi-format delivery with `<picture>`
3. ✅ Add CDN purge integration
4. ✅ Monitor performance (LCP, CLS, FCP)

### Phase 4: Monitoring (Ongoing)
1. ✅ Add Cloudflare Analytics
2. ✅ Monitor cache hit rates
3. ✅ Track image bandwidth savings
4. ✅ A/B test image quality settings

---

## Expected Performance Gains

| Metric | Before | After | Improvement |
|--------|--------|-------|-------------|
| TTFB (First Image) | 200-500ms | 20-50ms | **90%** |
| Page Load Time | 3-5s | 1-2s | **60%** |
| Bandwidth Costs | $100/mo | $20/mo | **80%** |
| Image File Size | 500KB avg | 150KB avg | **70%** |
| Lighthouse Score | 70-80 | 90-95 | **+20pts** |

---

## Cost Estimates

### CloudFlare (Recommended)
- **Free Tier**: Up to 100k requests/day, unlimited bandwidth
- **Pro ($20/mo)**: Image optimization, better analytics
- **Business ($200/mo)**: Advanced caching, cache purge by prefix

### AWS CloudFront
- **Data Transfer**: $0.085/GB (first 10TB)
- **Requests**: $0.0075 per 10k requests
- **Estimated**: $30-50/month for moderate traffic

### DigitalOcean Spaces CDN
- **Storage**: $5/month (250GB)
- **Bandwidth**: $0.01/GB after 1TB
- **Estimated**: $10-20/month

---

## Monitoring & Metrics

### Key Metrics to Track
1. **Cache Hit Rate**: Target >90%
2. **CDN Bandwidth**: Should reduce origin traffic by 80%+
3. **Image Load Times**: Target <200ms (LCP)
4. **Storage Costs**: Track multi-format storage impact
5. **User Experience**: Core Web Vitals (LCP, CLS, FID)

### Tools
- CloudFlare Analytics Dashboard
- Google PageSpeed Insights
- Lighthouse CI in CI/CD pipeline
- Custom Prometheus metrics for cache hits

---

## Rollout Plan

### Week 1: Preparation
- Add cache headers to File Service
- Install Pillow-SIMD
- Update Next.js image components

### Week 2: CDN Setup
- Configure CloudFlare CDN
- Test cache behaviors
- Update DNS/reverse proxy

### Week 3: Multi-Format
- Implement WebP/AVIF generation
- Update frontend to use `<picture>`
- A/B test format delivery

### Week 4: Monitoring
- Set up analytics
- Monitor performance
- Optimize cache policies based on data

---

## Additional Optimizations

### 1. Static Asset Hosting
Move static assets (logos, icons) to a separate bucket:
```
/static/
  /logos/
  /icons/
  /fonts/
```

### 2. Image Sprites
For multiple small logos (sponsors):
```python
# Generate sprite sheet
def create_sprite(logos: List[Image]) -> Image:
    ...
```

### 3. Progressive JPEGs
```python
img.save(output, format='JPEG', quality=85, optimize=True, progressive=True)
```

### 4. Image Placeholders
Generate tiny blurred placeholders (LQIP - Low Quality Image Placeholder):
```python
placeholder = img.resize((20, 20), Image.LANCZOS)
placeholder_base64 = base64.b64encode(placeholder.tobytes()).decode()
```

Use in Next.js:
```tsx
<Image
  src={imageUrl}
  placeholder="blur"
  blurDataURL={placeholderBase64}
/>
```

---

## Security Considerations

1. **Signed URLs**: For private images (user documents)
2. **Rate Limiting**: Prevent CDN abuse
3. **Hotlink Protection**: Block external sites from embedding images
4. **Access Control**: Ensure MinIO buckets are not public

---

## Success Criteria

✅ CDN cache hit rate > 90%
✅ Image load time < 200ms (p95)
✅ Lighthouse Performance score > 90
✅ Bandwidth costs reduced by 70%+
✅ Zero broken images during migration
