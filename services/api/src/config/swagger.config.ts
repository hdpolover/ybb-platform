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
  const builder = new DocumentBuilder()
    .setTitle('YBB Platform API')
    .setDescription('YBB Platform API Gateway - Brand-Scoped Multi-Tenant System')
    .setVersion('1.0')
    .addBearerAuth();

  // Add all tags
  SWAGGER_TAGS.forEach(tag => {
    builder.addTag(tag.name, tag.description);
  });

  const config = builder.build();
  const document = SwaggerModule.createDocument(app, config);
  SwaggerModule.setup('docs', app, document);
}
