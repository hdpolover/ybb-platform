import { CommandHandler, ICommandHandler } from '@nestjs/cqrs';
import { Inject } from '@nestjs/common';
import { IProgramContentRepository } from '@core/interfaces/repositories/program-content.repository.interface';
import { IUserActivityLogRepository } from '@core/interfaces/repositories/user-activity-log.repository.interface';
import { Decimal } from '@prisma/client/runtime/library';
import {
    CreateProgramTimelineCommand, UpdateProgramTimelineCommand, DeleteProgramTimelineCommand,
    CreateProgramScheduleCommand, UpdateProgramScheduleCommand, DeleteProgramScheduleCommand,
    CreateProgramSpeakerCommand, UpdateProgramSpeakerCommand, DeleteProgramSpeakerCommand,
    CreateProgramGalleryCommand, UpdateProgramGalleryCommand, DeleteProgramGalleryCommand,
    CreateProgramTestimonialCommand, UpdateProgramTestimonialCommand, DeleteProgramTestimonialCommand,
    CreateProgramFaqCommand, UpdateProgramFaqCommand, DeleteProgramFaqCommand,
    CreateProgramTeamCommand, UpdateProgramTeamCommand, DeleteProgramTeamCommand,
    CreateProgramPartnerCommand, UpdateProgramPartnerCommand, DeleteProgramPartnerCommand,
    CreateProgramResourceCommand, UpdateProgramResourceCommand, DeleteProgramResourceCommand,
    CreateProgramPricingTierCommand, UpdateProgramPricingTierCommand, DeleteProgramPricingTierCommand,
    CreateProgramRequirementCommand, UpdateProgramRequirementCommand, DeleteProgramRequirementCommand
} from '../program-content.commands';

// --- Timeline Handlers ---
@CommandHandler(CreateProgramTimelineCommand)
export class CreateProgramTimelineHandler implements ICommandHandler<CreateProgramTimelineCommand> {
    constructor(
        @Inject('IProgramContentRepository') private readonly repository: IProgramContentRepository,
        @Inject(IUserActivityLogRepository) private readonly activityLog: IUserActivityLogRepository
    ) {}
    async execute(command: CreateProgramTimelineCommand) {
        const dto = {
            ...command.dto,
            date: new Date(command.dto.date)
        };
        const result = await this.repository.createTimeline(dto);
        // Log activity here if needed
        return result;
    }
}
@CommandHandler(UpdateProgramTimelineCommand)
export class UpdateProgramTimelineHandler implements ICommandHandler<UpdateProgramTimelineCommand> {
    constructor(@Inject('IProgramContentRepository') private readonly repository: IProgramContentRepository) {}
    async execute(command: UpdateProgramTimelineCommand) {
        const dto = {
            ...command.dto,
            date: command.dto.date ? new Date(command.dto.date) : undefined
        };
        return this.repository.updateTimeline(command.id, dto);
    }
}
@CommandHandler(DeleteProgramTimelineCommand)
export class DeleteProgramTimelineHandler implements ICommandHandler<DeleteProgramTimelineCommand> {
    constructor(@Inject('IProgramContentRepository') private readonly repository: IProgramContentRepository) {}
    async execute(command: DeleteProgramTimelineCommand) {
        return this.repository.deleteTimeline(command.id);
    }
}

// --- Schedule Handlers ---
@CommandHandler(CreateProgramScheduleCommand)
export class CreateProgramScheduleHandler implements ICommandHandler<CreateProgramScheduleCommand> {
    constructor(@Inject('IProgramContentRepository') private readonly repository: IProgramContentRepository) {}
    async execute(command: CreateProgramScheduleCommand) {
        return this.repository.createSchedule(command.dto);
    }
}
@CommandHandler(UpdateProgramScheduleCommand)
export class UpdateProgramScheduleHandler implements ICommandHandler<UpdateProgramScheduleCommand> {
    constructor(@Inject('IProgramContentRepository') private readonly repository: IProgramContentRepository) {}
    async execute(command: UpdateProgramScheduleCommand) {
        return this.repository.updateSchedule(command.id, command.dto);
    }
}
@CommandHandler(DeleteProgramScheduleCommand)
export class DeleteProgramScheduleHandler implements ICommandHandler<DeleteProgramScheduleCommand> {
    constructor(@Inject('IProgramContentRepository') private readonly repository: IProgramContentRepository) {}
    async execute(command: DeleteProgramScheduleCommand) {
        return this.repository.deleteSchedule(command.id);
    }
}

