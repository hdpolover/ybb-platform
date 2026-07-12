"use client";

import { useParams } from "next/navigation";
import { PageHeader } from "@/src/admin/page-header";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/src/ui/tabs";
import { LoaTemplateEditor } from "@/app/components/documents/LoaTemplateEditor";
import { LoaBatchesTab } from "@/app/components/documents/LoaBatchesTab";
import { LoaStatusTable } from "@/app/components/documents/LoaStatusTable";

export default function LoaTemplatePage() {
  const params = useParams<{ programId: string }>();
  const programId = params.programId;

  return (
    <div className="space-y-6">
      <PageHeader
        title="Invitation Letter"
        breadcrumb={
          <nav className="text-xs text-zinc-400">
            <span>Documents</span>
            <span className="mx-1">/</span>
            <span className="text-zinc-700">Invitation Letter</span>
          </nav>
        }
      />

      <Tabs defaultValue="batches">
        <TabsList>
          <TabsTrigger value="batches">Batches</TabsTrigger>
          <TabsTrigger value="template">Template</TabsTrigger>
          <TabsTrigger value="downloads">Downloads</TabsTrigger>
        </TabsList>

        <TabsContent value="batches">
          <LoaBatchesTab programId={programId} />
        </TabsContent>

        <TabsContent value="template">
          <LoaTemplateEditor programId={programId} />
        </TabsContent>

        <TabsContent value="downloads">
          <LoaStatusTable programId={programId} />
        </TabsContent>
      </Tabs>
    </div>
  );
}
