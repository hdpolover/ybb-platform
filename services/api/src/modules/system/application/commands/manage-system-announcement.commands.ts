import {
  CreateSystemAnnouncementDto,
  UpdateSystemAnnouncementDto,
} from '../../presentation/dto/system-announcement.dto';

export class ListAllSystemAnnouncementsCommand {
  constructor(
    public readonly page: number = 1,
    public readonly limit: number = 20,
    public readonly brandId?: string,
  ) {}
}

export class CreateSystemAnnouncementCommand {
  constructor(
    public readonly dto: CreateSystemAnnouncementDto,
    public readonly createdBy: string,
  ) {}
}

export class UpdateSystemAnnouncementCommand {
  constructor(
    public readonly id: string,
    public readonly dto: UpdateSystemAnnouncementDto,
    public readonly updatedBy: string,
  ) {}
}

export class DeleteSystemAnnouncementCommand {
  constructor(
    public readonly id: string,
    public readonly deletedBy: string,
  ) {}
}

export class TogglePublishSystemAnnouncementCommand {
  constructor(
    public readonly id: string,
    public readonly publish: boolean,
    public readonly updatedBy: string,
  ) {}
}
