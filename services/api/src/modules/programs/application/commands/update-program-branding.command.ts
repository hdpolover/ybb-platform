import { ICommand } from '@nestjs/cqrs';
import { UploadProgramBrandingDto } from '../../presentation/dto/upload-content.dto';

export class UpdateProgramBrandingCommand implements ICommand {
    constructor(
        public readonly programId: string,
        public readonly dto: UploadProgramBrandingDto,
        public readonly userId: string,
        public readonly files: {
            logo?: any;
            banner?: any;
            thumbnail?: any;
        }
    ) {}
}
