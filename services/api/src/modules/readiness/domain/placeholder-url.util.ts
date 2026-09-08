// services/api/src/modules/readiness/domain/placeholder-url.util.ts

// Hosts that serve generated grey placeholder images. A brand pointing at one
// of these has a non-null logo_url and a visibly broken public site, so a
// presence check alone is not enough.
const PLACEHOLDER_HOSTS = [
  'placehold.co',
  'placeholder.com',
  'via.placeholder.com',
  'dummyimage.com',
  'placekitten.com',
  'picsum.photos',
];

export function isUsableImageUrl(url: string | null): boolean {
  if (!url || url.trim().length === 0) return false;
  let host: string;
  try {
    host = new URL(url.trim()).hostname.toLowerCase();
  } catch {
    return false;
  }
  return !PLACEHOLDER_HOSTS.some(
    (bad) => host === bad || host.endsWith(`.${bad}`),
  );
}
