import { QueryHandler, IQueryHandler } from '@nestjs/cqrs';
import { PrismaService } from '../../../../../shared/infrastructure/prisma/prisma.service';
import { GetAmbassadorsListQuery } from '../../commands/ambassador-admin.commands'; // Corrected path
import { Prisma } from '@prisma/client';

@QueryHandler(GetAmbassadorsListQuery)
export class GetAmbassadorsListHandler implements IQueryHandler<GetAmbassadorsListQuery> {
    constructor(private readonly prisma: PrismaService) {}

    async execute(query: GetAmbassadorsListQuery): Promise<any> {
        const { programId, search, page, limit, sortBy, sortOrder } = query;
        const skip = (page - 1) * limit;

        const where: Prisma.AmbassadorWhereInput = { deletedAt: null };

        if (programId) {
            const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(programId);
            if (isUuid) {
                where.programId = programId;
            } else {
                const program = await this.prisma.program.findFirst({ where: { slug: programId }, select: { id: true } });
                if (!program) return { data: [], meta: { total: 0, page, limit, lastPage: 0 } };
                where.programId = program.id;
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
                    program: { select: { name: true, slug: true } }
                }
            }),
            this.prisma.ambassador.count({ where })
        ]);

        return {
            data,
            meta: {
                total,
                page,
                limit,
                lastPage: Math.ceil(total / limit),
            }
        };
    }
}
