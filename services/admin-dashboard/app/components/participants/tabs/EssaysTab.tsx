// services/admin-dashboard/app/components/participants/tabs/EssaysTab.tsx
import React from "react";
import { CopyButton } from "../IconActions";

export interface Essay {
  id: string;
  question: string;
  answer: string | null;
  wordLimit: number | null;
  order: number;
  isRequired: boolean;
}

export interface EssayCollection {
  essays: Essay[];
}

export function countWords(text: string): number {
  return text.split(/\s+/).filter(Boolean).length;
}

function WordCount({ answer, limit }: { answer: string; limit: number | null }) {
  const count = countWords(answer);
  const isOver = limit != null && count > limit;
  const label = limit != null ? `${count} / ${limit} words` : `${count} words`;
  return <span className={`text-xs ${isOver ? "font-semibold text-amber-600" : "text-zinc-400"}`}>{label}</span>;
}

export function EssaysTab({ data }: { data: EssayCollection }) {
  if (data.essays.length === 0) {
    return (
      <section>
        <h3 className="mb-8 text-base font-semibold text-zinc-900">Essays</h3>
        <p className="text-sm text-zinc-500">No essay questions for this application.</p>
      </section>
    );
  }

  const sorted = [...data.essays].sort((a, b) => a.order - b.order);

  return (
    <section>
      <h3 className="mb-8 text-base font-semibold text-zinc-900">Essays</h3>
      <div className="space-y-8">
        {sorted.map((essay) => (
          <div key={essay.id} className="flex flex-col gap-2">
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-xs font-medium text-zinc-500">{essay.question}</span>
              {essay.isRequired && (
                <span className="rounded-full bg-blue-50 border border-blue-100 px-2 py-0.5 text-xs font-semibold text-blue-700">
                  Required
                </span>
              )}
              {essay.wordLimit != null && (
                <span className="text-xs text-zinc-400">Limit: {essay.wordLimit} words</span>
              )}
            </div>
            {essay.answer ? (
              <>
                <p className="rounded-md border border-zinc-200 bg-zinc-50 p-4 text-sm leading-relaxed text-zinc-900 whitespace-pre-wrap">
                  {essay.answer}
                </p>
                <div className="flex items-center gap-2">
                  <WordCount answer={essay.answer} limit={essay.wordLimit} />
                  <CopyButton text={essay.answer} label="Answer" />
                </div>
              </>
            ) : (
              <p className="text-sm text-zinc-400 italic">No answer provided.</p>
            )}
          </div>
        ))}
      </div>
    </section>
  );
}
