import { Injectable, Logger } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { IQueryHandler, QueryHandler } from '@nestjs/cqrs';
import { StreamableFile } from '@nestjs/common';
import { PassThrough } from 'stream';
import * as ExcelJS from 'exceljs';
import { ExportApplicationsQuery } from '../export-applications.query';
import { PrismaService } from '@shared/infrastructure/prisma/prisma.service';
import type { Column } from 'exceljs';
import { buildE164Phone, extractAndSanitizePhone, extractPhoneFromPersonalData } from '@shared/utils/phone-e164';
import { resolveApplicationBirthdate } from '@shared/utils/birthdate-resolution';
import { isRenderableEssayQuestion, coalesceStr } from '../../helpers/application-coalesce.helpers';
import { resolveCountryName } from '@shared/utils/country-groups';
import { ACTIVE_PARTICIPANT_WHERE } from '@shared/utils/active-participant.filter';
import { buildWibDateRangeFilter } from '@shared/utils/wib-time';

type ApplicationExportPayload = Prisma.ParticipantApplicationGetPayload<{
    select: {
        id: true;
        programId: true;
        status: true;
        applicationCategory: true;
        scoreTotal: true;
        scoreStatus: true;
        submittedAt: true;
        createdAt: true;
        registrationPaymentStatus: true;
        programPaymentStatus: true;
        personalData: true;
        essayAnswers: true;
        uploadedFiles: true;
        participant: {
            select: {
                fullName: true;
                phoneCountryCode: true;
                phoneNumber: true;
                originCountry: true;
                birthdate: true;
                // Dead columns in prod (0 rows populated) — kept only as the
                // fallback when personal_data has no institution/occupation.
                institution: true;
                occupation: true;
                user: { select: { email: true } };
            };
        };
        program: { select: { name: true } };
    };
}>;
type FormFieldPayload = Prisma.ApplicationFormFieldGetPayload<{
    select: {
        name: true;
        label: true;
        type: true;
        section: true;
        order: true;
        placeholder: true;
        validationRules: true;
    };
}>;
type EssayPayload = Prisma.ProgramEssayGetPayload<{
    select: { id: true; question: true; order: true };
}>;

/** Dynamic column derived from a program's application_form_fields row or a program_essays row. */
interface DynamicColumnDef {
    key: string;
    header: string;
    section: string;
    order: number;
}

/** Columns + lookup tables needed to render one export row. Resolved once per export, reused per row. */
interface DynamicColumnContext {
    dynamicDefs: DynamicColumnDef[];
    fieldsByKey: Map<string, FormFieldPayload>;
    essaysByKey: Map<string, EssayPayload>;
    keysByProgram: Map<string, Set<string>>;
}

type ExportRow = Record<string, string | number | null | undefined>;

const FILE_FIELD_TYPES = new Set(['file', 'upload', 'document', 'image', 'photo', 'avatar', 'resume']);

/** The select clause shared by both keyset-scan phases. */
const EXPORT_SELECT = {
    id: true,
    programId: true,
    status: true,
    applicationCategory: true,
    scoreTotal: true,
    scoreStatus: true,
    submittedAt: true,
    createdAt: true,
    registrationPaymentStatus: true,
    programPaymentStatus: true,
    personalData: true,
    essayAnswers: true,
    uploadedFiles: true,
    participant: {
        select: {
            fullName: true,
            phoneCountryCode: true,
            phoneNumber: true,
            originCountry: true,
            birthdate: true,
            institution: true,
            occupation: true,
            user: { select: { email: true } },
        },
    },
    program: { select: { name: true } },
} satisfies Prisma.ParticipantApplicationSelect;

/**
 * Field-kind column key. Prefixed so a field named e.g. "id" or "status"
 * cannot collide with the static core columns, and so the extraction loop
 * can tell field-derived columns apart from essay-derived ones.
 */
function fieldColumnKey(fieldName: string): string {
    return `f_${fieldName}`;
}

function essayColumnKey(essayId: string): string {
    return `e_${essayId}`;
}

/**
 * Returns true if a field's answer lives in essayAnswers rather than
 * personalData. Mirrors GetApplicationHandler.isEssaySectionField (kept
 * local here to avoid reaching into that handler's private method).
 */
