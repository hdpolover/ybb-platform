import { prisma, log } from './utils';
import * as bcrypt from 'bcrypt';

export async function seedAuth() {
  log('🌱 Seeding Auth...');

  // 1. Auth Providers
  const providers = [
    { name: 'local', displayName: 'Email & Password', icon: 'email', buttonColor: '#4A5568', order: 1, isOAuth: false },
    { name: 'google', displayName: 'Google', icon: 'google', buttonColor: '#4285F4', order: 2, isOAuth: true },
    { name: 'facebook', displayName: 'Facebook', icon: 'facebook', buttonColor: '#1877F2', order: 3, isOAuth: true },
    { name: 'apple', displayName: 'Apple', icon: 'apple', buttonColor: '#000000', order: 4, isOAuth: true },
  ];

  for (const p of providers) {
    await prisma.authProvider.upsert({
      where: { name: p.name },
      update: {},
      create: {
        name: p.name,
        displayName: p.displayName,
        description: `Sign in with ${p.displayName}`,
        isActive: true,
        isOAuth: p.isOAuth,
        icon: p.icon,
        buttonColor: p.buttonColor,
        order: p.order,
      },
    });
  }
  log('✅ Auth Providers created');

  // 2. Roles
  const roles = [
    { name: 'Super Admin', permissions: ['*'] },
    { name: 'Admin', permissions: ['program:read', 'program:write'] },
    { name: 'Editor', permissions: ['content:write'] },
    { name: 'Participant', permissions: ['application:read', 'application:write'] }
  ];

  for (const r of roles) {
    await prisma.adminRole.upsert({
      where: { name: r.name },
      update: {},
      create: {
        name: r.name,
        isActive: true,
        permissions: r.permissions
      }
    });
  }
  log('✅ Roles created');
}
