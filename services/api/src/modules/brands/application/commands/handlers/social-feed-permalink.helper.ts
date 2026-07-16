import { BadRequestException } from '@nestjs/common';

function decodeHtmlEntities(value: string): string {
  return value
    .replace(/&amp;/gi, '&')
    .replace(/&quot;/gi, '"')
    .replace(/&#39;/gi, "'")
    .replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>');
}

function extractInstagramUrlCandidate(input: string): string | null {
  const embedAttributeMatch = input.match(/data-instgrm-permalink=(["'])([\s\S]*?)\1/i);
  if (embedAttributeMatch?.[2]) {
    return decodeHtmlEntities(embedAttributeMatch[2].trim());
  }

  const urlMatch = input.match(
    /https?:\/\/(?:www\.)?instagram\.com\/(?:p|reel|tv)\/[A-Za-z0-9_-]+\/?(?:\?[^\s"'<>]*)?/i,
  );
  if (urlMatch?.[0]) {
    return decodeHtmlEntities(urlMatch[0].trim());
  }

  return null;
}

export function parseInstagramPermalinkInput(input: string): string {
  const raw = input.trim();
  if (!raw) {
    throw new BadRequestException('Instagram post input is required.');
  }

  const candidate = extractInstagramUrlCandidate(raw) ?? raw;

  let parsed: URL;
  try {
    parsed = new URL(candidate);
  } catch {
    throw new BadRequestException(
      'Invalid Instagram input. Provide a post URL or Instagram embed snippet.',
    );
  }

  const hostname = parsed.hostname.replace(/^www\./i, '').toLowerCase();
  if (hostname !== 'instagram.com') {
    throw new BadRequestException(
      'Invalid Instagram input. Provide a post URL or Instagram embed snippet.',
    );
  }

  const segments = parsed.pathname.split('/').filter(Boolean);
  const postType = segments[0]?.toLowerCase();
  const postId = segments[1];

  if (!postType || !postId || !['p', 'reel', 'tv'].includes(postType)) {
    throw new BadRequestException(
      'Invalid Instagram input. Supported formats: /p/, /reel/, or /tv/.',
    );
  }

  return `https://www.instagram.com/${postType}/${postId}/`;
}
