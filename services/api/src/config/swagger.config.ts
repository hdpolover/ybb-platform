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

  // Setup Main Swagger UI with Dropdown
  SwaggerModule.setup('docs', app, documentV1, {
    explorer: true,
    swaggerOptions: {
      persistAuthorization: true,
      displayRequestDuration: true,
      docExpansion: 'none',
      filter: true,
      urls: [
        { url: '/docs/v1-json', name: 'v1' },
        { url: '/docs/v2-json', name: 'v2' },
      ],
      'urls.primaryName': 'v1', // Select v1 by default
    },
    customSiteTitle: 'YBB API Documentation',
  });
}
