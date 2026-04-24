import { Injectable, NotFoundException } from '@nestjs/common';
import { ILandingPageStrategy } from './landing-page.strategy';
import { PrismaService } from '../../../shared/infrastructure/prisma/prisma.service';
import { CacheService } from '../../../shared/infrastructure/cache/cache.service';
import { CACHE_KEYS, CACHE_TTL } from '../../../shared/constants/cache-keys';
import { Brand } from '@prisma/client';

@Injectable()
export class ProgramsStrategy implements ILandingPageStrategy {
    constructor(
        private readonly prisma: PrismaService,
        private readonly cacheService: CacheService,
    ) { }

    async getData(brand: Brand | null) {
        if (!brand) {
            return { slug: 'programs', title: 'Our Programs', sections: [] };
        }

        // Check cache first
        const cacheKey = CACHE_KEYS.LANDING_PROGRAMS(brand.id);
        const cached = await this.cacheService.get(cacheKey);
        if (cached) {
            return cached;
        }

        // 1. Fetch Latest Active Program for this Brand
        let currentProgram = await this.prisma.program.findFirst({
            where: {
                brandId: brand.id,
                isPublished: true,
                isActive: true,
            },
            orderBy: { startDate: 'desc' }, // Latest start date
            include: {
                objectives: {
                    where: { isActive: true },
                    orderBy: { order: 'asc' }
                },
                subthemes: {
                    where: { isActive: true },
                    orderBy: { order: 'asc' }
                },
                resources: {
                    where: {
                        type: 'guide',
                        isActive: true
                    }
                },
                faqs: {
                    where: { isActive: true },
                    take: 5,
                    orderBy: { order: 'asc' }
                },
                timeline: {
                    where: { isActive: true },
                    orderBy: { order: 'asc' }
                },
                schedules: { // Fetch schedules for the Activity section
                    where: { isActive: true },
                    orderBy: { order: 'asc' }
                },
                pricingTiers: {
                    where: { isActive: true },
                    orderBy: { order: 'asc' }
                }
            }
        });

        // Fallback: If no active program, find the latest published one (even if closed/completed)
        if (!currentProgram) {
            currentProgram = await this.prisma.program.findFirst({
                where: {
                    brandId: brand.id,
                    isPublished: true,
                },
                orderBy: { startDate: 'desc' },
                include: {
                    objectives: { where: { isActive: true }, orderBy: { order: 'asc' } },
                    subthemes: { where: { isActive: true }, orderBy: { order: 'asc' } },
                    resources: { where: { type: 'guide', isActive: true } },
                    faqs: { where: { isActive: true }, take: 5, orderBy: { order: 'asc' } },
                    timeline: { where: { isActive: true }, orderBy: { order: 'asc' } },
                    schedules: { where: { isActive: true }, orderBy: { order: 'asc' } },
                    pricingTiers: { where: { isActive: true }, orderBy: { order: 'asc' } }
                }
            });
        }

        // 2. Fetch Previous Programs (Same Brand)
        const previousProgramsData = await this.prisma.program.findMany({
            where: {
                brandId: brand.id,
                id: { not: currentProgram?.id }, // Exclude current
                isPublished: true,
                // Logic: Either explicitly completed OR endDate in past
                OR: [
                    { status: 'completed' },
                    { endDate: { lt: new Date() } }
                ]
            },
            orderBy: { startDate: 'desc' },
            take: 4,
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

        // 3. Fetch Other Programs (Other Brands - Cross Promotion)
        const otherProgramsData = await this.prisma.program.findMany({
            where: {
                brandId: { not: brand.id },
                isPublished: true,
                // isActive: true, // Removed requirement for program to be active
                // endDate: { gt: new Date() } // Removed requirement for future end date
            },
            orderBy: { startDate: 'desc' }, // Latest first
            take: 3,
            distinct: ['brandId'], // One per brand to show variety
            select: {
                id: true,
                name: true,
                slug: true,
                thumbnailUrl: true,
                startDate: true,
                endDate: true,
                location: true,
                brand: {
                    select: {
                        name: true,
                        logoUrl: true
                    }
                }
            }
        });

        // 4. Fetch Additional Active Programs (Same Brand)
        const additionalProgramsData = await this.prisma.program.findMany({
            where: {
                brandId: brand.id,
                id: { not: currentProgram?.id },
                isPublished: true,
                isActive: true,
                endDate: { gt: new Date() }
            },
            orderBy: { startDate: 'asc' },
            select: {
                id: true,
                name: true,
                slug: true,
                thumbnailUrl: true,
                startDate: true,
                endDate: true,
                location: true,
                shortDescription: true,
                brand: {
                    select: {
                        name: true,
                        logoUrl: true
                    }
                }
            }
        });

        const sections: Record<string, unknown>[] = [];

        if (currentProgram) {
            // Section 1: Hero (Image + Title)
            sections.push({
                type: 'hero',
                content: {
                    id: currentProgram.id,
                    title: currentProgram.name,
                    subtitle: currentProgram.shortDescription || `${currentProgram.name} — International Youth Program`,
                    bg_image: currentProgram.bannerUrl,
                    thumbnail: currentProgram.thumbnailUrl,
                    status: currentProgram.status
                }
            });

            // Section 2: Program Details (Description, Theme, Subthemes, Summary)
            sections.push({
                type: 'program_overview',
                content: {
                    program_name: currentProgram.name,
                    program_slug: currentProgram.slug,
                    description: currentProgram.description,
                    theme: currentProgram.theme || currentProgram.shortDescription,
                    subthemes: currentProgram.subthemes.map(sub => ({
                        id: sub.id,
                        title: sub.name,
                        description: sub.description
                    })),

                    // Side Panel Data
                    location: currentProgram.location,
                    program_format: currentProgram.programFormat,
                    start_date: currentProgram.startDate,
                    end_date: currentProgram.endDate,
                    duration: `${Math.ceil((currentProgram.endDate.getTime() - currentProgram.startDate.getTime()) / (1000 * 60 * 60 * 24))} Days`,
                    guidebooks: currentProgram.resources.map(r => ({
                        label: `Read Guidebook (${r.title})`,
                        url: r.fileUrl
                    }))
                }
            });

            // Section 3: Registration/Pricing Types & Instructions
            // Logic to determine if registration is open
            const now = new Date();
            const isRegistrationOpen = currentProgram.isActive &&
                currentProgram.allowRegistration &&
                (!currentProgram.registrationOpenDate || currentProgram.registrationOpenDate <= now) &&
                (!currentProgram.registrationCloseDate || currentProgram.registrationCloseDate >= now);

            sections.push({
                type: 'registration_info',
                content: {
                    title: 'Choose Your Registration Type',
                    description: 'Read Important Payment & Selection Information',
                    status: isRegistrationOpen ? 'open' : 'closed',
                    registration_dates: {
                        open: currentProgram.registrationOpenDate,
                        close: currentProgram.registrationCloseDate
                    },
                    pricing_tiers: currentProgram.pricingTiers.map(tier => ({
                        id: tier.id,
                        name: tier.name,
                        description: tier.description,
                        price: tier.price,
                        currency: tier.currency,
                        benefits: tier.benefits,
                        fee_type: tier.feeType, // fully_funded, partial, etc.
                        allowed_categories: tier.allowedCategories // self_funded, etc.
                    })),
                    instructions: [
                        {
                            title: "Payment Schedule",
                            icon: "calendar",
                            text: "All participants pay program fees in scheduled batches over time - not as a single upfront payment"
                        },
                        {
                            title: "Selection Quota",
                            icon: "chart",
                            text: "Fully funded slots are limited and competitive based on qualifications and available funding."
                        },
                        {
                            title: "Fully Funded Process",
                            icon: "clipboard-check",
                            text: "Pay each batch as scheduled, complete essays and interviews, then get full reimbursement if selected."
                        },
                        {
                            title: "Self Funded Guarantee",
                            icon: "shield-check",
                            text: "Guaranteed participation without competitive selection - just follow payment schedule."
                        }
                    ]
                }
            });

            // Section 3b: Detailed Activities (Rundown)
            if (currentProgram.schedules && currentProgram.schedules.length > 0) {
                const startDate = new Date(currentProgram.startDate);

                sections.push({
                    type: 'program_activities',
                    content: {
                        title: `${currentProgram.name} Activity`,
                        subtitle: 'Detailed schedule of activities for this program',
                        items: currentProgram.schedules.map((schedule) => {
                            // Calculate Date: "Day N" logic
                            const scheduleDate = new Date(startDate);
                            const dayMatch = schedule.day.match(/Day (\d+)/i);
                            if (dayMatch) {
                                const dayOffset = parseInt(dayMatch[1]) - 1;
                                scheduleDate.setDate(startDate.getDate() + dayOffset);
                            }

                            // Parse Checkitems from Description
                            // Convention: Text description... \n[CHECKLIST]Item1,Item2
                            let description = schedule.description || '';
                            let checkItems: string[] = [];

                            if (description.includes('[CHECKLIST]')) {
                                const parts = description.split('[CHECKLIST]');
                                description = parts[0].trim();
                                checkItems = parts[1].split(',').map(s => s.trim());
                            }

                            // Duration Calc (Simple approx if HH:MM format used)
                            let duration = '';
                            if (schedule.startTime && schedule.endTime) {
                                // Assuming HH:MM format 24h
                                const [startH, startM] = schedule.startTime.split(':').map(Number);
                                const [endH, endM] = schedule.endTime.split(':').map(Number);
                                if (!isNaN(startH) && !isNaN(endH)) {
                                    const diffMins = (endH * 60 + endM) - (startH * 60 + startM);
                                    const diffHrs = Math.floor(diffMins / 60);
                                    const remMins = diffMins % 60;
                                    duration = `${diffHrs}h ${remMins}m`;
                                }
                            }

                            return {
                                day: schedule.day, // "Day 1"
                                title: schedule.activity, // "First Day: Arrival..."
                                date: scheduleDate,
                                time_range: `${schedule.startTime} - ${schedule.endTime}`,
                                duration: duration,
                                description: description,
                                checklist: checkItems
                            };
                        })
                    }
                });
            }

            // Section 4: Program Journey (Steps)
            // Using `program_timeline` but filtering or ordering specifically for this view
            sections.push({
                type: 'program_journey',
                content: {
                    title: 'What steps will you go through in this program?',
                    subtitle: 'Explore the step-by-step journey of our program—from registration to selection and participation.',
                    items: currentProgram.timeline.map((t, index) => ({
                        step_number: (index + 1).toString().padStart(2, '0'),
                        title: t.title,
                        description: t.description,
                        date_display: t.endDate
                            ? `${t.date.toLocaleDateString('en-US', { month: 'short', day: '2-digit', year: 'numeric' })} - ${t.endDate.toLocaleDateString('en-US', { month: 'short', day: '2-digit', year: 'numeric' })}`
                            : t.date.toLocaleDateString('en-US', { month: 'short', day: '2-digit', year: 'numeric' }),
                        // Assuming fees are stored in description for now or extended in schema later
                        // For the "Journey" view, description usually contains the fee details if relevant
                    }))
                }
            });

            // Section 5: Program Important Dates (Table Schedule)
            // Also using `program_timeline` but formatted as a table with Status indicators
            const today = new Date();
            sections.push({
                type: 'program_important_dates',
                content: {
                    title: 'Program Schedules',
                    subtitle: 'Important dates and deadlines for this program',
                    items: currentProgram.timeline.map(t => {
                        const startDate = new Date(t.date);
                        const endDate = t.endDate ? new Date(t.endDate) : startDate;

                        // Determine Status
                        let status = 'Upcoming';
                        if (today >= startDate && today <= endDate) {
                            status = 'Active';
                        } else if (today > endDate) {
                            status = 'Passed';
                        }

                        return {
                            date_display: t.endDate
                                ? `${t.date.toLocaleDateString('en-US', { month: 'short', day: '2-digit', year: 'numeric' })} - ${t.endDate.toLocaleDateString('en-US', { month: 'short', day: '2-digit', year: 'numeric' })}`
                                : t.date.toLocaleDateString('en-US', { month: 'short', day: '2-digit', year: 'numeric' }),
                            status: status,
                            name: t.title,
                            description: t.description,
                            is_active: status === 'Active'
                        };
                    })
                }
            });

            // Section 6: FAQs

            // Section 4: FAQs
            sections.push({
                type: 'program_faqs',
                content: {
                    title: 'Frequently Asked Questions',
                    items: currentProgram.faqs.map(f => ({
                        question: f.question,
                        answer: f.answer,
                        category: f.category
                    }))
                }
            });
        }

        // Section: Additional Programs (Active, same brand)
        if (additionalProgramsData.length > 0) {
            sections.push({
                type: 'additional_programs',
                content: {
                    title: 'More Active Programs',
                    items: additionalProgramsData.map(p => ({
                        id: p.id,
                        name: p.name,
                        slug: p.slug,
                        thumbnail: p.thumbnailUrl,
                        summary: p.shortDescription
                    }))
                }
            });
        }

        // Section 5: Previous Programs
        if (previousProgramsData.length > 0) {
            sections.push({
                type: 'previous_programs',
                content: {
                    title: `Previous ${brand.name} Programs`,
                    items: previousProgramsData.map(p => ({
                        id: p.id,
                        name: p.name,
                        slug: p.slug,
                        thumbnail: p.thumbnailUrl,
                        year: p.startDate.getFullYear(),
                        location: p.location
                    }))
                }
            });
        }

        // Section 6: Other Programs
        if (otherProgramsData.length > 0) {
            sections.push({
                type: 'other_programs',
                content: {
                    title: 'Other Programs',
                    items: otherProgramsData.map(p => ({
                        id: p.id,
                        name: p.name,
                        slug: p.slug,
                        thumbnail: p.thumbnailUrl,
                        brand_name: p.brand.name,
                        brand_logo: p.brand.logoUrl,
                        start_date: p.startDate,
                        location: p.location
                    }))
                }
            });
        }

        const result = {
            slug: 'programs',
            title: `${brand.name} Programs`,
            sections: sections,
        };

        // Cache the result for 1 hour
        await this.cacheService.set(cacheKey, result, CACHE_TTL.HOUR);

        return result;
    }

    async getProgramData(slug: string, brand: Brand | null) {
        // 1. Resolve Brand (Optional but good for validation context)
        const brandId = brand?.id;

        // Check cache first
        const cacheKey = CACHE_KEYS.LANDING_PROGRAM_DETAIL(brandId || 'default', slug);
        const cached = await this.cacheService.get(cacheKey);
        if (cached) {
            return cached;
        }

        // Fetch the program with all related data
        const program = await this.prisma.program.findFirst({
            where: {
                slug: slug,
                // If brand context provided, enforce it
                ...(brandId ? { brandId: brandId } : {}),
            },
            include: {
                brand: true,
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
                allowed_categories: tier.allowedCategories,
                icon: tier.icon,
                requirements: tier.requirements
            })),
        };

        // 4. Rundown (Program Schedules)
        // Grouping by day for better structure
        const schedulesByDay = program.schedules.reduce((acc: Record<string, unknown[]>, curr) => {
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

        // 6.5. Additional Active Programs (Same Brand, excluding current)
        const additionalProgramsData = await this.prisma.program.findMany({
            where: {
                brandId: program.brandId,
                id: { not: program.id },
                isPublished: true,
                isActive: true,
                endDate: { gt: new Date() }
            },
            orderBy: { startDate: 'asc' },
            select: {
                id: true,
                name: true,
                slug: true,
                thumbnailUrl: true,
                startDate: true,
                endDate: true,
                location: true,
                shortDescription: true,
            }
        });

        const additionalPrograms = {
            type: 'additional_programs',
            data: additionalProgramsData
        };

        // 7. Previous Programs (Same brand)
        const previousProgramsData = await this.prisma.program.findMany({
            where: {
                brandId: program.brandId,
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

        // 8. Other Programs (Ongoing, other brands if applicable, or same brand active)
        // Show programs from other brands to cross-pollinate traffic
        const otherProgramsData = await this.prisma.program.findMany({
            where: {
                brandId: { not: program.brandId },
                isPublished: true,
                // isActive: true // Relaxed constraints to show visibility of other brands
            },
            orderBy: { startDate: 'desc' },
            take: 3,
            distinct: ['brandId'], // Ensure variety of brands
            select: {
                id: true,
                name: true,
                slug: true,
                startDate: true,
                endDate: true,
                thumbnailUrl: true,
                location: true,
                brand: {
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

        const result = {
            slug: program.slug,
            title: program.name,
            sections: [
                heroSection,
                programDetails,
                registrationTypes,
                rundown,
                journey,
                schedules,
                additionalPrograms,
                previousPrograms,
                otherPrograms,
                faqs
            ],
        };

        // Cache the result for 1 hour
        await this.cacheService.set(cacheKey, result, CACHE_TTL.HOUR);

        return result;
    }
}
