import { Injectable, BadRequestException, ConflictException, NotFoundException } from '@nestjs/common';
import * as bcrypt from 'bcrypt';
import { LinkLocalIdentityCommand } from '../link-local-identity.command';
import { LinkLocalIdentityResponseDto } from '../../../presentation/dto/link-local-identity-response.dto';
import { PrismaService } from '../../../../../shared/infrastructure/prisma/prisma.service';

/**
 * Adds email & password sign-in to an already authenticated account.
 *
 * This used to be done by re-POSTing /v1/auth/register with the signed-in
 * user's own email, which meant an anonymous caller could reach the same code
 * path. Registration now rejects an existing email outright, so linking a
 * local identity lives here behind JwtAuthGuard and only ever touches the
 * caller's own user row.
 */
@Injectable()
export class LinkLocalIdentityHandler {
  constructor(private readonly prisma: PrismaService) { }

  async execute(command: LinkLocalIdentityCommand): Promise<LinkLocalIdentityResponseDto> {
    const localProvider = await this.prisma.authProvider.findUnique({
      where: { name: 'local' },
    });

    if (!localProvider || !localProvider.isActive) {
      throw new BadRequestException('Email & password sign-in is not available');
    }

    const user = await this.prisma.user.findFirst({
      where: { id: command.userId, deletedAt: null },
      include: { identities: true },
    });

    if (!user) {
      throw new NotFoundException('User not found');
    }

    if (user.identities.some(identity => identity.providerId === localProvider.id)) {
      throw new ConflictException(`User already has ${localProvider.displayName} authentication configured`);
    }

    const passwordHash = await bcrypt.hash(command.password, 10);
    const isPrimary = user.identities.length === 0;
    const lastUsedAt = new Date();

    // Identity row and password hash must land together — an identity without a
    // hash (or the reverse) leaves the account unable to sign in locally.
    let identity: { isPrimary: boolean; createdAt: Date };

    try {
      [identity] = await this.prisma.$transaction([
        this.prisma.userIdentity.create({
          data: {
            userId: user.id,
            brandId: user.brandId,
            providerId: localProvider.id,
            providerUserId: user.email,
            providerEmail: user.email,
            isPrimary,
            lastUsedAt,
          },
        }),
        this.prisma.user.update({
          where: { id: user.id },
          data: { passwordHash },
        }),
      ]);
    } catch (error) {
      // Two concurrent link requests race past the check above; the
      // (userId, providerId) unique index settles it. Same answer either way.
      if (error?.code === 'P2002') {
        throw new ConflictException(`User already has ${localProvider.displayName} authentication configured`);
      }
      throw error;
    }

    return {
      provider: localProvider.name,
      isPrimary: identity.isPrimary,
      linkedAt: identity.createdAt,
    };
  }
}
