import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaReadService } from '@shared/infrastructure/prisma/prisma-read.service';
import { ReadinessContext } from '../domain/readiness-rule.types';
import { PaymentConfigClient } from './payment-config.client';

// The soft-delete Prisma extension injects deletedAt into findUnique/findFirst/
// findMany/delete/deleteMany but NOT into count(). Every count below passes it
// explicitly; dropping it makes rules pass on deleted rows.
const LIVE_PROGRAM = { isPublished: true, isActive: true, status: { not: 'draft' }, deletedAt: null };

@Injectable()
export class ReadinessContextLoader {
  constructor(
    private readonly read: PrismaReadService,
    private readonly payment: PaymentConfigClient,
  ) {}

  async loadBrand(brandId: string): Promise<ReadinessContext> {
    const brand = await this.read.brand.findUnique({
      where: { id: brandId },
      include: { settings: true },
    });
    if (!brand) throw new NotFoundException(`Brand ${brandId} not found`);

    const [activeSignatureCount, legalDocumentCount, publishedProgramCount] = await Promise.all([
      this.read.signature.count({ where: { brandId, isActive: true, deletedAt: null } }),
      this.read.legalDocument.count({ where: { brandId, isActive: true, deletedAt: null } }),
      this.read.program.count({ where: { brandId, ...LIVE_PROGRAM } }),
    ]);

    return {
      brand: {
        id: brand.id,
        name: brand.name,
        primaryColor: brand.primaryColor,
        logoUrl: brand.logoUrl,
        logoIconUrl: brand.logoIconUrl,
        landingUrl: brand.landingUrl,
        tagline: brand.tagline,
        defaultCurrency: brand.defaultCurrency,
        isMaintenanceMode: brand.settings?.isMaintenanceMode ?? false,
        supportEmail: brand.settings?.supportEmail ?? null,
        activeSignatureCount,
        legalDocumentCount,
        publishedProgramCount,
      },
    };
  }

  async loadProgram(programId: string): Promise<ReadinessContext> {
    const program = await this.read.program.findUnique({ where: { id: programId } });
    if (!program) throw new NotFoundException(`Program ${programId} not found`);

    const brandCtx = await this.loadBrand(program.brandId);

    const [pricingTierCount, objectiveCount, faqCount, galleryCount, testimonialCount, paymentMethods] =
      await Promise.all([
        this.read.programPricingTier.count({ where: { programId, isActive: true, deletedAt: null } }),
        this.read.programObjective.count({ where: { programId, isActive: true, deletedAt: null } }),
        this.read.programFaq.count({ where: { programId, isActive: true, deletedAt: null } }),
        this.read.programGallery.count({ where: { programId, isActive: true, deletedAt: null } }),
        // programId is nullable on ProgramTestimonial: a brand-scoped row still
        // renders on the program page, so counting only programId under-reports.
        this.read.programTestimonial.count({
          where: {
            isActive: true,
            deletedAt: null,
            OR: [{ programId }, { brandId: program.brandId, programId: null }],
          },
        }),
        this.payment.getProgramMethodSummary(programId),
      ]);

    return {
      brand: brandCtx.brand,
      program: {
        id: program.id,
        name: program.name,
        bannerUrl: program.bannerUrl,
        description: program.description,
        registrationOpenDate: program.registrationOpenDate,
        registrationCloseDate: program.registrationCloseDate,
        applicationDeadline: program.applicationDeadline,
        pricingTierCount,
        objectiveCount,
        faqCount,
        galleryCount,
        testimonialCount,
        paymentMethods,
      },
    };
  }
}
