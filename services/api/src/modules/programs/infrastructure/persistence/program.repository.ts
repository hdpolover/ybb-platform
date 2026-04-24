import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { IProgramRepository, FindAllProgramsParams, FindAllProgramsResult } from '@core/interfaces/repositories/program.repository.interface';
import { Program } from '@core/entities/program.entity';
import { PrismaService } from '@shared/infrastructure/prisma/prisma.service';

@Injectable()
export class ProgramRepository implements IProgramRepository {
    constructor(private readonly prisma: PrismaService) { }

    async findAll(params: FindAllProgramsParams): Promise<FindAllProgramsResult> {
        const { brandId, year, isPublished, isActive, isVisibleToUsers, status, page = 1, limit = 10 } = params;

        const where: Prisma.ProgramWhereInput = {
            brandId,
            deletedAt: null,
        };

        if (year !== undefined) {
            where.year = year;
        }

        if (isPublished !== undefined) {
            where.isPublished = isPublished;
        }

        if (isActive !== undefined) {
            where.isActive = isActive;
        }

        if (status !== undefined) {
            where.status = status;
        }

        if (isVisibleToUsers !== undefined) {
            where.isVisibleToUsers = isVisibleToUsers;
        }

        const skip = (page - 1) * limit;

        const [total, programs] = await Promise.all([
            this.prisma.program.count({ where }),
            this.prisma.program.findMany({
                where,
                skip,
                take: limit,
                orderBy: [
                    { year: 'desc' },
                    { createdAt: 'desc' },
                ],
                include: {
                    brand: {
                        select: {
                            name: true,
                        },
                    },
                },
            }),
        ]);

        return {
            programs: programs.map(this.mapToEntity),
            total,
        };
    }

    async findById(id: string): Promise<Program | null> {
        const program = await this.prisma.program.findUnique({
            where: { id },
        });
        return program ? this.mapToEntity(program) : null;
    }

    async findBySlug(slug: string, brandId?: string): Promise<Program | null> {
        const where: Prisma.ProgramWhereInput = { slug };
        if (brandId) {
            where.brandId = brandId;
        }

        // If brandId is provided, we can use the compound unique index if it exists, 
        // but since slug is usually unique globally or we want to find by slug regardless, 
        // we might need to adjust. Assuming slug is unique per category or globally.
        // If slug is unique globally, just { slug } is enough.
        // If slug is unique per category, we need both.

        // Let's assume we search by slug and optionally filter by category if provided.
        // But findUnique requires a unique constraint.
        // If the schema has @@unique([brandId, slug]), we should use that if both are present.

        if (brandId) {
            const program = await this.prisma.program.findUnique({
                where: {
                    brandId_slug: {
                        brandId,
                        slug,
                    },
                },
            });
            return program ? this.mapToEntity(program) : null;
        } else {
            // Fallback to findFirst if we don't have the category ID, or if slug is unique globally
            const program = await this.prisma.program.findFirst({
                where: { slug },
            });
            return program ? this.mapToEntity(program) : null;
        }
    }

    async create(data: Partial<Program>): Promise<Program> {
        const program = await this.prisma.program.create({
            data: {
                brandId: data.brandId!,
                name: data.name!,
                slug: data.slug!,
                description: data.description,
                shortDescription: data.shortDescription,
                year: data.year!,
                startDate: data.startDate!,
                endDate: data.endDate!,
                applicationDeadline: data.applicationDeadline!,
                location: data.location,
                capacity: data.capacity,
                isPublished: data.isPublished ?? false,
                isVisibleToUsers: data.isVisibleToUsers ?? true,
                isActive: data.isActive ?? true,
                status: data.status ?? 'draft',
                thumbnailUrl: data.thumbnailUrl,
                bannerUrl: data.bannerUrl,
                videoUrl: data.videoUrl,
                requireEmailVerification: data.requireEmailVerification ?? true,
                currency: data.currency ?? 'USD',
                enableCurrencyConversion: data.enableCurrencyConversion ?? false,
                usdInIdr: data.usdInIdr as unknown as Prisma.Decimal,
                logoUrl: data.logoUrl,
                allowRegistration: data.allowRegistration ?? true,
                registrationOpenDate: data.registrationOpenDate,
                registrationCloseDate: data.registrationCloseDate,
                requirePayment: data.requirePayment ?? false,
                registrationFee: data.registrationFee as unknown as Prisma.Decimal, // Decimal handling
                requirementsDescription: data.requirementsDescription,
                benefitsDescription: data.benefitsDescription,
                termsAndConditions: data.termsAndConditions,
                previewChecklistItems: data.previewChecklistItems ?? [],
                metaTitle: data.metaTitle,
                metaDescription: data.metaDescription,
            },
            include: {
                brand: {
                    select: {
                        name: true,
                    },
                },
            },
        });
        return this.mapToEntity(program);
    }