function isEssaySectionField(field: FormFieldPayload): boolean {
    if (field.section === 'essay') return true;

    const normalizedName = field.name.toLowerCase().replace(/[^a-z0-9]/g, '');
    if (
        normalizedName.includes('essay')
        || normalizedName.includes('keyword')
        || normalizedName.includes('reference')
    ) {
        return true;
    }

    if (field.type !== 'textarea') return false;

    const normalizedLabel = field.label.trim().toLowerCase().replace(/\s+/g, ' ');
    const normalizedPlaceholder = (field.placeholder ?? '').trim().toLowerCase();
    const rules = field.validationRules;
    const hasWordLimitRule = Boolean(
        rules
        && typeof rules === 'object'
        && ['wordLimit', 'maxWords', 'minWords'].some((key) =>
            Object.prototype.hasOwnProperty.call(rules, key),
        ),
    );
    const looksLikeEssayPrompt =
        normalizedLabel.endsWith('?')
        || normalizedLabel.includes('word limit')
        || normalizedPlaceholder.includes('word limit');

    return hasWordLimitRule || looksLikeEssayPrompt;
}

/** Converts an unknown JSON value to a display string. Objects/arrays are JSON-serialised (e.g. multi-file upload maps). */
function coerceToString(value: unknown): string {
    if (value === null || value === undefined) return '';
    if (typeof value === 'string') return value;
    if (typeof value === 'number' || typeof value === 'boolean') return String(value);
    try {
        return JSON.stringify(value);
    } catch {
        return '';
    }
}

function extractFieldValue(
    field: FormFieldPayload,
    personalData: Record<string, unknown>,
    essayAnswers: Record<string, unknown>,
    uploadedFiles: Record<string, unknown>,
): string {
    const isEssay = isEssaySectionField(field);
    const isFile = FILE_FIELD_TYPES.has(field.type.toLowerCase());

    let raw: unknown;
    if (isEssay) {
        raw = essayAnswers[field.name] ?? personalData[field.name] ?? uploadedFiles[field.name];
    } else if (isFile) {
        raw = uploadedFiles[field.name] ?? personalData[field.name];
    } else {
        raw = personalData[field.name] ?? essayAnswers[field.name] ?? uploadedFiles[field.name];
    }

    return coerceToString(raw);
}

@Injectable()
@QueryHandler(ExportApplicationsQuery)
export class ExportApplicationsHandler implements IQueryHandler<ExportApplicationsQuery> {
    private readonly logger = new Logger(ExportApplicationsHandler.name);

    /** Rows fetched per keyset batch, for both the submitted and draft scan phases. */
    private static readonly BATCH_SIZE = 1000;

    constructor(
        private readonly prisma: PrismaService,
    ) { }

