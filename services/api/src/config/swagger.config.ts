import { INestApplication } from '@nestjs/common';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';

export const SWAGGER_TAGS = [
  { name: 'achievements', description: 'Awards & Achievements' },
  { name: 'applications', description: 'Application management' },
  { name: 'auth', description: 'Authentication endpoints' },
  { name: 'brands', description: 'Brand & Sponsor management' },
  { name: 'documents', description: 'Document generation & exports' },
  { name: 'files', description: 'File operations' },
  { name: 'health', description: 'Health check' },
  { name: 'landing', description: 'Landing page content' },
  { name: 'participants', description: 'Participant management' },
  { name: 'payments', description: 'Payment management' },
  { name: 'programs', description: 'Program management' },
  { name: 'support', description: 'Support ticket system' },
  { name: 'system', description: 'System announcements & logs' },
  { name: 'users', description: 'User management' },
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
      .version-selector { display: flex; align-items: center; gap: 8px; font-size: 14px; }
      select { padding: 4px 8px; border-radius: 4px; border: 1px solid #d1d5db; background-color: #fff; font-size: 14px; color: #374151; cursor: pointer; }
      select:focus { outline: 2px solid #2563eb; border-color: #2563eb; }
      elements-api { flex: 1; overflow: hidden; }
    </style>
  </head>
  <body>
    <div id="header">
        <h1>YBB Platform API</h1>
        <div class="version-selector">
            <label for="version-select">Version:</label>
            <select id="version-select" onchange="updateDocs(this.value)">
                <option value="/docs/v1-json">v1 (Current)</option>
                <option value="/docs/v2-json">v2 (Beta)</option>
            </select>
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
