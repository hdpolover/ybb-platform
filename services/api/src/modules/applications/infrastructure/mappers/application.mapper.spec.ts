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

      const result = mapper.toPrismaUpdate(entity, ['documents']);

      expect(result.documentFiles).toEqual(documents);
      expect(result).not.toHaveProperty('documents');
    });

    // M112: toPrismaUpdate used to spread every field on the entity
    // regardless of what the caller actually changed - a stale scoreTotal/
    // scoreStatus/scoreBreakdown read at request start could clobber a
    // concurrent write from the rubric-scoring handler. Only fields the
    // caller explicitly lists may appear in the patch.
    it('only includes explicitly-requested fields in the patch', () => {
      const entity = buildEntity({});

      const result = mapper.toPrismaUpdate(entity, ['status']);

      expect(result).toHaveProperty('status');
      expect(result).not.toHaveProperty('scoreTotal');
      expect(result).not.toHaveProperty('scoreBreakdown');
      expect(result).not.toHaveProperty('scoreStatus');
      expect(result).not.toHaveProperty('documentFiles');
      expect(result).not.toHaveProperty('participantSnapshot');
      expect(result).not.toHaveProperty('motivationLetter');
    });

    it('always bumps updatedAt and lastEditedAt regardless of the requested fields', () => {
      const entity = buildEntity({});

      const result = mapper.toPrismaUpdate(entity, []);

      expect(result.updatedAt).toBeInstanceOf(Date);
      expect(result.lastEditedAt).toBeInstanceOf(Date);
    });

    it('omits applicationCategory when the entity does not carry one, even if requested', () => {
      const entity = buildEntity({});
      entity.applicationCategory = null as unknown as ApplicationCategory;

      const result = mapper.toPrismaUpdate(entity, ['applicationCategory']);

      expect(result).not.toHaveProperty('applicationCategory');
    });
  });
});
