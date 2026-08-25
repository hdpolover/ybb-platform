// services/api/src/modules/programs/application/copy/program-landing-content.constants.ts

// The 7 Brand.metadata keys the ownership split moves onto Program (see
// spec's "Brand and program ownership split" table). This is the single
// source of truth for "what's a legal top-level key in
// Program.landingContent" — imported by the update handler (rejects
// anything else), the landing copier (Task 8), and home.strategy.ts
// (Task 16) so the three can never drift out of sync with each other.
export const PROGRAM_LANDING_CONTENT_KEYS = [
  'benefits',
  'features',
  'promo_cta',
  'moments_shorts',
  'further_information',
  'payment_info',
  // No reader anywhere in services/api/src today — see Global Constraints.
  // Carried forward with the same (lack of) behavior, not newly wired up.
  'participant_demographics',
] as const;

export type ProgramLandingContentKey = (typeof PROGRAM_LANDING_CONTENT_KEYS)[number];

// Loose on purpose — each key's internal shape is validated informally by
// the admin editor sheets that write it (same trust boundary as the
// Brand.metadata patch endpoint it replaces), not by nested class-validator
// DTOs. See Global Constraints for why.
export type ProgramLandingContent = Partial<Record<ProgramLandingContentKey, unknown>>;

export function isProgramLandingContentKey(key: string): key is ProgramLandingContentKey {
  return (PROGRAM_LANDING_CONTENT_KEYS as readonly string[]).includes(key);
}
