import { Injectable } from '@nestjs/common';
import { IApplicationRepository } from '@core/interfaces/repositories/application.repository.interface';
import { ParticipantApplication, ApplicationStatus } from '@core/entities/participant-application.entity';
import { PrismaService } from '@shared/infrastructure/prisma/prisma.service';
import { ApplicationMapper } from '../mappers/application.mapper';
import { Prisma } from '@prisma/client';

/**
 * Application Repository
 * 
 * Infrastructure Layer - Data Access
 * Implements data persistence using Prisma ORM
 */
@Injectable()
export class ApplicationRepository implements IApplicationRepository {
  constructor(
    private readonly prisma: PrismaService,
    private readonly mapper: ApplicationMapper,
  ) {}

  async findById(id: string): Promise<ParticipantApplication | null> {
    const application = await this.prisma.participantApplication.findUnique({
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
    const applications = await this.prisma.participantApplication.findMany({
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
      limit?: number;
      offset?: number;
    },
  ): Promise<{ applications: ParticipantApplication[]; total: number }> {
    const where: Prisma.ParticipantApplicationWhereInput = { programId };

    if (filters?.status) {
      where.status = filters.status;
    }

    if (filters?.category) {
      where.applicationCategory = filters.category as import('@prisma/client').ApplicationCategory;
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

    const [applications, total] = await Promise.all([
      this.prisma.participantApplication.findMany({
        where,
        take: filters?.limit,
        skip: filters?.offset,
        orderBy: { submittedAt: 'desc' },
      }),
      this.prisma.participantApplication.count({ where }),
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
      limit?: number;
      offset?: number;
    },
  ): Promise<{ applications: ParticipantApplication[]; total: number }> {
    const where: Prisma.ParticipantApplicationWhereInput = {
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

    const [applications, total] = await Promise.all([
      this.prisma.participantApplication.findMany({
        where,
        take: filters?.limit,
        skip: filters?.offset,
        orderBy: { submittedAt: 'desc' },
      }),
      this.prisma.participantApplication.count({ where }),
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
    const counts = await this.prisma.participantApplication.groupBy({
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
