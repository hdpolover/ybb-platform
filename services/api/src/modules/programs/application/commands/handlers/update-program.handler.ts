import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../../../../shared/infrastructure/prisma/prisma.service';
import { CacheService } from '../../../../../shared/infrastructure/cache/cache.service';
import { CACHE_KEYS } from '../../../../../shared/constants/cache-keys';
import { UpdateProgramCommand } from '../update-program.command';

@Injectable()
export class UpdateProgramHandler {
  constructor(
    private readonly prisma: PrismaService,
    private readonly cacheService: CacheService,
  ) {}

  async execute(command: UpdateProgramCommand) {
    const { programId, ...updateData } = command;

    // Check if program exists
    const program = await this.prisma.program.findUnique({
      where: { id: programId },
      select: { id: true, slug: true },
    });

    if (!program) {
      throw new NotFoundException(`Program with ID ${programId} not found`);
    }

    // Update program
    const updatedProgram = await this.prisma.program.update({
      where: { id: programId },
      data: {
        ...updateData,
        updatedAt: new Date(),
      },
    });

    // Invalidate all cache related to this program
    await this.invalidateProgramCache(programId, program.slug);

    return updatedProgram;
  }

  private async invalidateProgramCache(programId: string, slug: string) {
    // Invalidate specific program caches (by ID and slug)
    await this.cacheService.invalidateKey(CACHE_KEYS.PROGRAM_DETAIL(programId));
    await this.cacheService.invalidateKey(CACHE_KEYS.PROGRAM_DETAIL(slug));
    
    // Also invalidate any cached queries with this program's data
    // In a real implementation, you'd track which list queries include this program
    console.log(`Invalidated cache for program ${programId} (${slug})`);
  }
}
