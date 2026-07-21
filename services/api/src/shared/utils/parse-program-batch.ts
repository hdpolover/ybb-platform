// Program names are authored like "Japan Youth Summit 2026 Batch 2" (year lives on
// Program.year, but batch is NOT a column — it's embedded in the free-text name).
// The LOA header needs the two rendered as separate lines ("Japan Youth Summit 2026"
// / "Batch 2"), so this pure helper splits a trailing "Batch <token>" suffix off the
// display name. No match -> name is returned unchanged and batch is empty.
const TRAILING_BATCH_PATTERN = /\s*[-–—]?\s*batch\s+([\w-]+)\s*$/i;

export interface ParsedProgramBatch {
  displayName: string;
  batch: string;
}

export function parseProgramBatch(name: string): ParsedProgramBatch {
  const match = name.match(TRAILING_BATCH_PATTERN);
  if (!match || match.index === undefined) {
    return { displayName: name, batch: '' };
  }
  return {
    displayName: name.slice(0, match.index),
    batch: match[1],
  };
}
