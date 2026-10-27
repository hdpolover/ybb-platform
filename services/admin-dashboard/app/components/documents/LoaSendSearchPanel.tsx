// app/components/documents/LoaSendSearchPanel.tsx
"use client";

import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Copy, MailSearch } from "lucide-react";
import { toast } from "sonner";
import { searchLoaSends, type LoaSendSearchResult } from "@/src/shared/api-client";
import { formatDateTime } from "@/lib/utils";
import { Badge } from "@/src/ui/badge";
import { Input } from "@/src/ui/input";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/src/ui/table";
import { LoaDeliveryBadge } from "./LoaDeliveryBadge";
import { EmptyState } from "@/src/admin/empty-state";

// Mirrors SearchLoaSendsQueryDto in services/api.
const MIN_QUERY_LENGTH = 3;
const DEBOUNCE_MS = 400;

const STATUS_VARIANT: Record<LoaSendSearchResult["status"], "success" | "destructive" | "secondary"> = {
  sent: "success",
  failed: "destructive",
  pending: "secondary",
};

const STATUS_LABEL: Record<LoaSendSearchResult["status"], string> = {
  sent: "Sent",
  failed: "Failed",
  pending: "Pending",
};

function copyMessageId(messageId: string) {
  void navigator.clipboard.writeText(messageId).then(
    () => toast.success("Message ID copied."),
    () => toast.error("Failed to copy message ID."),
  );
}

export function LoaSendSearchPanel({ programId }: { programId: string }) {
  const [input, setInput] = useState("");
  const [term, setTerm] = useState("");

  useEffect(() => {
    const handle = window.setTimeout(() => setTerm(input.trim()), DEBOUNCE_MS);
    return () => window.clearTimeout(handle);
  }, [input]);

  const isSearchable = term.length >= MIN_QUERY_LENGTH;
  const { data: results = [], isFetching, isError, error } = useQuery({
    queryKey: ["loa-sends", programId, term],
    queryFn: () => searchLoaSends(programId, term),
    enabled: isSearchable && !!programId,
  });

  return (
    <div className="space-y-3 rounded-md border border-zinc-200 p-4">
      <div>
        <p className="text-sm font-medium text-zinc-900">Find a sent email</p>
        <p className="text-xs text-zinc-500">
          Search every batch in this program by recipient email to confirm the Invitation
          Letter email went out.
        </p>
      </div>
      <Input
        type="search"
        value={input}
        onChange={(event) => setInput(event.target.value)}
        placeholder="Search by email (at least 3 characters)"
        aria-label="Search sent Invitation Letter emails by recipient email"
        className="max-w-sm"
      />

      {isSearchable && isError && (
        <p className="text-sm text-red-700">
          {error instanceof Error ? error.message : "Search failed"}
        </p>
      )}

      {isSearchable && !isError && !isFetching && results.length === 0 && (
        <EmptyState
          icon={MailSearch}
          className="py-8"
          title="No email records found"
          description="No Invitation Letter email was recorded for an address matching this search in this program."
        />
      )}

      {isSearchable && results.length > 0 && (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Participant</TableHead>
              <TableHead>Email</TableHead>
              <TableHead>Batch</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Sent</TableHead>
              <TableHead>Delivery</TableHead>
              <TableHead>Message ID</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {results.map((row) => (
              <TableRow key={row.id}>
                <TableCell className="font-medium">{row.participantName}</TableCell>
                <TableCell className="text-sm text-zinc-500">{row.email}</TableCell>
                <TableCell className="text-sm">{row.batchName}</TableCell>
                <TableCell>
                  <Badge variant={STATUS_VARIANT[row.status]}>{STATUS_LABEL[row.status]}</Badge>
                </TableCell>
                <TableCell className="text-sm text-zinc-500">
                  {row.sentAt ? formatDateTime(row.sentAt) : "—"}
                </TableCell>
                <TableCell>
                  <LoaDeliveryBadge row={row} />
                </TableCell>
                <TableCell className="max-w-[16rem] text-sm text-zinc-500">
                  {row.errorMessage ? (
                    <span className="text-red-700">{row.errorMessage}</span>
                  ) : row.providerMessageId ? (
                    <button
                      type="button"
                      onClick={() => copyMessageId(row.providerMessageId!)}
                      title="Copy message ID"
                      className="inline-flex max-w-full cursor-pointer items-center gap-1.5 font-mono text-xs hover:text-zinc-900"
                    >
                      <span className="truncate">{row.providerMessageId}</span>
                      <Copy className="h-3 w-3 shrink-0" />
                    </button>
                  ) : (
                    "—"
                  )}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}
    </div>
  );
}