    /**
     * Loads application_form_fields + program_essays for every distinct
     * program in this export's result set (one query per table, not per
     * program/row) and builds the union of dynamic columns across them.
     *
     * Multi-program handling: each row only fills the columns that belong to
     * its own program (via `keysByProgram`); columns from other programs are
     * left blank for that row rather than silently misaligning values under
     * the wrong header.
     */
    private async buildDynamicColumns(programIds: string[]): Promise<{
        defs: DynamicColumnDef[];
        fieldsByKey: Map<string, FormFieldPayload>;
        essaysByKey: Map<string, EssayPayload>;
        keysByProgram: Map<string, Set<string>>;
    }> {
        const fieldsByKey = new Map<string, FormFieldPayload>();
        const essaysByKey = new Map<string, EssayPayload>();
        const keysByProgram = new Map<string, Set<string>>();
        const defs: DynamicColumnDef[] = [];
        const seenKeys = new Set<string>();

        if (programIds.length === 0) {
            return { defs, fieldsByKey, essaysByKey, keysByProgram };
        }

        const [allFields, allEssays] = await Promise.all([
            this.prisma.applicationFormField.findMany({
                where: { programId: { in: programIds }, isActive: true },
                select: {
                    programId: true,
                    name: true,
                    label: true,
                    type: true,
                    section: true,
                    order: true,
                    placeholder: true,
                    validationRules: true,
                },
                orderBy: [{ section: 'asc' }, { order: 'asc' }],
            }),
            this.prisma.programEssay.findMany({
                where: { programId: { in: programIds }, isActive: true },
                select: { programId: true, id: true, question: true, order: true },
                orderBy: { order: 'asc' },
            }),
        ]);

        const fieldsByProgram = new Map<string, typeof allFields>();
        for (const field of allFields) {
            if (field.section === 'preview') continue;
            const bucket = fieldsByProgram.get(field.programId) ?? [];
            bucket.push(field);
            fieldsByProgram.set(field.programId, bucket);
        }

        const essaysByProgram = new Map<string, typeof allEssays>();
        for (const essay of allEssays) {
            if (!isRenderableEssayQuestion(essay.question)) continue;
            const bucket = essaysByProgram.get(essay.programId) ?? [];
            bucket.push(essay);
            essaysByProgram.set(essay.programId, bucket);
        }

        for (const programId of programIds) {
            const keys = new Set<string>();

            for (const field of fieldsByProgram.get(programId) ?? []) {
                const key = fieldColumnKey(field.name);
                keys.add(key);
                if (!fieldsByKey.has(key)) fieldsByKey.set(key, field);
                if (!seenKeys.has(key)) {
                    seenKeys.add(key);
                    defs.push({ key, header: field.label, section: field.section, order: field.order });
                }
            }

            for (const essay of essaysByProgram.get(programId) ?? []) {
                const key = essayColumnKey(essay.id);
                keys.add(key);
                if (!essaysByKey.has(key)) essaysByKey.set(key, essay);
                if (!seenKeys.has(key)) {
                    seenKeys.add(key);
                    defs.push({
                        key,
                        header: essay.question.trim().replace(/\s+/g, ' '),
                        section: 'essay',
                        order: essay.order,
                    });
                }
            }

            keysByProgram.set(programId, keys);
        }

        defs.sort((a, b) => a.section.localeCompare(b.section) || a.order - b.order);

        return { defs, fieldsByKey, essaysByKey, keysByProgram };
    }

    /**
     * Builds the participantApplication where-clause from the query's
     * filters. Country/registrationPaymentStatus/programPaymentStatus mirror
     * ApplicationRepository.findByBrand's filter logic exactly (audit M116),
     * so an export always matches what the admin list view would show for
     * the same filters.
     */
    private buildWhere(query: ExportApplicationsQuery): Prisma.ParticipantApplicationWhereInput {
        const where: Prisma.ParticipantApplicationWhereInput = {
            // Deactivated/deleted accounts stay visible in admin views but
            // never leave the building in an export.
            participant: ACTIVE_PARTICIPANT_WHERE,
        };
        // brandId/programIds arrive already narrowed to the caller's admin scope
        // (see ApplicationsController.resolveScopedFilters). At least one of the
        // three filters below is always set, so an export is never platform-wide
        // for a brand- or program-scoped admin.
        if (query.brandId) where.program = { brand: { id: query.brandId } };
        if (query.programIds) where.programId = { in: query.programIds };
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
        if (query.country) {
            const andConditions = Array.isArray(where.AND)
                ? where.AND
                : where.AND
                    ? [where.AND]
                    : [];
            where.AND = [
                ...andConditions,
                {
                    OR: [
                        { participant: { originCountry: { contains: query.country, mode: 'insensitive' } } },
                        { participant: { nationality: { contains: query.country, mode: 'insensitive' } } },
                    ],
                },
            ];
        }
        if (query.registrationPaymentStatus) where.registrationPaymentStatus = query.registrationPaymentStatus;
        if (query.programPaymentStatus) where.programPaymentStatus = query.programPaymentStatus;
        const createdAt = buildWibDateRangeFilter(query.startDate, query.endDate);
        if (createdAt) where.createdAt = createdAt;

        return where;
    }

