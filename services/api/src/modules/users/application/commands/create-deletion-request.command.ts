import { CreateDeletionRequestDto } from '../../presentation/dto/deletion-request.dto';

export class CreateDeletionRequestCommand {
    constructor(
        public readonly userId: string,
        public readonly dto: CreateDeletionRequestDto,
        public readonly ipAddress?: string,
        public readonly userAgent?: string,
    ) { }
}
