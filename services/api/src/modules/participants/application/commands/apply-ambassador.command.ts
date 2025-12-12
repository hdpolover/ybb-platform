import { ApplyAmbassadorDto } from '../../presentation/dto/ambassador.dto';

export class ApplyAmbassadorCommand {
    constructor(
        public readonly userId: string,
        public readonly dto: ApplyAmbassadorDto,
    ) { }
}