    /** Builds one export row from a fetched application, given the resolved dynamic-column context. */
    private buildRow(app: ApplicationExportPayload, ctx: DynamicColumnContext): ExportRow {
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

        // Dynamic columns: only fill the ones that belong to this
        // row's own program. A row from a program with no matching
        // field/essay leaves that column blank instead of showing a
        // value under an unrelated program's header.
        const personalData = (app.personalData ?? {}) as Record<string, unknown>;
        const essayAnswers = (app.essayAnswers ?? {}) as Record<string, unknown>;
        const uploadedFiles = (app.uploadedFiles ?? {}) as Record<string, unknown>;
        const applicableKeys = ctx.keysByProgram.get(app.programId);

        const dynamicValues: Record<string, string> = {};
        for (const def of ctx.dynamicDefs) {
            if (!applicableKeys?.has(def.key)) {
                dynamicValues[def.key] = '';
                continue;
            }
            const essay = ctx.essaysByKey.get(def.key);
            if (essay) {
                dynamicValues[def.key] = coerceToString(essayAnswers[essay.id]);
                continue;
            }
            const field = ctx.fieldsByKey.get(def.key);
            dynamicValues[def.key] = field
                ? extractFieldValue(field, personalData, essayAnswers, uploadedFiles)
                : '';
        }

        // Same resolver the admin detail view and LoA use: prefer the
        // date the applicant entered on the application form, falling
        // back to participants.birthdate only when it holds a real
        // (non-placeholder) date. Keeps all read paths in agreement.
        const resolvedBirthdate = resolveApplicationBirthdate(app.personalData, app.participant?.birthdate);

        // participants.institution/occupation are dead columns in prod
        // (0 rows populated) — personal_data is the real source, the
        // participant column is only a fallback for legacy rows.
        const institution = coalesceStr(personalData['institution']) ?? app.participant?.institution ?? '';
        const occupation = coalesceStr(personalData['occupation']) ?? app.participant?.occupation ?? '';

        // origin_country holds an ISO code ("ID"), which is unreadable in
        // a report. Resolve to the display name the analytics views use,
        // falling back to the personal_data nationality when the column
        // is empty.
        const country = resolveCountryName(
            app.participant?.originCountry,
            coalesceStr(personalData['nationality']),
        );

        return {
            id: app.id,
            program: app.program?.name ?? 'N/A',
            participantName: app.participant?.fullName ?? 'N/A',
            email: app.participant?.user?.email ?? 'N/A',
            country: country ?? 'N/A',
            institution,
            occupation,
            phone: phone.value,
            phoneValid: phone.isValid ? 'Yes' : 'No',
            dateOfBirth: resolvedBirthdate ? resolvedBirthdate.toISOString().slice(0, 10) : '',
            status: app.status,
            category: app.applicationCategory,
            appliedAt: new Date(app.createdAt).toISOString(),
            submittedAt: app.submittedAt ? new Date(app.submittedAt).toISOString() : '',
            registrationPaymentStatus: app.registrationPaymentStatus,
            programPaymentStatus: app.programPaymentStatus,
            scoreTotal: app.scoreTotal != null ? Number(app.scoreTotal) : '',
            scoreStatus: app.scoreStatus ?? '',
            ...dynamicValues,
        };
    }

    /**
     * Two-phase keyset scan over the export's applications, yielding rows
     * one at a time (no full-table buffering).
     *
     * OFFSET pagination (the previous approach) re-sorts on `submittedAt`,
     * which is NULL for every draft application and non-unique across
     * submitted ones — ties or NULLs straddling a batch boundary duplicate
     * or drop rows (audit M115). A keyset scan visits every row exactly
     * once regardless of ties/NULLs:
     *
     *  - Phase 1 walks rows with submittedAt IS NOT NULL, ordered
     *    (submittedAt DESC, id ASC), cursoring on the last row's
     *    (submittedAt, id) pair.
     *  - Phase 2 walks the NULL-submittedAt rows (drafts) as a distinct
     *    trailing group, ordered by id ASC, cursoring on the last id.
     */
    private async *streamRows(
        baseWhere: Prisma.ParticipantApplicationWhereInput,
        ctx: DynamicColumnContext,
    ): AsyncGenerator<ExportRow> {
        const BATCH_SIZE = ExportApplicationsHandler.BATCH_SIZE;

        // Phase 1 — submittedAt IS NOT NULL.
        let submittedCursor: { submittedAt: Date; id: string } | null = null;
        for (;;) {
            const where: Prisma.ParticipantApplicationWhereInput = submittedCursor
                ? {
                    AND: [
                        baseWhere,
                        { submittedAt: { not: null } },
                        {
                            OR: [
                                { submittedAt: { lt: submittedCursor.submittedAt } },
                                { submittedAt: submittedCursor.submittedAt, id: { gt: submittedCursor.id } },
                            ],
                        },
                    ],
                }
                : { ...baseWhere, submittedAt: { not: null } };

            const batch = (await this.prisma.participantApplication.findMany({
                where,
                take: BATCH_SIZE,
                orderBy: [{ submittedAt: 'desc' }, { id: 'asc' }],
                select: EXPORT_SELECT,
            })) as unknown as ApplicationExportPayload[];

            for (const app of batch) {
                yield this.buildRow(app, ctx);
            }

            if (batch.length < BATCH_SIZE) break;
            const last = batch[batch.length - 1];
            submittedCursor = { submittedAt: last.submittedAt as unknown as Date, id: last.id };
        }

        // Phase 2 — submittedAt IS NULL (drafts), as a distinct trailing group.
        let draftCursorId: string | null = null;
        for (;;) {
            const where: Prisma.ParticipantApplicationWhereInput = draftCursorId
                ? { AND: [baseWhere, { submittedAt: null }, { id: { gt: draftCursorId } }] }
                : { ...baseWhere, submittedAt: null };

            const batch = (await this.prisma.participantApplication.findMany({
                where,
                take: BATCH_SIZE,
                orderBy: [{ id: 'asc' }],
                select: EXPORT_SELECT,
            })) as unknown as ApplicationExportPayload[];

            for (const app of batch) {
                yield this.buildRow(app, ctx);
            }

            if (batch.length < BATCH_SIZE) break;
            draftCursorId = batch[batch.length - 1].id;
        }
    }

