import { QueryHandler, IQueryHandler } from '@nestjs/cqrs';
import { PrismaService } from '../../../../../shared/infrastructure/prisma/prisma.service';
import { GetAmbassadorsListQuery } from '../../commands/ambassador-admin.commands'; // Corrected path

@QueryHandler(GetAmbassadorsListQuery)
export class GetAmbassadorsListHandler implements IQueryHandler<GetAmbassadorsListQuery> {
    constructor(private readonly prisma: PrismaService) {}

    async execute(query: GetAmbassadorsListQuery): Promise<any> {
        const { programId, search, page, limit } = query;
        const skip = (page - 1) * limit;

        const where: any = {};
        
        if (programId) {
            where.programId = programId;
        }

        if (search) {
             where.OR = [
                 { fullName: { contains: search, mode: 'insensitive' } },
                 { referralCode: { contains: search, mode: 'insensitive' } },
             ];
        }

        const [data, total] = await Promise.all([
            this.prisma.ambassador.findMany({
                where,
                skip,
                take: limit,
                orderBy: { createdAt: 'desc' },
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
