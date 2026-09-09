import { QueryHandler, IQueryHandler } from '@nestjs/cqrs';
import { ForbiddenException } from '@nestjs/common';
import { PrismaService } from '../../../../../shared/infrastructure/prisma/prisma.service';
import { GetAmbassadorsListQuery } from '../../commands/ambassador-admin.commands'; // Corrected path
import { Prisma } from '@prisma/client';
import { createAmbassadorShareToken } from '../../utils/ambassador-share-token.util';

@QueryHandler(GetAmbassadorsListQuery)
export class GetAmbassadorsListHandler implements IQueryHandler<GetAmbassadorsListQuery> {
    constructor(private readonly prisma: PrismaService) {}

    async execute(query: GetAmbassadorsListQuery): Promise<any> {
        const { programId, search, page, limit, sortBy, sortOrder, allowedProgramIds } = query;
        const skip = (page - 1) * limit;

        const where: Prisma.AmbassadorWhereInput = { deletedAt: null };

        let resolvedProgramId: string | undefined;
        if (programId) {
            const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(programId);
            if (isUuid) {
                resolvedProgramId = programId;
            } else {
                const program = await this.prisma.program.findFirst({ where: { slug: programId }, select: { id: true } });
                if (!program) return { data: [], meta: { total: 0, page, limit, lastPage: 0 } };
                resolvedProgramId = program.id;
            }
            where.programId = resolvedProgramId;
        }

        // Scope, applied here rather than in the controller because programId may
        // arrive as a slug and this is where that is resolved.
        //
        // null means no restriction, which only a platform admin gets. Anything
        // else - INCLUDING an empty array - must narrow the query. Leaving the
        // filter off for a scoped admin is how the users list ended up returning
        // every brand when its parameter was simply omitted: Prisma treats an
        // absent condition as no condition.
        if (allowedProgramIds !== null) {
            if (resolvedProgramId) {
                if (!allowedProgramIds.includes(resolvedProgramId)) {
                    throw new ForbiddenException('You do not have access to this program.');
                }
            } else {
                where.programId = { in: allowedProgramIds };
            }
        }

        if (search) {
             where.OR = [
                 { fullName: { contains: search, mode: 'insensitive' } },
                 { referralCode: { contains: search, mode: 'insensitive' } },
                 { user: { email: { contains: search, mode: 'insensitive' } } },
             ];
        }

        const dir: Prisma.SortOrder = sortOrder === 'asc' ? Prisma.SortOrder.asc : Prisma.SortOrder.desc;
        const orderBy =
            sortBy === 'totalReferrals' ? { totalReferrals: dir }
            : sortBy === 'successfulReferrals' ? { successfulReferrals: dir }
            : sortBy === 'lastReferralAt' ? { lastReferralAt: dir }
            : sortBy === 'fullName' ? { fullName: dir }
            : sortBy === 'referralCode' ? { referralCode: dir }
            : sortBy === 'institution' ? { institution: dir }
            : sortBy === 'isActive' ? { isActive: dir }
            : sortBy === 'createdAt' ? { createdAt: dir }
            : { totalReferrals: Prisma.SortOrder.desc };

        const [data, total] = await Promise.all([
            this.prisma.ambassador.findMany({
                where,
                skip,
                take: limit,
                orderBy,
                include: {
                    user: { select: { email: true } },
                    program: {
                        select: {
                            name: true,
                            slug: true,
                            brand: { select: { websiteUrl: true } },
                        },
                    },
                }
            }),
            this.prisma.ambassador.count({ where })
        ]);

        // The share link is minted here so the ambassadors list can offer a
        // copyable link per row. It mirrors the detail endpoint's format
        // (ambassador-admin.controller.ts findOne) — token minting is cheap and
        // the token is opaque, so no extra query is needed.
        const items = data.map((ambassador) => {
            const brandUrl = ambassador.program?.brand?.websiteUrl || 'ybb.co';
            const cleanBrandUrl = brandUrl.replace(/^https?:\/\//, '').replace(/\/$/, '');
            const slug = ambassador.program?.slug;
            // A missing share-token secret must not take the whole list down —
            // the row degrades to no link instead of a 500.
            let shareLink: string | null = null;
            if (slug) {
                try {
                    shareLink = `https://${cleanBrandUrl}/programs/${slug}?r=${createAmbassadorShareToken(ambassador.id)}`;
                } catch {
                    shareLink = null;
                }
            }
            return { ...ambassador, shareLink };
        });

        return {
            data: items,
            meta: {
                total,
                page,
                limit,
                lastPage: Math.ceil(total / limit),
            }
        };
    }
}
