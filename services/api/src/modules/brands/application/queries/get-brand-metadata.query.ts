import { IQuery } from '@nestjs/cqrs';

export class GetBrandMetadataQuery implements IQuery {
    constructor(public readonly id: string) {}
}
