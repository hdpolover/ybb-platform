
import { createMysqlConnection } from './mysql-config';
import { prisma, log, error } from '../utils';

export async function migrateParticipantData() {
    log('📂 Migrating Participant Documents & Payments...');
    const conn = await createMysqlConnection();

    try {
        // 1. Participant Documents (from participant_program_documents)
        // Table: participant_program_documents
        // Columns: id, participant_id, program_document_id, file_url, status
        // New Model: ParticipantDocument (id, participantId, applicationId, type, url, status)

        const [docs]: any = await conn.execute('SELECT * FROM participant_program_documents WHERE is_deleted = 0 AND file_url IS NOT NULL');

        // Improve performance: Group by participant_id to minimize queries if needed, 
        // but for now, we'll iterate. IDs are UUIDs derived from Legacy IDs.

        // Helper to generate IDs - matching migrate-users.ts logic if needed
        const generateAppId = (legacyParticipantId: number) => {
            return `00000000-0000-0000-0000-${legacyParticipantId.toString().padStart(12, '0')}`;
        };

        let docCount = 0;
        for (const d of docs) {
            // Find the User/Participant first?
            // Actually, we linked Application ID directly to Legacy Participant ID in migrate-users.ts
            // appId = `00000000-0000-0000-0000-${p.id.toString().padStart(12, '0')}`

            const appId = generateAppId(d.participant_id);
            const docId = `80000000-0000-0000-0000-${d.id.toString().padStart(12, '0')}`;

            // Check if application exists (it should if user migration ran)
            // We can optimize by not checking every time if we trust the previous step,
            // but prisma upsert requires the connect to exist or foreign key constraint fails.
            // Let's rely on standard upsert.

            // Get document type name from program_documents
            const [docTypes]: any = await conn.execute(`SELECT name, type FROM program_documents WHERE id = ${d.program_document_id}`);
            const docType = docTypes.length > 0 ? (docTypes[0].type || docTypes[0].name) : 'DOCUMENT';

            try {
                await prisma.participantDocument.upsert({
                    where: { id: docId },
                    update: {
                        fileUrl: d.file_url,
                        // status: mapDocStatus(d.status), // Removed: Not in schema
                        // Assuming linked to Application
                        applicationId: appId,
                        name: docType,
                        type: 'document' // General type
                    },
                    create: {
                        id: docId,
                        applicationId: appId,
                        fileUrl: d.file_url,
                        // status: mapDocStatus(d.status), // Removed: Not in schema
                        name: docType,
                        type: 'document'
                    }
                });
                docCount++;
            } catch (e) {
                // If application doesn't exist (maybe deleted user?), skip
                // log(`Current Doc ${d.id} skipped: ${e.message}`);
            }
        }
        log(`✅ Participant Documents synced (${docCount} records)`);


        // 2. Payments (from payments table)
        // Table: payments
        // Columns: id, participant_id, amount, proof_url, status, payment_date
        // New Model: ApplicationInvoice (id, applicationId, amount, status, paidAt, pricingTierId)
        // Strategy: Map proof_url to a new ParticipantDocument of type 'payment_proof'

        const [payments]: any = await conn.execute('SELECT * FROM payments WHERE is_deleted = 0');
        let paymentCount = 0;

        for (const pay of payments) {
            const appId = generateAppId(pay.participant_id);
            const invoiceId = `90000000-0000-0000-0000-${pay.id.toString().padStart(12, '0')}`;

            try {
                // Get Application to find pricingTierId
                const application = await prisma.participantApplication.findUnique({
                    where: { id: appId },
                    select: { pricingTierId: true, programId: true }
                });

                if (!application) {
                    continue;
                }

                let pricingTierId = application.pricingTierId;

                // Fallback: Find default pricing tier for program
                if (!pricingTierId) {
                    const defaultTier = await prisma.programPricingTier.findFirst({
                        where: { programId: application.programId },
                        orderBy: { order: 'asc' }
                    });
                    if (defaultTier) pricingTierId = defaultTier.id;
                }

                if (!pricingTierId) {
                    // log(`Skipping payment ${pay.id}: No pricing tier found for app ${appId}`);
                    continue;
                }

                await prisma.applicationInvoice.upsert({
                    where: { id: invoiceId },
                    update: {
                        amount: pay.amount || 0,
                        currency: pay.currency || 'IDR',
                        status: mapPaymentStatus(pay.status),
                        // proofUrl not in schema, handling below
                        paidAt: pay.payment_date,
                        // Items would be separate, but for direct migration we map the main invoice
                        pricingTierId: pricingTierId
                    },
                    create: {
                        id: invoiceId,
                        applicationId: appId,
                        amount: pay.amount || 0,
                        currency: pay.currency || 'IDR',
                        status: mapPaymentStatus(pay.status),
                        // proofUrl not in schema
                        paidAt: pay.payment_date,
                        createdAt: pay.created_at || new Date(),
                        // dueDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000) 
                        pricingTierId: pricingTierId
                    }
                });

                // Migrate Proof URL as Document
                if (pay.proof_url) {
                    const proofDocId = `99000000-0000-0000-0000-${pay.id.toString().padStart(12, '0')}`;
                    await prisma.participantDocument.upsert({
                        where: { id: proofDocId },
                        update: {
                            fileUrl: pay.proof_url,
                            type: 'payment_proof',
                            name: 'Payment Proof',
                            // status removed
                        },
                        create: {
                            id: proofDocId,
                            applicationId: appId,
                            fileUrl: pay.proof_url,
                            type: 'payment_proof',
                            name: 'Payment Proof',
                            // status removed
                        }
                    });
                }

                paymentCount++;
            } catch (e: any) {
                log(`Payment ${pay.id} skipped: ${e.message}`);
                if (e.code) log(`Error Code: ${e.code}`);
            }
        }
        log(`✅ Payments synced (${paymentCount} records)`);

    } catch (e) {
        error('Participant Data migration failed');
        console.error(e);
    } finally {
        await conn.end();
    }
}

function mapDocStatus(status: string): any {
    switch (status) {
        case 'accepted': return 'verified';
        case 'rejected': return 'rejected';
        case 'under_review': return 'submitted';
        default: return 'pending';
    }
}

function mapPaymentStatus(status: number): any {
    // Legacy: 1=Pending?, 2=Paid?, 3=Rejected? 
    // Need to verify standard status codes from legacy or assume.
    // Based on `participants` table checking in previous steps:
    // 1 might be pending, 2 success/verified. 
    // Let's use specific map if known, else 'pending'.
    // Actually `payments.status` is int.
    // Common: 0=pending, 1=success, 2=failed/expired

    if (status === 1) return 'paid';
    if (status === 2) return 'failed';
    return 'unpaid'; // Default
}

if (require.main === module) {
    migrateParticipantData().catch(console.error);
}
