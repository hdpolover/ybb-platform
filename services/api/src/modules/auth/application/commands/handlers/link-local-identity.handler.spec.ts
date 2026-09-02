// src/modules/auth/application/commands/handlers/link-local-identity.handler.spec.ts

import { Test, TestingModule } from '@nestjs/testing';
import { ConflictException } from '@nestjs/common';
import * as bcrypt from 'bcrypt';
import { LinkLocalIdentityHandler } from './link-local-identity.handler';
import { LinkLocalIdentityCommand } from '../link-local-identity.command';
import { PrismaService } from '../../../../../shared/infrastructure/prisma/prisma.service';

describe('LinkLocalIdentityHandler', () => {
  let handler: LinkLocalIdentityHandler;

  const mockPrismaService = {
    authProvider: { findUnique: jest.fn() },
    user: { findFirst: jest.fn(), update: jest.fn() },
    userIdentity: { create: jest.fn() },
    $transaction: jest.fn(),
  };

  const localProvider = {
    id: 'provider-local',
    name: 'local',
    displayName: 'Email & Password',
    isActive: true,
  };

  const googleIdentity = { id: 'identity-1', providerId: 'provider-google' };

  const createdIdentity = {
    id: 'identity-2',
    isPrimary: false,
    createdAt: new Date('2026-09-02T10:00:00.000Z'),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        LinkLocalIdentityHandler,
        { provide: PrismaService, useValue: mockPrismaService },
      ],
    }).compile();

    handler = module.get<LinkLocalIdentityHandler>(LinkLocalIdentityHandler);

    jest.clearAllMocks();
    mockPrismaService.authProvider.findUnique.mockResolvedValue(localProvider);
    mockPrismaService.userIdentity.create.mockReturnValue('create-op');
    mockPrismaService.user.update.mockReturnValue('update-op');
    mockPrismaService.$transaction.mockResolvedValue([createdIdentity, {}]);
  });

  it('creates the local identity and password hash for the authenticated user', async () => {
    mockPrismaService.user.findFirst.mockResolvedValue({
      id: 'user-1',
      email: 'user@example.com',
      brandId: 'brand-1',
      identities: [googleIdentity],
    });

    const result = await handler.execute(new LinkLocalIdentityCommand('user-1', 'Passw0rd!'));

    expect(mockPrismaService.userIdentity.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          userId: 'user-1',
          brandId: 'brand-1',
          providerId: 'provider-local',
          providerUserId: 'user@example.com',
          providerEmail: 'user@example.com',
          isPrimary: false, // a google identity already exists
        }),
      }),
    );

    // Identity + password hash go out in a single transaction.
    expect(mockPrismaService.$transaction).toHaveBeenCalledTimes(1);
    expect(mockPrismaService.$transaction).toHaveBeenCalledWith(['create-op', 'update-op']);

    const passwordHash = mockPrismaService.user.update.mock.calls[0][0].data.passwordHash;
    await expect(bcrypt.compare('Passw0rd!', passwordHash)).resolves.toBe(true);
    expect(bcrypt.getRounds(passwordHash)).toBe(10);

    expect(result).toEqual({
      provider: 'local',
      isPrimary: false,
      linkedAt: createdIdentity.createdAt,
    });
  });

  it('rejects with 409 when the user already has local sign-in', async () => {
    mockPrismaService.user.findFirst.mockResolvedValue({
      id: 'user-1',
      email: 'user@example.com',
      brandId: 'brand-1',
      identities: [{ id: 'identity-3', providerId: 'provider-local' }],
    });

    await expect(
      handler.execute(new LinkLocalIdentityCommand('user-1', 'Passw0rd!')),
    ).rejects.toThrow(ConflictException);

    expect(mockPrismaService.$transaction).not.toHaveBeenCalled();
  });
});
