import { prisma, log } from './utils';
import { BRANDS } from './seed-brands';
import * as bcrypt from 'bcrypt';
import { Prisma } from '@prisma/client';

// Hardcode enums to avoid importing issues if any, or match exactly what's in client
enum Gender {
  male = 'male',
  female = 'female',
  other = 'other'
}

export async function seedParticipants() {
  log('🌱 Seeding Participants & Applications...');

  const iys = await prisma.brand.findUnique({ where: { slug: BRANDS.IYS } });
  if (!iys) return;

  const iys2026 = await prisma.program.findFirst({
    where: { 
      brandId: iys.id, 
      slug: 'istanbul-youth-summit-2026' 
    }
  });

  if (!iys2026) {
    log('⚠️ IYS 2026 Program not found, skipping applications seeding.');
    return;
  }

  // Get Local Auth Provider
  const localProvider = await prisma.authProvider.findUnique({ where: { name: 'local' } });

  // Define Fake Participants
  const participants = [
    {
      email: 'john.participant@example.com',
      name: 'John Participant',
      password: 'password123',
      country: 'Indonesia',
      phone: '+6281234567890',
      gender: Gender.male
    },
    {
      email: 'jane.applicant@example.com',
      name: 'Jane Applicant',
      password: 'password123',
      country: 'Philippines',
      phone: '+639123456789',
      gender: Gender.female
    },
     {
      email: 'alex.winner@example.com',
      name: 'Alex Winner',
      password: 'password123',
      country: 'Malaysia',
      phone: '+60123456789',
      gender: Gender.male
    }
  ];

  for (const p of participants) {
    // 1. Create User/Participant
    const hashedPassword = await bcrypt.hash(p.password, 10);
    
    // Check using Compound Unique
    let user = await prisma.user.findUnique({ 
        where: { 
            email_brandId: {
                email: p.email,
                brandId: iys.id
            }
        } 
    });

    if (!user) {
        user = await prisma.user.create({
            data: {
                email: p.email,
                brand: { connect: { id: iys.id } },
                passwordHash: hashedPassword,
                emailVerified: true,
                isActive: true
            }
        });

        // 1b. Create User Identity (Local)
        if (localProvider) {
            await prisma.userIdentity.create({
                data: {
                    userId: user.id,
                    brandId: iys.id,
                    providerId: localProvider.id,
                    isPrimary: true
                }
            });
        }
    }

    // Ensure Profile exists
    let participant = await prisma.participant.findUnique({ where: { userId: user.id } });
    if (!participant) {
        participant = await prisma.participant.create({
            data: {
                userId: user.id,
                fullName: p.name,
                phoneNumber: p.phone,
                nationality: p.country,
                birthdate: new Date('2000-01-01'), 
                gender: p.gender,
                originCity: 'City',
                originCountry: p.country
            }
        });
    }

    // 2. Create Application for IYS 2026
    const existingApp = await prisma.participantApplication.findUnique({
        where: {
            participantId_programId: {
                participantId: participant.id,
                programId: iys2026.id
            }
        }
    });

    if (!existingApp) {
        let status: any = 'draft';
        let regPaymentStatus: any = 'unpaid';
        let category: any = 'self_funded';
        let scoreToSeed: number | null = null;

        if (p.name.includes('Applicant')) {
            status = 'submitted'; 
            category = 'fully_funded';
        } else if (p.name.includes('Winner')) {
            status = 'accepted';
            regPaymentStatus = 'paid';
            scoreToSeed = 95.5; 
        }

        const app = await prisma.participantApplication.create({
            data: {
                programId: iys2026.id,
                participantId: participant.id,
                status: status,
                registrationPaymentStatus: regPaymentStatus,
                programPaymentStatus: 'unpaid', // Default
                applicationCategory: category,
                submittedAt: status !== 'draft' ? new Date() : null,
                // reviewScore removed
                personalData: {
                    full_name: p.name,
                    whatsapp_number: p.phone,
                    tshirt_size: "M"
                },
                essayAnswers: {
                    "question_1": "My motivation is huge.",
                    "question_2": "I want to solve poverty."
                }
            }
        });

        // Seed Assessment if score exists
        if (scoreToSeed) {
             await prisma.applicationAssessment.create({
                data: {
                    applicationId: app.id,
                    type: 'document_review',
                    status: 'completed',
                    score: scoreToSeed,
                    notes: 'Excellent submission.'
                }
             });
        }
        
        // Seed Invoice if paid
        if (regPaymentStatus === 'paid') {
            // Find pricing tier
             const tier = await prisma.programPricingTier.findFirst({
                 where: { programId: iys2026.id, feeType: 'registration_fee' }
             });
             
             if (tier) {
                 await prisma.applicationInvoice.create({
                     data: {
                         applicationId: app.id,
                         pricingTierId: tier.id,
                         amount: tier.price,
                         currency: tier.currency,
                         status: 'paid',
                         paidAt: new Date(),
                         paymentMethod: 'credit_card',
                         externalTransactionId: 'TXN_' + Math.floor(Math.random() * 100000)
                     }
                 });
             }
        }

        // 3. Seed Document (if accepted)
        if (status === 'accepted') {
            await prisma.participantDocument.create({
                data: {
                    applicationId: app.id,
                    name: "Letter of Acceptance",
                    type: "loa",
                    fileUrl: "https://example.com/loa.pdf",
                    isPublic: false
                }
            });
            
             // 4. Seed Award (for winner)
            const award = await prisma.programAward.findFirst({ where: { programId: iys2026.id, name: "Best Delegate" }});
            if (award) {
                 await prisma.participantAward.create({
                    data: {
                        applicationId: app.id,
                        programAwardId: award.id,
                        notes: "Outstanding performance during the summit."
                    }
                });
            }
        }
    }
  }

  log('✅ Participants & Applications seeded (with Identities)');
}