// --- Speaker Handlers ---
@CommandHandler(CreateProgramSpeakerCommand)
export class CreateProgramSpeakerHandler implements ICommandHandler<CreateProgramSpeakerCommand> {
    constructor(@Inject('IProgramContentRepository') private readonly repository: IProgramContentRepository) {}
    async execute(command: CreateProgramSpeakerCommand) {
        return this.repository.createSpeaker(command.dto);
    }
}
@CommandHandler(UpdateProgramSpeakerCommand)
export class UpdateProgramSpeakerHandler implements ICommandHandler<UpdateProgramSpeakerCommand> {
    constructor(@Inject('IProgramContentRepository') private readonly repository: IProgramContentRepository) {}
    async execute(command: UpdateProgramSpeakerCommand) {
        return this.repository.updateSpeaker(command.id, command.dto);
    }
}
@CommandHandler(DeleteProgramSpeakerCommand)
export class DeleteProgramSpeakerHandler implements ICommandHandler<DeleteProgramSpeakerCommand> {
    constructor(@Inject('IProgramContentRepository') private readonly repository: IProgramContentRepository) {}
    async execute(command: DeleteProgramSpeakerCommand) {
        return this.repository.deleteSpeaker(command.id);
    }
}

// --- Gallery Handlers ---
@CommandHandler(CreateProgramGalleryCommand)
export class CreateProgramGalleryHandler implements ICommandHandler<CreateProgramGalleryCommand> {
    constructor(@Inject('IProgramContentRepository') private readonly repository: IProgramContentRepository) {}
    async execute(command: CreateProgramGalleryCommand) {
        return this.repository.createGallery(command.dto);
    }
}
@CommandHandler(UpdateProgramGalleryCommand)
export class UpdateProgramGalleryHandler implements ICommandHandler<UpdateProgramGalleryCommand> {
    constructor(@Inject('IProgramContentRepository') private readonly repository: IProgramContentRepository) {}
    async execute(command: UpdateProgramGalleryCommand) {
        return this.repository.updateGallery(command.id, command.dto);
    }
}
@CommandHandler(DeleteProgramGalleryCommand)
export class DeleteProgramGalleryHandler implements ICommandHandler<DeleteProgramGalleryCommand> {
    constructor(@Inject('IProgramContentRepository') private readonly repository: IProgramContentRepository) {}
    async execute(command: DeleteProgramGalleryCommand) {
        return this.repository.deleteGallery(command.id);
    }
}

// --- Testimonial Handlers ---
@CommandHandler(CreateProgramTestimonialCommand)
export class CreateProgramTestimonialHandler implements ICommandHandler<CreateProgramTestimonialCommand> {
    constructor(@Inject('IProgramContentRepository') private readonly repository: IProgramContentRepository) {}
    async execute(command: CreateProgramTestimonialCommand) {
        return this.repository.createTestimonial(command.dto);
    }
}
@CommandHandler(UpdateProgramTestimonialCommand)
export class UpdateProgramTestimonialHandler implements ICommandHandler<UpdateProgramTestimonialCommand> {
    constructor(@Inject('IProgramContentRepository') private readonly repository: IProgramContentRepository) {}
    async execute(command: UpdateProgramTestimonialCommand) {
        return this.repository.updateTestimonial(command.id, command.dto);
    }
}
@CommandHandler(DeleteProgramTestimonialCommand)
export class DeleteProgramTestimonialHandler implements ICommandHandler<DeleteProgramTestimonialCommand> {
    constructor(@Inject('IProgramContentRepository') private readonly repository: IProgramContentRepository) {}
    async execute(command: DeleteProgramTestimonialCommand) {
        return this.repository.deleteTestimonial(command.id);
    }
}

