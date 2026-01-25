import { Injectable, NotFoundException, Inject } from '@nestjs/common';
import { IApplicationRepository } from '@core/interfaces/repositories/application.repository.interface';
import { GetApplicationQuery } from '../get-application.query';
import { ApplicationResponseDto, ApplicationStepDto } from '../../dto/application-response.dto';
import { ApplicationMapper } from '@modules/applications/infrastructure/mappers/application.mapper';
import { APPLICATION_REPOSITORY } from '@modules/applications/infrastructure/tokens';
import { CacheService } from '@shared/infrastructure/cache/cache.service';
import { CACHE_KEYS, CACHE_TTL } from '@shared/constants/cache-keys';
import { PrismaService } from '@shared/infrastructure/prisma/prisma.service';

/**
 * Get Application Handler
 * 
 * Application Layer - Query Handler
 * Handles retrieval of single application
 */
@Injectable()
export class GetApplicationHandler {
  constructor(
    @Inject(APPLICATION_REPOSITORY)
    private readonly applicationRepository: IApplicationRepository,
    private readonly applicationMapper: ApplicationMapper,
    private readonly cacheService: CacheService,
    private readonly prisma: PrismaService,
  ) { }

  async execute(query: GetApplicationQuery): Promise<ApplicationResponseDto> {
    // Only cache if not including relations (simpler caching)
    const cacheKey = query.includeRelations
      ? null
      : CACHE_KEYS.APPLICATION(query.applicationId);

    // Check cache first (if applicable)
    if (cacheKey) {
      const cached = await this.cacheService.get<ApplicationResponseDto>(cacheKey);
      if (cached) {
        return cached;
      }
    }

    // Fetch from database
    const application = await this.applicationRepository.findById(query.applicationId);

    if (!application) {
      throw new NotFoundException(`Application ${query.applicationId} not found`);
    }

    const dto = this.applicationMapper.toDto(application, query.includeRelations);

    try {
      const fields = await this.prisma.applicationFormField.findMany({
        where: { programId: application.programId, isActive: true },
        orderBy: { order: 'asc' },
      });

      if (fields.length > 0) {
        dto.steps = this.calculateSteps(application, fields);
      } else {
        dto.steps = [
            { section: 'personal_info', label: 'Personal Details', status: 'completed', flag: 'completed', progress: 100 },
            { section: 'professional_profile', label: 'Professional Profile', status: 'not_started', flag: 'not-yet', progress: 0 },
            { section: 'entry_information', label: 'Entry Information', status: 'not_started', flag: 'not-yet', progress: 0 },
            { section: 'preview', label: 'Preview', status: 'not_started', flag: 'not-yet', progress: 0 },
        ];
      }
    } catch (e) {
      console.error('Error calculating steps:', e);
    }

    // Cache for 2 minutes (if applicable)
    if (cacheKey) {
      await this.cacheService.set(cacheKey, dto, CACHE_TTL.SHORT);
    }

    return dto;
  }

  private calculateSteps(app: any, fields: any[]): ApplicationStepDto[] {
    const fieldSections = [...new Set(fields.map(f => f.section))];
    if(!fieldSections.includes('preview')) fieldSections.push('preview');

     const sectionLabels: Record<string, string> = {
        'personal_info': 'Personal Details',
        'professional_profile': 'Professional Profile',
        'essay': 'Entry Information', 
        'documents': 'Documents',
        'preview': 'Preview'
    };

     return fieldSections.map(section => {
        if (section === 'preview') {
             return {
                section,
                label: 'Preview',
                status: 'not_started', 
                flag: 'not-yet',
                progress: 0
            };
        }

        const sectionFields = fields.filter(f => f.section === section);
        const requiredFields = sectionFields.filter(f => f.isRequired);
        
        let completedCount = 0;
        
        requiredFields.forEach(f => {
            const val = app.personalData?.[f.name] || app.essayAnswers?.[f.name] || app.uploadedFiles?.[f.name];
            if (val !== undefined && val !== null && val !== '') {
                completedCount++;
            }
        });

        const totalRequired = requiredFields.length;
        const progress = totalRequired === 0 ? 100 : Math.round((completedCount / totalRequired) * 100);
        
        let status: 'completed' | 'in_progress' | 'not_started' = 'not_started';
        let flag = 'not-yet';

        if (progress === 100) {
            status = 'completed';
            flag = 'completed';
        } else if (progress > 0) {
            status = 'in_progress';
            flag = 'process';
        } 

        return {
            section,
            label: sectionLabels[section] || section.replace(/_/g, ' '),
            status,
            flag,
            progress
        };
    });
  }
}


