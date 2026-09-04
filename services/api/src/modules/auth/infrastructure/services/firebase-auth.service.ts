import { Injectable, OnModuleInit, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as admin from 'firebase-admin';

@Injectable()
export class FirebaseAuthService implements OnModuleInit {
  private readonly logger = new Logger(FirebaseAuthService.name);

  constructor(private readonly configService: ConfigService) {}

  onModuleInit() {
    if (admin.apps.length === 0) {
      // 0. Priority: specific JSON content in Env Var (Best for Dokploy/Production)
      if (process.env.FIREBASE_SERVICE_ACCOUNT_JSON) {
        try {
            const serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT_JSON);
            admin.initializeApp({
                credential: admin.credential.cert(serviceAccount),
            });
            this.logger.log('Firebase Admin initialized using FIREBASE_SERVICE_ACCOUNT_JSON env var');
            return;
        } catch (err) {
            this.logger.error(`Failed to parse FIREBASE_SERVICE_ACCOUNT_JSON: ${err.message}`);
        }
      }

      // 1. Try "The Easy Way" (Application Default Credentials / File Path)
      // This works if GOOGLE_APPLICATION_CREDENTIALS env var is set to a path,
      // or if running in GCP (Cloud Run, App Engine, etc)
      if (process.env.GOOGLE_APPLICATION_CREDENTIALS) {
        try {
          admin.initializeApp({
            credential: admin.credential.applicationDefault(),
          });
          this.logger.log('Firebase Admin initialized using Application Default Credentials');
          return;
        } catch (err) {
            this.logger.error(`Failed to initialize Application Default Credentials: ${err.message}`);
        }
      }

      // 2. Fallback check
      // If we reached here, both methods failed or were missing.
      this.logger.warn('Firebase Admin failed to initialize. Please set either FIREBASE_SERVICE_ACCOUNT_JSON or GOOGLE_APPLICATION_CREDENTIALS.');
    }
  }

  async verifyIdToken(token: string): Promise<admin.auth.DecodedIdToken> {
    try {
      return await admin.auth().verifyIdToken(token);
    } catch (error: unknown) {
      this.logger.error(`Firebase token verification failed: ${error instanceof Error ? error.message : String(error)}`);
      throw new Error('Invalid Firebase token');
    }
  }

  /**
   * Deletes a Firebase Auth user by uid. Used by the account-deletion purge
   * job - without this, a deleted account's Google/OAuth credential still
   * lives in Firebase forever, so the person can sign in again and (via
   * firebase-login.handler's auto-register path) get a brand-new account,
   * making the whole deletion feature cosmetic.
   *
   * `auth/user-not-found` is treated as success, not failure: the purge job
   * calls this before touching the database and retries the whole user on
   * any other error, so a retry after a prior run already deleted this uid
   * must be able to converge instead of failing forever.
   */
  async deleteUser(uid: string): Promise<void> {
    try {
      await admin.auth().deleteUser(uid);
    } catch (error: unknown) {
      const code = (error as { code?: string } | undefined)?.code;
      if (code === 'auth/user-not-found') {
        this.logger.warn(`Firebase user ${uid} already deleted or not found; treating as success`);
        return;
      }
      this.logger.error(`Failed to delete Firebase user ${uid}: ${error instanceof Error ? error.message : String(error)}`);
      throw error;
    }
  }
}