// --- FAQ Handlers ---
@CommandHandler(CreateProgramFaqCommand)
export class CreateProgramFaqHandler implements ICommandHandler<CreateProgramFaqCommand> {
    constructor(@Inject('IProgramContentRepository') private readonly repository: IProgramContentRepository) {}
    async execute(command: CreateProgramFaqCommand) {
        return this.repository.createFaq(command.dto);
    }
}
@CommandHandler(UpdateProgramFaqCommand)
export class UpdateProgramFaqHandler implements ICommandHandler<UpdateProgramFaqCommand> {
    constructor(@Inject('IProgramContentRepository') private readonly repository: IProgramContentRepository) {}
    async execute(command: UpdateProgramFaqCommand) {
        return this.repository.updateFaq(command.id, command.dto);
    }
}
@CommandHandler(DeleteProgramFaqCommand)
export class DeleteProgramFaqHandler implements ICommandHandler<DeleteProgramFaqCommand> {
    constructor(@Inject('IProgramContentRepository') private readonly repository: IProgramContentRepository) {}
    async execute(command: DeleteProgramFaqCommand) {
        return this.repository.deleteFaq(command.id);
    }
}

// --- Team Handlers ---
@CommandHandler(CreateProgramTeamCommand)
export class CreateProgramTeamHandler implements ICommandHandler<CreateProgramTeamCommand> {
    constructor(@Inject('IProgramContentRepository') private readonly repository: IProgramContentRepository) {}
    async execute(command: CreateProgramTeamCommand) {
        return this.repository.createTeam(command.dto);
    }
}
@CommandHandler(UpdateProgramTeamCommand)
export class UpdateProgramTeamHandler implements ICommandHandler<UpdateProgramTeamCommand> {
    constructor(@Inject('IProgramContentRepository') private readonly repository: IProgramContentRepository) {}
    async execute(command: UpdateProgramTeamCommand) {
        return this.repository.updateTeam(command.id, command.dto);
    }
}
@CommandHandler(DeleteProgramTeamCommand)
export class DeleteProgramTeamHandler implements ICommandHandler<DeleteProgramTeamCommand> {
    constructor(@Inject('IProgramContentRepository') private readonly repository: IProgramContentRepository) {}
    async execute(command: DeleteProgramTeamCommand) {
        return this.repository.deleteTeam(command.id);
    }
}

// --- Partner Handlers ---
@CommandHandler(CreateProgramPartnerCommand)
export class CreateProgramPartnerHandler implements ICommandHandler<CreateProgramPartnerCommand> {
    constructor(@Inject('IProgramContentRepository') private readonly repository: IProgramContentRepository) {}
    async execute(command: CreateProgramPartnerCommand) {
        return this.repository.createPartner(command.dto);
    }
}
@CommandHandler(UpdateProgramPartnerCommand)
export class UpdateProgramPartnerHandler implements ICommandHandler<UpdateProgramPartnerCommand> {
    constructor(@Inject('IProgramContentRepository') private readonly repository: IProgramContentRepository) {}
    async execute(command: UpdateProgramPartnerCommand) {
        return this.repository.updatePartner(command.id, command.dto);
    }
}
@CommandHandler(DeleteProgramPartnerCommand)
export class DeleteProgramPartnerHandler implements ICommandHandler<DeleteProgramPartnerCommand> {
    constructor(@Inject('IProgramContentRepository') private readonly repository: IProgramContentRepository) {}
    async execute(command: DeleteProgramPartnerCommand) {
        return this.repository.deletePartner(command.id);
    }
}

