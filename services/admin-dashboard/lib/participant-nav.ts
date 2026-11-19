// services/admin-dashboard/lib/participant-nav.ts
// Prev/next hand-off between the participants list and the detail page, via sessionStorage.

export interface ParticipantNav {
  /** participantIds in the order the list displayed them. */
  ids: string[];
  /** pathname + search of the list, so "Back to list" keeps its filters. */
  listHref: string;
}

export interface Neighbours {
  /** Zero-based position of the current participant. */
  index: number;
  total: number;
  prevId: string | null;
  nextId: string | null;
}

export const participantNavKey = (programId: string): string => `ybb:participant-nav:${programId}`;

/** Validates untrusted storage content; null for anything that isn't a well-formed nav payload. */
export function parseParticipantNav(raw: string | null | undefined): ParticipantNav | null {
  if (!raw) return null;
  try {
    const v: unknown = JSON.parse(raw);
    if (typeof v !== "object" || v === null) return null;
    const { ids, listHref } = v as Record<string, unknown>;
    if (!Array.isArray(ids) || !ids.every((id) => typeof id === "string")) return null;
    // Same-origin path only; never navigate to whatever happens to be in storage.
    if (typeof listHref !== "string" || !listHref.startsWith("/") || listHref.startsWith("//")) return null;
    return { ids, listHref };
  } catch {
    return null;
  }
}

/** Neighbours of currentId in the saved list; null when the list doesn't contain it. */
export function getNeighbours(nav: ParticipantNav | null, currentId: string): Neighbours | null {
  if (!nav) return null;
  const index = nav.ids.indexOf(currentId);
  if (index < 0) return null;
  return {
    index,
    total: nav.ids.length,
    prevId: nav.ids[index - 1] ?? null,
    nextId: nav.ids[index + 1] ?? null,
  };
}

// ponytail: only covers the list page that was loaded; crossing pages would need a neighbours endpoint.
export function saveParticipantNav(programId: string, nav: ParticipantNav): void {
  try {
    sessionStorage.setItem(participantNavKey(programId), JSON.stringify(nav));
  } catch {
    // Storage unavailable (private mode, quota): the detail page just hides the nav bar.
  }
}

/** Raw stored string; a stable snapshot for useSyncExternalStore. */
export function readParticipantNavRaw(programId: string): string | null {
  try {
    return sessionStorage.getItem(participantNavKey(programId));
  } catch {
    return null;
  }
}

export function readParticipantNav(programId: string): ParticipantNav | null {
  return parseParticipantNav(readParticipantNavRaw(programId));
}
