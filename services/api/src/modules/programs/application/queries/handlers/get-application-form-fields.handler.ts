import { IQueryHandler, QueryHandler } from '@nestjs/cqrs';
import { Inject } from '@nestjs/common';
import { IProgramContentRepository } from '@core/interfaces/repositories/program-content.repository.interface';
import { GetApplicationFormFieldsQuery } from '../get-application-form-fields.query';

@QueryHandler(GetApplicationFormFieldsQuery)
export class GetApplicationFormFieldsHandler implements IQueryHandler<GetApplicationFormFieldsQuery> {
  constructor(
    @Inject('IProgramContentRepository')
    private readonly repository: IProgramContentRepository,
  ) {}

  async execute(query: GetApplicationFormFieldsQuery) {
    const { programId } = query;
    return this.repository.findFormFieldsByProgramId(programId);
  }
}
