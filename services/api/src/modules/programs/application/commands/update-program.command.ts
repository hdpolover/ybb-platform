import { UpdateProgramDto } from '../../presentation/dto/update-program.dto';

export class UpdateProgramCommand {
  constructor(
    public readonly programId: string,
    public readonly updateProgramDto: UpdateProgramDto,
    public readonly userId: string,
  ) {}
}
