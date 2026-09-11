// services/api/src/modules/participants/presentation/ambassador-admin.controller.ts
import {
  Controller,
  Get,
  Post,
  Param,
  UseGuards,
  Query,
  Body,
  Patch,
  Delete,
  Req,
  ConflictException,
  NotFoundException,
  BadRequestException,
  ForbiddenException,
} from '@nestjs/common';
import { randomInt } from 'crypto';
import { ApiTags, ApiOperation, ApiBearerAuth, ApiQuery } from '@nestjs/swagger';
import { CommandBus, QueryBus } from '@nestjs/cqrs';
import { ConfigService } from '@nestjs/config';
import { JwtAuthGuard } from '@modules/auth/infrastructure/guards/jwt-auth.guard';
import { RolesGuard } from '@modules/auth/infrastructure/guards/roles.guard';
import { Roles } from '@modules/auth/application/decorators/roles.decorator';
import { UserRole } from '@core/entities/user.entity';
import { PrismaService } from '@shared/infrastructure/prisma/prisma.service';
import { RabbitMQProducerService } from '@shared/infrastructure/rabbitmq/rabbitmq-producer.service';
import {
  GetAmbassadorsListQuery,
  UpdateAmbassadorStatusCommand,
  GetAmbassadorReferralsQuery,
} from '../application/commands/ambassador-admin.commands';
import { DeleteAmbassadorCommand } from '../application/commands/delete-ambassador.command';
import { AuditTrail } from '@shared/decorators/audit-trail.decorator';
import { ChangeType, Prisma } from '@prisma/client';
import { createAmbassadorShareToken } from '../application/utils/ambassador-share-token.util';
import { Logger } from '@nestjs/common';
import {
  CreateAmbassadorAdminDto,
  UpdateAmbassadorAdminDto,
  AmbassadorReferralAnalyticsQueryDto,
  AmbassadorRecapQueryDto,
  AmbassadorRecapStage,
  AMBASSADOR_RECAP_STAGES,
} from './dto/ambassador.dto';
import { PrismaReadService } from '@shared/infrastructure/prisma/prisma-read.service';
import { CurrentUser, CurrentUserData } from '@shared/decorators/current-user.decorator';
import { assertAmbassadorAccess, assertAmbassadorCreateAccess, resolveAmbassadorProgramScope } from '../application/utils/ambassador-access.util';
import { buildWibDateRangeFilter, parseWibFilterDate, startOfWibMonth, addWibMonths, endOfWibDay, wibMonthKey } from '@shared/utils/wib-time';

// Maps the recap's `stage` query param to the ambassador_referrals column that
// timestamps it. A hardcoded lookup, not string interpolation of the query
// param itself — `stage` is user input and this map is what stands between it
// and a raw SQL identifier in getRecap() below. Column names (snake_case),
// not Prisma field names, because they are spliced into $queryRaw.
const AMBASSADOR_RECAP_STAGE_COLUMNS: Record<AmbassadorRecapStage, string> = {
  referred: 'referred_at',
  registered: 'registered_at',
  applied: 'applied_at',
  accepted: 'accepted_at',
  completed: 'completed_at',
};

interface AmbassadorRecapMonth {
  key: string;
  label: string;
}

interface AmbassadorRecapSqlRow {
  ambassadorId: string;
  ambassadorName: string;
  referralCode: string;
  monthKey: string;
  count: number;
}

interface AmbassadorRecapRow {
  ambassadorId: string;
  ambassadorName: string;
  referralCode: string;
  counts: Record<string, number>;
  total: number;
}

interface AmbassadorRecapResponse {
  stage: AmbassadorRecapStage;
  months: AmbassadorRecapMonth[];
  rows: AmbassadorRecapRow[];
  totals: { byMonth: Record<string, number>; total: number };
}

@ApiTags('Ambassadors')
@Controller('admin/ambassadors')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(UserRole.ADMIN, UserRole.SUPER_ADMIN)
@ApiBearerAuth()
export class AmbassadorAdminController {
  private readonly logger = new Logger(AmbassadorAdminController.name);

