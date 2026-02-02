import { INestApplication } from '@nestjs/common';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import * as fs from 'fs';
import * as path from 'path';

// Helper to safely read documentation files
const getDocContent = (filename: string): string => {
  try {
    // 1. Try finding relative to this config file (Works for src/docs in Dev and dist/src/docs if copied)
    // __dirname is .../src/config
    // Target is .../src/docs
    const localPath = path.join(__dirname, '..', 'docs', filename);
    if (fs.existsSync(localPath)) {
      return fs.readFileSync(localPath, 'utf8');
    }

    // 2. Try finding in src/docs (Explicit Source check for Docker Dev with Volumes)
    const srcPath = path.join(process.cwd(), 'src', 'docs', filename);
    if (fs.existsSync(srcPath)) {
      return fs.readFileSync(srcPath, 'utf8');
    }

    // 3. Try finding in project root/docs (Legacy/Fallback)
    // Assumes CWD is the service root
    const rootPath = path.join(process.cwd(), 'docs', filename);
    if (fs.existsSync(rootPath)) {
      return fs.readFileSync(rootPath, 'utf8');
    }
    
    // 4. Try finding in dist/docs (Previous Strategy)
    const distPath = path.join(__dirname, '..', '..', 'docs', filename);
    if (fs.existsSync(distPath)) {
        return fs.readFileSync(distPath, 'utf8');
    }

    console.warn(`[Swagger] Documentation file not found: ${filename}. Checked: ${localPath}, ${srcPath}, ${rootPath}, ${distPath}`);
    return '';
  } catch (error) {
    console.warn(`Failed to load documentation file ${filename}:`, error.message);
    return '';
  }
};

export const SWAGGER_TAGS = [
  { name: 'Achievements', description: 'Awards & Achievements' },
  { name: 'AI Bot', description: 'AI Bot configuration' },
  { name: 'Ambassadors', description: 'Ambassador program management' },
  { name: 'Applications', description: 'Application management' },
  { name: 'Auth', description: 'Authentication endpoints' },
  { name: 'Brands', description: getDocContent('BRANDS_API.md') || 'Brand & Sponsor management' },
  { name: 'Documents', description: 'Document generation & exports' },
  { name: 'Files', description: 'File operations' },
  { name: 'Gallery', description: 'Photo & Video gallery' },
  { name: 'Health', description: 'Health check' },
  { name: 'Landing', description: 'Landing page content' },
  { name: 'Legal', description: 'Legal documents & Terms' },
  { name: 'Metadata', description: 'Common metadata (Countries, Currencies, etc.)' },
  { name: 'Newsletter', description: 'Newsletter subscriptions' },
  { name: 'Participants', description: 'Participant management' },
  { name: 'Partnerships', description: 'Partnership opportunities' },
  { name: 'Payments', description: 'Payment management' },
  { name: 'Admin Payments', description: 'Admin payment management' },
  { name: 'Programs', description: 'Program management' },
  { name: 'Stats', description: 'Statistics & Analytics' },
  { name: 'Support', description: 'Support ticket system' },
  { name: 'System', description: 'System announcements & logs' },
  { name: 'Users', description: 'User management' },
  { name: 'Webhooks', description: 'Incoming webhook handlers' },
];

export function setupSwagger(app: INestApplication): void {
  // Base builder for application
  const builder = new DocumentBuilder()
    .setTitle('YBB Platform API')
    .setDescription('YBB Platform API Gateway - Brand-Scoped Multi-Tenant System.')
    .setVersion('1.0')
    .addBearerAuth();

  // Add all tags
  SWAGGER_TAGS.forEach(tag => {
    builder.addTag(tag.name, tag.description);
  });

  const config = builder.build();

  // Generate the full document covering all modules
  const documentAll = SwaggerModule.createDocument(app, config);

  // Split documents manually based on path prefix
  // We strip prefixes (/v1, /v2) from paths and set 'servers' to that prefix
  // so the Swagger UI looks clean (e.g. /brands instead of /v1/brands)
  const documentV1 = {
    ...documentAll,
    paths: {},
    info: { ...documentAll.info, title: 'YBB Platform API (v1)', version: '1.0' },
    servers: [{ url: '/v1', description: 'Current (V1)' }],
  };

  const documentV2 = {
    ...documentAll,
    paths: {},
    info: { ...documentAll.info, title: 'YBB Platform API (v2)', version: '2.0-beta' },
    servers: [{ url: '/v2', description: 'Beta (V2)' }],
  };

  Object.keys(documentAll.paths).forEach((key) => {
    if (key.startsWith('/v2')) {
      const newKey = key.replace(/^\/v2/, '') || '/';
      documentV2.paths[newKey] = documentAll.paths[key];
    } else {
      // Strip /v1 prefix if present
      let newKey = key;
      if (key.startsWith('/v1')) {
        newKey = key.replace(/^\/v1/, '') || '/';
      }
      documentV1.paths[newKey] = documentAll.paths[key];
    }
  });

  // Setup specific endpoints to ensure -json files are served
  SwaggerModule.setup('docs/v1', app, documentV1, { swaggerOptions: { persistAuthorization: true } });
  SwaggerModule.setup('docs/v2', app, documentV2, { swaggerOptions: { persistAuthorization: true } });

  // Serve Stoplight Elements for the main docs page
  const httpAdapter = app.getHttpAdapter();
  httpAdapter.get('/docs', (req, res) => {
    res.send(`<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1, shrink-to-fit=no">
    <title>YBB Platform API Docs</title>
    
    <script src="https://unpkg.com/@stoplight/elements/web-components.min.js"></script>
    <link rel="stylesheet" href="https://unpkg.com/@stoplight/elements/styles.min.css">
    <style>
      body { height: 100vh; display: flex; flex-direction: column; overflow: hidden; margin: 0; } 
      #header { padding: 12px 20px; background: #fff; border-bottom: 1px solid #e1e4e8; display: flex; align-items: center; justify-content: space-between; font-family: ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif; }
      #header h1 { margin: 0; font-size: 18px; font-weight: 600; color: #111827; }
      .header-actions { display: flex; align-items: center; gap: 16px; }
      .version-selector { display: flex; align-items: center; gap: 8px; font-size: 14px; }
      .classic-link { font-size: 14px; text-decoration: none; color: #2563eb; font-weight: 500; }
      .classic-link:hover { text-decoration: underline; }
      select { padding: 4px 8px; border-radius: 4px; border: 1px solid #d1d5db; background-color: #fff; font-size: 14px; color: #374151; cursor: pointer; }
      select:focus { outline: 2px solid #2563eb; border-color: #2563eb; }
      elements-api { flex: 1; overflow: hidden; }
    </style>
  </head>
  <body>
    <div id="header">
        <h1>YBB Platform API</h1>
        <div class="header-actions">
            <a href="/docs/v1" class="classic-link" target="_blank">Classic Swagger UI &rarr;</a>
            <div class="version-selector">
                <label for="version-select">Version:</label>
                <select id="version-select" onchange="updateDocs(this.value)">
                    <option value="/docs/v1-json">v1 (Current)</option>
                    <option value="/docs/v2-json">v2 (Beta)</option>
                </select>
            </div>
        </div>
    </div>

    <elements-api
      id="docs"
      apiDescriptionUrl="/docs/v1-json"
      router="hash"
      layout="sidebar"
    />

    <script>
        function updateDocs(url) {
            document.getElementById('docs').setAttribute('apiDescriptionUrl', url);
        }
    </script>
  </body>
</html>`);
  });
}
