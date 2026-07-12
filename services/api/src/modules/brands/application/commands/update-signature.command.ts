import { UpdateSignatureDto } from '../../presentation/dto/signature.dto';

export class UpdateSignatureCommand {
    constructor(
        public readonly signatureId: string,
        public readonly dto: UpdateSignatureDto,
    ) { }
}
