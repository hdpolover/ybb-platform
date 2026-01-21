import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '@shared/infrastructure/prisma/prisma.service';
import { CreateAiBotConfigDto } from './dtos/create-ai-bot.dto';
import { UpdateAiBotConfigDto } from './dtos/update-ai-bot.dto';

@Injectable()
export class AiBotService {
  constructor(private readonly prisma: PrismaService) {}

  async create(dto: CreateAiBotConfigDto) {
    return this.prisma.aiChatBotConfig.create({
      data: {
        ...dto,
      },
    });
  }

  async findAll(page: number = 1, limit: number = 10) {
    const skip = (page - 1) * limit;
    const [data, total] = await Promise.all([
      this.prisma.aiChatBotConfig.findMany({
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
        include: { programCategory: { select: { id: true, name: true } } },
      }),
      this.prisma.aiChatBotConfig.count(),
    ]);

    return {
      data,
      meta: {
        total,
        page,
        last_page: Math.ceil(total / limit),
      },
    };
  }

  async findOne(id: string) {
    const bot = await this.prisma.aiChatBotConfig.findUnique({
      where: { id },
      include: { programCategory: { select: { id: true, name: true } } },
    });
    if (!bot) throw new NotFoundException('AiChatBotConfig not found');
    return bot;
  }

  async update(id: string, dto: UpdateAiBotConfigDto) {
    await this.findOne(id); // Ensure exists
    return this.prisma.aiChatBotConfig.update({
      where: { id },
      data: dto,
    });
  }

  async remove(id: string) {
    await this.findOne(id);
    return this.prisma.aiChatBotConfig.delete({
      where: { id },
    });
  }

  /**
   * Retrieves the active bot configuration.
   * Priority:
   * 1. Specific Program Category (if provided)
   * 2. Global Config (programCategoryId is null)
   */
  async getActiveConfig(programCategoryId?: string) {
    if (programCategoryId) {
      const categoryBot = await this.prisma.aiChatBotConfig.findFirst({
        where: {
          programCategoryId,
          isActive: true,
        },
      });
      if (categoryBot) return categoryBot;
    }

    // Fallback to Global
    const globalBot = await this.prisma.aiChatBotConfig.findFirst({
      where: {
        programCategoryId: null,
        isActive: true,
      },
    });

    return globalBot || null; // Return null if no bot is configured
  }
}
