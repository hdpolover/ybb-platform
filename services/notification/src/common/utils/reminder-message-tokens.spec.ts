// src/common/utils/reminder-message-tokens.spec.ts
import { renderReminderTokens } from './reminder-message-tokens';

const values = { participantName: 'Ada Lovelace', programName: 'CYS 2026' };

describe('renderReminderTokens (notification mirror)', () => {
  it('substitutes both tokens, every occurrence', () => {
    expect(
      renderReminderTokens(
        'Hi {{participant_name}}, about {{program_name}} ({{program_name}}).',
        values,
      ),
    ).toBe('Hi Ada Lovelace, about CYS 2026 (CYS 2026).');
  });

  it('does not choke on stray braces in ordinary prose', () => {
    // Handlebars would throw here and take a whole reminder down with it.
    expect(renderReminderTokens('See {{ attached }} and {{ note', values)).toBe(
      'See {{ attached }} and {{ note',
    );
  });

  it('leaves an unknown token verbatim instead of blanking it', () => {
    expect(renderReminderTokens('Hi {{name}}', values)).toBe('Hi {{name}}');
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
