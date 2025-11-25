import { Injectable } from '@nestjs/common';
import { ListProgramsQuery } from '../list-programs.query';
import { ProgramListResponseDto, ProgramResponseDto } from '../../../presentation/dto/program-response.dto';
import { PrismaService } from '../../../../../shared/infrastructure/prisma/prisma.service';

@Injectable()
export class ListProgramsHandler {
  constructor(private readonly prisma: PrismaService) {}

  async execute(query: ListProgramsQuery): Promise<ProgramListResponseDto> {
    const { programCategoryId, year, isPublished, page, limit } = query;

    // Build where clause
    const where: any = {
      programCategoryId,
      deletedAt: null,
    };

    if (year !== undefined) {
      where.year = year;
    }

    if (isPublished !== undefined) {
      where.isPublished = isPublished;
    }

    // Get total count
    const total = await this.prisma.program.count({ where });

    // Get paginated data
    const skip = (page - 1) * limit;
    const programs = await this.prisma.program.findMany({
      where,
      skip,
      take: limit,
      orderBy: [
        { year: 'desc' },
        { createdAt: 'desc' },
      ],
      include: {
        programCategory: {
          select: {
            name: true,
            slug: true,
          },
        },
      },
    });

    const data: ProgramResponseDto[] = programs.map((program) => ({
      id: program.id,
      programCategoryId: program.programCategoryId,
      name: program.name,
      description: program.description,
      year: program.year,
      startDate: program.startDate,
      endDate: program.endDate,
      applicationDeadline: program.applicationDeadline,
      location: program.location,
      capacity: program.capacity,
      isPublished: program.isPublished,
      createdAt: program.createdAt,
      updatedAt: program.updatedAt,
    }));

    const totalPages = Math.ceil(total / limit);

    return {
      data,
      total,
      page,
      limit,
      totalPages,
    };
  }
}
