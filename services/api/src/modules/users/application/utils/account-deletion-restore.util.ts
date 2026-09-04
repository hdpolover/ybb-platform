// src/modules/users/application/utils/account-deletion-restore.util.ts
import { DeletionStatus, Prisma } from '@prisma/client';

// Narrow structural type for the interactive-transaction client, scoped to
// only the delegates this function calls. `PrismaService` itself does NOT
// work here (unlike its use as an inline $transaction callback annotation
// elsewhere in this codebase) - Prisma's real transaction-client type is
// missing PrismaService's custom fields (pool, logger, etc.), so passing it
// into a parameter typed `PrismaService` fails to typecheck.
type TxLike = {
    accountDeletionRequest: {
        update: (args: { where: { id: string }; data: Record<string, unknown> }) => Promise<unknown>;
    };
    user: {
        update: (args: { where: { id: string }; data: Record<string, unknown> }) => Promise<unknown>;
    };
    participant: {
        updateMany: (args: { where: { userId: string }; data: Record<string, unknown> }) => Promise<unknown>;
    };
};

// Shared restore logic for BOTH cancellation entry points:
//  - CancelDeletionRequestHandler (public, token-based, self-service)
//  - ReviewDeletionRequestHandler's 'reject' action against an already
//    auto-scheduled ("approved") request (admin-initiated cancel)
// Runs inside the caller's own transaction so the request-row flip and the
// account restore commit or fail together. Never called once status is
// already 'completed' (purge has run - callers must check that first) or
// after this has already run once (also caller's responsibility to guard,
// so each call site's own idempotency messaging stays accurate).
export async function restoreAccountDeletionRequest(tx: TxLike, requestId: string, userId: string): Promise<void> {
    await tx.accountDeletionRequest.update({
        where: { id: requestId },
        data: {
            status: DeletionStatus.cancelled,
            scheduledDeletionDate: null,
            // Clears the cancellation token along with it - a used/superseded
            // token must not remain valid for anything.
            dataSnapshot: Prisma.JsonNull,
        },
    });

    await tx.user.update({
        where: { id: userId },
        data: { isActive: true, deletedAt: null },
    });

    // updateMany, not update: some users (e.g. admins) have no participant
    // row at all, and this must be a safe no-op for them rather than a
    // "record not found" throw. In practice deletedAt is never actually set
    // here - the purge job only ever sets it in the same transaction that
    // also flips status to 'completed', and callers already refuse to
    // restore a 'completed' request - but clearing it is cheap insurance
    // against that invariant ever drifting.
    await tx.participant.updateMany({
        where: { userId },
        data: { deletedAt: null },
    });
}
