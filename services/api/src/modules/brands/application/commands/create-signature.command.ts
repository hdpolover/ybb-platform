import { CreateSignatureDto } from '../../presentation/dto/signature.dto';

export class CreateSignatureCommand {
    constructor(public readonly dto: CreateSignatureDto) { }
}
