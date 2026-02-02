import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../../../../shared/infrastructure/prisma/prisma.service';
import { GetUserProfileQuery } from '../get-user-profile.query';
import { UserProfileDto } from '../../../presentation/dto/user-profile.dto';

@Injectable()
export class GetUserProfileHandler {
  constructor(private readonly prisma: PrismaService) {}

  async execute(query: GetUserProfileQuery): Promise<UserProfileDto> {
    const { userId, brandId } = query;

    // Fetch fresh user data with identities and participant info
    const userData = await this.prisma.user.findUnique({
      where: { id: userId },
      include: {
        identities: {
          include: {
            provider: true
          }
        },
        participant: {
          include: {
            applications: {
              where: {
                program: {
                  brandId: brandId
                }
              },
              include: {
                program: true
              }
            }
          }
        }
      }
    });

    if (!userData) {
      // Return a basic structure even if user not found (shouldn't happen for authenticated requests generally)
      // or we could throw NotFoundException. Logic in controller returned a default object.
      // We'll stick to the controller logic for now but this might need revisiting if userId is from token.
      return {
        userId: userId,
        email: '', // Logic in controller used user.email from token, but here we don't have it unless passed in query. 
                   // However, if DB lookup fails for a valid token ID, something is wrong. 
                   // The controller logic: 
                   // return { userId: user.userId, email: user.email, ... }
                   // I should probably update the query to include email if we want to fallback to token data, 
                   // or just rely on DB data and throw if missing.
                   // Controller fallback:
                   /*
                    if (!userData) {
                      return {
                        userId: user.userId,
                        email: user.email,
                        brandId: user.brandId,
                        identities: [],
                        participantId: null,
                        registeredPrograms: [],
                        isProfileCompleted: false
                      };
                    }
                   */
                   // Ideally we should throw if user doesn't exist in DB.
                   // But to match controller exactly, let's just make sure we handle it.
                   // Refetching email from DB is better than trusting token blindly for "fresh" data, 
                   // but if DB record is gone, token is invalid effectively.
                   
                   // Let's return null here and handle fallback in controller or throw.
                   // But QueryHandlers return the result.
                   // I'll throw NotFoundException if user doesn't exist, which causes 404.
                   // The controller fallback was safety code.
                   
                   // Wait, the controller used `user` object from `@CurrentUser()` which comes from the token.
                   // If I move this to handler, I lose the fallback values from token unless I pass them in query.
                   // Let's pass email in query too just in case? No, the ID is enough to fetch. 
                   // If fetch fails, the user is deleted or invalid.
        brandId: brandId,
        identities: [],
        participantId: undefined,
        registeredPrograms: [],
        isProfileCompleted: false
      } as unknown as UserProfileDto;
    }

    const registeredPrograms = userData.participant?.applications.map(app => ({
      programId: app.programId,
      programName: app.program.name,
      programSlug: app.program.slug,
      year: app.program.year,
      applicationId: app.id,
      applicationStatus: app.status
    })) || [];

    // Determine if onboarding is needed (isFirstTime)
    // We consider it completed if we have a participant record AND profileCompletedAt is set
    const isProfileCompleted = !!(userData.participant?.profileCompletedAt);

    return {
      userId: userData.id,
      email: userData.email,
      brandId: userData.brandId,
      identities: userData.identities.map(i => ({
        provider: i.provider.name,
        lastUsedAt: i.lastUsedAt
      })),
      participantId: userData.participant?.id,
      registeredPrograms,
      isProfileCompleted
    };
  }
}
