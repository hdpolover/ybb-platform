// src/modules/auth/application/commands/handlers/logout.handler.spec.ts

import { LogoutHandler } from './logout.handler';
import { LogoutCommand } from '../logout.command';
import { TokenBlacklistService } from '../../../infrastructure/services/token-blacklist.service';
import { PrismaService } from '../../../../../shared/infrastructure/prisma/prisma.service';

describe('LogoutHandler - revoke one session, never all of them', () => {
  let handler: LogoutHandler;

  const prisma = { userSession: { updateMany: jest.fn() } };
  const blacklist = { blacklistToken: jest.fn() };

  const futureExp = () => Math.floor(Date.now() / 1000) + 3600;

  beforeEach(() => {
    jest.clearAllMocks();
    prisma.userSession.updateMany.mockResolvedValue({ count: 1 });
    handler = new LogoutHandler(
      blacklist as unknown as TokenBlacklistService,
      prisma as unknown as PrismaService,
    );
  });

  afterEach(() => jest.restoreAllMocks());

  it('revokes only the session the token names when a sid is present', async () => {
    await handler.execute(new LogoutCommand('user-1', 'jti-1', futureExp(), 'session-1'));

    expect(prisma.userSession.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ userId: 'user-1', sessionToken: 'session-1' }),
      }),
    );
  });

  it('revokes NOTHING when the token carries no sid', async () => {
    // The bug this guards: Prisma drops an undefined key from a where clause,
    // so { userId, sessionToken: undefined, revokedAt: null } silently became
    // "every live session this user has" and one logout signed them out of
    // every device. Legacy tokens minted before sid shipped still have none, so
    // the safe answer for them is to revoke nothing and let the access-token
    // blacklist plus the TTL do the work.
    await handler.execute(new LogoutCommand('user-1', 'jti-1', futureExp(), undefined));

    expect(prisma.userSession.updateMany).not.toHaveBeenCalled();
  });

  it('still blacklists the access token when there is no sid', async () => {
    await handler.execute(new LogoutCommand('user-1', 'jti-1', futureExp(), undefined));

    expect(blacklist.blacklistToken).toHaveBeenCalledWith('jti-1', expect.any(Number));
  });

  it('does not blacklist a token that has already expired', async () => {
    await handler.execute(
      new LogoutCommand('user-1', 'jti-1', Math.floor(Date.now() / 1000) - 60, 'session-1'),
    );

    expect(blacklist.blacklistToken).not.toHaveBeenCalled();
    expect(prisma.userSession.updateMany).toHaveBeenCalled();
  });
});
