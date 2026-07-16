import { FIELD_KEY_FORMAT } from '../../src/modules/programs/application/validators/form-field-key.validator';

export const LEGACY_ALIASES: Readonly<Record<string, string>> = {
  birthdate: 'date_of_birth',
  resume_url: 'cv_upload',
  picture_url: 'profile_picture',
  contact_relation: 'emergency_contact_relation',
  ref_code_ambassador: 'ambassador_referral_code',
  source_account_name: 'referral_source_detail',
  knowledge_source: 'referral_source',
};

export type KnownCatalogKeys = Set<string>;

export type Classification =
  | { status: 'system'; canonical: string; source: 'system' }
  | { status: 'aliased_to_system'; canonical: string; source: 'system' }
  | { status: 'custom'; canonical: string; source: 'custom'; valid: boolean };

export function classifyLegacyFieldName(
  rawName: string,
  catalogKeys: KnownCatalogKeys,
  magicKeys: Set<string>,
): Classification {
  if (LEGACY_ALIASES[rawName]) {
    return {
      status: 'aliased_to_system',
      canonical: LEGACY_ALIASES[rawName],
      source: 'system',
    };
  }
  if (magicKeys.has(rawName) || catalogKeys.has(rawName)) {
    return { status: 'system', canonical: rawName, source: 'system' };
  }
  return {
    status: 'custom',
    canonical: rawName,
    source: 'custom',
    valid: FIELD_KEY_FORMAT.test(rawName),
  };
}
