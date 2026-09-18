import * as fs from 'fs';
import * as path from 'path';
import * as hbs from 'handlebars';

// Renders the three document-review .hbs files directly (no NestJS wiring
// needed) and asserts the reviewer note survives verbatim, unescaped by an
// HTML entity a later grep wouldn't match.
describe('document review email templates', () => {
  const render = (templateName: string, data: Record<string, unknown>) => {
    const filePath = path.join(__dirname, `${templateName}.hbs`);
    const source = fs.readFileSync(filePath, 'utf8');
    return hbs.compile(source)(data);
  };

  it('document-approved.hbs mentions the document name and needs no note', () => {
    const html = render('document-approved', {
      name: 'Jane',
      documentName: 'Agreement Letter',
      documentsUrl: '#',
    });
    expect(html).toContain('Agreement Letter');
    expect(html).toMatch(/approved/i);
  });

  it('document-rejected.hbs includes the reviewer note verbatim', () => {
    const note = 'The signature page is missing.';
    const html = render('document-rejected', {
      name: 'Jane',
      documentName: 'Agreement Letter',
      note,
      documentsUrl: '#',
    });
    expect(html).toContain(note);
    expect(html).toContain('Agreement Letter');
  });

  it('document-revision-requested.hbs includes the reviewer note verbatim', () => {
    const note = 'Please re-scan page 2, it is blurry.';
    const html = render('document-revision-requested', {
      name: 'Jane',
      documentName: 'Agreement Letter',
      note,
      documentsUrl: '#',
    });
    expect(html).toContain(note);
    expect(html).toContain('Agreement Letter');
  });
});
