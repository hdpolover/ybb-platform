import { QueryHandler, IQueryHandler } from '@nestjs/cqrs';
import { PrismaService } from '@shared/infrastructure/prisma/prisma.service';
import { ListSignaturesQuery } from '../list-signatures.query';
import { SignatureResponseDto } from '@modules/brands/presentation/dto/signature.dto';

@QueryHandler(ListSignaturesQuery)
export class ListSignaturesHandler implements IQueryHandler<ListSignaturesQuery> {
    constructor(private readonly prisma: PrismaService) { }

    async execute(query: ListSignaturesQuery): Promise<SignatureResponseDto[]> {
        const signatures = await this.prisma.signature.findMany({
            where: { brandId: query.brandId, isActive: true, deletedAt: null },
            orderBy: { sortOrder: 'asc' },
        });

        return signatures.map((signature) => ({
            id: signature.id,
            brandId: signature.brandId,
            name: signature.name,
            title: signature.title ?? undefined,
            imageUrl: signature.imageUrl,
            isActive: signature.isActive,
            sortOrder: signature.sortOrder,
        }));
    }
}
