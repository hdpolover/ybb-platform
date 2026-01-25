import { Injectable } from '@nestjs/common';
import { ILandingPageStrategy } from './landing-page.strategy';
import { PrismaService } from '../../../shared/infrastructure/prisma/prisma.service';
import { ProgramCategory } from '@prisma/client';

@Injectable()
export class FaqsStrategy implements ILandingPageStrategy {
  constructor(private readonly prisma: PrismaService) {}

  // ILandingPageStrategy interface requirement
  async getData(category: ProgramCategory | null) {
      // Default behavior if called via standard interface: Return first page
      return this.getFaqs(category, 1, 10);
  }

  async getFaqs(
      category: ProgramCategory | null, 
      page: number = 1, 
      limit: number = 10,
      search?: string
  ) {
    const skip = (page - 1) * limit;

    // 1. Resolve Category context and Target Program
    // We want FAQs related to the "current" offering of this brand.
    const programWhere = category 
        ? { programCategoryId: category.id } 
        : {}; 

    // Find latest active program
    let targetProgram = await this.prisma.program.findFirst({
        where: {
            ...programWhere,
            isPublished: true,
            isActive: true,
        },
        orderBy: { startDate: 'desc' },
    });

    // Fallback to latest published program if no active one found
    if (!targetProgram) {
        targetProgram = await this.prisma.program.findFirst({
            where: {
                ...programWhere,
                isPublished: true,
            },
            orderBy: { startDate: 'desc' },
        });
    }

    if (!targetProgram && !category) {
         // If no category and no program found globally, return empty
         return {
            slug: 'faqs',
            title: 'Frequently Asked Questions',
            sections: []
        };
    }

    // 2. Fetch FAQs with pagination
    const whereCondition: any = {
        isActive: true, // Only show active FAQs
    };

    if (targetProgram) {
        whereCondition.programId = targetProgram.id;
    } else {
        // If we have category but NO programs, we can't really fetch program_faqs.
        // Unless we change logic to fetching across all programs in category?
        // But usually FAQs are program specific. 
        // If no program exists for a category, return empty.
        return {
            slug: 'faqs',
            title: 'Frequently Asked Questions',
            sections: [
                 {
                    type: 'hero',
                    content: {
                        title: 'Frequently Asked Questions',
                        subtitle: `Find answers to common questions about ${category?.name || 'us'}.`,
                        bg_image: category?.bannerUrl,
                    }
                },
                {
                    type: 'faq_list',
                    content: {
                        items: [],
                        pagination: { total: 0, page, limit, total_pages: 0 }
                    }
                }
            ]
        };
    }

    if (search) {
        whereCondition.OR = [
            { question: { contains: search, mode: 'insensitive' } },
            { answer: { contains: search, mode: 'insensitive' } },
        ];
    }

    const [faqs, total] = await Promise.all([
        this.prisma.programFaq.findMany({
            where: whereCondition,
            orderBy: { order: 'asc' },
            skip,
            take: Number(limit), // Ensure number
        }),
        this.prisma.programFaq.count({ where: whereCondition }),
    ]);

    // 3. Construct Sections

    // Hero Section
    const heroSection = {
        type: 'hero',
        content: {
            title: 'Frequently Asked Questions',
            subheadline: `Find answers to common questions about ${targetProgram?.name || category?.name}.`,
            bg_image: category?.bannerUrl || targetProgram?.bannerUrl, // Prefer category banner for generic pages, but program banner is also good
        }
    };

    // FAQ List Section
    const faqSection = {
        type: 'faq_list',
        content: {
            items: faqs.map(f => ({
                id: f.id,
                question: f.question,
                answer: f.answer,
                category: f.category
            })),
            pagination: {
                total,
                page: Number(page),
                limit: Number(limit),
                total_pages: Math.ceil(total / limit)
            }
        }
    };

    // Contact/CTA Section
    const ctaSection = {
        type: 'cta_support',
        content: {
            title: 'Still have questions?',
            description: 'Cannot find the answer you are looking for? Please contact our support team.',
            button_text: 'Contact Support',
            action_url: '/contact'
        }
    };

    return {
        slug: 'faqs',
        title: 'FAQs',
        sections: [heroSection, faqSection, ctaSection]
    };
  }
}
