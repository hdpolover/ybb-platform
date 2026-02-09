import { Injectable, UnauthorizedException } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../../../../shared/infrastructure/prisma/prisma.service';

export interface JwtPayload {
  sub: string;
  email: string;
  brandId: string;
  jti?: string; // JWT unique token ID for blacklisting
  exp?: number; // Token expiration timestamp
  roles?: string[]; // Roles from token
  adminId?: string; // Admin ID
}

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(
    private readonly configService: ConfigService,
    private readonly prisma: PrismaService,
  ) {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: configService.get<string>('JWT_SECRET'),
    });
  }

  async validate(payload: JwtPayload) {
    console.error('[JwtStrategy DEBUG] Validate payload:', JSON.stringify(payload));
    // Verify user still exists and is active
    const user = await this.prisma.user.findUnique({
      where: { id: payload.sub },
    });

    if (!user || !user.isActive) {
      throw new UnauthorizedException('User not found or inactive');
    }

    // Return user info to be attached to request object
    // Include jti and exp for token blacklisting support
    return {
      id: payload.sub, // Standardize on 'id'
      userId: payload.sub, // Keep for backward compatibility
      sub: payload.sub, // Keep for backward compatibility
      email: payload.email,
      brandId: payload.brandId,
      jti: payload.jti,
      exp: payload.exp,
      role: payload.roles || [], // Map roles to role for RolesGuard compatibility
      adminId: payload.adminId,
    };
  }
}

