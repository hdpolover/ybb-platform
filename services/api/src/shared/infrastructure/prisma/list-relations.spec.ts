// services/api/src/shared/infrastructure/prisma/list-relations.spec.ts
import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { parseListRelations } from './list-relations.parser';
import { LIST_RELATIONS } from './list-relations.generated';

const SCHEMA_DIR = join(__dirname, '../../../../prisma/schema');

describe('parseListRelations', () => {
  const schema = `
    enum Role { A B }
    /// doc comment
    model Parent {
      id        String   @id
      tags      String[]
      roles     Role[]
      kids      Kid[]    // trailing comment
      // ghosts Ghost[]
      only      Kid?
      other     Other[] @relation("x")
      @@map("parent")
    }
    model Kid {
      id       String @id
      parent   Parent @relation(fields: [parentId], references: [id])
      parentId String
    }
    model Other { id String @id }
  `;

  it('returns only Model[] fields whose target is a declared model', () => {
    expect(parseListRelations(schema)).toEqual({
      Parent: { kids: 'Kid', other: 'Other' },
    });
  });

  it('ignores scalar lists, enum lists, optional relations and commented-out fields', () => {
    const fields = Object.keys(parseListRelations(schema).Parent);
    expect(fields).not.toEqual(expect.arrayContaining(['tags', 'roles', 'only', 'ghosts']));
  });

});

describe('LIST_RELATIONS drift', () => {
  const text = readdirSync(SCHEMA_DIR)
    .filter((f) => f.endsWith('.prisma'))
    .sort()
    .map((f) => readFileSync(join(SCHEMA_DIR, f), 'utf8'))
    .join('\n');

  it('matches prisma/schema/*.prisma (rerun `npm run prisma:list-relations` if this fails)', () => {
    expect(LIST_RELATIONS).toEqual(parseListRelations(text));
  });

  it('contains Program.schedules -> ProgramSchedule', () => {
    expect(LIST_RELATIONS.Program.schedules).toBe('ProgramSchedule');
  });
});
