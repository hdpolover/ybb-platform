import { Injectable } from '@nestjs/common';
import { IApplicationRepository } from '@core/interfaces/repositories/application.repository.interface';
import {
  ParticipantApplication,
  ApplicationStatus,
} from '@core/entities/participant-application.entity';
import { PrismaService } from '@shared/infrastructure/prisma/prisma.service';
import { PrismaReadService } from '@shared/infrastructure/prisma/prisma-read.service';
import { ApplicationMapper } from '../mappers/application.mapper';
import {
  ApplicationCategory as PrismaApplicationCategory,
  PaymentStatus,
  Prisma,
} from '@prisma/client';

/**
 * Application Repository
 * 
 * Infrastructure Layer - Data Access
 * Implements data persistence using Prisma ORM
 */
@Injectable()
export class ApplicationRepository implements IApplicationRepository {
  private readonly readClient: PrismaService | PrismaReadService;

  constructor(
    private readonly prisma: PrismaService,
    private readonly mapper: ApplicationMapper,
    readPrisma?: PrismaReadService,
  ) {
    this.readClient = readPrisma ?? prisma;
  }

  private buildCreatedAtFilter(startDate?: string, endDate?: string): Prisma.DateTimeFilter | undefined {
    if (!startDate && !endDate) {
      return undefined;
    }

    const createdAt: Prisma.DateTimeFilter = {};

    if (startDate) {
      createdAt.gte = new Date(`${startDate}T00:00:00.000Z`);
    }

    if (endDate) {
      createdAt.lte = new Date(`${endDate}T23:59:59.999Z`);
    }

    return createdAt;
  }

  private buildOrderBy(filters?: {
    sortBy?:
      | 'updatedAt'
      | 'createdAt'
      | 'submittedAt'
      | 'participantName'
      | 'country'
      | 'status'
      | 'registrationPaymentStatus'
      | 'programPaymentStatus';
    sortOrder?: 'asc' | 'desc';
  }): Prisma.ParticipantApplicationOrderByWithRelationInput[] {
    const sortOrder: Prisma.SortOrder = filters?.sortOrder === 'asc' ? 'asc' : 'desc';

    if (!filters?.sortBy) {
      return [{ updatedAt: 'desc' }, { createdAt: 'desc' }];
    }

    switch (filters.sortBy) {
      case 'createdAt':
        return [{ createdAt: sortOrder }, { updatedAt: 'desc' }];
      case 'submittedAt':
        return [{ submittedAt: sortOrder }, { updatedAt: 'desc' }];
      case 'participantName':
        return [{ participant: { fullName: sortOrder } }, { updatedAt: 'desc' }];
      case 'country':
        return [{ participant: { originCountry: sortOrder } }, { updatedAt: 'desc' }];
      case 'status':
        return [{ status: sortOrder }, { updatedAt: 'desc' }];
      case 'registrationPaymentStatus':
        return [{ registrationPaymentStatus: sortOrder }, { updatedAt: 'desc' }];
      case 'programPaymentStatus':
        return [{ programPaymentStatus: sortOrder }, { updatedAt: 'desc' }];
      case 'updatedAt':
      default:
        return [{ updatedAt: sortOrder }, { createdAt: 'desc' }];
    }
  }

  async findById(id: string): Promise<ParticipantApplication | null> {
    const application = await this.readClient.participantApplication.findUnique({
      where: { id },
    });

    return application ? this.mapper.toDomain(application) : null;
  }

  async findByParticipantAndProgram(
    participantId: string,
    programId: string,
  ): Promise<ParticipantApplication | null> {
    const application = await this.prisma.participantApplication.findUnique({
      where: {
        participantId_programId: {
          participantId,
          programId,
        },
      },
    });

    return application ? this.mapper.toDomain(application) : null;
  }

  async findByParticipant(participantId: string): Promise<ParticipantApplication[]> {
    const applications = await this.readClient.participantApplication.findMany({
      where: { participantId },
      orderBy: { createdAt: 'desc' },
    });

    return applications.map(app => this.mapper.toDomain(app));
  }

  async findByProgram(
    programId: string,
    filters?: {
      status?: ApplicationStatus;
      category?: string;
      search?: string;
      country?: string;
      registrationPaymentStatus?: PaymentStatus;
      programPaymentStatus?: PaymentStatus;
      sortBy?:
        | 'updatedAt'
        | 'createdAt'
        | 'submittedAt'
        | 'participantName'
        | 'country'
        | 'status'
        | 'registrationPaymentStatus'
        | 'programPaymentStatus';
      sortOrder?: 'asc' | 'desc';
      startDate?: string;
      endDate?: string;
      limit?: number;
      offset?: number;
    },
  ): Promise<{ applications: ParticipantApplication[]; total: number }> {
    const where: Prisma.ParticipantApplicationWhereInput = { programId, deletedAt: null };

    if (filters?.status) {
      where.status = filters.status;
    }

    if (filters?.category) {
      where.applicationCategory = filters.category as PrismaApplicationCategory;
    }

    if (filters?.search) {
      where.OR = [
        { motivationLetter: { contains: filters.search, mode: 'insensitive' } },
        { achievements: { contains: filters.search, mode: 'insensitive' } },
        { experiences: { contains: filters.search, mode: 'insensitive' } },
        { participant: { fullName: { contains: filters.search, mode: 'insensitive' } } },
        { participant: { user: { email: { contains: filters.search, mode: 'insensitive' } } } },
      ];
    }

    if (filters?.country) {
      const andConditions = Array.isArray(where.AND)
        ? where.AND
        : where.AND
          ? [where.AND]
          : [];
      where.AND = [
        ...andConditions,
        {
          OR: [
            { participant: { originCountry: { contains: filters.country, mode: 'insensitive' } } },
            { participant: { nationality: { contains: filters.country, mode: 'insensitive' } } },
          ],
        },
      ];
    }

    if (filters?.registrationPaymentStatus) {
      where.registrationPaymentStatus = filters.registrationPaymentStatus;
    }

    if (filters?.programPaymentStatus) {
      where.programPaymentStatus = filters.programPaymentStatus;
    }

    const createdAt = this.buildCreatedAtFilter(filters?.startDate, filters?.endDate);
    if (createdAt) {
      where.createdAt = createdAt;
    }

    const [applications, total] = await Promise.all([
      this.readClient.participantApplication.findMany({
        where,
        take: filters?.limit,
        skip: filters?.offset,
        orderBy: this.buildOrderBy(filters),
      }),
      this.readClient.participantApplication.count({ where }),
    ]);

    return {
      applications: applications.map(app => this.mapper.toDomain(app)),
      total,
    };
  }

