# CloudFlare CDN Setup for YBB Platform

## Overview
This guide walks through setting up CloudFlare as a CDN for the YBB Platform's images and static assets.

## Benefits
- ✅ **FREE tier** available (unlimited bandwidth)
- ✅ **Global CDN** with 300+ edge locations
- ✅ **Automatic image optimization** (Cloudflare Polish)
- ✅ **Cache analytics** and insights
- ✅ **DDoS protection** included
- ✅ **Cache purge API** for updates

---

## Step 1: Add Site to CloudFlare

1. Go to [cloudflare.com](https://dash.cloudflare.com)
2. Click "Add Site"
3. Enter domain: `ybbhub.com`
4. Choose FREE plan
5. Update nameservers at your domain registrar to CloudFlare's nameservers

---

## Step 2: Enable CDN for Images

### Option A: Use CloudFlare as Reverse Proxy (Recommended)

1. In CloudFlare Dashboard, go to **DNS**
2. Add A record pointing to your origin server:
   ```
   Type: A
   Name: api (or cdn)
   IPv4: YOUR_SERVER_IP
   Proxy status: ✅ Proxied (orange cloud)
   TTL: Auto
   ```

3. Add CNAME for static assets:
   ```
   Type: CNAME
   Name: static
   Target: api.ybbhub.com
   Proxy status: ✅ Proxied
   ```

### Option B: Use Subdomain (Simpler)

1. Create subdomain: `cdn.ybbhub.com`
2. Point to same origin server
3. Enable proxy (orange cloud)

---

## Step 3: Configure Cache Rules

Go to **Caching** > **Cache Rules** > **Create Rule**

### Rule 1: Cache Images Long Term
```
Rule name: Cache Images 7 Days
When incoming requests match: Custom filter expression

Field: URI Path
Operator: contains
Value: /api/v1/images/

Then:
  Cache level: Standard
  Browser cache TTL: 7 days
  Edge cache TTL: 30 days
  Cache status code: 200, 206
```

### Rule 2: Cache Static Assets
```
Rule name: Cache Static Assets
When incoming requests match: Custom filter expression

Field: File extension
Operator: matches regex
Value: (jpg|jpeg|png|webp|avif|gif|svg|ico|woff|woff2|css|js)$

Then:
  Cache level: Standard
  Browser cache TTL: 1 year
  Edge cache TTL: 1 year
```

---

## Step 4: Enable Image Optimization (Optional - Pro Plan)

Go to **Speed** > **Optimization** > **Images**

Enable:
- ✅ **Polish**: Lossless compression (Pro: Lossy available)
- ✅ **Mirage**: Lazy loading for images
- ✅ **WebP conversion**: Auto-convert to WebP for supported browsers

---

## Step 5: Configure Page Rules (Alternative to Cache Rules)

If cache rules aren't working, use Page Rules:

Go to **Rules** > **Page Rules** > **Create Page Rule**

### Rule 1: Cache Everything for Images
```
URL: api.ybbhub.com/api/v1/images/*

Settings:
  Cache Level: Cache Everything
  Edge Cache TTL: 30 days
  Browser Cache TTL: 7 days
  Origin Cache Control: On
```

### Rule 2: Bypass Cache for Uploads
```
URL: api.ybbhub.com/api/v1/images/*

Method: POST, PUT, DELETE
Settings:
  Cache Level: Bypass
```

---

## Step 6: Update Application URLs

### Backend (.env)
```env
# File Service
CDN_URL=https://cdn.ybbhub.com
# or
CDN_URL=https://api.ybbhub.com
```

### Frontend (.env)
```env
NEXT_PUBLIC_CDN_URL=https://cdn.ybbhub.com
NEXT_PUBLIC_API_URL=https://api.ybbhub.com
```

### Code Changes

**File Service** (`ybb-platform/services/file/app/config.py`):
```python
from pydantic_settings import BaseSettings

class Settings(BaseSettings):
    CDN_URL: str = "https://cdn.ybbhub.com"
    
    def get_image_url(self, path: str) -> str:
        """Return CDN URL for image."""
        return f"{self.CDN_URL}/{path}"

settings = Settings()
```

**API Service** (Image URLs in responses):
```typescript
// Before
imageUrl: `/api/v1/images/program/${programId}/banner.jpg`

// After
imageUrl: `${process.env.CDN_URL}/api/v1/images/program/${programId}/banner.jpg`
```

**Frontend** (use CDN URL):
```tsx
<OptimizedImage
  src={`${process.env.NEXT_PUBLIC_CDN_URL}${imageUrl}`}
  alt="Banner"
  type="banner"
/>
```

---

## Step 7: Test CDN

### Check Cache Status
```bash
curl -I https://cdn.ybbhub.com/api/v1/images/program/123/banner.jpg

# Look for headers:
# cf-cache-status: HIT (good) or MISS (first request)
# cache-control: public, max-age=604800
# cf-ray: [ID]
```

### Check Different Regions
Use [CDN Planet](https://www.cdnplanet.com/tools/cdntest/) or:
```bash
# From different servers
curl -I https://cdn.ybbhub.com/api/v1/images/...
```

---

## Step 8: Implement Cache Purge

### Manual Purge (Dashboard)
1. Go to **Caching** > **Configuration**
2. Click **Purge Cache**
3. Options:
   - Purge Everything (nuclear option)
   - Purge by URL
   - Purge by Tag (Pro plan)

### API Purge (Automated)

**Install CloudFlare SDK** in File Service:
```bash
pip install cloudflare
```

**Add to File Service** (`app/infrastructure/cdn/cloudflare.py`):
```python
import CloudFlare
from typing import List

class CloudFlareService:
    def __init__(self, api_token: str, zone_id: str):
        self.cf = CloudFlare.CloudFlare(token=api_token)
        self.zone_id = zone_id
    
    def purge_urls(self, urls: List[str]) -> dict:
        """Purge specific URLs from cache."""
        try:
            result = self.cf.zones.purge_cache.post(
                self.zone_id,
                data={'files': urls}
            )
            return {'success': True, 'result': result}
        except Exception as e:
            return {'success': False, 'error': str(e)}
    
    def purge_everything(self) -> dict:
        """Purge entire cache (use sparingly)."""
        try:
            result = self.cf.zones.purge_cache.post(
                self.zone_id,
                data={'purge_everything': True}
            )
            return {'success': True, 'result': result}
        except Exception as e:
            return {'success': False, 'error': str(e)}
```

**Environment Variables**:
```env
CLOUDFLARE_API_TOKEN=your_api_token_here
CLOUDFLARE_ZONE_ID=your_zone_id_here
```

**Usage in Delete Endpoint**:
```python
@router.delete("/program/{program_id}/banner")
async def delete_banner(
    program_id: str,
    cdn_service: CloudFlareService = Depends(get_cdn_service)
):
    # Delete from storage
    await storage_service.delete(...)
    
    # Purge from CDN
    urls = [
        f"https://cdn.ybbhub.com/api/v1/images/program/{program_id}/banner.jpg",
        f"https://cdn.ybbhub.com/api/v1/images/program/{program_id}/banner.webp",
    ]
    cdn_service.purge_urls(urls)
```

---

## Step 9: Monitor Performance

### CloudFlare Analytics
Go to **Analytics & Logs** > **Traffic**

Key metrics:
- **Cache Hit Ratio**: Target >90%
- **Bandwidth Saved**: Should see 70-80% savings
- **Request Count**: Monitor traffic patterns
- **Response Time**: Should drop to <50ms

### Custom Dashboard
Create monitoring endpoint:
```python
@router.get("/cdn/stats")
async def get_cdn_stats(cdn_service: CloudFlareService):
    return {
        "cache_hit_rate": cdn_service.get_analytics(),
        "bandwidth_saved": ...,
        "total_requests": ...,
    }
```

---

## Step 10: Security & Access Control

### Enable WAF (Web Application Firewall)
Go to **Security** > **WAF**
- Enable managed rules
- Create custom rules if needed

### Rate Limiting
Go to **Security** > **Rate Limiting**
```
Rule: Limit Image Uploads
URL: api.ybbhub.com/api/v1/images/*
Method: POST
Rate: 100 requests per minute per IP
Action: Block
```

### Hotlink Protection
Go to **Scrape Shield** > **Hotlink Protection**
- Enable to prevent other sites from embedding your images

### SSL/TLS
Go to **SSL/TLS**
- Mode: Full (Strict) - requires valid cert on origin
- Always Use HTTPS: ON
- Minimum TLS Version: 1.2

---

## Troubleshooting

### Cache Not Working
1. Check `Cache-Control` headers in origin response
2. Verify Page Rule or Cache Rule is active
3. Check if URL matches rule pattern
4. Look for `cf-cache-status: BYPASS` (indicates why not cached)

### Images Not Loading
1. Check DNS propagation: `dig cdn.ybbhub.com`
2. Verify origin server is responding: `curl -I origin-ip/path`
3. Check CloudFlare firewall logs
4. Disable proxy temporarily to test origin

### Slow Performance
1. Check origin server performance
2. Enable Argo (paid feature for faster routing)
3. Verify cache hit ratio is >80%
4. Check if image sizes are optimized

---

## Cost Comparison

### FREE Plan
- ✅ Unlimited bandwidth
- ✅ 100% uptime SLA
- ✅ Basic DDoS protection
- ✅ Limited page rules (3)
- ✅ Shared SSL certificate
- ❌ No Polish (image optimization)
- ❌ No advanced analytics

### PRO Plan ($20/month)
- ✅ Everything in FREE
- ✅ Polish (lossy image compression)
- ✅ Advanced analytics
- ✅ 20 page rules
- ✅ Image resizing API
- ✅ Mobile optimization

### Recommendation
Start with **FREE** plan, upgrade to **PRO** if:
- Need automatic image optimization (Polish)
- Want detailed analytics
- High traffic (>1M requests/day)

---

## Expected Results

### Performance Gains
| Metric | Before | After | Improvement |
|--------|--------|-------|-------------|
| TTFB | 300-500ms | 20-50ms | **90%** |
| Image Load | 2-3s | 200-400ms | **85%** |
| Bandwidth Used | 100GB/mo | 20GB/mo | **80%** |
| Cache Hit Rate | 0% | 90%+ | ∞ |

### Traffic Stats (Estimated)
- **Origin Requests**: 90% reduction
- **CDN Requests**: 95%+ from edge cache
- **Bandwidth Savings**: $80-$100/month

---

## Rollback Plan

If issues occur:
1. **Disable Proxy** in DNS (click orange cloud to gray)
2. **Purge All Cache** in CloudFlare
3. **Revert URLs** in code to direct origin
4. **Check logs** for errors

---

## Next Steps

1. ✅ Set up CloudFlare account
2. ✅ Configure DNS records
3. ✅ Create cache rules
4. ✅ Update application URLs
5. ✅ Test cache behavior
6. ✅ Implement purge API
7. ✅ Monitor analytics
8. ✅ Optimize based on data

---

## Support

- CloudFlare Docs: https://developers.cloudflare.com/
- Community Forum: https://community.cloudflare.com/
- Support: support@cloudflare.com (Pro+ plans)
