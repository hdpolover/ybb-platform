import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../../../shared/infrastructure/prisma/prisma.service';

export interface CreateLoaBatchData {
  programId: string;
  name: string;
  submissionFrom: Date;
  submissionTo: Date;
  createdBy: string;
}

export interface UpdateLoaBatchData {
  name?: string;
  submissionFrom?: Date;
  submissionTo?: Date;
}

@Injectable()
export class LoaReleaseBatchRepository {
  constructor(private readonly prisma: PrismaService) {}

  async findByProgram(programId: string) {
    return this.prisma.loaReleaseBatch.findMany({
      where: { programId, deletedAt: null },
      orderBy: { submissionFrom: 'asc' },
    });
  }

  async findById(id: string) {
    return this.prisma.loaReleaseBatch.findFirst({
      where: { id, deletedAt: null },
    });
  }

  async findOverlapping(
    programId: string,
    from: Date,
    to: Date,
    excludeId?: string,
  ) {
    return this.prisma.loaReleaseBatch.findMany({
      where: {
        programId,
        deletedAt: null,
        ...(excludeId ? { NOT: { id: excludeId } } : {}),
        // overlap: existing.from <= to AND existing.to >= from
        submissionFrom: { lte: to },
        submissionTo: { gte: from },
      },
    });
  }

  async create(data: CreateLoaBatchData) {
    return this.prisma.loaReleaseBatch.create({ data });
  }

  async update(id: string, data: UpdateLoaBatchData) {
    return this.prisma.loaReleaseBatch.update({ where: { id }, data });
  }

  async release(id: string) {
    return this.prisma.loaReleaseBatch.update({
      where: { id },
      data: { releasedAt: new Date() },
    });
  }

  async unrelease(id: string) {
    return this.prisma.loaReleaseBatch.update({
      where: { id },
      data: { releasedAt: null },
    });
  }

  async softDelete(id: string) {
    return this.prisma.loaReleaseBatch.update({
      where: { id },
      data: { deletedAt: new Date() },
    });
  }
}
