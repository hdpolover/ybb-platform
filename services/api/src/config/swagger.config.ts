import { INestApplication } from '@nestjs/common';
import { DocumentBuilder, OpenAPIObject, SwaggerModule } from '@nestjs/swagger';
import * as fs from 'fs';
import * as path from 'path';

/**
 * Whether the API should mount Swagger/OpenAPI docs and the `/` -> `/docs` redirect.
 *
 * Fail-closed in production. The docs enumerate the entire admin surface at an
 * unauthenticated path and the docs page holds a bearer token in localStorage
 * (persistAuthorization) on the API's own origin, so production does not serve
 * them. SWAGGER_ENABLED is the deliberate break-glass and is intentionally NOT
 * mapped into docker-compose.dokploy.yml - same pattern as
 * ADMIN_REGISTRATION_ENABLED - so re-enabling docs in production needs a
 * reviewable compose change, not just a panel toggle.
 *
 * Only the exact string 'true' enables it; anything else (including 'TRUE',
 * '1', 'yes') stays off, so a typo fails safe rather than exposing docs.
 */
export const isSwaggerEnabled = (env: NodeJS.ProcessEnv = process.env): boolean =>
  env.NODE_ENV !== 'production' || env.SWAGGER_ENABLED === 'true';

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
  { name: 'Announcements', description: 'System-wide announcements for participants' },
  { name: 'Landing', description: 'Landing page content' },
  { name: 'Legal', description: 'Legal documents & Terms' },
  { name: 'Metadata', description: 'Common metadata (Countries, Currencies, etc.)' },
  { name: 'Newsletter', description: 'Newsletter subscriptions' },
  { name: 'Participants', description: 'Participant management' },
  { name: 'Partnerships', description: 'Partnership opportunities' },
  { name: 'Payments', description: 'Payment management' },
  { name: 'Portal', description: 'Participant portal — submissions, certificates, dashboard' },
  { name: 'Admin Payments', description: 'Admin payment management' },
  { name: 'Programs', description: 'Program management' },
  { name: 'Reporting', description: 'Data export & Reporting (Admin)' },
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

  // Helper to determine if an endpoint is Admin-only
  const isAdminEndpoint = (path: string, method: string, operation: Record<string, unknown>): boolean => {
    const lowerPath = path.toLowerCase();
    const lowerMethod = method.toLowerCase();
    const summary = ((operation.summary as string) || '').toLowerCase();
    const description = ((operation.description as string) || '').toLowerCase();

    // 1. Explicit marker in Summary or Description
    if (summary.includes('admin') || summary.includes('reporting') || summary.includes('audit')) {
      return true;
    }

    // 2. Explicit admin paths and keywords
    const adminPathPrefixes = ['/admin/', '/admins', '/stats', '/system', '/audit', '/reporting', '/health', '/metrics'];
    const adminPathKeywords = ['/admin/', '/admins/', '/stats/', '/metrics/', '/health/', '/audit/', '/reporting/'];

    const matchesPrefix = adminPathPrefixes.some(prefix => lowerPath.startsWith(prefix) || lowerPath.startsWith('/v1' + prefix) || lowerPath.startsWith('/v2' + prefix));
    const matchesKeyword = adminPathKeywords.some(keyword => lowerPath.includes(keyword));

    if (matchesPrefix || matchesKeyword) {
      // Exception: Announcements and Webhooks are for participants/public
      if (lowerPath.includes('/announcements')) return false;
      if (lowerPath.includes('/webhooks')) return false;
      return true;
    }

    // 3. Special cases for AI Bot
    if (lowerPath.startsWith('/ai-bot') || lowerPath.startsWith('/v1/ai-bot')) {
      if (lowerPath.includes('/active')) return false;
      return true;
    }

    // 4. Special cases for mixed controllers (e.g., Programs, Applications)
    const resourcePaths = ['/programs', '/applications', '/brands', '/achievements'];
    const isResourcePath = resourcePaths.some(p => lowerPath === p || lowerPath === '/v1' + p || lowerPath === '/v2' + p || lowerPath.startsWith(p + '/') || lowerPath.startsWith('/v1' + p + '/') || lowerPath.startsWith('/v2' + p + '/'));

    if (isResourcePath) {
      // GET /applications or /v1/applications is admin-only (listing all)
      if (lowerMethod === 'get' && (lowerPath === '/applications' || lowerPath === '/v1/applications' || lowerPath === '/v2/applications')) {
        return true;
      }

      // Export is always admin
      if (lowerPath.includes('/export')) return true;

      // Mutation methods
      const mutationMethods = ['post', 'put', 'patch', 'delete'];
      if (mutationMethods.includes(lowerMethod)) {
        // Exceptions: participant actions
        const participantPaths = [
          '/login', '/register', '/forgot-password', '/reset-password', '/verify-email', '/logout',
          '/apply', '/participants', '/submit', '/withdraw', '/payment-intent', '/switch-category'
        ];

        // If it's the root POST of applications or programs, it needs careful handling
        if (lowerMethod === 'post') {
          if (lowerPath === '/applications' || lowerPath === '/v1/applications' || lowerPath === '/v2/applications') return false;
          if (lowerPath === '/programs' || lowerPath === '/v1/programs' || lowerPath === '/v2/programs') return true;
          if (lowerPath === '/brands' || lowerPath === '/v1/brands' || lowerPath === '/v2/brands') return true;
        }

        if (participantPaths.some(p => lowerPath.includes(p))) return false;
        if (lowerPath.includes('/webhooks')) return false;

        return true;
      }
    }

    return false;
  };

  // Split documents manually based on path prefix and category
  const documentV1Participant = {
    ...documentAll,
    paths: {},
    info: { ...documentAll.info, title: 'YBB Participant API (v1)', version: '1.0' },
    servers: [{ url: '/v1', description: 'Current (V1)' }],
  };

  const documentV1Admin = {
    ...documentAll,
    paths: {},
    info: { ...documentAll.info, title: 'YBB Admin API (v1)', version: '1.0' },
    servers: [{ url: '/v1', description: 'Current (V1)' }],
  };

  const documentV2 = {
    ...documentAll,
    paths: {},
    info: { ...documentAll.info, title: 'YBB Platform API (v2)', version: '2.0-beta' },
    servers: [{ url: '/v2', description: 'Beta (V2)' }],
  };

  const usedParticipantTagsLower = new Set<string>();
  const usedAdminTagsLower = new Set<string>();

  // Helper to collect all used schema references recursively
  const collectUsedSchemas = (obj: unknown, usedSet: Set<string>) => {
    if (!obj || typeof obj !== 'object') return;

    const objRecord = obj as Record<string, unknown>;
    if (objRecord.$ref && typeof objRecord.$ref === 'string') {
      const parts = (objRecord.$ref as string).split('/');
      const schemaName = parts[parts.length - 1];
      if (!usedSet.has(schemaName)) {
        usedSet.add(schemaName);
        // Recursively check the newly added schema
        const schema = (documentAll as OpenAPIObject & { components?: { schemas?: Record<string, unknown> } }).components?.schemas?.[schemaName];
        if (schema) collectUsedSchemas(schema, usedSet);
      }
    }

    Object.values(obj).forEach(val => collectUsedSchemas(val, usedSet));
  };

  const usedParticipantSchemas = new Set<string>();
  const usedAdminSchemas = new Set<string>();

  Object.keys(documentAll.paths).forEach((pathKey) => {
    const pathItem = documentAll.paths[pathKey];

    if (pathKey.startsWith('/v2')) {
      const newKey = pathKey.replace(/^\/v2/, '') || '/';
      documentV2.paths[newKey] = pathItem;
    } else {
      // Strip /v1 prefix for clean keys
      const cleanKey = pathKey.startsWith('/v1') ? (pathKey.replace(/^\/v1/, '') || '/') : pathKey;

      // Categorize methods within the path
      const participantMethods: Record<string, unknown> = {};
      const adminMethods: Record<string, unknown> = {};

      Object.keys(pathItem).forEach(method => {
        const operation = pathItem[method];
        if (isAdminEndpoint(pathKey, method, operation)) {
          adminMethods[method] = operation;
          (operation.tags || []).forEach((t: string) => usedAdminTagsLower.add(t.toLowerCase()));
          collectUsedSchemas(operation, usedAdminSchemas);
        } else {
          participantMethods[method] = operation;
          (operation.tags || []).forEach((t: string) => usedParticipantTagsLower.add(t.toLowerCase()));
          collectUsedSchemas(operation, usedParticipantSchemas);
        }
      });

      if (Object.keys(participantMethods).length > 0) {
        documentV1Participant.paths[cleanKey] = participantMethods;
      }

      if (Object.keys(adminMethods).length > 0) {
        documentV1Admin.paths[cleanKey] = adminMethods;
      }
    }
  });

  // Filter components (schemas)
  const docAllWithComponents = documentAll as OpenAPIObject & { components?: { schemas?: Record<string, unknown> }; tags?: Array<{ name: string }> };
  const allSchemas = docAllWithComponents.components?.schemas || {};
  documentV1Participant.components = {
    ...documentAll.components,
    schemas: Object.fromEntries(
      Object.entries(allSchemas).filter(([name]) => usedParticipantSchemas.has(name))
    )
  } as OpenAPIObject['components'] extends infer C ? C : never;

  documentV1Admin.components = {
    ...documentAll.components,
    schemas: Object.fromEntries(
      Object.entries(allSchemas).filter(([name]) => usedAdminSchemas.has(name))
    )
  } as OpenAPIObject['components'] extends infer C ? C : never;

  // Filter tags to only show those that have endpoints
  if (docAllWithComponents.tags) {
    documentV1Participant.tags = docAllWithComponents.tags.filter((t) => usedParticipantTagsLower.has(t.name.toLowerCase()));
    documentV1Admin.tags = docAllWithComponents.tags.filter((t) => usedAdminTagsLower.has(t.name.toLowerCase()));
  }

  // Setup specific endpoints to ensure -json files are served
  SwaggerModule.setup('docs/participant/v1', app, documentV1Participant, { swaggerOptions: { persistAuthorization: true } });
  SwaggerModule.setup('docs/admin/v1', app, documentV1Admin, { swaggerOptions: { persistAuthorization: true } });
  SwaggerModule.setup('docs/v2', app, documentV2, { swaggerOptions: { persistAuthorization: true } });

  // Legacy support/catch-all
  SwaggerModule.setup('docs/v1', app, documentV1Participant, { swaggerOptions: { persistAuthorization: true } });

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
      body { height: 100vh; display: flex; flex-direction: column; margin: 0; overflow: hidden; } 
      #header { padding: 12px 20px; background: #fff; border-bottom: 1px solid #e1e4e8; display: flex; align-items: center; justify-content: space-between; font-family: ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif; flex-shrink: 0; }
      #header h1 { margin: 0; font-size: 18px; font-weight: 600; color: #111827; }
      .header-actions { display: flex; align-items: center; gap: 16px; }
      .selector-group { display: flex; align-items: center; gap: 12px; font-size: 14px; }
      .classic-link { font-size: 14px; text-decoration: none; color: #2563eb; font-weight: 500; }
      .classic-link:hover { text-decoration: underline; }
      select { padding: 4px 8px; border-radius: 4px; border: 1px solid #d1d5db; background-color: #fff; font-size: 14px; color: #374151; cursor: pointer; }
      select:focus { outline: 2px solid #2563eb; border-color: #2563eb; }
      #docs-container { flex: 1; min-height: 0; position: relative; }
      elements-api { position: absolute; top: 0; left: 0; right: 0; bottom: 0; }

      /* COLLAPSE SCHEMAS HACK */
      /* Stoplight Elements uses a complex web component structure, 
         to collapse we target the section that usually holds schemas. */
      /* This is a bit brittle but should work for the current version of Elements */
      .sl-menu-section__header-title:contains("Schemas") + .sl-menu-section__children {
          display: none;
      }
      /* Since :contains is not standard CSS, we use a more generic approach 
         or just provide a button to toggle if we can't do it via CSS. */
      /* Better: Let's use a mutation observer in the script below to find and collapse the schemas section. */
    </style>
  </head>
  <body>
    <div id="header">
        <h1>YBB Platform API</h1>
        <div class="header-actions">
            <div class="selector-group">
                <label for="project-select">Project:</label>
                <select id="project-select" onchange="updateDocs()">
                    <option value="participant">Participant / Public</option>
                    <option value="admin">Admin Dashboard</option>
                </select>
            </div>
            <div class="selector-group">
                <label for="version-select">Version:</label>
                <select id="version-select" onchange="updateDocs()">
                    <option value="v1">v1 (Current)</option>
                    <option value="v2">v2 (Beta)</option>
                </select>
            </div>
            <a id="classic-link" href="/docs/participant/v1" class="classic-link" target="_blank">Classic Swagger UI &rarr;</a>
        </div>
    </div>

    <div id="docs-container">
        <elements-api
          id="docs"
          apiDescriptionUrl="/docs/participant/v1-json"
          router="hash"
          layout="sidebar"
        />
    </div>

    <script>
        function collapseSchemas() {
            // Find the SCHEMAS header. Stoplight Elements structure:
            // .sl-menu-section__header-title containing "Schemas"
            const headers = document.querySelectorAll('.sl-menu-section__header');
            headers.forEach(header => {
                const title = header.querySelector('.sl-menu-section__header-title');
                if (title && title.textContent.trim() === 'Schemas') {
                    const children = header.nextElementSibling;
                    if (children && children.classList.contains('sl-menu-section__children')) {
                        // Collapse by default
                        children.style.display = 'none';
                        // Add a click listener to the header to toggle
                        header.style.cursor = 'pointer';
                        header.onclick = function() {
                            children.style.display = children.style.display === 'none' ? 'block' : 'none';
                        };
                    }
                }
            });
        }

        function updateDocs() {
            const project = document.getElementById('project-select').value;
            const version = document.getElementById('version-select').value;
            let url = '';
            let classicUrl = '';
            
            if (version === 'v2') {
                url = '/docs/v2-json';
                classicUrl = '/docs/v2';
                document.getElementById('project-select').disabled = true;
            } else {
                url = '/docs/' + project + '/v1-json';
                classicUrl = '/docs/' + project + '/v1';
                document.getElementById('project-select').disabled = false;
            }
            
            // Force reload by re-creating the elements-api tag
            const container = document.getElementById('docs-container');
            container.innerHTML = '<div style="padding: 20px; color: #666;">Loading documentation...</div>';
            
            setTimeout(() => {
                container.innerHTML = '';
                const el = document.createElement('elements-api');
                el.id = 'docs';
                el.setAttribute('apiDescriptionUrl', url);
                el.setAttribute('router', 'hash');
                el.setAttribute('layout', 'sidebar');
                container.appendChild(el);

                // Re-apply collapse after load
                const observer = new MutationObserver((mutations, obs) => {
                    const schemaHeader = document.querySelector('.sl-menu-section__header');
                    if (schemaHeader) {
                        collapseSchemas();
                        obs.disconnect();
                    }
                });
                observer.observe(container, { childList: true, subtree: true });
            }, 50);

            document.getElementById('classic-link').href = classicUrl;
        }

        // Initial setup
        window.addEventListener('load', () => {
             const observer = new MutationObserver((mutations, obsList) => {
                if (document.querySelector('.sl-menu-section__header')) {
                    collapseSchemas();
                    obsList.disconnect();
                }
            });
            observer.observe(document.body, { childList: true, subtree: true });
        });
    </script>
  </body>
</html>`);
  });
}
