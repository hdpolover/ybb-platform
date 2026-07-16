import { Injectable, NotFoundException, Inject } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { ParticipantApplication } from '@core/entities/participant-application.entity';
import { IApplicationRepository } from '@core/interfaces/repositories/application.repository.interface';
import { GetApplicationQuery } from '../get-application.query';
import {
  ApplicationResponseDto,
  ApplicationStepDto,
  SubmissionFormFieldAdminDto,
  SubmissionSectionAdminDto,
} from '../../dto/application-response.dto';
import { ApplicationMapper } from '@modules/applications/infrastructure/mappers/application.mapper';
import { APPLICATION_REPOSITORY } from '@modules/applications/infrastructure/tokens';
import { CacheService } from '@shared/infrastructure/cache/cache.service';
import { CACHE_KEYS, CACHE_TTL } from '@shared/constants/cache-keys';
import { PrismaService } from '@shared/infrastructure/prisma/prisma.service';
import { PaymentGrpcClient } from '@modules/payments/infrastructure/services/payment-grpc.client';
import { isRenderableEssayQuestion, coalesceStr } from '../../helpers/application-coalesce.helpers';

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
    private readonly paymentClient: PaymentGrpcClient,
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

    // Coalesce app-level fields from personalData for dynamic-form participants
    const pd = (application.personalData ?? {}) as Record<string, unknown>;

    dto.experiences = coalesceStr(application.experiences) ?? coalesceStr(pd['experiences']) ?? coalesceStr(pd['experience']) ?? undefined;
    dto.achievements = coalesceStr(application.achievements) ?? coalesceStr(pd['achievements']) ?? undefined;

    // New app-level fields from personalData
    dto.sourceAccountName = coalesceStr(pd['source_account_name']) ?? null;
    dto.requirementLink = coalesceStr(pd['requirement_link']) ?? null;
    dto.referralCode = coalesceStr(pd['ref_code_ambassador']) ?? coalesceStr(pd['ambassador_referral_code']) ?? null;
    dto.subthemeId = coalesceStr(pd['program_subtheme_id']) ?? null;

    if (query.includeRelations) {
      try {
        const participant = await this.prisma.participant.findUnique({
          where: { id: application.participantId },
          select: {
            id: true, fullName: true, nickName: true,
            birthdate: true, gender: true, nationality: true,
            phoneCountryCode: true, phoneNumber: true,
            originCity: true, originCountry: true, originAddress: true,
            currentCity: true, currentCountry: true, currentAddress: true,
            emergencyContactPhone: true, emergencyContactCountryCode: true,
            emergencyContactRelation: true,
            tshirtSize: true, medicalConditions: true,
            educationLevel: true, institution: true, major: true, organizations: true,
            instagramUsername: true, linkedinUrl: true, portfolioUrl: true,
            knowledgeSource: true, referralCode: true,
            profilePictureUrl: true, resumeUrl: true,
            user: { select: { email: true } },
          },
        });
        if (participant) {
          dto.participant = {
            id: participant.id,
            fullName: participant.fullName,
            nickName: participant.nickName ?? coalesceStr(pd['nickname']) ?? null,
            email: participant.user?.email ?? '',
            phoneCountryCode: participant.phoneCountryCode ?? coalesceStr(pd['phone_country_code']) ?? null,
            phoneNumber: participant.phoneNumber ?? coalesceStr(pd['phone_number']) ?? null,
            birthdate: participant.birthdate,
            gender: participant.gender ?? coalesceStr(pd['gender']) ?? null,
            nationality: participant.nationality ?? coalesceStr(pd['nationality']) ?? null,
            originCity: participant.originCity,
            originCountry: participant.originCountry,
            originAddress: participant.originAddress ?? coalesceStr(pd['origin_address']) ?? null,
            currentCity: participant.currentCity,
            currentCountry: participant.currentCountry,
            currentAddress: participant.currentAddress ?? coalesceStr(pd['current_address']) ?? null,
            emergencyContactName: coalesceStr(pd['emergency_contact_name']) ?? null,
            emergencyContactPhone: participant.emergencyContactPhone ?? coalesceStr(pd['emergency_phone_number']) ?? null,
            emergencyContactCountryCode: participant.emergencyContactCountryCode ?? coalesceStr(pd['emergency_country_code']) ?? null,
            emergencyContactRelation: participant.emergencyContactRelation ?? coalesceStr(pd['contact_relation']) ?? null,
            tshirtSize: participant.tshirtSize ?? coalesceStr(pd['tshirt_size']) ?? null,
            medicalConditions: participant.medicalConditions ?? coalesceStr(pd['disease_history']) ?? null,
            educationLevel: participant.educationLevel ?? coalesceStr(pd['education_level']) ?? null,
            institution: participant.institution ?? coalesceStr(pd['institution']) ?? null,
            major: participant.major ?? coalesceStr(pd['major']) ?? null,
            organizations: participant.organizations ?? coalesceStr(pd['organizations']) ?? null,
            instagramUsername: participant.instagramUsername ?? coalesceStr(pd['instagram_account']) ?? null,
            linkedinUrl: participant.linkedinUrl,
            portfolioUrl: participant.portfolioUrl,
            knowledgeSource: participant.knowledgeSource ?? coalesceStr(pd['knowledge_source']) ?? null,
            referralCode: participant.referralCode,
            profilePictureUrl: participant.profilePictureUrl,
            resumeUrl: participant.resumeUrl ?? coalesceStr(pd['resume_url']) ?? null,
          };
        }
      } catch (e) {
        console.error('Failed to fetch participant for application', e);
      }
    }

    try {
        const payments = await this.paymentClient.getIntentsByReference({
            reference_type: 'application',
            reference_id: application.id
        });

        const intents = payments?.intents ?? [];
        const successfulPayment = intents.find(i =>
             i.status === 'SUCCEEDED'
             && i.metadata?.['payment_category'] === 'registration'
        );

        if (successfulPayment) {
             dto.paymentStatus = 'PAID';
             dto.paymentId = successfulPayment.id;
             dto.paymentAmount = Number(successfulPayment.amount);
        } else {
             const pending = intents.find(i =>
                 ['PENDING', 'REQUIRES_PAYMENT_METHOD'].includes(i.status)
                 && i.metadata?.['payment_category'] === 'registration'
             );
             if (pending) {
                 dto.paymentStatus = pending.status;
                 dto.paymentId = pending.id;
             }
        }
    } catch (error) {
        console.error(`Failed to fetch payment status for app ${application.id}`, error);
    }

    // Load essays and resolve subtheme for admin view
    if (query.includeRelations) {
      try {
        const programEssays = await this.prisma.programEssay.findMany({
          where: { programId: application.programId, isActive: true },
          select: {
            id: true,
            question: true,
            isRequired: true,
            wordLimit: true,
            order: true,
          },
          orderBy: { order: 'asc' },
        });

        const essayAnswers = (application.essayAnswers ?? {}) as Record<string, unknown>;

        dto.essays = programEssays
          .filter((essay) => isRenderableEssayQuestion(essay.question))
          .map((essay) => ({
            id: essay.id,
            question: essay.question.trim().replace(/\s+/g, ' '),
            answer: coalesceStr(essayAnswers[essay.id]) ?? null,
            wordLimit: essay.wordLimit ?? null,
            order: essay.order,
            isRequired: essay.isRequired,
          }));
      } catch (e) {
        console.error('Failed to load essays for application', e);
        dto.essays = [];
      }

      // Resolve subtheme name if we have a subthemeId
      if (dto.subthemeId) {
        try {
          const subtheme = await this.prisma.programSubtheme.findUnique({
            where: { id: dto.subthemeId },
            select: { name: true },
          });
          dto.subthemeName = subtheme?.name ?? null;
        } catch (e) {
          console.error('Failed to resolve subtheme name', e);
          dto.subthemeName = null;
        }
      }
    }

    try {
      const fields = await this.prisma.applicationFormField.findMany({
        where: { programId: application.programId, isActive: true },
        orderBy: { order: 'asc' },
      });

      if (fields.length > 0) {
        dto.steps = this.calculateSteps(application, fields);
        dto.submissionForm = this.buildSubmissionForm(application, fields);
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

  /**
   * Build the structured submission form descriptor for admin use.
   *
   * Design decisions:
   * - Fields in the 'essay' section, or that look like essay prompts
   *   (textarea + word-limit rules), are stored in essayAnswers → store: 'essayAnswers'.
   * - All other fields → store: 'personalData'.
   * - File/upload fields are included but flagged readonly: true so the UI
   *   renders a read-only display rather than an edit control.
   * - The 'preview' section is excluded (it's a UI-only confirmation step,
   *   not a data store).
   * - Full-name / nick-name fields are included in the generic list. The
   *   endpoint's name-sync logic means editing them via personalData is
   *   equivalent to editing via the participant patch — the server keeps them
   *   in sync. The admin UI should therefore NOT render a separate identity
   *   section when submissionForm is present to avoid double-editing.
   */
  private buildSubmissionForm(
    app: ParticipantApplication,
    fields: Prisma.ApplicationFormFieldGetPayload<Record<string, never>>[],
  ): { sections: SubmissionSectionAdminDto[] } {
    const FILE_TYPES = new Set(['file', 'upload', 'document', 'image', 'photo', 'avatar', 'resume']);

    const personalData = (app.personalData ?? {}) as Record<string, unknown>;
    const essayAnswers = (app.essayAnswers ?? {}) as Record<string, unknown>;
    const uploadedFiles = (app.uploadedFiles ?? {}) as Record<string, unknown>;

    const sectionLabels: Record<string, string> = {
      personal_info: 'Personal Information',
      personal_details: 'Personal Details',
      contact_information: 'Contact Information',
      professional_profile: 'Professional Profile',
      entry_information: 'Entry Information',
      essay: 'Essays / Entry Information',
      miscellaneous: 'Miscellaneous',
      additional_info: 'Additional Information',
      documents: 'Documents',
    };

    // Group fields by section, preserving order
    const sectionMap = new Map<string, SubmissionFormFieldAdminDto[]>();

    for (const field of fields) {
      const section = field.section ?? 'personal_info';

      // Skip the preview section — it holds UI-only checklist flags, not data
      if (section === 'preview') continue;

      const isFileField = FILE_TYPES.has(field.type.toLowerCase());
      const isEssayField = this.isEssaySectionField(field);

      // Determine which store this field writes to
      const store: 'personalData' | 'essayAnswers' = isEssayField ? 'essayAnswers' : 'personalData';

      // Resolve current value: check the appropriate store first, then fallback
      const rawValue = isEssayField
        ? (essayAnswers[field.name] ?? personalData[field.name] ?? uploadedFiles[field.name])
        : (personalData[field.name] ?? essayAnswers[field.name] ?? uploadedFiles[field.name]);

      const value = this.coerceToString(rawValue);

      // Parse options from the field definition
      const options = this.parseFieldOptions(field.options);

      const fieldDto: SubmissionFormFieldAdminDto = {
        name: field.name,
        label: field.label,
        type: field.type,
        store,
        section,
        isRequired: field.isRequired,
        value,
        readonly: isFileField,
        ...(options ? { options } : {}),
        order: field.order,
      };

      if (!sectionMap.has(section)) {
        sectionMap.set(section, []);
      }
      sectionMap.get(section)!.push(fieldDto);
    }

    const sections: SubmissionSectionAdminDto[] = [];
    for (const [sectionId, sectionFields] of sectionMap) {
      sections.push({
        section: sectionId,
        label: sectionLabels[sectionId] ?? sectionId.replace(/_/g, ' '),
        fields: sectionFields,
      });
    }

    return { sections };
  }

  /**
   * Returns true if a field is stored in essayAnswers rather than personalData.
   * Mirrors the portal handler's isLegacyEssayFormField heuristic.
   */
  private isEssaySectionField(field: Prisma.ApplicationFormFieldGetPayload<Record<string, never>>): boolean {
    const section = field.section ?? '';
    if (section === 'essay') return true;

    const normalizedName = field.name.toLowerCase().replace(/[^a-z0-9]/g, '');
    if (
      normalizedName.includes('essay')
      || normalizedName.includes('keyword')
      || normalizedName.includes('reference')
    ) {
      return true;
    }

    if (field.type !== 'textarea') return false;

    const normalizedLabel = field.label.trim().toLowerCase().replace(/\s+/g, ' ');
    const normalizedPlaceholder = (field.placeholder ?? '').trim().toLowerCase();
    const rules = field.validationRules;
    const hasWordLimitRule = Boolean(
      rules
      && typeof rules === 'object'
      && ['wordLimit', 'maxWords', 'minWords'].some((key) =>
        Object.prototype.hasOwnProperty.call(rules, key),
      ),
    );
    const looksLikeEssayPrompt =
      normalizedLabel.endsWith('?')
      || normalizedLabel.includes('word limit')
      || normalizedPlaceholder.includes('word limit');

    return hasWordLimitRule || looksLikeEssayPrompt;
  }

  /**
   * Converts an unknown JSON value to a string suitable for display / editing
   * in a text input.  Objects and arrays are JSON-serialised.
   */
  private coerceToString(value: unknown): string {
    if (value === null || value === undefined) return '';
    if (typeof value === 'string') return value;
    if (typeof value === 'number' || typeof value === 'boolean') return String(value);
    try {
      return JSON.stringify(value);
    } catch {
      return '';
    }
  }

  /**
   * Normalises the field `options` JSON blob into a flat label/value array.
   * Returns undefined when there are no usable options (non-select fields).
   */
  private parseFieldOptions(raw: unknown): Array<{ label: string; value: string }> | undefined {
    if (!raw) return undefined;

    let source = raw;

    if (typeof source === 'string') {
      const trimmed = source.trim();
      if (!trimmed) return undefined;
      try {
        source = JSON.parse(trimmed);
      } catch {
        const split = trimmed.split(',').map((s) => s.trim()).filter(Boolean);
        return split.length > 0 ? split.map((s) => ({ label: s, value: s })) : undefined;
      }
    }

    if (Array.isArray(source)) {
      const result: Array<{ label: string; value: string }> = [];
      for (const item of source) {
        if (typeof item === 'string' && item.trim()) {
          result.push({ label: item.trim(), value: item.trim() });
        } else if (item && typeof item === 'object') {
          const rec = item as Record<string, unknown>;
          const label = String(rec.label ?? rec.text ?? rec.name ?? rec.value ?? '').trim();
          const value = String(rec.value ?? rec.id ?? rec.label ?? rec.name ?? '').trim();
          if (label || value) result.push({ label: label || value, value: value || label });
        }
      }
      return result.length > 0 ? result : undefined;
    }

    return undefined;
  }

  private calculateSteps(app: ParticipantApplication, fields: Prisma.ApplicationFormFieldGetPayload<Record<string, never>>[]): ApplicationStepDto[] {
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


