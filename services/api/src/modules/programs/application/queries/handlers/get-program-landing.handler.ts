import { IQueryHandler, QueryHandler } from '@nestjs/cqrs';
import { NotFoundException } from '@nestjs/common';
import { GetProgramLandingQuery } from '../get-program-landing.query';
import { ProgramLandingResponseDto } from '../../dto/program-landing.dto';
import { PrismaService } from '@shared/infrastructure/prisma/prisma.service';

@QueryHandler(GetProgramLandingQuery)
export class GetProgramLandingHandler implements IQueryHandler<GetProgramLandingQuery> {
  constructor(private readonly prisma: PrismaService) {}

  async execute(query: GetProgramLandingQuery): Promise<ProgramLandingResponseDto> {
    const { programId, newsLimit, awardsLimit } = query;

    // Verify program exists
    const program = await this.prisma.program.findUnique({
      where: { id: programId },
    });

    if (!program) {
      throw new NotFoundException('Program not found');
    }

    // The four content queries below are independent of each other (each only
    // depends on the existence check above), so they run concurrently instead
    // of as four sequential round trips.
    const [news, awards, scholarship, conference] = await Promise.all([
      // 1. News (Program Announcements)
      // Filter for categories like 'News', 'General' or null, avoiding internal announcements if needed.
      // Assuming category 'News' or 'General' is what we want on landing.
      // If category is null, we assume it's general news.
      this.prisma.programAnnouncement.findMany({
        where: {
          programId,
          isActive: true,
          // Optional: filter by category if enforced. For now, fetch all public ones.
          // category: { in: ['News', 'General', 'Update'] }
        },
        orderBy: { publishDate: 'desc' },
        take: newsLimit,
      }),

      // 2. Awards (Available Awards + Winners if any)
      // We want to show what awards are available, AND if there are past winners (maybe from previous iteration or current if announced).
      // For this endpoint, let's fetch the Award Definitions.
      // If the requirement asks for "Awardees", we would fetch ParticipantAward.
      // "News and Awards" usually implies "Updates about the program" and "Who won / What you can win".
      // I will return Awards with their Winners (recipients).
      //
      // recipients.application is a `select`, not an `include`: the mapper
      // below (mappedAwards) only ever reads participant.{fullName,
      // institution, profilePictureUrl, nationality} off it, never a scalar
      // of `application` itself, so pulling the full application row (5 JSON
      // columns) per recipient was pure waste.
      this.prisma.programAward.findMany({
        where: { programId, isActive: true },
        include: {
          recipients: {
            take: 3,
            orderBy: { awardedAt: 'desc' },
            include: {
              application: {
                select: {
                  participant: {
                    select: {
                      fullName: true,
                      institution: true,
                      profilePictureUrl: true,
                      nationality: true,
                    }
                  }
                }
              }
            }
          }
        },
        orderBy: { order: 'asc' },
        take: awardsLimit,
      }),

      // 3. Scholarship / Participation Info
      // This is likely the pricing tiers or specific scholarship info associated with 'Scholarship' category.
      // We'll fetch ProgramParticipationInfo.
      this.prisma.programParticipationInfo.findMany({
        where: { programId, isActive: true },
      }),

      // 4. Conference / Timeline
      // The "Conference" or "Summit" schedule.
      this.prisma.programTimeline.findMany({
        where: { programId, isActive: true },
        orderBy: { date: 'asc' },
        take: 5,
      }),
    ]);

    // Simplify the Award structure for the frontend if needed, or return as is.
    // I'll map the awards to include a flattened recipient list.
    const mappedAwards = awards.map(award => ({
      ...award,
      recipients: award.recipients.map(r => ({
        id: r.id,
        awardedAt: r.awardedAt,
        notes: r.notes,
        participant: {
          name: r.application.participant.fullName,
          institution: r.application.participant.institution,
          avatar: r.application.participant.profilePictureUrl,
          nationality: r.application.participant.nationality,
        }
      }))
    }));

    return {
      news,
      awards: mappedAwards,
      scholarship: scholarship as unknown as Record<string, unknown>,
      conference: conference as unknown as Record<string, unknown>,
      program: {
        id: program.id,
        title: program.name,
        videoUrl: program.videoUrl, // Main promo video
        startDate: program.startDate,
        endDate: program.endDate,
        status: program.status,
      }
    };
  }
}
