// services/api/src/modules/auth/application/commands/handlers/admin-login.handler.spec.ts
import { UnauthorizedException } from '@nestjs/common';
import * as bcrypt from 'bcrypt';
import { AdminLoginHandler } from './admin-login.handler';
import { AdminLoginCommand } from '../admin-login.command';

describe('AdminLoginHandler - accounts with no usable password', () => {
  const baseUser = {
    id: 'u1', email: 'new.admin@ybb.org', isActive: true, failedLoginAttempts: 0, lockedUntil: null,
    admin: { id: 'a1', role: { isActive: true } },
  };
  const prisma = { user: { findFirst: jest.fn(), update: jest.fn() } };
  const jwt = { sign: jest.fn() };
  const metrics = { loginTotal: { inc: jest.fn() } };
  const handler = new AdminLoginHandler(prisma as never, jwt as never, { get: jest.fn() } as never, { logFailedLogin: jest.fn() } as never, metrics as never);
  const command = () => new AdminLoginCommand('new.admin@ybb.org', 'anything-at-all', '1.2.3.4', 'jest');

  beforeEach(() => jest.clearAllMocks());

  it('rejects a null password hash with a clean 401, never reaching bcrypt or issuing a token', async () => {
    prisma.user.findFirst.mockResolvedValue({ ...baseUser, passwordHash: null });
    const compare = jest.spyOn(bcrypt, 'compare');

    // L2: same message as a wrong password, so a pending invitee is not distinguishable
    await expect(handler.execute(command())).rejects.toThrow(new UnauthorizedException('Invalid credentials'));

    expect(compare).not.toHaveBeenCalled();
    expect(jwt.sign).not.toHaveBeenCalled();
    compare.mockRestore();
  });

  it('rejects an unusable (random) hash without throwing anything but 401', async () => {
    const unusable = await bcrypt.hash('x'.repeat(64), 4);
    prisma.user.findFirst.mockResolvedValue({ ...baseUser, passwordHash: unusable });
    prisma.user.update.mockResolvedValue({ failedLoginAttempts: 1 });

    await expect(handler.execute(command())).rejects.toBeInstanceOf(UnauthorizedException);
    expect(jwt.sign).not.toHaveBeenCalled();
  });
});