    private buildColumns(dynamicDefs: DynamicColumnDef[]): Partial<Column>[] {
        return [
            { header: 'Application ID', key: 'id', width: 36 },
            { header: 'Program', key: 'program', width: 28 },
            { header: 'Participant Name', key: 'participantName', width: 24 },
            { header: 'Email', key: 'email', width: 28 },
            { header: 'Country', key: 'country', width: 10 },
            { header: 'Institution', key: 'institution', width: 28 },
            { header: 'Occupation', key: 'occupation', width: 24 },
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
            ...dynamicDefs.map((def) => ({
                header: def.header,
                key: def.key,
                width: def.section === 'essay' ? 50 : 24,
            })),
        ];
    }

    async execute(query: ExportApplicationsQuery): Promise<StreamableFile> {
        this.logger.log(`Exporting applications for brand ${query.brandId} program ${query.programId}`);

        const where = this.buildWhere(query);

        // Resolve which program(s) this export actually spans before pulling
        // rows, so form-field/essay lookups run once per program (not once
        // per row/batch). groupBy (not findMany+distinct) avoids pulling
        // every matching row's programId into memory just to dedupe it
        // (audit M105).
        const programIdRows = await this.prisma.participantApplication.groupBy({
            by: ['programId'],
            where,
        });
        const programIds = programIdRows.map((r) => r.programId);
        const { defs: dynamicDefs, fieldsByKey, essaysByKey, keysByProgram } =
            await this.buildDynamicColumns(programIds);
        const ctx: DynamicColumnContext = { dynamicDefs, fieldsByKey, essaysByKey, keysByProgram };

        const columns = this.buildColumns(dynamicDefs);

        // Stream the workbook instead of buffering every row + the whole
        // xlsx file in memory (audit M105) — ExcelJS's WorkbookWriter
        // commits each row directly into a PassThrough as it's produced.
        const passThrough = new PassThrough();
        const workbook = new ExcelJS.stream.xlsx.WorkbookWriter({
            stream: passThrough,
            useStyles: true,
            useSharedStrings: false,
        });
        const worksheet = workbook.addWorksheet('Applications');
        worksheet.columns = columns;
        worksheet.getRow(1).font = { bold: true };

        // Fire-and-forget: write rows into the stream without blocking the
        // StreamableFile response from being returned; consumption of
        // `passThrough` drives backpressure normally through Nest's response
        // pipeline. Any error here must be surfaced, not swallowed.
        (async () => {
            try {
                for await (const row of this.streamRows(where, ctx)) {
                    worksheet.addRow(row).commit();
                }
                worksheet.commit();
                await workbook.commit();
            } catch (err) {
                this.logger.error(`Export stream failed: ${err instanceof Error ? err.message : String(err)}`);
                passThrough.destroy(err instanceof Error ? err : new Error(String(err)));
                return;
            }
            passThrough.end();
        })();

        return new StreamableFile(passThrough, {
            type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
            disposition: `attachment; filename="applications_${query.brandId ?? query.programId ?? 'scoped'}_${new Date().toISOString()}.xlsx"`,
        });
    }
}
