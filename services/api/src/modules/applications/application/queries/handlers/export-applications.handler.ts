import { Injectable, Logger } from '@nestjs/common';
import { Prisma } from '@prisma/client';

type ApplicationExportPayload = Prisma.ParticipantApplicationGetPayload<{
    select: {
        id: true;
        status: true;
        applicationCategory: true;
        scoreTotal: true;
        scoreStatus: true;
        submittedAt: true;
        createdAt: true;
        registrationPaymentStatus: true;
        programPaymentStatus: true;
        personalData: true;
        participant: {
            select: {
                fullName: true;
                phoneCountryCode: true;
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
import { ExcelService } from '@shared/infrastructure/excel/excel.service';
import type { Column } from 'exceljs';
import { buildE164Phone, extractAndSanitizePhone, extractPhoneFromPersonalData } from '@shared/utils/phone-e164';

// The application form stores the participant's date of birth in the
// personal_data JSON (key differs per form generation). participants.birthdate
// is NOT a usable fallback: onboarding only asks for a birth year, so that
// column is always Jan 1 of the year.
function extractBirthdateFromPersonalData(personalData: unknown): string {
    if (!personalData || typeof personalData !== 'object') return '';
    const pd = personalData as Record<string, unknown>;
    const raw = pd.birthdate ?? pd.date_of_birth;
    return typeof raw === 'string' ? raw : '';
}

@Injectable()
@QueryHandler(ExportApplicationsQuery)
export class ExportApplicationsHandler implements IQueryHandler<ExportApplicationsQuery> {
    private readonly logger = new Logger(ExportApplicationsHandler.name);

    constructor(
        private readonly prisma: PrismaService,
        private readonly excelService: ExcelService,
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

        const where: Prisma.ParticipantApplicationWhereInput = {
            program: { brand: { id: query.brandId } },
        };
        if (query.programId) where.programId = query.programId;
        if (query.status) where.status = query.status;
        if (query.category) where.applicationCategory = query.category;
        if (query.scoreStatus) where.scoreStatus = query.scoreStatus;
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
        if (createdAt) where.createdAt = createdAt;

        const rows: Record<string, string | number | null | undefined>[] = [];
        let offset = 0;
        let hasMore = true;

        while (hasMore) {
            const applications: ApplicationExportPayload[] = await this.prisma.participantApplication.findMany({
                where,
                take: BATCH_SIZE,
                skip: offset,
                orderBy: { submittedAt: 'desc' },
                select: {
                    id: true,
                    status: true,
                    applicationCategory: true,
                    scoreTotal: true,
                    scoreStatus: true,
                    submittedAt: true,
                    createdAt: true,
                    registrationPaymentStatus: true,
                    programPaymentStatus: true,
                    personalData: true,
                    participant: {
                        select: {
                            fullName: true,
                            phoneCountryCode: true,
                            phoneNumber: true,
                            originCountry: true,
                            user: { select: { email: true } },
                        },
                    },
                    program: { select: { name: true } },
                }
            });

            if (applications.length === 0) {
                hasMore = false;
                break;
            }

            for (const app of applications) {
                // The application form's personal_data JSON is the source of
                // truth for phone; the participant columns are a legacy
                // fallback that is empty for nearly all prod rows.
                const phone = extractPhoneFromPersonalData(app.personalData)
                    ? extractAndSanitizePhone(app.personalData)
                    : {
                        value:
                            buildE164Phone(
                                app.participant?.phoneCountryCode,
                                app.participant?.phoneNumber,
                            ) ?? 'N/A',
                        isValid: false,
                    };

                rows.push({
                    id: app.id,
                    program: app.program?.name ?? 'N/A',
                    participantName: app.participant?.fullName ?? 'N/A',
                    email: app.participant?.user?.email ?? 'N/A',
                    country: app.participant?.originCountry ?? 'N/A',
                    phone: phone.value,
                    phoneValid: phone.isValid ? 'Yes' : 'No',
                    dateOfBirth: extractBirthdateFromPersonalData(app.personalData),
                    status: app.status,
                    category: app.applicationCategory,
                    appliedAt: new Date(app.createdAt).toISOString(),
                    submittedAt: app.submittedAt ? new Date(app.submittedAt).toISOString() : '',
                    registrationPaymentStatus: app.registrationPaymentStatus,
                    programPaymentStatus: app.programPaymentStatus,
                    scoreTotal: app.scoreTotal != null ? Number(app.scoreTotal) : '',
                    scoreStatus: app.scoreStatus ?? '',
                });
            }

            offset += BATCH_SIZE;
            // Safety break to prevent unbounded iteration
            if (offset > 100000) break;
        }

        const columns: Partial<Column>[] = [
            { header: 'Application ID', key: 'id', width: 36 },
            { header: 'Program', key: 'program', width: 28 },
            { header: 'Participant Name', key: 'participantName', width: 24 },
            { header: 'Email', key: 'email', width: 28 },
            { header: 'Country', key: 'country', width: 10 },
            { header: 'Phone', key: 'phone', width: 16 },
            { header: 'Phone Valid', key: 'phoneValid', width: 12 },
            { header: 'Date of Birth', key: 'dateOfBirth', width: 14 },
            { header: 'Status', key: 'status', width: 14 },
            { header: 'Category', key: 'category', width: 14 },
            { header: 'Applied At', key: 'appliedAt', width: 22 },
            { header: 'Submitted At', key: 'submittedAt', width: 22 },
            { header: 'Reg. Payment', key: 'registrationPaymentStatus', width: 14 },
            { header: 'Prog. Payment', key: 'programPaymentStatus', width: 14 },
            { header: 'Score Total', key: 'scoreTotal', width: 12 },
            { header: 'Score Status', key: 'scoreStatus', width: 16 },
        ];

        const buffer = await this.excelService.generateExcel(rows, columns, 'Applications');

        return new StreamableFile(buffer, {
            type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
            disposition: `attachment; filename="applications_${query.brandId}_${new Date().toISOString()}.xlsx"`,
        });
    }
}
