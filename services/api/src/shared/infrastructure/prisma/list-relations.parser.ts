// services/api/src/shared/infrastructure/prisma/list-relations.parser.ts
// Pure parser: Prisma schema text -> to-many relations. Needed because the Prisma 7 runtime
// dmmf is trimmed (no `isList`), so list-ness has to come from the schema source itself.

export type ListRelations = Record<string, Record<string, string>>;

const MODEL_START = /^\s*model\s+(\w+)\s*\{/;
const LIST_FIELD = /^\s*(\w+)\s+(\w+)\[\]/;

/** Returns { Model: { field: TargetModel } } for every `Target[]` field whose Target is a declared model. */
export function parseListRelations(schemaText: string): ListRelations {
  // `//` also covers `///` doc comments. ponytail: breaks on a `//` inside a string literal; none in our schema.
  const lines = schemaText.split('\n').map((l) => l.replace(/\/\/.*$/, ''));

  const modelNames = new Set<string>();
  for (const line of lines) {
    const m = MODEL_START.exec(line);
    if (m) modelNames.add(m[1]);
  }

  const result: ListRelations = {};
  let current: string | null = null;
  for (const line of lines) {
    const start = MODEL_START.exec(line);
    if (start) {
      current = start[1];
      continue;
    }
    if (current === null) continue;
    if (/^\s*\}/.test(line)) {
      current = null;
      continue;
    }
    const field = LIST_FIELD.exec(line);
    if (field && modelNames.has(field[2])) {
      result[current] = { ...result[current], [field[1]]: field[2] };
    }
  }
  return result;
}
