// app/components/videoTestimonialsMasterData/video-platform.test.ts
import { describe, expect, it } from "vitest";
import { parseVideoUrl } from "./video-platform";

describe("parseVideoUrl", () => {
  it.each([
    ["https://www.youtube.com/watch?v=dQw4w9WgXcQ", "youtube", "https://www.youtube.com/embed/dQw4w9WgXcQ"],
    ["https://youtube.com/shorts/dQw4w9WgXcQ?si=x", "youtube", "https://www.youtube.com/embed/dQw4w9WgXcQ"],
    ["https://youtu.be/dQw4w9WgXcQ", "youtube", "https://www.youtube.com/embed/dQw4w9WgXcQ"],
    ["https://www.instagram.com/reel/C9abc_12-x/?igsh=1", "instagram", "https://www.instagram.com/p/C9abc_12-x/embed"],
    ["https://www.instagram.com/p/C9abc/", "instagram", "https://www.instagram.com/p/C9abc/embed"],
    ["https://www.tiktok.com/@ybb/video/7301234567890123456?lang=en", "tiktok", "https://www.tiktok.com/embed/v2/7301234567890123456"],
    [
      "https://www.facebook.com/reel/1234567890",
      "facebook",
      "https://www.facebook.com/plugins/video.php?href=https%3A%2F%2Fwww.facebook.com%2Freel%2F1234567890&show_text=false",
    ],
    [
      "https://m.facebook.com/ybb/videos/987654321/",
      "facebook",
      "https://www.facebook.com/plugins/video.php?href=https%3A%2F%2Fwww.facebook.com%2Fybb%2Fvideos%2F987654321%2F&show_text=false",
    ],
    [
      "https://www.facebook.com/watch/?v=555",
      "facebook",
      "https://www.facebook.com/plugins/video.php?href=https%3A%2F%2Fwww.facebook.com%2Fwatch%2F%3Fv%3D555&show_text=false",
    ],
  ])("embeds %s", (url, platform, embedUrl) => {
    expect(parseVideoUrl(url)).toMatchObject({ platform, embedUrl });
  });

  it("gives YouTube a public thumbnail and the others none", () => {
    expect(parseVideoUrl("https://youtu.be/dQw4w9WgXcQ")?.thumbnailUrl).toBe(
      "https://img.youtube.com/vi/dQw4w9WgXcQ/hqdefault.jpg",
    );
    expect(parseVideoUrl("https://www.instagram.com/reel/C9abc/")?.thumbnailUrl).toBeNull();
  });

  it.each([
    "https://vm.tiktok.com/ZSabc123/",
    "https://www.tiktok.com/t/ZSabc123/",
    "https://fb.watch/abc123/",
    "https://www.facebook.com/share/v/abc123/",
    "https://www.instagram.com/ybb.foundation/",
    // the portal cannot embed /live/ links
    "https://www.youtube.com/live/dQw4w9WgXcQ",
    "https://example.com/video/123",
    "not a url",
    "",
  ])("rejects %s", (url) => {
    expect(parseVideoUrl(url)).toBeNull();
  });
});