  constructor(
    private readonly queryBus: QueryBus,
    private readonly commandBus: CommandBus,
    private readonly prisma: PrismaService,
    private readonly rabbitMQProducerService: RabbitMQProducerService,
    private readonly configService: ConfigService,
    private readonly prismaRead: PrismaReadService,
  ) { }

  // gender is optional, but when present it must match the Prisma Gender enum
  // (male | female). Guard so an invalid value returns a clean 400 instead of a
  // raw PrismaClientValidationError 500.
  private assertValidGender(gender?: string): void {
    const allowedGenders = ['male', 'female'];
    if (gender && !allowedGenders.includes(gender)) {
      throw new BadRequestException(`gender must be one of: ${allowedGenders.join(', ')}`);
    }
  }

  @Get()
  @ApiOperation({ summary: 'List all ambassadors (Admin)' })
  @ApiQuery({ name: 'programId', required: false })
  @ApiQuery({ name: 'search', required: false })
  @ApiQuery({ name: 'page', required: false })
  @ApiQuery({ name: 'limit', required: false })
  @ApiQuery({ name: 'sortBy', required: false })
  @ApiQuery({ name: 'sortOrder', required: false })
  async findAll(
    @CurrentUser() actor: CurrentUserData,
    @Query('programId') programId?: string,
    @Query('search') search?: string,
    @Query('page') page: number = 1,
    @Query('limit') limit: number = 20,
    @Query('sortBy') sortBy?: string,
    @Query('sortOrder') sortOrder?: string,
  ) {
    // The scope is resolved here but APPLIED in the handler: programId may be a
    // slug, and the handler is where that is resolved.
    const allowedProgramIds = await resolveAmbassadorProgramScope(this.prismaRead, actor);
    return this.queryBus.execute(
      new GetAmbassadorsListQuery(programId, search, Number(page), Number(limit), sortBy, sortOrder, allowedProgramIds),
    );
  }

  // Builds the ordered list of WIB calendar months spanning [gte, lte],
  // inclusive of both ends. `months` in the recap response is this list's
  // {key, label} pairs, independent of how many referrals actually landed in
  // each one — that independence is what makes a fully-zero month show up
  // as a real 0 column instead of silently vanishing.
  private buildRecapMonths(gte: Date, lte: Date): AmbassadorRecapMonth[] {
    const months: AmbassadorRecapMonth[] = [];
    let cursor = startOfWibMonth(gte);
    const end = startOfWibMonth(lte);
    while (cursor.getTime() <= end.getTime()) {
      const key = wibMonthKey(cursor);
      const [year, month] = key.split('-').map(Number);
      const label = new Date(Date.UTC(year, month - 1, 1)).toLocaleString('en-US', {
        month: 'long',
        year: 'numeric',
        timeZone: 'UTC',
      });
      months.push({ key, label });
      cursor = addWibMonths(cursor, 1);
    }
    return months;
  }

  // Reshapes the flat (ambassador x month) SQL rows into the recap's
  // per-ambassador shape and rolls up totals. The SQL query already
  // CROSS JOINs every scoped ambassador against every requested month (see
  // getRecap()), so every (ambassadorId, monthKey) pair this loop needs is
  // guaranteed to be present — no zero-filling has to happen here.
  private buildRecapResponse(
    stage: AmbassadorRecapStage,
    months: AmbassadorRecapMonth[],
    sqlRows: AmbassadorRecapSqlRow[],
  ): AmbassadorRecapResponse {
    const rowsByAmbassador = new Map<string, AmbassadorRecapRow>();
    const byMonth: Record<string, number> = {};
    months.forEach((month) => { byMonth[month.key] = 0; });
    let grandTotal = 0;

    sqlRows.forEach((sqlRow) => {
      const row = rowsByAmbassador.get(sqlRow.ambassadorId) ?? {
        ambassadorId: sqlRow.ambassadorId,
        ambassadorName: sqlRow.ambassadorName,
        referralCode: sqlRow.referralCode,
        counts: {},
        total: 0,
      };
      row.counts[sqlRow.monthKey] = sqlRow.count;
      row.total += sqlRow.count;
      rowsByAmbassador.set(sqlRow.ambassadorId, row);

      byMonth[sqlRow.monthKey] = (byMonth[sqlRow.monthKey] ?? 0) + sqlRow.count;
      grandTotal += sqlRow.count;
    });

    return {
      stage,
      months,
      rows: Array.from(rowsByAmbassador.values()).sort((a, b) => a.ambassadorName.localeCompare(b.ambassadorName)),
      totals: { byMonth, total: grandTotal },
    };
  }

