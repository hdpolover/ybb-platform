
import { Injectable, ConflictException, NotFoundException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../../shared/infrastructure/prisma/prisma.service';
import { SubscribeNewsletterDto, UnsubscribeNewsletterDto } from './dtos/subscribe.dto';

@Injectable()
export class NewsletterService {
  constructor(private readonly prisma: PrismaService) {}

  async subscribe(dto: SubscribeNewsletterDto) {
    const existing = await this.prisma.newsletterSubscriber.findFirst({
        where: { email: dto.email }
    });

    if (existing) {
        if (existing.isSubscribed) {
            throw new ConflictException('Email is already subscribed');
        }
        // Reactivate subscription
        return this.prisma.newsletterSubscriber.update({
            where: { id: existing.id },
            data: {
                isSubscribed: true,
                subscribedAt: new Date(),
                unsubscribedAt: null,
                source: dto.source || existing.source,
                name: dto.name || existing.name
            }
        });
    }

    // New subscription
    // Check if user exists to link
    const user = await this.prisma.user.findFirst({
        where: { email: dto.email }
    });

    return this.prisma.newsletterSubscriber.create({
        data: {
            email: dto.email,
            name: dto.name,
            source: dto.source,
            userId: user?.id
        }
    });
  }

  async unsubscribe(dto: UnsubscribeNewsletterDto) {
    const subscriber = await this.prisma.newsletterSubscriber.findFirst({
        where: { email: dto.email }
    });

    if (!subscriber) {
        throw new NotFoundException('Subscriber not found');
    }

    if (!subscriber.isSubscribed) {
        return { message: 'Already unsubscribed' };
    }

    await this.prisma.newsletterSubscriber.update({
        where: { id: subscriber.id },
        data: {
            isSubscribed: false,
            unsubscribedAt: new Date()
        }
    });

    return { message: 'Successfully unsubscribed' };
  }

  async getSubscribers(page: number = 1, limit: number = 10) {
    const skip = (page - 1) * limit;
    
    const [total, data] = await Promise.all([
        this.prisma.newsletterSubscriber.count({ where: { isSubscribed: true } }),
        this.prisma.newsletterSubscriber.findMany({
            where: { isSubscribed: true },
            skip,
            take: limit,
            orderBy: { subscribedAt: 'desc' }
        })
    ]);

    return {
        data,
        meta: {
            total,
            page,
            last_page: Math.ceil(total / limit)
        }
    };
  }
}
