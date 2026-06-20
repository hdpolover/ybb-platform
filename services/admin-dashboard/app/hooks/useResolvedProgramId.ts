"use client";

import { useMemo } from "react";
import { useAuth } from "@/app/contexts/AuthContext";

/**
 * Program routes use `[programId]`, which is frequently a program SLUG
 * (e.g. "china-youth-summit-2026"). Most admin and stats API endpoints are
 * keyed by the program UUID and return a 500 when given a slug.
 *
 * This hook resolves whatever the route provides (slug or UUID) to the program
 * UUID, using the admin's accessible programs. Use the returned value for any
 * program-scoped API call. Keep the raw route value for navigation/links.
 *
 * Falls back to the input when the program is not in `accessiblePrograms`
 * (e.g. a super admin viewing an unassigned program), matching the existing
 * per-page resolution pattern.
 */
export function useResolvedProgramId(programId: string): string {
  const { accessiblePrograms } = useAuth();
  return useMemo(() => {
    const match = accessiblePrograms.find(
      (program) => program.programId === programId || program.programSlug === programId,
    );
    return match?.programId ?? programId;
  }, [accessiblePrograms, programId]);
}
