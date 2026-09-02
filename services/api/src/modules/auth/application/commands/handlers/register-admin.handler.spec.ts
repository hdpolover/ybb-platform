// src/modules/auth/application/commands/handlers/register-admin.handler.spec.ts

import { Test, TestingModule } from '@nestjs/testing';
import {
  BadRequestException,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { RegisterAdminHandler } from './register-admin.handler';
import { RegisterAdminCommand } from '../register-admin.command';
import { PrismaService } from '../../../../../shared/infrastructure/prisma/prisma.service';
import { UnitOfWork } from '../../../../../shared/infrastructure/database/unit-of-work.service';

describe('RegisterAdminHandler - public admin-registration hardening', () => {
  let handler: RegisterAdminHandler;

  const VALID_SECRET = 'correct-horse-battery-staple';

  const mockPrisma = {
    brand: { findUnique: jest.fn() },
    user: { findFirst: jest.fn() },
    adminRole: { findUnique: jest.fn(), create: jest.fn() },
  };

  // The transactional repo surface the handler actually touches.
  const tx = {
    user: { create: jest.fn() },
    admin: { update: jest.fn() },
    adminBrand: { create: jest.fn(), createMany: jest.fn() },
  };
  const repos = { tx, createAdmin: jest.fn() };
  const mockUnitOfWork = {
    execute: jest.fn((work: (r: typeof repos) => unknown) => work(repos)),
  };

  const mockJwtService = { sign: jest.fn(() => 'mock_token') };

  // Config is a real map so a test can flip one key without re-stubbing the rest.
  let config: Record<string, string>;
  const mockConfigService = {
    get: jest.fn((key: string, fallback?: string) => config[key] ?? fallback),
  };

  const command = () =>
    new RegisterAdminCommand(
      'new-admin@example.com',
      'hunter2hunter2',
      'New Admin',
      VALID_SECRET,
      'brand-1',
      'super_admin',
    );

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        RegisterAdminHandler,
        { provide: PrismaService, useValue: mockPrisma },
        { provide: UnitOfWork, useValue: mockUnitOfWork },
        { provide: JwtService, useValue: mockJwtService },
        { provide: ConfigService, useValue: mockConfigService },
      ],
    }).compile();

    handler = module.get(RegisterAdminHandler);
    jest.clearAllMocks();

    config = {
      ADMIN_REGISTRATION_ENABLED: 'true',
      ADMIN_REGISTRATION_SECRET: VALID_SECRET,
    };

    mockPrisma.brand.findUnique.mockResolvedValue({ id: 'brand-1', isActive: true });
    mockPrisma.user.findFirst.mockResolvedValue(null);
    // What the seed actually creates: a DISPLAY name, not the request slug.
    mockPrisma.adminRole.findUnique.mockResolvedValue({ id: 'role-1', name: 'Super Admin' });
    tx.user.create.mockResolvedValue({
      id: 'user-1',
      email: 'new-admin@example.com',
      brandId: 'brand-1',
      isActive: true,
      isOnboardingCompleted: false,
    });
    repos.createAdmin.mockResolvedValue({ id: 'admin-1' });
    tx.admin.update.mockResolvedValue({});
    tx.adminBrand.create.mockResolvedValue({});
  });

  it('404s when the route has not been explicitly enabled', async () => {
    // The flag is opt-in, absent everywhere by default. NotFound (not Forbidden)
    // so a disabled route is indistinguishable from a route that never existed.
    delete config.ADMIN_REGISTRATION_ENABLED;

    await expect(handler.execute(command())).rejects.toThrow(NotFoundException);
    expect(mockPrisma.brand.findUnique).not.toHaveBeenCalled();
  });

  it('404s when the flag is set to anything other than the literal "true"', async () => {
    config.ADMIN_REGISTRATION_ENABLED = '1';
    await expect(handler.execute(command())).rejects.toThrow(NotFoundException);
  });

  it('rejects a wrong secret without touching the database', async () => {
    const bad = new RegisterAdminCommand(
      'new-admin@example.com',
      'hunter2hunter2',
      'New Admin',
      'wrong-secret',
      'brand-1',
      'super_admin',
    );

    await expect(handler.execute(bad)).rejects.toThrow(ForbiddenException);
    expect(mockPrisma.user.findFirst).not.toHaveBeenCalled();
  });

  it('rejects a secret guess that is a prefix of the real one, and one far longer', async () => {
    // The compare is over SHA-256 digests precisely so these two shapes behave
    // identically: a prefix must not short-circuit early, and a length mismatch
    // must not make timingSafeEqual throw (that would surface as a 500 and leak
    // the secret's length).
    const guesses = [VALID_SECRET.slice(0, VALID_SECRET.length - 1), 'x'.repeat(4096), ''];

    for (const guess of guesses) {
      const attempt = new RegisterAdminCommand(
        'new-admin@example.com',
        'hunter2hunter2',
        'New Admin',
        guess,
        'brand-1',
        'super_admin',
      );
      await expect(handler.execute(attempt)).rejects.toThrow(ForbiddenException);
    }
  });

  it('rejects a role outside the allowlist instead of creating an AdminRole row for it', async () => {
    const attempt = new RegisterAdminCommand(
      'new-admin@example.com',
      'hunter2hunter2',
      'New Admin',
      VALID_SECRET,
      'brand-1',
      'god_mode',
    );

    await expect(handler.execute(attempt)).rejects.toThrow(BadRequestException);
    expect(mockPrisma.adminRole.create).not.toHaveBeenCalled();
    expect(mockPrisma.adminRole.findUnique).not.toHaveBeenCalled();
  });

  it('resolves the request slug to the SEEDED role row, not to the slug itself', async () => {
    // AdminRole.name is the unique key and seed-auth.ts writes 'Super Admin';
    // the body sends the 'super_admin' slug that admin_brands.role_in_brand
    // uses. Looking the slug up as a role name missed on every seeded
    // database, so the old auto-create branch fired every time and M136 then
    // linked that fabricated, permission-less row.
    await handler.execute(command());

    expect(mockPrisma.adminRole.findUnique).toHaveBeenCalledWith({
      where: { name: 'Super Admin' },
    });
  });

  it('400s instead of creating a role when the database has not been seeded', async () => {
    mockPrisma.adminRole.findUnique.mockResolvedValue(null);

    await expect(handler.execute(command())).rejects.toThrow(BadRequestException);
    expect(mockPrisma.adminRole.create).not.toHaveBeenCalled();
    expect(mockUnitOfWork.execute).not.toHaveBeenCalled();
  });

  it('never creates an AdminRole row, whatever the request asks for', async () => {
    for (const role of ['super_admin', 'owner', 'editor', 'news_writer', 'god_mode', 'constructor']) {
      jest.clearAllMocks();
      mockPrisma.brand.findUnique.mockResolvedValue({ id: 'brand-1', isActive: true });
      mockPrisma.user.findFirst.mockResolvedValue(null);
      mockPrisma.adminRole.findUnique.mockResolvedValue({ id: 'role-1', name: 'Super Admin' });
      tx.user.create.mockResolvedValue({
        id: 'user-1',
        email: 'new-admin@example.com',
        brandId: 'brand-1',
        isActive: true,
        isOnboardingCompleted: false,
      });
      repos.createAdmin.mockResolvedValue({ id: 'admin-1' });

      await handler
        .execute(
          new RegisterAdminCommand(
            'new-admin@example.com',
            'hunter2hunter2',
            'New Admin',
            VALID_SECRET,
            'brand-1',
            role,
          ),
        )
        .catch(() => undefined);

      expect(mockPrisma.adminRole.create).not.toHaveBeenCalled();
    }
  });

  it('links the resolved role id onto the created admin', async () => {
    // M136: roleId was never written, so admins.role_id stayed NULL and the
    // account lost every @Roles(SUPER_ADMIN) route on its next login.
    await handler.execute(command());

    expect(tx.admin.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 'admin-1' },
        data: expect.objectContaining({ roleId: 'role-1', accessLevel: 10 }),
      }),
    );
  });
});
