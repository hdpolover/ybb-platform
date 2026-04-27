import { Injectable, Logger } from '@nestjs/common';
import { Prisma } from '@prisma/client';

type ApplicationExportPayload = Prisma.ParticipantApplicationGetPayload<{
    include: {
        participant: {
            select: {
                fullName: true;
                phoneNumber: true;
                originCountry: true;
                user: { select: { email: true } };
            };
        };
        program: { select: { name: true } };
    };
}>;
import { IQueryHandler, QueryHandler } from '@nestjs/cqrs';
import { StreamableFile } from '@nestjs/common';
import { ExportApplicationsQuery } from '../export-applications.query';
import { PrismaService } from '@shared/infrastructure/prisma/prisma.service';
import { stringify } from 'csv-stringify';
import { Readable } from 'stream';

@Injectable()
@QueryHandler(ExportApplicationsQuery)
export class ExportApplicationsHandler implements IQueryHandler<ExportApplicationsQuery> {
    private readonly logger = new Logger(ExportApplicationsHandler.name);

    constructor(
        private readonly prisma: PrismaService,
    ) { }

    private buildCreatedAtFilter(startDate?: string, endDate?: string): Prisma.DateTimeFilter | undefined {
        if (!startDate && !endDate) {
            return undefined;
        }

        const createdAt: Prisma.DateTimeFilter = {};

        if (startDate) {
            createdAt.gte = new Date(`${startDate}T00:00:00.000Z`);
        }

        if (endDate) {
            createdAt.lte = new Date(`${endDate}T23:59:59.999Z`);
        }

        return createdAt;
    }

    async execute(query: ExportApplicationsQuery): Promise<StreamableFile> {
        this.logger.log(`Exporting applications for brand ${query.brandId} program ${query.programId}`);

        const BATCH_SIZE = 1000;
        const prisma = this.prisma;

        // Create an async generator to stream data from DB
        async function* fetchData() {
            let offset = 0;
            let hasMore = true;

            const where: Prisma.ParticipantApplicationWhereInput = {
                program: {
                    brand: {
                        id: query.brandId,
                    },
                },
            };

            if (query.programId) where.programId = query.programId;
            if (query.status) where.status = query.status;
            if (query.search) {
                where.OR = [
                    { motivationLetter: { contains: query.search, mode: 'insensitive' } },
                    { achievements: { contains: query.search, mode: 'insensitive' } },
                    { experiences: { contains: query.search, mode: 'insensitive' } },
                    { participant: { fullName: { contains: query.search, mode: 'insensitive' } } },
                    { participant: { user: { email: { contains: query.search, mode: 'insensitive' } } } },
                ];
            }

            const createdAt = this.buildCreatedAtFilter(query.startDate, query.endDate);
            if (createdAt) {
                where.createdAt = createdAt;
            }

            while (hasMore) {
                const applications: ApplicationExportPayload[] = await prisma.participantApplication.findMany({
                    where,
                    take: BATCH_SIZE,
                    skip: offset,
                    orderBy: { submittedAt: 'desc' },
                    include: {
                        participant: {
                            select: {
                                fullName: true,
                                phoneNumber: true,
                                originCountry: true,
                                user: {
                                    select: {
                                        email: true
                                    }
                                }
                            }
                        },
                        program: {
                            select: {
                                name: true,
                            }
                        }
                    }
                });

                if (applications.length === 0) {
                    hasMore = false;
                    break;
                }

                for (const app of applications) {
                    yield {
                        id: app.id,
                        program: app.program?.name || 'N/A',
                        participantName: app.participant?.fullName || 'N/A',
                        email: app.participant?.user?.email || 'N/A',
                        country: app.participant?.originCountry || 'N/A',
                        phone: app.participant?.phoneNumber || 'N/A',
                        status: app.status,
                        category: app.applicationCategory,
                        appliedAt: new Date(app.createdAt).toISOString(),
                        submittedAt: app.submittedAt ? new Date(app.submittedAt).toISOString() : '',
                        registrationPaymentStatus: app.registrationPaymentStatus,
                        programPaymentStatus: app.programPaymentStatus,
                    };
                }

                offset += BATCH_SIZE;
                // Safety break to prevent infinite loops in dev
                if (offset > 100000) break;
            }
        }

        // Create a readable stream from the generator
        const dataStream = Readable.from(fetchData());

        // Pipe through simple CSV stringifier
        const csvStream = dataStream.pipe(stringify({
            header: true,
            columns: [
                { key: 'id', header: 'Application ID' },
                { key: 'program', header: 'Program' },
                { key: 'participantName', header: 'Participant Name' },
                { key: 'email', header: 'Email' },
                { key: 'country', header: 'Country' },
                { key: 'phone', header: 'Phone' },
                { key: 'status', header: 'Status' },
                { key: 'category', header: 'Category' },
                { key: 'appliedAt', header: 'Applied At' },
                { key: 'submittedAt', header: 'Submitted At' },
                { key: 'registrationPaymentStatus', header: 'Reg. Payment' },
                { key: 'programPaymentStatus', header: 'Prog. Payment' },
            ]
        }));

        return new StreamableFile(csvStream, {
            type: 'text/csv',
            disposition: `attachment; filename="applications_${query.brandId}_${new Date().toISOString()}.csv"`,
        });
    }
}
