"use client";

import { use } from "react";
import { LoaTemplateEditor } from "@/app/components/documents/LoaTemplateEditor";

export default function LoaTemplatePage({
  params,
}: {
  params: Promise<{ programId: string }>;
}) {
  const { programId } = use(params);
  return <LoaTemplateEditor programId={programId} />;
}
