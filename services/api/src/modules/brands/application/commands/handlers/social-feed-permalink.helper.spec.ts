import { BadRequestException } from '@nestjs/common';
import { parseInstagramPermalinkInput } from './social-feed-permalink.helper';

describe('parseInstagramPermalinkInput', () => {
  it('normalizes a direct Instagram post URL', () => {
    expect(parseInstagramPermalinkInput('https://instagram.com/p/DWBoc7RkSGQ/?utm_source=ig_web_copy_link')).toBe(
      'https://www.instagram.com/p/DWBoc7RkSGQ/',
    );
  });

  it('extracts permalink from instagram embed HTML', () => {
    const embedCode =
      '<blockquote class="instagram-media" data-instgrm-permalink="https://www.instagram.com/p/DWBoc7RkSGQ/?utm_source=ig_embed&amp;utm_campaign=loading"></blockquote>';
    expect(parseInstagramPermalinkInput(embedCode)).toBe(
      'https://www.instagram.com/p/DWBoc7RkSGQ/',
    );
  });

  it('supports reel links', () => {
    expect(parseInstagramPermalinkInput('https://www.instagram.com/reel/ABCdef12345/?igsh=abcd')).toBe(
      'https://www.instagram.com/reel/ABCdef12345/',
    );
  });

  it('throws for non-instagram URL', () => {
    expect(() => parseInstagramPermalinkInput('https://example.com/p/test/')).toThrow(
      BadRequestException,
    );
  });
});
