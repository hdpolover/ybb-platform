"use client";

import { useState } from "react";
import { Zap, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { listDocumentTemplates, generateLoa } from "@/src/shared/api-client";
import { Button } from "@/src/ui/button";

export function GenerateLoaButton({
  programId,
  participantId,
}: {
  programId: string;
  participantId: string;
}) {
  const [loading, setLoading] = useState(false);

  async function handleClick() {
    setLoading(true);
    try {
      const templates = await listDocumentTemplates(programId, "letter_of_acceptance");
      const template = templates.find((t) => t.isActive);
      if (!template) {
        toast.error("No published LOA template found for this program");
        return;
      }
      const result = await generateLoa(programId, template.id, { participantId });
      if (result.generated > 0) {
        toast.success("LOA generated successfully");
      } else {
        toast.error("LOA generation failed — check participant has an accepted application");
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Generation failed");
    } finally {
      setLoading(false);
    }
  }

  return (
    <Button
      type="button"
      disabled={loading}
      onClick={handleClick}
      size="sm"
      className="gap-1.5 bg-emerald-600 text-white hover:bg-emerald-700"
    >
      {loading ? (
        <Loader2 className="h-3.5 w-3.5 animate-spin" />
      ) : (
        <Zap className="h-3.5 w-3.5" />
      )}
      Generate LOA
    </Button>
  );
}