// --- Resource Handlers ---
@CommandHandler(CreateProgramResourceCommand)
export class CreateProgramResourceHandler implements ICommandHandler<CreateProgramResourceCommand> {
    constructor(@Inject('IProgramContentRepository') private readonly repository: IProgramContentRepository) {}
    async execute(command: CreateProgramResourceCommand) {
        const dto = {
            ...command.dto,
            fileSize: command.dto.fileSize ? BigInt(command.dto.fileSize) : undefined
        };
        return this.repository.createResource(dto);
    }
}
@CommandHandler(UpdateProgramResourceCommand)
export class UpdateProgramResourceHandler implements ICommandHandler<UpdateProgramResourceCommand> {
    constructor(@Inject('IProgramContentRepository') private readonly repository: IProgramContentRepository) {}
    async execute(command: UpdateProgramResourceCommand) {
        const dto = {
            ...command.dto,
            fileSize: command.dto.fileSize ? BigInt(command.dto.fileSize) : undefined
        };
        return this.repository.updateResource(command.id, dto);
    }
}
@CommandHandler(DeleteProgramResourceCommand)
export class DeleteProgramResourceHandler implements ICommandHandler<DeleteProgramResourceCommand> {
    constructor(@Inject('IProgramContentRepository') private readonly repository: IProgramContentRepository) {}
    async execute(command: DeleteProgramResourceCommand) {
        return this.repository.deleteResource(command.id);
    }
}

// --- Pricing Tier Handlers ---
@CommandHandler(CreateProgramPricingTierCommand)
export class CreateProgramPricingTierHandler implements ICommandHandler<CreateProgramPricingTierCommand> {
    constructor(@Inject('IProgramContentRepository') private readonly repository: IProgramContentRepository) {}
    async execute(command: CreateProgramPricingTierCommand) {
        const dto = {
            ...command.dto,
            price: new Decimal(command.dto.price),
            validFrom: new Date(command.dto.validFrom),
            validUntil: new Date(command.dto.validUntil)
        };
        return this.repository.createPricingTier(dto);
    }
}
@CommandHandler(UpdateProgramPricingTierCommand)
export class UpdateProgramPricingTierHandler implements ICommandHandler<UpdateProgramPricingTierCommand> {
    constructor(@Inject('IProgramContentRepository') private readonly repository: IProgramContentRepository) {}
    async execute(command: UpdateProgramPricingTierCommand) {
        const dto = {
            ...command.dto,
            price: command.dto.price ? new Decimal(command.dto.price) : undefined,
            validFrom: command.dto.validFrom ? new Date(command.dto.validFrom) : undefined,
            validUntil: command.dto.validUntil ? new Date(command.dto.validUntil) : undefined
        };
        return this.repository.updatePricingTier(command.id, dto);
    }
}
@CommandHandler(DeleteProgramPricingTierCommand)
export class DeleteProgramPricingTierHandler implements ICommandHandler<DeleteProgramPricingTierCommand> {
    constructor(@Inject('IProgramContentRepository') private readonly repository: IProgramContentRepository) {}
    async execute(command: DeleteProgramPricingTierCommand) {
        return this.repository.deletePricingTier(command.id);
    }
}

// --- Requirement Handlers ---
@CommandHandler(CreateProgramRequirementCommand)
export class CreateProgramRequirementHandler implements ICommandHandler<CreateProgramRequirementCommand> {
    constructor(@Inject('IProgramContentRepository') private readonly repository: IProgramContentRepository) {}
    async execute(command: CreateProgramRequirementCommand) {
        return this.repository.createRequirement(command.dto);
    }
}
@CommandHandler(UpdateProgramRequirementCommand)
export class UpdateProgramRequirementHandler implements ICommandHandler<UpdateProgramRequirementCommand> {
    constructor(@Inject('IProgramContentRepository') private readonly repository: IProgramContentRepository) {}
    async execute(command: UpdateProgramRequirementCommand) {
        return this.repository.updateRequirement(command.id, command.dto);
    }
}
@CommandHandler(DeleteProgramRequirementCommand)
export class DeleteProgramRequirementHandler implements ICommandHandler<DeleteProgramRequirementCommand> {
    constructor(@Inject('IProgramContentRepository') private readonly repository: IProgramContentRepository) {}
    async execute(command: DeleteProgramRequirementCommand) {
        return this.repository.deleteRequirement(command.id);
    }
}
