import { CommandHandler, ICommandHandler } from '@nestjs/cqrs';
import { Inject, NotFoundException } from '@nestjs/common';
import { IProgramContentRepository } from '@core/interfaces/repositories/program-content.repository.interface';
import { IUserActivityLogRepository } from '@core/interfaces/repositories/user-activity-log.repository.interface';
import { Prisma, PricingFeeType, ApplicationCategory } from '@prisma/client';
import { StorageService } from '../../../../files/application/storage.service';
import { PrismaService } from '@shared/infrastructure/prisma/prisma.service';
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
    CreateProgramRequirementCommand, UpdateProgramRequirementCommand, DeleteProgramRequirementCommand,
    CreateProgramEssayCommand, UpdateProgramEssayCommand, DeleteProgramEssayCommand
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
    constructor(
        @Inject('IProgramContentRepository') private readonly repository: IProgramContentRepository,
        private readonly storageService: StorageService,
        private readonly prisma: PrismaService,
    ) {}
    async execute(command: CreateProgramSpeakerCommand) {
        let photoUrl = command.dto.photoUrl;

        if (command.image) {
            const program = await this.prisma.program.findUnique({ where: { id: command.dto.programId } });
            if (!program) {
                throw new NotFoundException('Program not found');
            }
            
            const result = await this.storageService.uploadFile(
                command.image,
                command.userId,
                program.programCategoryId, // brandId
                'speakers',
                program.id
            );
            
            photoUrl = result.url;
        }

        const dto = {
            ...command.dto,
            photoUrl
        };
        return this.repository.createSpeaker(dto);
    }
}
@CommandHandler(UpdateProgramSpeakerCommand)
export class UpdateProgramSpeakerHandler implements ICommandHandler<UpdateProgramSpeakerCommand> {
    constructor(
        @Inject('IProgramContentRepository') private readonly repository: IProgramContentRepository,
        private readonly storageService: StorageService,
        private readonly prisma: PrismaService,
    ) {}

    async execute(command: UpdateProgramSpeakerCommand) {
        let photoUrl = command.dto.photoUrl;

        if (command.image) {
            const speaker = await this.repository.findSpeakerById(command.id);
            if (!speaker) {
                throw new NotFoundException('Speaker not found');
            }

            const program = await this.prisma.program.findUnique({ where: { id: speaker.programId } });
            if (!program) {
                throw new NotFoundException('Program not found');
            }
            
            const result = await this.storageService.uploadFile(
                command.image,
                command.userId,
                program.programCategoryId, 
                'speakers',
                program.id
            );
            photoUrl = result.url;
        }

        const dto = {
            ...command.dto,
            photoUrl
        };

        return this.repository.updateSpeaker(command.id, dto);
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
    constructor(
        @Inject('IProgramContentRepository') private readonly repository: IProgramContentRepository,
        private readonly storageService: StorageService,
        private readonly prisma: PrismaService,
    ) {}
    async execute(command: CreateProgramTeamCommand) {
        let photoUrl = command.dto.photoUrl;

        if (command.image) {
            let brandId;
            if (command.dto.programId) {
                const program = await this.prisma.program.findUnique({ where: { id: command.dto.programId } });
                brandId = program?.programCategoryId;
            } else if (command.dto.programCategoryId) {
                brandId = command.dto.programCategoryId;
            }

            if (!brandId) {
                 throw new NotFoundException('Program or Brand ID required');
            }

             const result = await this.storageService.uploadFile(
                command.image,
                command.userId,
                brandId, 
                'team',
                command.dto.programId
            );
             photoUrl = result.url;
        }

        const dto = {
            ...command.dto,
            photoUrl
        };
        return this.repository.createTeam(dto);
    }
}
@CommandHandler(UpdateProgramTeamCommand)
export class UpdateProgramTeamHandler implements ICommandHandler<UpdateProgramTeamCommand> {
    constructor(
        @Inject('IProgramContentRepository') private readonly repository: IProgramContentRepository,
        private readonly storageService: StorageService,
        private readonly prisma: PrismaService,
    ) {}