  async findByBrand(
    brandId: string,
    filters?: {
      programId?: string;
      status?: ApplicationStatus;
      category?: string;
      search?: string;
      country?: string;
      registrationPaymentStatus?: PaymentStatus;
      programPaymentStatus?: PaymentStatus;
      sortBy?:
        | 'updatedAt'
        | 'createdAt'
        | 'submittedAt'
        | 'participantName'
        | 'country'
        | 'status'
        | 'registrationPaymentStatus'
        | 'programPaymentStatus';
      sortOrder?: 'asc' | 'desc';
      startDate?: string;
      endDate?: string;
      limit?: number;
      offset?: number;
    },
  ): Promise<{ applications: ParticipantApplication[]; total: number }> {
    const where: Prisma.ParticipantApplicationWhereInput = {
      deletedAt: null,
      program: {
        brand: {
          id: brandId,
        },
      },
    };

    if (filters?.programId) {
      where.programId = filters.programId;
    }

    if (filters?.status) {
      where.status = filters.status;
    }

    if (filters?.category) {
      where.applicationCategory = filters.category as PrismaApplicationCategory;
    }

    if (filters?.search) {
      where.OR = [
        { motivationLetter: { contains: filters.search, mode: 'insensitive' } },
        { achievements: { contains: filters.search, mode: 'insensitive' } },
        { experiences: { contains: filters.search, mode: 'insensitive' } },
        { participant: { fullName: { contains: filters.search, mode: 'insensitive' } } },
        { participant: { user: { email: { contains: filters.search, mode: 'insensitive' } } } },
      ];
    }

    if (filters?.country) {
      const andConditions = Array.isArray(where.AND)
        ? where.AND
        : where.AND
          ? [where.AND]
          : [];
      where.AND = [
        ...andConditions,
        {
          OR: [
            { participant: { originCountry: { contains: filters.country, mode: 'insensitive' } } },
            { participant: { nationality: { contains: filters.country, mode: 'insensitive' } } },
          ],
        },
      ];
    }

    if (filters?.registrationPaymentStatus) {
      where.registrationPaymentStatus = filters.registrationPaymentStatus;
    }

    if (filters?.programPaymentStatus) {
      where.programPaymentStatus = filters.programPaymentStatus;
    }

    const createdAt = this.buildCreatedAtFilter(filters?.startDate, filters?.endDate);
    if (createdAt) {
      where.createdAt = createdAt;
    }

    const [applications, total] = await Promise.all([
      this.readClient.participantApplication.findMany({
        where,
        take: filters?.limit,
        skip: filters?.offset,
        orderBy: this.buildOrderBy(filters),
      }),
      this.readClient.participantApplication.count({ where }),
    ]);

    return {
      applications: applications.map(app => this.mapper.toDomain(app)),
      total,
    };
  }

  async create(application: ParticipantApplication): Promise<ParticipantApplication> {
    const data = this.mapper.toPrismaCreate(application);

    const created = await this.prisma.participantApplication.create({
      data: data as import('@prisma/client').Prisma.ParticipantApplicationCreateInput,
    });

    return this.mapper.toDomain(created);
  }

  async update(application: ParticipantApplication): Promise<ParticipantApplication> {
    const data = this.mapper.toPrismaUpdate(application);

    const updated = await this.prisma.participantApplication.update({
      where: { id: application.id },
      data,
    });

    return this.mapper.toDomain(updated);
  }

  async delete(id: string, deletedBy: string): Promise<void> {
    await this.prisma.participantApplication.update({
      where: { id },
      data: {
        deletedAt: new Date(),
        deletedBy,
      },
    });
  }

  async countByStatus(programId: string): Promise<Record<ApplicationStatus, number>> {
    const counts = await this.readClient.participantApplication.groupBy({
      by: ['status'],
      where: { programId },
      _count: true,
    });

    const result: Record<string, number> = {};
    counts.forEach(({ status, _count }) => {
      result[status] = _count;
    });

    return result as Record<ApplicationStatus, number>;
  }

  async exists(participantId: string, programId: string): Promise<boolean> {
    const count = await this.prisma.participantApplication.count({
      where: {
        participantId,
        programId,
      },
    });

    return count > 0;
  }
}
