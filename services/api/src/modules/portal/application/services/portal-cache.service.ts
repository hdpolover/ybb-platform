import { Injectable } from '@nestjs/common';
import { PrismaService } from '@shared/infrastructure/prisma/prisma.service';
import { CacheService } from '@shared/infrastructure/cache/cache.service';
import { CACHE_KEYS, CACHE_TTL } from '@shared/constants/cache-keys';

type ParticipantProfile = {
    id: string;
    userId: string;
    fullName: string;
    nickName: string | null;
    displayName: string | null;
    gender: string | null;
    phoneCountryCode: string | null;
    phoneNumber: string | null;
    birthdate: Date | null;
    nationality: string | null;
    nationalityCode: string | null;
    originCountry: string | null;
    originCity: string | null;
    originAddress: string | null;
    currentCountry: string | null;
    currentCity: string | null;
    currentAddress: string | null;
    educationLevel: string | null;
    institution: string | null;
    major: string | null;
    occupation: string | null;
    organizations: string | null;
    instagramUsername: string | null;
    tshirtSize: string | null;
    medicalConditions: string | null;
    emergencyContactRelation: string | null;
    emergencyContactCountryCode: string | null;
    emergencyContactPhone: string | null;
    profilePictureUrl: string | null;
    resumeUrl: string | null;
    knowledgeSource: string | null;
    referralCode: string | null;
    createdAt: Date;
    updatedAt: Date;
    user: {
        id: string;
        email: string;
    };
};

type ParticipantStats = {
    applicationsCount: number;
    completedProgramsCount: number;
    certificatesCount: number;
};

/**
 * Portal Cache Service
 * 
 * Provides optimized, cached lookups for common portal queries
 * to reduce database load and improve response times
 */
@Injectable()
export class PortalCacheService {
    constructor(
        private readonly prisma: PrismaService,
        private readonly cacheService: CacheService,
    ) {}

    /**
     * Get participant profile with caching
     * This is called by all 4 portal endpoints, so caching saves 4 DB queries per page load
     */
    async getParticipantProfile(userId: string): Promise<ParticipantProfile | null> {
        const cacheKey = CACHE_KEYS.PARTICIPANT_PROFILE(userId);
        const cached = await this.cacheService.get<ParticipantProfile>(cacheKey);
        
        if (cached && Object.prototype.hasOwnProperty.call(cached, 'displayName')) {
            return cached;
        }

        const participant = await this.prisma.participant.findUnique({
            where: { userId },
            select: {
                id: true,
                userId: true,
                fullName: true,
                nickName: true,
                displayName: true,
                gender: true,
                phoneCountryCode: true,
                phoneNumber: true,
                birthdate: true,
                nationality: true,
                nationalityCode: true,
                originCountry: true,
                originCity: true,
                originAddress: true,
                currentCountry: true,
                currentCity: true,
                currentAddress: true,
                educationLevel: true,
                institution: true,
                major: true,
                occupation: true,
                organizations: true,
                instagramUsername: true,
                tshirtSize: true,
                medicalConditions: true,
                emergencyContactRelation: true,
                emergencyContactCountryCode: true,
                emergencyContactPhone: true,
                profilePictureUrl: true,
                resumeUrl: true,
                knowledgeSource: true,
                referralCode: true,
                createdAt: true,
                updatedAt: true,
                user: {
                    select: {
                        id: true,
                        email: true,
                    }
                }
            }
        });

        if (participant) {
            // Cache for 15 minutes - profile data doesn't change frequently
            await this.cacheService.set(cacheKey, participant, CACHE_TTL.LONG);
        }

        return participant;
    }

    /**
     * Get participant stats with caching
     * Aggregated counts that are expensive to compute
     */
    async getParticipantStats(participantId: string): Promise<ParticipantStats> {
        const cacheKey = CACHE_KEYS.PARTICIPANT_STATS(participantId);
        const cached = await this.cacheService.get<ParticipantStats>(cacheKey);
        
        if (cached) {
            return cached;
        }

        const [appCount, certCount] = await Promise.all([
            this.prisma.participantApplication.count({ 
                where: { participantId } 
            }),
            this.prisma.participantDocument.count({
                where: { 
                    application: { participantId },
                    type: 'certificate' 
                }
            })
        ]);

        const stats = {
            applicationsCount: appCount,
            completedProgramsCount: 0, // Placeholder for now
            certificatesCount: certCount
        };

        // Cache for 15 minutes
        await this.cacheService.set(cacheKey, stats, CACHE_TTL.LONG);

        return stats;
    }