    async execute(command: UpdateProgramTeamCommand) {
        let photoUrl = command.dto.photoUrl;

        if (command.image) {
            const teamMember = await this.repository.findTeamById(command.id);
            if (!teamMember) {
                throw new NotFoundException('Team member not found');
            }
            
            if (!teamMember.programId) {
                throw new NotFoundException('Program ID missing on team member');
            }

            const program = await this.prisma.program.findUnique({ where: { id: teamMember.programId } });
             if (!program) {
                throw new NotFoundException('Program not found');
            }
            
            const result = await this.storageService.uploadFile(
                command.image,
                command.userId,
                program.programCategoryId, 
                'team',
                program.id
            );
            photoUrl = result.url;
        }

        const dto = {
            ...command.dto,
            photoUrl
        };
        return this.repository.updateTeam(command.id, dto);
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
    constructor(
        @Inject('IProgramContentRepository') private readonly repository: IProgramContentRepository,
        private readonly storageService: StorageService,
        private readonly prisma: PrismaService,
    ) {}
    async execute(command: CreateProgramPartnerCommand) {
         let logoUrl = command.dto.logoUrl;

         if (command.logo) {
            const program = await this.prisma.program.findUnique({ where: { id: command.dto.programId } });
            if (!program) {
                throw new NotFoundException('Program not found');
            }

             const result = await this.storageService.uploadFile(
                command.logo,
                command.userId,
                program.programCategoryId, 
                'partners',
                program.id
            );
            logoUrl = result.url;
        }

        const dto = {
            ...command.dto,
            logoUrl
        };
        return this.repository.createPartner(dto);
    }
}
@CommandHandler(UpdateProgramPartnerCommand)
export class UpdateProgramPartnerHandler implements ICommandHandler<UpdateProgramPartnerCommand> {
    constructor(
        @Inject('IProgramContentRepository') private readonly repository: IProgramContentRepository,
        private readonly storageService: StorageService,
        private readonly prisma: PrismaService,
    ) {}

    async execute(command: UpdateProgramPartnerCommand) {
        let logoUrl = command.dto.logoUrl;

        if (command.logo) {
            const partner = await this.repository.findPartnerById(command.id);
            if (!partner) {
                throw new NotFoundException('Partner not found');
            }

            if (!partner.programId) {
                throw new NotFoundException('Program ID missing on partner');
            }

            const program = await this.prisma.program.findUnique({ where: { id: partner.programId } });
            if (!program) {
                throw new NotFoundException('Program not found');
            }

             const result = await this.storageService.uploadFile(
                command.logo,
                command.userId,
                program.programCategoryId, 
                'partners',
                program.id
            );
            logoUrl = result.url;
        }

        const dto = {
            ...command.dto,
            logoUrl
        };
        return this.repository.updatePartner(command.id, dto);
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
    constructor(
        @Inject('IProgramContentRepository') private readonly repository: IProgramContentRepository,
        private readonly storageService: StorageService,
        private readonly prisma: PrismaService,
    ) {}
    async execute(command: CreateProgramResourceCommand) {
        let fileUrl = command.dto.fileUrl;
        let fileSize: number | undefined = command.dto.fileSize;
        let fileType = command.dto.fileType;

        if (command.file) {
            const program = await this.prisma.program.findUnique({ where: { id: command.dto.programId } });
            if (!program) {
                throw new NotFoundException('Program not found');
            }
            
            // Use programCategoryId as brandId for now, similar to Gallery Service logic
            const brandId = program.programCategoryId; 
            
            const result = await this.storageService.uploadFile(
                command.file,
                command.userId,
                brandId,
                'resources',
                program.id
            );
            
            fileUrl = result.url;
            fileSize = command.file.size;
            fileType = command.file.mimetype;
        }

        const dto = {
            ...command.dto,
            fileUrl: fileUrl,
            fileSize: fileSize ? BigInt(fileSize) : undefined,
            fileType: fileType
        };
        return this.repository.createResource(dto);
    }
}
@CommandHandler(UpdateProgramResourceCommand)
export class UpdateProgramResourceHandler implements ICommandHandler<UpdateProgramResourceCommand> {
    constructor(
        @Inject('IProgramContentRepository') private readonly repository: IProgramContentRepository,
        private readonly storageService: StorageService,
        private readonly prisma: PrismaService,
    ) {}

