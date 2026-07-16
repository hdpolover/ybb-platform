import { Module } from '@nestjs/common';
import { PrismaService } from '@shared/infrastructure/prisma/prisma.service';
import { LegalDocumentController } from './presentation/legal-document.controller';
import { LegalDocumentService } from './application/services/legal-document.service';
import { LegalDocumentRepository } from './infrastructure/persistence/legal-document.repository';
import { AuthModule } from '../auth/auth.module';

@Module({
    imports: [AuthModule],
    controllers: [LegalDocumentController],
    providers: [
        LegalDocumentService,
        LegalDocumentRepository,
    ],
    exports: [LegalDocumentService],
})
export class LegalModule {}
