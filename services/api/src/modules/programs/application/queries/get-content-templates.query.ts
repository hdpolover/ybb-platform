// services/api/src/modules/programs/application/queries/get-content-templates.query.ts
export class GetContentTemplatesQuery {
  constructor(public readonly entityType?: string) {}
}

export class GetContentTemplateByIdQuery {
  constructor(public readonly id: string) {}
}
