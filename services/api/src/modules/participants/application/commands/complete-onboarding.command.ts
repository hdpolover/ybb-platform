import { ICommand } from '@nestjs/cqrs';
import { OnboardingDto } from '../../presentation/dto/onboarding.dto';

export class CompleteOnboardingCommand implements ICommand {
    constructor(
        public readonly userId: string,
        public readonly dto: OnboardingDto,
    ) {}
}