  @Get('recap')
  @ApiOperation({ summary: 'Monthly affiliate recap: one row per ambassador, one column per month (Admin)' })
  @ApiQuery({ name: 'programId', required: true, description: 'Program id or slug' })
  @ApiQuery({ name: 'stage', required: false, enum: AMBASSADOR_RECAP_STAGES })
  @ApiQuery({ name: 'from', required: false, description: 'Start of the recap window (WIB calendar day)' })
  @ApiQuery({ name: 'to', required: false, description: 'End of the recap window (WIB calendar day, inclusive)' })
  async getRecap(
    @CurrentUser() actor: CurrentUserData,
    @Query() query: AmbassadorRecapQueryDto,
  ): Promise<AmbassadorRecapResponse> {
    // Same cross-field check as findOne() below: a class-validator decorator
    // on either field alone can't see its sibling's value, so from > to is
    // hand-checked here rather than declared on the DTO.
    if (query.from && query.to) {
      const fromInstant = parseWibFilterDate(query.from);
      const toInstant = parseWibFilterDate(query.to);
      if (fromInstant.getTime() > toInstant.getTime()) {
        throw new BadRequestException('from must not be later than to');
      }
    }

    // programId may be a slug or a uuid, exactly like findAll() above —
    // resolved the same way so the two admin ambassador endpoints agree on
    // what a given programId string means.
    const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(query.programId);
    let resolvedProgramId: string;
    if (isUuid) {
      resolvedProgramId = query.programId;
    } else {
      const program = await this.prismaRead.program.findFirst({ where: { slug: query.programId }, select: { id: true } });
      if (!program) throw new NotFoundException('Program not found');
      resolvedProgramId = program.id;
    }

    // Authorization — the single most important check on this route. An
    // explicit programId is resolved above and checked against the caller's
    // scope BEFORE any recap data is touched, the same way findAll() guards
    // its own explicit-programId branch: without this, a program-scoped
    // admin could read another programme's affiliate performance just by
    // naming it in the query string.
    const allowedProgramIds = await resolveAmbassadorProgramScope(this.prismaRead, actor);
    if (allowedProgramIds !== null && !allowedProgramIds.includes(resolvedProgramId)) {
      throw new ForbiddenException('You do not have access to this program.');
    }

    const stage: AmbassadorRecapStage = query.stage ?? 'applied';
    const stageColumn = AMBASSADOR_RECAP_STAGE_COLUMNS[stage];

    const now = new Date();
    // Default window: the last 6 WIB calendar months, ending with the
    // current one. `to` defaults to "now" rather than the literal end of the
    // current month — indistinguishable in the data (nothing has a future
    // timestamp) but keeps `lte` honest about what was actually scanned.
    const gte = query.from ? parseWibFilterDate(query.from) : startOfWibMonth(addWibMonths(now, -5));
    const lte = query.to ? endOfWibDay(parseWibFilterDate(query.to)) : endOfWibDay(now);

    const months = this.buildRecapMonths(gte, lte);
    const monthKeys = months.map((month) => month.key);

    // One grouped query, not a per-ambassador fan-out (this codebase has a
    // documented history of exactly that mistake). $queryRaw is used instead
    // of the Prisma query builder because the builder has no groupBy-by-
    // WIB-month primitive and no way to CROSS JOIN a synthetic month list
    // against ambassadors. $queryRaw bypasses the soft-delete extension in
    // prisma.service.ts entirely, so deleted_at IS NULL is spelled out by
    // hand for both tables rather than relied on implicitly. `stageColumn`
    // is spliced in via Prisma.raw, but it can only ever be one of the 5
    // hardcoded values above — never the raw `stage` query param.
    const sqlRows = await this.prismaRead.$queryRaw<AmbassadorRecapSqlRow[]>`
      WITH months(month_key) AS (
        SELECT unnest(${monthKeys}::text[])
      ),
      scoped_ambassadors AS (
        -- Who belongs on this programme's recap, from BOTH directions.
        --
        -- Ambassador.programId is only the ambassador's HOME programme. Its
        -- schema doc comment is explicit that a brand-wide code produces a
        -- referral row per programme a participant applies to, and that every
        -- per-programme read must key on referral.programId, never on
        -- ambassador.programId. Selecting rows by home programme alone would
        -- therefore silently drop an ambassador based elsewhere in the brand
        -- who brought participants INTO this programme: their referrals are
        -- attributed here and counted nowhere. Production happens to have zero
        -- cross-programme referrals today, so that is latent rather than live
        -- — which is exactly why it would have gone unnoticed until a recap
        -- quietly under-reported a partner.
        --
        -- So: ambassadors whose home programme is this one (they belong on the
        -- recap at zero even if idle — an absent row reads as "not checked",
        -- a 0 reads as "none"), UNION any ambassador with a referral actually
        -- attributed to this programme.
        SELECT id, full_name, referral_code
        FROM ambassadors
        WHERE program_id = ${resolvedProgramId}::uuid AND deleted_at IS NULL
        UNION
        SELECT a.id, a.full_name, a.referral_code
        FROM ambassadors a
        WHERE a.deleted_at IS NULL
          AND EXISTS (
            SELECT 1
            FROM ambassador_referrals r
            WHERE r.ambassador_id = a.id
              AND r.program_id = ${resolvedProgramId}::uuid
              AND r.deleted_at IS NULL
          )
      ),
      matched_referrals AS (
        -- Stage-REACHED counts, mirroring findOne()'s reachedCounts below: a
        -- referral counts in the month its OWN stage timestamp falls in, not
        -- the month matching its current status. referral.programId (not
        -- ambassador.programId) is what a referral is actually attributed
        -- to, so it — not the ambassador's home programme — is what's
        -- filtered here.
        SELECT
          ambassador_id,
          to_char(date_trunc('month', ${Prisma.raw(stageColumn)} + interval '7 hours'), 'YYYY-MM') AS month_key,
          COUNT(*)::int AS cnt
        FROM ambassador_referrals
        WHERE program_id = ${resolvedProgramId}::uuid
          AND deleted_at IS NULL
          AND ${Prisma.raw(stageColumn)} IS NOT NULL
          AND ${Prisma.raw(stageColumn)} >= ${gte}
          AND ${Prisma.raw(stageColumn)} <= ${lte}
        GROUP BY ambassador_id, month_key
      )
      SELECT
        a.id AS "ambassadorId",
        a.full_name AS "ambassadorName",
        a.referral_code AS "referralCode",
        m.month_key AS "monthKey",
        COALESCE(mr.cnt, 0)::int AS count
      FROM scoped_ambassadors a
      CROSS JOIN months m
      LEFT JOIN matched_referrals mr
        ON mr.ambassador_id = a.id AND mr.month_key = m.month_key
      ORDER BY a.full_name, m.month_key;
    `;

    return this.buildRecapResponse(stage, months, sqlRows);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get ambassador detail (Admin)' })
  @ApiQuery({ name: 'from', required: false, description: 'Start of the stage-reached window (WIB calendar day)' })
  @ApiQuery({ name: 'to', required: false, description: 'End of the stage-reached window (WIB calendar day, inclusive)' })
  async findOne(
    @Param('id') id: string,
    @CurrentUser() actor: CurrentUserData,
    @Query() query: AmbassadorReferralAnalyticsQueryDto,
  ) {
    await assertAmbassadorAccess(this.prismaRead, actor, id);

    // from > to can't be caught by a class-validator decorator on either field
    // alone (each only sees its own value), so it's checked here, the same way
    // assertValidGender() above hand-checks a rule format decorators can't
    // express. Compared as WIB filter dates rather than raw `Date` so a
    // same-day from/to pair (both date-only) doesn't get flagged: they parse
    // to the same WIB midnight and are equal, not "from after to".
    if (query.from && query.to) {
      const fromInstant = parseWibFilterDate(query.from);
      const toInstant = parseWibFilterDate(query.to);
      if (fromInstant.getTime() > toInstant.getTime()) {
        throw new BadRequestException('from must not be later than to');
      }
    }

    // Undefined when neither from nor to is supplied — the trigger for
    // whether the new reachedCounts fields appear in the response at all. No
    // params must reproduce today's response byte-for-byte, so this can't
    // just be an empty range object.
    const reachedWindow = buildWibDateRangeFilter(query.from, query.to);
    const ambassador = await this.prisma.ambassador.findFirst({
      where: { id, deletedAt: null },
      include: {
        user: { select: { email: true } },
        program: {
          select: {
            id: true,
            name: true,
            slug: true,
            brand: { select: { websiteUrl: true } },
          },
        },
      },
    });

    if (!ambassador) {
      throw new NotFoundException('Ambassador not found');
    }

    const referrals = await this.prisma.ambassadorReferral.findMany({
      where: { ambassadorId: id },
      select: {
        status: true,
        totalConversionDays: true,
        // programId so the per-programme breakdown below can be computed
        // here, where EVERY referral is in hand. The admin detail page needs
        // counts scoped to the programme being viewed, and it cannot derive
        // them from the referrals table it renders: that table is paginated
        // at 20, so counting client-side silently undercounts any ambassador
        // with more referrals than one page.
        programId: true,
        program: { select: { name: true } },
        // Per-stage timestamps, needed only to bucket reachedCounts /
        // reachedCountsByProgram by WHEN a referral reached a stage, as
        // opposed to statusCounts below which buckets by its CURRENT status.
        // profileCompletedAt is deliberately not selected: it isn't one of
        // the 5 stages this recap covers and statusCounts has no
        // profile-completed bucket to mirror either.
        referredAt: true,
        registeredAt: true,
        appliedAt: true,
        acceptedAt: true,
        completedAt: true,
      },
    });

    const statusCounts = {
      referred: 0,
      registered: 0,
      applied: 0,
      accepted: 0,
      completed: 0,
    };
    let conversionTotal = 0;
    let conversionCount = 0;

    // Same shape as statusCounts, but keyed by programme. An ambassador's
    // brand-wide code can bring participants into several programmes, so the
    // aggregate above is their whole-brand performance while this is what the
    // per-programme detail page shows.
    const statusCountsByProgram: Record<
      string,
      { programId: string; programName: string; referred: number; registered: number; applied: number; accepted: number; completed: number }
    > = {};

    // Every field below is a STAGE-REACHED count, unlike statusCounts above:
    // a referral is counted in every stage bucket whose own timestamp falls
    // in [from, to], not just the bucket matching its current status. That's
    // the whole point — a referral that applied in July and got accepted in
    // August must still show up in July's "applied" count for the monthly
    // recap, which a current-status snapshot can never give ops.
    type StageReachedCounts = { referred: number; registered: number; applied: number; accepted: number; completed: number };
    const zeroStageReachedCounts = (): StageReachedCounts => ({ referred: 0, registered: 0, applied: 0, accepted: 0, completed: 0 });
    const reachedCounts: StageReachedCounts = zeroStageReachedCounts();
    const reachedCountsByProgram: Record<string, { programId: string; programName: string } & StageReachedCounts> = {};

    // Maps each stage bucket to the referral column that timestamps it.
    // Deliberately 5 entries, not 6: profileCompletedAt exists on the model
    // but isn't one of the requested recap stages, and statusCounts above has
    // no profile-completed bucket for this to mirror.
    const stageTimestampFields: Record<keyof StageReachedCounts, 'referredAt' | 'registeredAt' | 'appliedAt' | 'acceptedAt' | 'completedAt'> = {
      referred: 'referredAt',
      registered: 'registeredAt',
      applied: 'appliedAt',
      accepted: 'acceptedAt',
      completed: 'completedAt',
    };

    const isWithinReachedWindow = (timestamp: Date | null): boolean => {
      if (!reachedWindow || !timestamp) return false;
      if (reachedWindow.gte && timestamp.getTime() < reachedWindow.gte.getTime()) return false;
      if (reachedWindow.lte && timestamp.getTime() > reachedWindow.lte.getTime()) return false;
      return true;
    };

    referrals.forEach((referral) => {
      if (referral.status in statusCounts) {
        statusCounts[referral.status as keyof typeof statusCounts] += 1;
      }
      if (typeof referral.totalConversionDays === 'number') {
        conversionTotal += referral.totalConversionDays;
        conversionCount += 1;
      }

      const bucket = (statusCountsByProgram[referral.programId] ??= {
        programId: referral.programId,
        programName: referral.program?.name ?? 'Unknown programme',
        referred: 0,
        registered: 0,
        applied: 0,
        accepted: 0,
        completed: 0,
      });
      if (referral.status in bucket) {
        bucket[referral.status as 'referred' | 'registered' | 'applied' | 'accepted' | 'completed'] += 1;
      }

      if (reachedWindow) {
        const reachedBucket = (reachedCountsByProgram[referral.programId] ??= {
          programId: referral.programId,
          programName: referral.program?.name ?? 'Unknown programme',
          ...zeroStageReachedCounts(),
        });
        (Object.keys(stageTimestampFields) as Array<keyof StageReachedCounts>).forEach((stage) => {
          if (isWithinReachedWindow(referral[stageTimestampFields[stage]])) {
            reachedCounts[stage] += 1;
            reachedBucket[stage] += 1;
          }
        });
      }
    });

    const brandUrl = ambassador.program.brand.websiteUrl || 'ybb.co';
    const cleanBrandUrl = brandUrl.replace(/^https?:\/\//, '').replace(/\/$/, '');
    const shareToken = createAmbassadorShareToken(ambassador.id);
    const shareLink = `https://${cleanBrandUrl}/programs/${ambassador.program.slug}?r=${shareToken}`;

    return {
      ...ambassador,
      shareLink,
      programName: ambassador.program.name,
      analytics: {
        statusCounts,
        statusCountsByProgram: Object.values(statusCountsByProgram),
        averageConversionDays: conversionCount > 0 ? Math.round(conversionTotal / conversionCount) : null,
        // Only present when from/to was supplied — an ambassador detail
        // fetched with no window must be byte-identical to before this
        // feature existed, so these keys can't just be zeroed, they must be
        // absent.
        ...(reachedWindow
          ? {
              reachedCounts,
              reachedCountsByProgram: Object.values(reachedCountsByProgram),
            }
          : {}),
      },
    };
  }

  @Post()
  @AuditTrail({ entityType: 'Ambassador', action: ChangeType.create })
  @ApiOperation({ summary: 'Create a new ambassador (Admin)' })
  async create(
    @Body() body: CreateAmbassadorAdminDto,
    @CurrentUser() actor: CurrentUserData,
  ) {
    const { email, fullName, programId, phoneNumber, institution, gender, notes } = body;

    // programId arrives in the body, so there is no route param for a guard to
    // check. Asserted on the value this handler actually creates against.
    // Without it, an admin of one brand could plant an ambassador in another -
    // and this route mints and emails login credentials, so it is account
    // creation, not just a row.
    await assertAmbassadorCreateAccess(this.prismaRead, actor, programId);

    // email/fullName/programId presence is enforced by CreateAmbassadorAdminDto
    // (@IsEmail, @IsNotEmpty, @IsUUID) via the global ValidationPipe before this
    // handler body runs — no manual re-check needed here.
    this.assertValidGender(gender);

    // Resolve program to get brandId and brand details for the welcome email
    const program = await this.prisma.program.findUnique({
      where: { id: programId },
      select: {
        id: true,
        brandId: true,
        contactEmail: true,
        contactAddress: true,
        brand: {
          select: {
            id: true,
            name: true,
            websiteUrl: true,
            primaryColor: true,
            logoUrl: true,
            socialMediaLinks: true,
          },
        },
      },
    });
    if (!program) throw new NotFoundException('Program not found');

    // Find or create user (case-insensitive email match)
    let user = await this.prisma.user.findFirst({ where: { email: { equals: email, mode: 'insensitive' }, brandId: program.brandId }, orderBy: { createdAt: 'asc' } });
    if (!user) {
      user = await this.prisma.user.create({
        data: {
          email,
          brandId: program.brandId,
          emailVerified: true,
        },
      });
    }

    // Check already ambassador
    const existing = await this.prisma.ambassador.findUnique({ where: { userId: user.id } });
    if (existing && !existing.deletedAt) {
      throw new ConflictException('This user is already an ambassador');
    }

    // Generate referral code: up to 3 letters from name + 8 random digits.
    //
    // This code is a CREDENTIAL — /auth/ambassador-login accepts email + code
    // with no password and returns full tokens — so it has to be unguessable,
    // and Math.random() is not. V8's xorshift128+ is seeded per context and its
    // internal state is recoverable from a handful of observed outputs, so an
    // attacker holding a couple of codes minted in the same process can predict
    // the rest. crypto.randomInt is a CSPRNG and costs nothing here.
    //
    // The digits went 5 -> 8 for free: the prefix is derivable from the
    // ambassador's public name, so the digits ARE the secret, and 90,000 of
    // them is a few minutes of guessing at any throttle we would tolerate.
    // 11 chars still fits referral_code VarChar(20) (prisma/schema/roles.prisma),
    // so no migration. Existing shorter codes keep working — every lookup path
    // matches the stored string, nothing parses its length.
    const namePrefix = fullName.replace(/[^a-zA-Z]/g, '').toUpperCase().slice(0, 3).padEnd(3, 'X');
    const mintDigits = () => randomInt(10_000_000, 100_000_000).toString();
    let referralCode = namePrefix + mintDigits();
    // Ensure uniqueness — retry once on collision
    const collision = await this.prisma.ambassador.findFirst({ where: { referralCode } });
    if (collision) {
      referralCode = namePrefix + mintDigits();
    }

    const ambassador = await this.prisma.ambassador.create({
      data: {
        userId: user.id,
        programId,
        fullName,
        phoneNumber: phoneNumber ?? null,
        institution: institution ?? null,
        gender: (gender as any) ?? null,
        notes: notes ?? null,
        referralCode,
        isActive: true,
        activatedAt: new Date(),
      },
      include: { user: { select: { email: true } } },
    });

    // Best-effort: emit welcome/credentials email. Never fail the create.
    try {
      // Merge program-owned contact fields back onto the emitted `brand`
      // shape — services/notification reads brand.contactEmail/contactAddress
      // from this event payload's field names, unchanged by this phase.
      const brand = program.brand
        ? { ...program.brand, contactEmail: program.contactEmail, contactAddress: program.contactAddress }
        : null;
      let baseUrl = this.configService.get('FRONTEND_URL') || 'http://localhost:3000';
      if (brand?.websiteUrl) baseUrl = brand.websiteUrl.replace(/\/$/, '');
      const normalizedBaseUrl = /^https?:\/\//i.test(baseUrl) ? baseUrl : `https://${baseUrl}`;
      const loginUrl = `${normalizedBaseUrl}/login?role=ambassador`;

      await this.rabbitMQProducerService.emit('notification.ambassador_created', {
        id: ambassador.id,
        email,
        name: ambassador.fullName,
        referralCode: ambassador.referralCode,
        loginUrl,
        brand,
      });
    } catch (error) {
      this.logger.warn(
        `Failed to emit ambassador welcome email for ambassador ${ambassador.id}: ${error instanceof Error ? error.message : String(error)}`,
      );
    }

    return ambassador;
  }

  @Post(':id/resend-credentials')
  @ApiOperation({ summary: 'Resend ambassador credentials email (Admin)' })
  async resendCredentials(@Param('id') id: string, @CurrentUser() actor: CurrentUserData) {
    await assertAmbassadorAccess(this.prismaRead, actor, id);
    const ambassador = await this.prisma.ambassador.findFirst({
      where: { id, deletedAt: null },
      include: {
        user: { select: { email: true } },
        program: {
          select: {
            id: true,
            contactEmail: true,
            contactAddress: true,
            brand: {
              select: {
                id: true,
                name: true,
                websiteUrl: true,
                primaryColor: true,
                logoUrl: true,
                socialMediaLinks: true,
              },
            },
          },
        },
      },
    });

    if (!ambassador) throw new NotFoundException('Ambassador not found');

    const email = ambassador.user?.email;
    if (!email) throw new BadRequestException('Ambassador has no email address on record');

    const brand = ambassador.program?.brand
      ? { ...ambassador.program.brand, contactEmail: ambassador.program.contactEmail, contactAddress: ambassador.program.contactAddress }
      : null;
    let baseUrl = this.configService.get('FRONTEND_URL') || 'http://localhost:3000';
    if (brand?.websiteUrl) baseUrl = brand.websiteUrl.replace(/\/$/, '');
    const normalizedBaseUrl = /^https?:\/\//i.test(baseUrl) ? baseUrl : `https://${baseUrl}`;
    const loginUrl = `${normalizedBaseUrl}/login?role=ambassador`;

    await this.rabbitMQProducerService.emit(
      'notification.ambassador_created',
      {
        id: ambassador.id,
        email,
        name: ambassador.fullName,
        referralCode: ambassador.referralCode,
        loginUrl,
        brand,
      },
      { messageId: `ambassador-resend-${id}-${Date.now()}` },
    );

    return { message: 'Credentials email queued for delivery' };
  }

  @Patch(':id')
  @AuditTrail({ entityType: 'Ambassador', action: ChangeType.update })
  @ApiOperation({ summary: 'Update ambassador details (Admin)' })
  async update(
    @Param('id') id: string,
    @Body() body: UpdateAmbassadorAdminDto,
    @CurrentUser() actor: CurrentUserData,
  ) {
    await assertAmbassadorAccess(this.prismaRead, actor, id);
    this.assertValidGender(body.gender);

    const ambassador = await this.prisma.ambassador.findUnique({ where: { id } });
    if (!ambassador || ambassador.deletedAt) throw new NotFoundException('Ambassador not found');

    return this.prisma.ambassador.update({
      where: { id },
      data: {
        fullName: body.fullName ?? undefined,
        phoneNumber: body.phoneNumber ?? undefined,
        institution: body.institution ?? undefined,
        gender: (body.gender as any) ?? undefined,
        notes: body.notes ?? undefined,
      },
      include: { user: { select: { email: true } } },
    });
  }

  @Patch(':id/activate')
  @AuditTrail({ entityType: 'Ambassador', action: ChangeType.update })
  @ApiOperation({ summary: 'Activate an ambassador' })
  async activate(@Param('id') id: string, @CurrentUser() actor: CurrentUserData) {
    await assertAmbassadorAccess(this.prismaRead, actor, id);
    return this.commandBus.execute(new UpdateAmbassadorStatusCommand(id, true));
  }

  @Patch(':id/deactivate')
  @AuditTrail({ entityType: 'Ambassador', action: ChangeType.update })
  @ApiOperation({ summary: 'Deactivate an ambassador' })
  async deactivate(@Param('id') id: string, @CurrentUser() actor: CurrentUserData) {
    await assertAmbassadorAccess(this.prismaRead, actor, id);
    return this.commandBus.execute(new UpdateAmbassadorStatusCommand(id, false));
  }

  @Get(':id/referrals')
  @ApiOperation({ summary: 'List referrals for a specific ambassador (Admin)' })
  @ApiQuery({ name: 'page', required: false })
  async getReferrals(
    @Param('id') id: string,
    @CurrentUser() actor: CurrentUserData,
    @Query('page') page: number = 1,
  ) {
    await assertAmbassadorAccess(this.prismaRead, actor, id);
    return this.queryBus.execute(new GetAmbassadorReferralsQuery(id, page));
  }

  @Delete(':id')
  @AuditTrail({ entityType: 'Ambassador', action: ChangeType.delete })
  @ApiOperation({ summary: 'Soft-delete an ambassador (Admin)' })
  async remove(@Param('id') id: string, @Req() req: any, @CurrentUser() actor: CurrentUserData) {
    await assertAmbassadorAccess(this.prismaRead, actor, id);
    const deletedBy: string = req.user?.id ?? req.user?.sub;
    return this.commandBus.execute(new DeleteAmbassadorCommand(id, deletedBy));
  }
}
