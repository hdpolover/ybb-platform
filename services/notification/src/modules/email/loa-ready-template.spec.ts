import * as fs from 'fs';
import * as path from 'path';
import * as hbs from 'handlebars';

describe('loa-ready.hbs template', () => {
  const tplPath = path.join(__dirname, 'templates', 'loa-ready.hbs');

  it('exists and compiles', () => {
    expect(fs.existsSync(tplPath)).toBe(true);
  });

  it('renders with all variables', () => {
    const source = fs.readFileSync(tplPath, 'utf-8');
    const template = hbs.compile(source);
    const html = template({
      participant_name: 'Jane Doe',
      program_name: 'YBB 2026',
      document_number: 'LOA-2026-000001',
      documents_page_url: 'https://ybb.io/dashboard/documents',
      theme: {
        primary: '#1D4ED8',
        primaryDark: '#1E3A8A',
        primaryMuted: '#EFF6FF',
        border: '#BFDBFE',
      },
    });
    expect(html).toContain('Jane Doe');
    expect(html).toContain('YBB 2026');
    expect(html).toContain('LOA-2026-000001');
    expect(html).toContain('https://ybb.io/dashboard/documents');
    expect(html).toContain('View My Documents');
  });

  it('omits CTA button when documents_page_url is empty', () => {
    const source = fs.readFileSync(tplPath, 'utf-8');
    const template = hbs.compile(source);
    const html = template({
      participant_name: 'Jane Doe',
      program_name: 'YBB 2026',
      document_number: 'LOA-2026-000001',
      documents_page_url: '',
      theme: {
        primary: '#1D4ED8',
        primaryDark: '#1E3A8A',
        primaryMuted: '#EFF6FF',
        border: '#BFDBFE',
      },
    });
    expect(html).not.toContain('View My Documents');
  });
});
