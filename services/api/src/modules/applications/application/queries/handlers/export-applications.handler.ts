import { Injectable, Inject, Logger } from '@nestjs/common';
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

    async execute(query: ExportApplicationsQuery): Promise<StreamableFile> {
        this.logger.log(`Exporting applications for brand ${query.brandId} program ${query.programId}`);

        const BATCH_SIZE = 1000;
        const prisma = this.prisma;

        // Create an async generator to stream data from DB
        async function* fetchData() {
            let offset = 0;
            let hasMore = true;

            const where: any = {
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
                ];
            }

            while (hasMore) {
                // Use any cast to avoid complex Prisma include typing issues
                const applications: any[] = await prisma.participantApplication.findMany({
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
                        submittedAt: app.submittedAt ? new Date(app.submittedAt).toISOString() : '',
                        registrationPaymentStatus: app.registrationPaymentStatus,
                        programPaymentStatus: app.programPaymentStatus,
                    };
                }

                offset += BATCH_SIZE;
                // Safety break to prevent infinite loops in dev
                if (offset > 100000) { }
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