    /**
     * Get latest application with light data for quick lookups
     * Each portal endpoint then fetches additional details as needed
     */
    async getLatestApplicationId(participantId: string): Promise<string | null> {
        const cacheKey = CACHE_KEYS.PARTICIPANT_LATEST_APP(participantId);
        const cached = await this.cacheService.get<string>(cacheKey);
        
        if (cached) {
            return cached;
        }

        const app = await this.prisma.participantApplication.findFirst({
            where: { participantId },
            orderBy: { updatedAt: 'desc' },
            select: { id: true }
        });

        if (app) {
            // Cache for 5 minutes - applications update frequently
            await this.cacheService.set(cacheKey, app.id, CACHE_TTL.MEDIUM);
            return app.id;
        }

        return null;
    }

    /**
     * Get program essays with caching
     */
    async getProgramEssays(programId: string) {
        const cacheKey = CACHE_KEYS.PROGRAM_ESSAYS(programId);
        const cached = await this.cacheService.get(cacheKey);
        
        if (cached) {
            return cached;
        }

        const essays = await this.prisma.programEssay.findMany({
            where: { programId, isActive: true },
            select: {
                id: true,
                question: true,
                isRequired: true,
                wordLimit: true,
                order: true
            },
            orderBy: { order: 'asc' }
        });

        // Cache for 1 hour - essays rarely change
        await this.cacheService.set(cacheKey, essays, CACHE_TTL.HOUR);

        return essays;
    }

    /**
     * Get program requirements with caching
     */
    async getProgramRequirements(programId: string) {
        const cacheKey = CACHE_KEYS.PROGRAM_REQUIREMENTS(programId);
        const cached = await this.cacheService.get(cacheKey);
        
        if (cached) {
            return cached;
        }

        const requirements = await this.prisma.programRequirement.findMany({
            where: { programId, isActive: true },
            select: {
                id: true,
                name: true,
                description: true,
                type: true,
                isRequired: true,
                order: true
            },
            orderBy: { order: 'asc' }
        });

        // Cache for 1 hour
        await this.cacheService.set(cacheKey, requirements, CACHE_TTL.HOUR);

        return requirements;
    }

    /**
     * Get program resources with caching
     */
    async getProgramResources(programId: string) {
        const cacheKey = CACHE_KEYS.PROGRAM_RESOURCES(programId);
        const cached = await this.cacheService.get(cacheKey);
        
        if (cached) {
            return cached;
        }

        const resources = await this.prisma.programResource.findMany({
            where: { 
                programId,
                isActive: true 
            },
            select: {
                id: true,
                title: true,
                description: true,
                type: true,
                fileUrl: true,
                isPublic: true,
                order: true,
                updatedAt: true
            },
            orderBy: { order: 'asc' }
        });

        // Cache for 1 hour
        await this.cacheService.set(cacheKey, resources, CACHE_TTL.HOUR);

        return resources;
    }

    /**
     * Invalidate all participant-related caches
     * Call this when participant profile is updated
     */
    async invalidateParticipantCache(userId: string, participantId: string): Promise<void> {
        await Promise.all([
            this.cacheService.invalidateKey(CACHE_KEYS.PARTICIPANT_PROFILE(userId)),
            this.cacheService.invalidateKey(CACHE_KEYS.PARTICIPANT_STATS(participantId)),
            this.cacheService.invalidateKey(CACHE_KEYS.PARTICIPANT_LATEST_APP(participantId)),
        ]);
    }

    /**
     * Invalidate program data caches
     * Call this when program content is updated
     */
    async invalidateProgramCache(programId: string): Promise<void> {
        await Promise.all([
            this.cacheService.invalidateByPattern(CACHE_KEYS.PROGRAM_ESSAYS(programId)),
            this.cacheService.invalidateByPattern(CACHE_KEYS.PROGRAM_REQUIREMENTS(programId)),
            this.cacheService.invalidateByPattern(CACHE_KEYS.PROGRAM_PRICING(programId)),
            this.cacheService.invalidateByPattern(CACHE_KEYS.PROGRAM_RESOURCES(programId)),
            this.cacheService.invalidateByPattern(`program:announcements:${programId}:*`),
        ]);
    }
}
