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
    ) { }

    async execute(query: ListProgramsQuery): Promise<ProgramListResponseDto> {
        const { brandId, year, isPublished, page, limit, isActive, isVisibleToUsers, status } = query;

        const { programs, total } = await this.programRepository.findAll({
            brandId: brandId,
            year,
            isPublished,
            isActive,
            isVisibleToUsers,
            status,
            page,
            limit,
        });

        const data: ProgramResponseDto[] = programs.map((program) => ({
            id: program.id,
            brandId: program.brandId,
            brandName: program.brandName ?? null,
            name: program.name,
            slug: program.slug,
            description: program.description,
            year: program.year,
            startDate: program.startDate,
            endDate: program.endDate,
            applicationDeadline: program.applicationDeadline,
            location: program.location,
            capacity: program.capacity,
            registrationOpenDate: program.registrationOpenDate,
            registrationCloseDate: program.registrationCloseDate,
            registrationFee: program.registrationFee,
            isPublished: program.isPublished,
            isActive: program.isActive,
            status: program.status,
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
