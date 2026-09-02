// app/components/reminders/ReminderAudienceCard.tsx
"use client";

import { Users } from "lucide-react";
import { Badge } from "@/src/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/src/ui/table";
import { formatWib } from "./wib-time";
import type { ReminderAudiencePreview } from "@/src/shared/api-client";

interface ReminderAudienceCardProps {
  audience: ReminderAudiencePreview | null;
  loading: boolean;
}

/**
 * Exactly who would be emailed if a reminder went out right now — shown before
 * anything is scheduled, so nobody has to trust the query. The count is the
 * true total; the table is capped server-side.
 */
export function ReminderAudienceCard({ audience, loading }: ReminderAudienceCardProps) {
  if (loading) {
    return (
      <div className="rounded-lg border border-zinc-200 bg-white px-4 py-6">
        <span className="text-sm text-zinc-400">Loading audience…</span>
      </div>
    );
  }

  if (!audience) return null;

  if (!audience.registrationFeeConfigured) {
    return (
      <div className="rounded-md border border-amber-200 bg-amber-50 px-4 py-3">
        <p className="text-sm text-amber-800">
          This program has no active registration fee, so nobody owes one and the
          audience is empty. That is not the same as everyone having paid — add a
          registration-fee pricing tier under Program Payments if one is expected.
        </p>
      </div>
    );
  }

  const capped = audience.count > audience.members.length;

  return (
    <div className="space-y-3 rounded-lg border border-zinc-200 bg-white p-4">
      <div className="flex items-baseline justify-between gap-4">
        <div className="flex items-baseline gap-2">
          <Users className="h-4 w-4 self-center text-zinc-400" />
          <span className="text-2xl font-semibold tabular-nums text-zinc-900">
            {audience.count}
          </span>
          <span className="text-sm text-zinc-500">
            {audience.count === 1 ? "participant" : "participants"} have not paid the
            registration fee
          </span>
        </div>
        {capped && (
          <span className="text-xs text-zinc-400">
            showing the {audience.members.length} longest-outstanding
          </span>
        )}
      </div>

      <p className="text-xs text-zinc-500">
        Most will still be in <span className="font-medium">draft</span> — the
        registration fee is what unlocks submission. Anyone whose payment is already
        settled or awaiting verification is excluded, as are deactivated accounts.
        The audience is recomputed at send time, so anyone who pays before then drops
        out automatically.
      </p>

      {audience.count === 0 ? (
        <p className="rounded-md bg-emerald-50 px-3 py-2 text-sm text-emerald-700">
          Everyone has paid. A reminder scheduled now would send to nobody.
        </p>
      ) : (
        <div className="max-h-[22rem] overflow-y-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Participant</TableHead>
                <TableHead>Email</TableHead>
                <TableHead>Application</TableHead>
                <TableHead>Registration Fee</TableHead>
                <TableHead>Registered</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {audience.members.map((member) => (
                <TableRow key={member.applicationId}>
                  <TableCell className="font-medium">{member.participantName}</TableCell>
                  <TableCell className="text-sm text-zinc-500">{member.email}</TableCell>
                  <TableCell>
                    <Badge
                      variant={member.applicationStatus === "draft" ? "secondary" : "info"}
                    >
                      {member.applicationStatus.replace(/_/g, " ")}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <Badge variant="warning">{member.registrationPaymentStatus}</Badge>
                  </TableCell>
                  <TableCell className="text-sm text-zinc-500">
                    {formatWib(member.registeredAt)}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}
    </div>
  );
}
