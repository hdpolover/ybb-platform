import { CreateProgramDto } from '../../presentation/dto/create-program.dto';

export class CreateProgramCommand {
  constructor(
    public readonly createProgramDto: CreateProgramDto,
    public readonly userId: string,
  ) {}
}
