
import { UpdateAdminDto } from '../../presentation/dto/update-admin.dto';

export class UpdateAdminCommand {
    constructor(
        public readonly id: string,
        public readonly updates: UpdateAdminDto,
        public readonly updatedBy: string
    ) { }
}
