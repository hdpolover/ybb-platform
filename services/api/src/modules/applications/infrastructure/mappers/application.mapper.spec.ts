import { ApplicationMapper } from './application.mapper';
import {
  ParticipantApplication,
  ApplicationStatus,
  ApplicationCategory,
  DocumentFile,
} from '@core/entities/participant-application.entity';

describe('ApplicationMapper', () => {
  let mapper: ApplicationMapper;

  beforeEach(() => {
    mapper = new ApplicationMapper();
  });

  function buildEntity(documents: Record<string, DocumentFile>): ParticipantApplication {
    return new ParticipantApplication(
      'app-1',
      'participant-1',
      'program-1',
      ApplicationStatus.DRAFT,
      ApplicationCategory.SELF_FUNDED,
      {},
      {},
      {},
      undefined,
      undefined,
      undefined,
      documents,
    );
  }

  describe('toPrismaCreate', () => {
    // M102: `documents` is a Prisma relation field (ParticipantDocument[]), not the
    // JSON column. Writing the domain's document map under `documents` makes Prisma
    // treat it as relation input instead of persisting it. The real JSON column is
    // `documentFiles`. This test pins the correct key.
    it('writes the document map under documentFiles, not documents', () => {
      const documents: Record<string, DocumentFile> = {
        passport: { fileId: 'f1', fileName: 'passport.pdf', fileUrl: 'https://x/passport.pdf' },
      };
      const entity = buildEntity(documents);

      const result = mapper.toPrismaCreate(entity);

      expect(result.documentFiles).toEqual(documents);
      expect(result).not.toHaveProperty('documents');
    });

    it('defaults documentFiles to an empty object when entity.documents is undefined', () => {
      const entity = buildEntity(undefined as unknown as Record<string, DocumentFile>);

      const result = mapper.toPrismaCreate(entity);

      expect(result.documentFiles).toEqual({});
      expect(result).not.toHaveProperty('documents');
    });
  });

  describe('toPrismaUpdate', () => {
    // M113: same collision on the update path.
    it('writes the document map under documentFiles, not documents', () => {
      const documents: Record<string, DocumentFile> = {
        visa: { fileId: 'f2', fileName: 'visa.pdf', fileUrl: 'https://x/visa.pdf' },
      };
      const entity = buildEntity(documents);

      const result = mapper.toPrismaUpdate(entity);

      expect(result.documentFiles).toEqual(documents);
      expect(result).not.toHaveProperty('documents');
    });
  });
});
