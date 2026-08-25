// services/admin-dashboard/app/components/shared/content-templates/ContentTemplatesTable.tsx
"use client";

import { Eye, Pencil, Star, Trash2 } from "lucide-react";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/src/ui/table";
import { Badge } from "@/src/ui/badge";
import { RowActions } from "@/src/ui/row-actions";
import { formatDate } from "@/lib/utils";
import type { ContentTemplateSummary } from "./content-templates-api";

interface ContentTemplatesTableProps {
  templates: ContentTemplateSummary[];
  /** Hides edit/set-default/delete when false — reads only need ADMIN, writes need SUPER_ADMIN. */
  canManage: boolean;
  onView: (template: ContentTemplateSummary) => void;
  onEdit: (template: ContentTemplateSummary) => void;
  onSetDefault: (template: ContentTemplateSummary) => void;
  onDelete: (template: ContentTemplateSummary) => void;
}

export function ContentTemplatesTable({
  templates,
  canManage,
  onView,
  onEdit,
  onSetDefault,
  onDelete,
}: ContentTemplatesTableProps) {
  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Name</TableHead>
          <TableHead>Items</TableHead>
          <TableHead>Default?</TableHead>
          <TableHead>Updated</TableHead>
          <TableHead className="text-right">Actions</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {templates.map((template) => (
          <TableRow key={template.id}>
            <TableCell>
              <div className="font-semibold text-zinc-900">{template.name}</div>
              {template.description && (
                <div className="mt-0.5 max-w-sm truncate text-xs text-zinc-500">{template.description}</div>
              )}
            </TableCell>
            <TableCell>
              <span className="inline-flex items-center rounded-full bg-blue-50 px-2 py-0.5 text-xs font-semibold text-blue-700">
                {template.itemCount}
              </span>
            </TableCell>
            <TableCell>
              {template.isDefault ? (
                <Badge variant="success">Default</Badge>
              ) : (
                <span className="text-xs text-zinc-400">—</span>
              )}
            </TableCell>
            <TableCell className="text-zinc-500">{formatDate(template.updatedAt)}</TableCell>
            <TableCell className="text-right">
              <RowActions
                primary={[{ label: "View", icon: Eye, onClick: () => onView(template) }]}
                menu={
                  canManage
                    ? [
                        { label: "Edit", icon: Pencil, onClick: () => onEdit(template) },
                        ...(template.isDefault
                          ? []
                          : [{ label: "Set as default", icon: Star, onClick: () => onSetDefault(template) }]),
                        { label: "Delete", icon: Trash2, destructive: true, onClick: () => onDelete(template) },
                      ]
                    : []
                }
              />
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}
