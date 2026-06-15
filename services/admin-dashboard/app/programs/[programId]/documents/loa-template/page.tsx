"use client";

import { use, useEffect, useState } from "react";
import { LoaTemplateEditor } from "@/app/components/documents/LoaTemplateEditor";
import { LoaStatusTable } from "@/app/components/documents/LoaStatusTable";
import { listDocumentTemplates, type DocumentTemplate } from "@/src/shared/api-client";

export default function LoaTemplatePage({
  params,
}: {
  params: Promise<{ programId: string }>;
}) {
  const { programId } = use(params);
  const [activeTemplate, setActiveTemplate] = useState<DocumentTemplate | null>(null);

  useEffect(() => {
    listDocumentTemplates(programId, 'letter_of_acceptance')
      .then((tpls) => setActiveTemplate(tpls.find((t) => t.isActive) ?? tpls[0] ?? null))
      .catch(() => {/* silent — editor handles its own load */});
  }, [programId]);

  return (
    <div className="flex flex-col gap-6">
      <LoaTemplateEditor programId={programId} onTemplateChange={setActiveTemplate} />
      <LoaStatusTable programId={programId} template={activeTemplate} />
    </div>
  );
}