    async update(id: string, data: Partial<Program>): Promise<Program> {
        const program = await this.prisma.program.update({
            where: { id },
            data: {
                brandId: data.brandId,
                name: data.name,
                slug: data.slug,
                description: data.description,
                shortDescription: data.shortDescription,
                programType: data.programType,
                programFormat: data.programFormat,
                year: data.year,
                startDate: data.startDate,
                endDate: data.endDate,
                applicationDeadline: data.applicationDeadline,
                location: data.location,
                capacity: data.capacity,
                isPublished: data.isPublished,
                isVisibleToUsers: data.isVisibleToUsers,
                isActive: data.isActive,
                status: data.status,
                thumbnailUrl: data.thumbnailUrl,
                bannerUrl: data.bannerUrl,
                videoUrl: data.videoUrl,
                requireEmailVerification: data.requireEmailVerification,
                currency: data.currency,
                enableCurrencyConversion: data.enableCurrencyConversion,
                usdInIdr: data.usdInIdr as unknown as Prisma.Decimal,
                logoUrl: data.logoUrl,
                allowRegistration: data.allowRegistration,
                registrationOpenDate: data.registrationOpenDate,
                registrationCloseDate: data.registrationCloseDate,
                requirePayment: data.requirePayment,
                registrationFee: data.registrationFee as unknown as Prisma.Decimal,
                requirementsDescription: data.requirementsDescription,
                benefitsDescription: data.benefitsDescription,
                termsAndConditions: data.termsAndConditions,
                previewChecklistItems: data.previewChecklistItems,
                metaTitle: data.metaTitle,
                metaDescription: data.metaDescription,
            },
            include: {
                brand: {
                    select: {
                        name: true,
                    },
                },
            },
        });
        return this.mapToEntity(program);
    }

    async delete(id: string): Promise<void> {
        await this.prisma.program.update({
            where: { id },
            data: {
                deletedAt: new Date(),
                isActive: false,
            },
        });
    }

    private mapToEntity(prismaEntity: Prisma.ProgramGetPayload<{ include: { brand: { select: { name: true } } } }> | Prisma.ProgramGetPayload<Record<string, never>>): Program {
        return new Program(
            prismaEntity.id,
            prismaEntity.brandId,
            prismaEntity.name,
            prismaEntity.slug,
            prismaEntity.description,
            prismaEntity.shortDescription,
            prismaEntity.programType,
            prismaEntity.programFormat,
            prismaEntity.year,
            prismaEntity.startDate,
            prismaEntity.endDate,
            prismaEntity.applicationDeadline,
            prismaEntity.location,
            prismaEntity.capacity,
            prismaEntity.isPublished,
            prismaEntity.isVisibleToUsers,
            prismaEntity.isActive,
            prismaEntity.status,
            prismaEntity.thumbnailUrl,
            prismaEntity.bannerUrl,
            prismaEntity.videoUrl,
            prismaEntity.requireEmailVerification,
            prismaEntity.currency,
            prismaEntity.enableCurrencyConversion,
            prismaEntity.usdInIdr ? Number(prismaEntity.usdInIdr) : null,
            prismaEntity.logoUrl,
            prismaEntity.allowRegistration,
            prismaEntity.registrationOpenDate,
            prismaEntity.registrationCloseDate,
            prismaEntity.requirePayment,
            prismaEntity.registrationFee ? Number(prismaEntity.registrationFee) : null,
            prismaEntity.requirementsDescription,
            prismaEntity.benefitsDescription,
            prismaEntity.termsAndConditions,
            prismaEntity.previewChecklistItems ?? [],
            prismaEntity.metaTitle,
            prismaEntity.metaDescription,
            prismaEntity.createdAt,
            prismaEntity.updatedAt,
            prismaEntity.deletedAt,
            (prismaEntity as Record<string, unknown> & { brand?: { name?: string } }).brand?.name ?? null,
        );
    }
}
