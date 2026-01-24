import { CreateIntentDto } from '../../presentation/dto/create-intent.dto';

export class CreateIntentCommand {
    constructor(
        public readonly userId: string,
        public readonly dto: CreateIntentDto,
    ) { }
}
