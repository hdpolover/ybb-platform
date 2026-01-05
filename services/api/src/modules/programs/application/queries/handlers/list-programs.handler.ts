import { IQueryHandler, QueryHandler } from '@nestjs/cqrs';
import { Inject } from '@nestjs/common';
import { ListProgramsQuery } from '../list-programs.query';
import { ProgramListResponseDto, ProgramResponseDto } from '../../../presentation/dto/program-response.dto';
import { IProgramRepository } from '@core/interfaces/repositories/program.repository.interface';

@QueryHandler(ListProgramsQuery)
export class ListProgramsHandler implements IQueryHandler<ListProgramsQuery> {
    constructor(
        @Inject('IProgramRepository')
        private readonly programRepository: IProgramRepository,
    ) {}

    async execute(query: ListProgramsQuery): Promise<ProgramListResponseDto> {
        const { programCategoryId, year, isPublished, page, limit } = query;

        const { programs, total } = await this.programRepository.findAll({
            programCategoryId,
            year,
            isPublished,
            page,
            limit,
        });

        const data: ProgramResponseDto[] = programs.map((program) => ({
            id: program.id,
            programCategoryId: program.programCategoryId,
            name: program.name,
            slug: program.slug,
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
