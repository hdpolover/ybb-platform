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
        // Strip framing quotes if present (some env injectors add them)
        const cleanRawKey = rawPrivateKey.replace(/^"|"$/g, '');
        
        // Handle Base64 encoded private key (common in Docker environments to avoid newline issues)
        if (!cleanRawKey.includes('-----BEGIN PRIVATE KEY-----') && !cleanRawKey.includes('-----BEGIN RSA PRIVATE KEY-----')) {
          try {
            const decoded = Buffer.from(cleanRawKey, 'base64').toString('utf-8');
            if (decoded.includes('-----BEGIN PRIVATE KEY-----') || decoded.includes('-----BEGIN RSA PRIVATE KEY-----')) {
              privateKey = decoded;
              this.logger.log('Successfully decoded Base64 private key');
            } else {
              // If decode doesn't result in a PEM header, it might mean the user provided a key body without headers
              // or it's just a malformed string. We use the original cleaned key fallback.
              this.logger.warn('Base64 decode did not produce a valid PEM header. Using raw value.');
              privateKey = cleanRawKey;
            }
          } catch (e) {
             this.logger.error('Failed to decode Base64 private key', e);
             privateKey = cleanRawKey;
          }
        } else {
          privateKey = cleanRawKey;
        }

        // Handle escaped newlines (e.g. from .env files)
        privateKey = privateKey.replace(/\\n/g, '\n');
        
        // Validation logging (safe - no secrets printed)
        this.logger.log(`Private Key loaded. Length: ${privateKey.length}. Header found: ${privateKey.includes('-----BEGIN')}`);
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
