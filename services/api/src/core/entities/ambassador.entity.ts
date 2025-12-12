export class Ambassador {
    id: string;
    userId: string;
    fullName: string;
    phoneNumber?: string | null;
    referralCode: string;
    programId: string;
    institution?: string | null;
    gender?: string | null;
    totalReferrals: number;
    successfulReferrals: number;
    lastReferralAt?: Date | null;
    firstSuccessfulReferralAt?: Date | null;
    notes?: string | null;
    isActive: boolean;
    activatedAt?: Date | null;
    deactivatedAt?: Date | null;
    deactivationReason?: string | null;
    createdAt: Date;
    updatedAt: Date;
}