    async execute(command: UpdateProgramResourceCommand) {
        let fileUrl = command.dto.fileUrl;
        let fileSize: number | undefined = command.dto.fileSize;
        let fileType = command.dto.fileType;

        if (command.file) {
            const resource = await this.repository.findResourceById(command.id);
            if (!resource) {
                throw new NotFoundException('Resource not found');
            }

            if (!resource.programId) {
                throw new NotFoundException('Program ID missing on resource');
            }

            const program = await this.prisma.program.findUnique({ where: { id: resource.programId } });
            if (!program) {
                throw new NotFoundException('Program not found');
            }
            
            const result = await this.storageService.uploadFile(
                command.file,
                command.userId,
                program.programCategoryId,
                'resources',
                program.id
            );
            
            fileUrl = result.url;
            fileSize = command.file.size;
            fileType = command.file.mimetype;
        }

        const dto = {
            ...command.dto,
            fileUrl: fileUrl,
            fileType: fileType,
            fileSize: fileSize ? BigInt(fileSize) : undefined
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
        const { feeType, allowedCategories, ...rest } = command.dto;
        const dto = {
            ...rest,
            price: new Prisma.Decimal(command.dto.price),
            validFrom: new Date(command.dto.validFrom),
            validUntil: new Date(command.dto.validUntil),
            feeType: command.dto.feeType ? command.dto.feeType as PricingFeeType : undefined,
            allowedCategories: command.dto.allowedCategories 
                ? command.dto.allowedCategories.map(c => c as ApplicationCategory) 
                : undefined
        };
        return this.repository.createPricingTier(dto);
    }
}
@CommandHandler(UpdateProgramPricingTierCommand)
export class UpdateProgramPricingTierHandler implements ICommandHandler<UpdateProgramPricingTierCommand> {
    constructor(@Inject('IProgramContentRepository') private readonly repository: IProgramContentRepository) {}
    async execute(command: UpdateProgramPricingTierCommand) {
        const { feeType, allowedCategories, ...rest } = command.dto;
        const dto = {
            ...rest,
            price: command.dto.price ? new Prisma.Decimal(command.dto.price) : undefined,
            validFrom: command.dto.validFrom ? new Date(command.dto.validFrom) : undefined,
            validUntil: command.dto.validUntil ? new Date(command.dto.validUntil) : undefined,
            feeType: command.dto.feeType ? command.dto.feeType as PricingFeeType : undefined,
            allowedCategories: command.dto.allowedCategories 
                ? command.dto.allowedCategories.map(c => c as ApplicationCategory) 
                : undefined
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

// --- Essay Handlers ---
@CommandHandler(CreateProgramEssayCommand)
export class CreateProgramEssayHandler implements ICommandHandler<CreateProgramEssayCommand> {
    constructor(@Inject('IProgramContentRepository') private readonly repository: IProgramContentRepository) {}
    async execute(command: CreateProgramEssayCommand) {
        return this.repository.createEssay(command.dto);
    }
}
@CommandHandler(UpdateProgramEssayCommand)
export class UpdateProgramEssayHandler implements ICommandHandler<UpdateProgramEssayCommand> {
    constructor(@Inject('IProgramContentRepository') private readonly repository: IProgramContentRepository) {}
    async execute(command: UpdateProgramEssayCommand) {
        return this.repository.updateEssay(command.id, command.dto);
    }
}
@CommandHandler(DeleteProgramEssayCommand)
export class DeleteProgramEssayHandler implements ICommandHandler<DeleteProgramEssayCommand> {
    constructor(@Inject('IProgramContentRepository') private readonly repository: IProgramContentRepository) {}
    async execute(command: DeleteProgramEssayCommand) {
        return this.repository.deleteEssay(command.id);
    }
}

