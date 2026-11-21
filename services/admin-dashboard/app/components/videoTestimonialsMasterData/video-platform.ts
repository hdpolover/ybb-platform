// app/components/videoTestimonialsMasterData/video-platform.ts
// Mirrors the portal's AlumniStories embed rules (ybb-program-next): a URL the
// admin accepts here must be one the landing page can embed.

export type VideoPlatform = "youtube" | "instagram" | "tiktok" | "facebook";

export type ParsedVideo = {
  platform: VideoPlatform;
  embedUrl: string;
  /** Only YouTube has a public thumbnail; the others need an uploaded cover. */
  thumbnailUrl: string | null;
};

export const VIDEO_PLATFORM_LABEL: Record<VideoPlatform, string> = {
  youtube: "YouTube",
  instagram: "Instagram",
  tiktok: "TikTok",
  facebook: "Facebook",
};

function hostIs(host: string, domain: string): boolean {
  return host === domain || host.endsWith(`.${domain}`);
}

function youtubeId(url: URL): string | null {
  if (url.hostname === "youtu.be") return url.pathname.slice(1).split("/")[0] || null;
  if (!hostIs(url.hostname, "youtube.com")) return null;
  const v = url.searchParams.get("v");
  if (v) return v;
  return url.pathname.match(/\/(?:shorts|embed)\/([A-Za-z0-9_-]{11})/)?.[1] ?? null;
}

export function parseVideoUrl(raw: string): ParsedVideo | null {
  let url: URL;
  try {
    url = new URL(raw.trim());
  } catch {
    return null;
  }
  const host = url.hostname;

  const yt = youtubeId(url);
  if (yt) {
    return {
      platform: "youtube",
      embedUrl: `https://www.youtube.com/embed/${yt}`,
      thumbnailUrl: `https://img.youtube.com/vi/${yt}/hqdefault.jpg`,
    };
  }

  if (hostIs(host, "instagram.com")) {
    const id = url.pathname.match(/\/(?:p|reel|reels|tv)\/([A-Za-z0-9_-]+)/)?.[1];
    return id ? { platform: "instagram", embedUrl: `https://www.instagram.com/p/${id}/embed`, thumbnailUrl: null } : null;
  }

  // Short links (vm.tiktok.com, /t/) carry no numeric id, and the embed needs one.
  if (hostIs(host, "tiktok.com")) {
    const id = url.pathname.match(/\/video\/(\d+)/)?.[1];
    return id ? { platform: "tiktok", embedUrl: `https://www.tiktok.com/embed/v2/${id}`, thumbnailUrl: null } : null;
  }

  // fb.watch and /share/ links are redirects the video plugin cannot resolve.
  if (hostIs(host, "facebook.com")) {
    const isVideo = /\/(?:reel|videos)\/\d+/.test(url.pathname) || (url.pathname.startsWith("/watch") && url.searchParams.has("v"));
    if (!isVideo) return null;
    const canonical = `https://www.facebook.com${url.pathname}${url.pathname.startsWith("/watch") ? `?v=${url.searchParams.get("v")}` : ""}`;
    return {
      platform: "facebook",
      embedUrl: `https://www.facebook.com/plugins/video.php?href=${encodeURIComponent(canonical)}&show_text=false`,
      thumbnailUrl: null,
    };
  }

  return null;
}
