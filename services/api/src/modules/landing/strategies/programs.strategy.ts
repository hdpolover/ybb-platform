import { Injectable, NotFoundException } from '@nestjs/common';
import { ILandingPageStrategy } from './landing-page.strategy';
import { PrismaService } from '../../../shared/infrastructure/prisma/prisma.service';
import { ProgramCategory } from '@prisma/client';

@Injectable()
export class ProgramsStrategy implements ILandingPageStrategy {
  constructor(private readonly prisma: PrismaService) {}

  async getData(category: ProgramCategory | null) {
    if (!category) {
        return { slug: 'programs', title: 'Our Programs', sections: [] };
    }

    // 2. Fetch Programs for this Category
    const programs = await this.prisma.program.findMany({
        where: {
            programCategoryId: category.id,
            isPublished: true,
            isActive: true,
        },
        orderBy: { startDate: 'desc' },
        select: {
            id: true,
            name: true,
            slug: true,
            description: true,
            shortDescription: true,
            thumbnailUrl: true,
            startDate: true,
            endDate: true,
            location: true,
        }
    });

    return {
      slug: 'programs',
      title: `${category.name} Programs`,
      sections: [
        {
          type: 'hero',
          content: {
            headline: `Discover ${category.name} Programs`,
            subheadline: category.description || 'Find the perfect program to accelerate your growth.',
            bg_image: category.bannerUrl,
          },
        },
        {
          type: 'program_list',
          data: programs.map(p => ({
              id: p.id,
              name: p.name,
              slug: p.slug,
              description: p.shortDescription || p.description,
              thumbnail: p.thumbnailUrl,
              startDate: p.startDate,
              endDate: p.endDate,
              location: p.location,
          })), 
        },
      ],
    };
  }

  async getProgramData(slug: string, category: ProgramCategory | null) {
    // 1. Resolve Category (Optional but good for validation context)
    const categoryId = category?.id;

    // Fetch the program with all related data
    const program = await this.prisma.program.findFirst({
      where: {
        slug: slug,
        // If brand context provided, enforce it
        ...(categoryId ? { programCategoryId: categoryId } : {}),
      },
      include: {
        programCategory: true,
        pricingTiers: {
          where: { isActive: true },
          orderBy: { order: 'asc' },
          include: {
              validityPeriods: true
          }
        },
        schedules: {
          where: { isActive: true },
          orderBy: { order: 'asc' },
        },
        timeline: { // using timeline for journey
          where: { isActive: true },
          orderBy: { order: 'asc' },
        },
        faqs: {
          where: { isActive: true },
          orderBy: { order: 'asc' },
        },
        // We'll treat program timelines as "rundown" or "journey" depending on data shape.
        // Assuming 'timeline' table is journey/roadmap.
        
        // For 'rundown' specifically, program_schedules seems most appropriate if detailed.
        
        // For theme/subtheme, currently not a distinct table in schema provided, 
        // might be in description or tags, or json fields. 
        // We will look for subthemes in program tags if available.
        tags: {
            include: {
                tag: true
            }
        },
      },
    });

    if (!program) {
      throw new NotFoundException(`Program not found`);
    }

    // 1. Hero Section
    const heroSection = {
      type: 'hero_section',
      content: {
        bg_image: program.bannerUrl,
        title: program.name,
        description: program.shortDescription || program.description,
      },
    };

    // 2. Program Details
    const programDetails = {
      type: 'program_details',
      content: {
        name: program.name,
        description: program.description,
        // Theme/Subtheme isn't explicitly in schema, using shortDescription or tags as fallback
        theme: program.shortDescription, 
        subthemes: program.tags.map(t => t.tag.name), 
        main_poster: program.thumbnailUrl, // or another field if poster is distinct
      },
    };

    // 3. Registration Types
    const registrationTypes = {
      type: 'registration_types',
      data: program.pricingTiers.map(tier => ({
        id: tier.id,
        name: tier.name,
        description: tier.description,
        price: tier.price,
        currency: tier.currency,
        benefits: tier.benefits,
        capacity: tier.capacity,
        sold_count: tier.soldCount,
        validity_periods: tier.validityPeriods.map(vp => ({
            start_date: vp.startDate,
            end_date: vp.endDate
        })),
        fee_type: tier.feeType,
        target: tier.target,
        icon: tier.icon,
        requirements: tier.requirements
      })),
    };

    // 4. Rundown (Program Schedules)
    // Grouping by day for better structure
    const schedulesByDay = program.schedules.reduce((acc, curr) => {
        const day = curr.day || 'Unscheduled';
        if (!acc[day]) acc[day] = [];
        acc[day].push({
            time: `${curr.startTime} - ${curr.endTime}`,
            activity: curr.activity,
            description: curr.description,
            location: curr.location,
            speaker: curr.speaker,
        });
        return acc;
    }, {});

    const rundown = {
      type: 'rundown',
      data: Object.entries(schedulesByDay).map(([day, activities]) => ({
          day,
          activities
      })),
    };

    // 5. Journey (Program Timeline)
    const journey = {
      type: 'journey',
      data: program.timeline.map(t => ({
        date: t.date,
        title: t.title,
        description: t.description,
        icon: t.icon,
      })),
    };

    // 6. Schedules (Simple list if needed separately, or duplicate of rundown)
    // The request separates rundown and schedules. Maybe "Schedules" refers to high level dates?
    // Using simple schedule data for now.
    const schedules = {
        type: 'schedules',
        data: program.schedules.map(p => ({
            day: p.day,
            activity: p.activity,
            time: `${p.startTime} - ${p.endTime}`
        }))
    };
    
    // 7. Previous Programs (Same brand)
    const previousProgramsData = await this.prisma.program.findMany({
        where: {
            programCategoryId: program.programCategoryId,
            id: { not: program.id },
            // Logic for "previous": end date in past
            endDate: { lt: new Date() },
            isPublished: true
        },
        orderBy: { startDate: 'desc' },
        take: 3,
        select: {
            id: true,
            name: true,
            slug: true,
            startDate: true,
            endDate: true,
            thumbnailUrl: true,
            location: true,
        }
    });

    const previousPrograms = {
        type: 'previous_programs',
        data: previousProgramsData
    };

    // 8. Other Programs (Ongoing, other brands/categories if applicable, or same brand active)
    // "other brand programs that are still active" implies finding programs where Category is different OR just active
    const otherProgramsData = await this.prisma.program.findMany({
        where: {
            // id: { not: program.id }, // don't show current
            // isActive: true,
            // endDate: { gt: new Date() }, // still active
            // OR logic if we want strictly OTHER brands:
             programCategoryId: { not: program.programCategoryId },
             isPublished: true,
             isActive: true
        },
        orderBy: { startDate: 'asc' },
        take: 3,
        select: {
            id: true,
            name: true,
            slug: true,
            startDate: true,
            endDate: true,
            thumbnailUrl: true,
            location: true,
            programCategory: {
                select: {
                    name: true,
                    logoUrl: true
                }
            }
        }
    });

    const otherPrograms = {
        type: 'other_programs',
        data: otherProgramsData
    };

    // 9. FAQs
    const faqs = {
        type: 'faqs',
        data: program.faqs.map(f => ({
            question: f.question,
            answer: f.answer,
            category: f.category
        }))
    };

    return {
      slug: program.slug,
      title: program.name,
      sections: [
        heroSection,
        programDetails,
        registrationTypes,
        rundown,
        journey,
        schedules,
        previousPrograms,
        otherPrograms,
        faqs
      ],
    };
  }
}
