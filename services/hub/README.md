# YBB program hub

Tiny static page served at https://programs.youthbreaktheboundaries.com. It is the brand-neutral target for email links that have no brand. It asks "Which program are you in?" and shows one card per active brand; each card links to that brand's portal.

## Path passthrough

Each card links to the brand's website origin plus the path, query and hash the hub was opened with:

`programs.youthbreaktheboundaries.com/dashboard/documents?x=1` -> `https://istanbulyouthsummit.com/dashboard/documents?x=1`

Only the pathname, search and hash are carried over (see `buildTargetUrl` in `app.js`); the host always comes from the brand, and leading slashes in the path are collapsed so `//evil.com` stays a path. nginx serves `index.html` for every unknown path for this reason.

Brands come from `GET /api/brands`, which nginx reverse-proxies (5 min cache) to `HUB_BRANDS_UPSTREAM` (default `https://api.ybbhub.com/v1/brands`), because the API sends no CORS headers. Cards show brands with `isActive`, no `deletedAt` and a `websiteUrl` (always linked over https). Each logo is sized to equal area on a 4:3 stage (`logoWidth`); brands without a usable logo, or whose logo fails to load, get an initials monogram. `primaryColor` tints the card when set.

The proxy forwards no client headers, body or query string, keeps one cache entry for everyone, and strips upstream rate-limit, CORS, Cloudflare and `X-Powered-By` headers. HTML, JS and CSS are served `no-cache` (ETag revalidation) because there is no build step to fingerprint filenames.

## Run locally

```sh
docker build -f Dockerfile.prod -t ybb-program-hub .
docker run --rm -p 8080:80 ybb-program-hub
# open http://localhost:8080/dashboard/documents?x=1
```

Tests (no dependencies): `node --test`

Deploy: Dokploy compose `docker-compose.dokploy.yml` (service `program-hub`); the domain is configured in Dokploy.
