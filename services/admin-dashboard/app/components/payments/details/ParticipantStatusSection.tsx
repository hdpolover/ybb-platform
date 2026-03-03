import React from "react";
import { CalendarIcon, ClockIcon, MapPinIcon } from "@heroicons/react/24/outline";

export interface ParticipantStatusItem {
  step: number;
  state: "Completed" | "In Progress" | "Not Yet";
  title: string;
  description: string;
  date?: string;
  processing?: string;
  release?: string;
  opening?: string;
  announcement?: string;
  programDates?: string;
  location?: string;
}

interface ParticipantStatusSectionProps {
  statuses: ParticipantStatusItem[];
}

const STATE_STYLES = {
  "Completed": {
    bg: "bg-green-600",
    line: "bg-green-600",
  },
  "In Progress": {
    bg: "bg-indigo-600",
    line: "bg-indigo-600",
  },
  "Not Yet": {
    bg: "bg-red-600",
    line: "bg-red-600",
  },
};

export function ParticipantStatusSection({ statuses }: ParticipantStatusSectionProps) {
  return (
    <section className="flex flex-col">
      <h3 className="mb-8 text-base font-semibold text-zinc-900">Participant Status</h3>
      
      <div className="relative pl-1">
        {statuses.map((item, index) => {
          const isLast = index === statuses.length - 1;
          const currentStyle = STATE_STYLES[item.state];
          
          return (
            <div key={item.step} className="relative flex gap-5 pb-8">
              {!isLast && (
                <div className={`absolute left-[11px] top-6 bottom-0 w-0.5 ${currentStyle.line}`} />
              )}
              <div className={`relative z-10 mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-xs font-bold text-white shadow-sm ${currentStyle.bg}`}>
                {item.step}
              </div>
              <div className="-mt-0.5 flex flex-col gap-1">
                <h4 className="text-sm font-semibold text-zinc-900">{item.title}</h4>
                
                <p className="mt-0.5 max-w-3xl text-xs leading-relaxed text-zinc-700">
                  {item.description}
                </p>
                
                <div className="mt-1 flex flex-col gap-1.5 text-xs text-zinc-500">
                  {item.date && (
                    <div className="flex items-center gap-1.5">
                      <CalendarIcon className="h-4 w-4" /> <span>{item.date}</span>
                    </div>
                  )}
                  {item.processing && (
                    <div className="flex items-center gap-1.5">
                      <ClockIcon className="h-4 w-4" /> <span>{item.processing}</span>
                    </div>
                  )}
                  {item.release && (
                    <div className="flex items-center gap-1.5">
                      <CalendarIcon className="h-4 w-4" /> <span>{item.release}</span>
                    </div>
                  )}
                  {item.opening && (
                    <div className="flex items-center gap-1.5">
                      <CalendarIcon className="h-4 w-4" /> <span>{item.opening}</span>
                    </div>
                  )}
                  {item.announcement && (
                    <div className="flex items-center gap-1.5">
                      <CalendarIcon className="h-4 w-4" /> <span>{item.announcement}</span>
                    </div>
                  )}
                  {item.programDates && (
                    <div className="flex items-center gap-1.5">
                      <CalendarIcon className="h-4 w-4" /> <span>{item.programDates}</span>
                    </div>
                  )}
                  {item.location && (
                    <div className="flex items-center gap-1.5">
                      <MapPinIcon className="h-4 w-4" /> <span>{item.location}</span>
                    </div>
                  )}
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
}