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
    } catch (error: any) {
      this.logger.error(`Firebase token verification failed: ${error.message}`);
      throw new Error('Invalid Firebase token');
    }
  }
}
