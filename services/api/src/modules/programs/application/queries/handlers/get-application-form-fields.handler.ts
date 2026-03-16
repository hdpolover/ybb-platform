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
    const fields = await this.repository.findFormFieldsByProgramId(programId);

    return fields.map(field => ({
      id: field.id,
      section: field.section,
      fieldName: field.name,
      label: field.label,
      placeholder: field.placeholder || undefined,
      helpText: field.helpText || undefined,
      mediaUrl: field.mediaUrl || undefined,
      mediaAlt: field.mediaAlt || undefined,
      fieldType: field.type,
      isRequired: field.isRequired,
      options: field.options || undefined,
      validationRules: field.validationRules || undefined,
      defaultValue:
        field.validationRules && typeof field.validationRules === 'object' && !Array.isArray(field.validationRules)
          ? (field.validationRules as Record<string, unknown>).defaultValue as string | undefined
          : undefined,
      order: field.order,
    }));
  }
}
