// services/api/src/shared/utils/loa-render-payload.util.spec.ts
import { buildGenerateLoaParams, LoaLayoutConfigInput } from './loa-render-payload.util';

function build(layoutConfig: LoaLayoutConfigInput) {
  return buildGenerateLoaParams({
    htmlContent: '<p>Dear {{participant_name}}</p>',
    layoutConfig,
    placeholders: [],
    sourceMap: {},
    documentNumber: 'DOC-1',
    signatureUrl: '',
    signerName: '',
    signerTitle: '',
    programDisplayName: 'Istanbul Youth Summit 2027',
    programBatch: '',
  });
}

describe('buildGenerateLoaParams header', () => {
  it('auto-builds the letterhead when no header config and no freeform header are set', () => {
    const params = build({ logoUrl: 'https://cdn.example.com/logo.png', headerHtml: '' });

    expect(params.header).toEqual({
      program_name: 'Istanbul Youth Summit 2027',
      batch: '',
      tagline: '',
      website: '',
      email: '',
      phone: '',
    });
    expect(params.logo_url).toBe('https://cdn.example.com/logo.png');
  });

  it('treats a whitespace-only freeform header as unset', () => {
    expect(build({ headerHtml: '   ' }).header).toBeDefined();
  });

  it('keeps an authored freeform header instead of the auto letterhead', () => {
    const params = build({ logoUrl: 'https://cdn.example.com/logo.png', headerHtml: '<p>{{logo}} Custom</p>' });

    expect(params.header).toBeUndefined();
    expect(params.header_html).toBe('<p>{{logo}} Custom</p>');
  });

  it('uses the structured header config when present', () => {
    const params = build({ headerHtml: '', header: { tagline: 'Together', website: 'iys.com' } });

    expect(params.header).toMatchObject({ tagline: 'Together', website: 'iys.com' });
  });
});
