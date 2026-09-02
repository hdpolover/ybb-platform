// src/shared/utils/reminder-message-tokens.util.spec.ts
import { renderReminderTokens } from './reminder-message-tokens.util';

const values = { participantName: 'Ada Lovelace', programName: 'CYS 2026' };

describe('renderReminderTokens', () => {
  it('substitutes both tokens', () => {
    expect(
      renderReminderTokens('Hi {{participant_name}}, about {{program_name}}.', values),
    ).toBe('Hi Ada Lovelace, about CYS 2026.');
  });

  it('substitutes every occurrence, not just the first', () => {
    expect(renderReminderTokens('{{program_name}} / {{program_name}}', values)).toBe(
      'CYS 2026 / CYS 2026',
    );
  });

  it('leaves an unknown token verbatim instead of blanking it', () => {
    // An admin who typos a token should see the typo in the preview, not an
    // empty gap they cannot explain.
    expect(renderReminderTokens('Hi {{name}}', values)).toBe('Hi {{name}}');
  });

  it('does not choke on stray braces in ordinary prose', () => {
    // This is why substitution is a literal replace and not hbs.compile():
    // Handlebars would throw here and take a whole reminder down with it.
    expect(renderReminderTokens('See {{ attached }} and {{ note', values)).toBe(
      'See {{ attached }} and {{ note',
    );
  });

  it('does not re-scan substituted values for tokens', () => {
    expect(
      renderReminderTokens('{{participant_name}}', {
        participantName: '{{program_name}}',
        programName: 'CYS 2026',
      }),
    ).toBe('{{program_name}}');
  });
});
