import { IQueryHandler, QueryHandler } from '@nestjs/cqrs';
import { PrismaService } from '../../../../../shared/infrastructure/prisma/prisma.service';
import { ListDeletionRequestsQuery } from '../list-deletion-requests.query';
import { DeletionStatus } from '@prisma/client';

@QueryHandler(ListDeletionRequestsQuery)
export class ListDeletionRequestsHandler implements IQueryHandler<ListDeletionRequestsQuery> {
  constructor(private readonly prisma: PrismaService) {}

  async execute(query: ListDeletionRequestsQuery) {
    const { status, page, limit } = query;
    const skip = (page - 1) * limit;

    const where = status ? { status: status as DeletionStatus } : {};

    const [total, requests] = await Promise.all([
      this.prisma.accountDeletionRequest.count({ where }),
      this.prisma.accountDeletionRequest.findMany({
        where,
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
        include: {
          user: { select: { email: true, id: true } }
        }
      }),
    ]);

    return {
      data: requests.map(req => ({
        id: req.id,
        userId: req.userId,
        userEmail: req.user.email,
        reason: req.reason,
        reasonCategory: req.reasonCategory,
        status: req.status,
        createdAt: req.createdAt,
        reviewedAt: req.reviewedAt,
        scheduledDeletionDate: req.scheduledDeletionDate
      })),
      total,
      page,
      limit,
      lastPage: Math.ceil(total / limit)
    };
  }
}
