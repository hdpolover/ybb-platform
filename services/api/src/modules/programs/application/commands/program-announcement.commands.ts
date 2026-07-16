import { CreateProgramAnnouncementDto, UpdateProgramAnnouncementDto } from '../../presentation/dto/program-announcement.dto';

export class ListProgramAnnouncementsCommand {
  constructor(
    public readonly programId: string,
    public readonly category?: string,
    public readonly targetAudience?: string,
    public readonly page: number = 1,
    public readonly limit: number = 20,
  ) {}
}

export class GetProgramAnnouncementCommand {
  constructor(public readonly id: string) {}
}

export class CreateProgramAnnouncementCommand {
  constructor(
    public readonly programId: string,
    public readonly dto: CreateProgramAnnouncementDto,
    public readonly createdBy: string,
  ) {}
}

export class UpdateProgramAnnouncementCommand {
  constructor(
    public readonly id: string,
    public readonly dto: UpdateProgramAnnouncementDto,
    public readonly updatedBy: string,
  ) {}
}

export class DeleteProgramAnnouncementCommand {
  constructor(
    public readonly id: string,
    public readonly deletedBy: string,
  ) {}
}
