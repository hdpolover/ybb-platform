import {
  classifyLegacyFieldName,
  LEGACY_ALIASES,
  type KnownCatalogKeys,
} from './classify-existing-form-fields';

const catalogKeys: KnownCatalogKeys = new Set([
  'full_name',
  'email',
  'tshirt_size',
  'profile_picture',
  'cv_upload',
  'date_of_birth',
  'emergency_contact_relation',
  'ambassador_referral_code',
  'referral_source',
  'referral_source_detail',
]);
const magicKeys = new Set(['category', 'program_subtheme_id', 'program_id']);

describe('classifyLegacyFieldName', () => {
  it('aliases birthdate → date_of_birth', () => {
    expect(
      classifyLegacyFieldName('birthdate', catalogKeys, magicKeys),
    ).toEqual({
      status: 'aliased_to_system',
      canonical: 'date_of_birth',
      source: 'system',
    });
  });

  it('aliases resume_url → cv_upload', () => {
    expect(
      classifyLegacyFieldName('resume_url', catalogKeys, magicKeys),
    ).toEqual({
      status: 'aliased_to_system',
      canonical: 'cv_upload',
      source: 'system',
    });
  });

  it('passes through a known catalog key unchanged', () => {
    expect(
      classifyLegacyFieldName('full_name', catalogKeys, magicKeys),
    ).toEqual({
      status: 'system',
      canonical: 'full_name',
      source: 'system',
    });
  });

  it('passes through a magic key unchanged', () => {
    expect(classifyLegacyFieldName('category', catalogKeys, magicKeys)).toEqual(
      {
        status: 'system',
        canonical: 'category',
        source: 'system',
      },
    );
  });

  it('keeps custom keys that match format but are not in catalog', () => {
    expect(
      classifyLegacyFieldName('some_custom_field', catalogKeys, magicKeys),
    ).toEqual({
      status: 'custom',
      canonical: 'some_custom_field',
      source: 'custom',
      valid: true,
    });
  });

  it('flags invalid custom keys', () => {
    expect(classifyLegacyFieldName('BadKey!', catalogKeys, magicKeys)).toEqual({
      status: 'custom',
      canonical: 'BadKey!',
      source: 'custom',
      valid: false,
    });
  });

  it('covers all required legacy aliases', () => {
    expect(LEGACY_ALIASES).toMatchObject({
      birthdate: 'date_of_birth',
      resume_url: 'cv_upload',
      picture_url: 'profile_picture',
      contact_relation: 'emergency_contact_relation',
      ref_code_ambassador: 'ambassador_referral_code',
      source_account_name: 'referral_source_detail',
      knowledge_source: 'referral_source',
    });
  });
});
