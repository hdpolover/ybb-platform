// services/admin-dashboard/app/programs/[programId]/scoring/review/[applicationId]/page.tsx
"use client";

import { useEffect } from "react";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import { parseStage } from "@/app/components/scoring/stage";

/**
 * This dedicated review route is superseded by the split-view participant
 * detail page, which puts the essay and the scoring panel side by side.
 * Kept as a redirect (not deleted) so existing bookmarks and shared links
 * keep working -- the `?stage=` param is preserved across the redirect.
 */
export default function ApplicationReviewRedirectPage() {
  const params = useParams<{ programId: string; applicationId: string }>();
  const programId = (params?.programId as string) || "";
  const applicationId = (params?.applicationId as string) || "";

  const router = useRouter();
  const searchParams = useSearchParams();
  const stage = parseStage(searchParams.get("stage"));

  useEffect(() => {
    if (!programId || !applicationId) return;
    router.replace(
      `/programs/${encodeURIComponent(programId)}/scoring/fully-funded/${encodeURIComponent(applicationId)}?stage=${stage}`,
    );
  }, [router, programId, applicationId, stage]);

  return (
    <div className="flex items-center justify-center py-20 text-sm text-zinc-500">
      Redirecting...
    </div>
  );
}
