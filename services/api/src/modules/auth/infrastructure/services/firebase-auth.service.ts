import { Injectable, OnModuleInit, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as admin from 'firebase-admin';

@Injectable()
export class FirebaseAuthService implements OnModuleInit {
  private readonly logger = new Logger(FirebaseAuthService.name);

  constructor(private readonly configService: ConfigService) {}

  onModuleInit() {
    if (admin.apps.length === 0) {
      const projectId = this.configService.get<string>('FIREBASE_PROJECT_ID');
      const clientEmail = this.configService.get<string>('FIREBASE_CLIENT_EMAIL');
      const rawPrivateKey = this.configService.get<string>('FIREBASE_PRIVATE_KEY');
      let privateKey: string | undefined;

      if (rawPrivateKey) {
        // Handle Base64 encoded private key (common in Docker environments to avoid newline issues)
        if (!rawPrivateKey.includes('-----BEGIN PRIVATE KEY-----')) {
          try {
            const decoded = Buffer.from(rawPrivateKey, 'base64').toString('utf-8');
            if (decoded.includes('-----BEGIN PRIVATE KEY-----')) {
              privateKey = decoded;
            } else {
              privateKey = rawPrivateKey;
            }
          } catch (e) {
             privateKey = rawPrivateKey;
          }
        } else {
          privateKey = rawPrivateKey;
        }

        // Handle escaped newlines (e.g. from .env files)
        privateKey = privateKey.replace(/\\n/g, '\n');
      }

      if (projectId && clientEmail && privateKey) {
        admin.initializeApp({
          credential: admin.credential.cert({
            projectId,
            clientEmail,
            privateKey,
          }),
        });
        this.logger.log('Firebase Admin initialized successfully');
      } else {
        this.logger.warn('Firebase configuration missing. Google Auth will not work.');
      }
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
