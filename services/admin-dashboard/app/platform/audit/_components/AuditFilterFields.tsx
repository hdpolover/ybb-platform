// services/admin-dashboard/app/platform/audit/_components/AuditFilterFields.tsx
import { FilterField } from "@/src/ui/filter-grid";
import { Select } from "@/src/ui/select";
import { Input } from "@/src/ui/input";
import type { AdminOption } from "@/lib/audit-log";

export function AdminSelect({
  admins,
  value,
  onChange,
}: {
  admins: AdminOption[];
  value: string;
  onChange: (id: string) => void;
}) {
  return (
    <FilterField label="Admin" htmlFor="audit-admin">
      <Select id="audit-admin" value={value} onChange={(e) => onChange(e.target.value)}>
        <option value="">All admins</option>
        {admins.map((a) => (
          <option key={a.id} value={a.id}>
            {a.name} ({a.email})
          </option>
        ))}
      </Select>
    </FilterField>
  );
}

export function DateRangeFields({
  dateFrom,
  dateTo,
  onChange,
}: {
  dateFrom: string;
  dateTo: string;
  onChange: (patch: { dateFrom?: string; dateTo?: string }) => void;
}) {
  return (
    <>
      <FilterField label="From (WIB)" htmlFor="audit-from">
        <Input id="audit-from" type="date" value={dateFrom} max={dateTo || undefined} onChange={(e) => onChange({ dateFrom: e.target.value })} />
      </FilterField>
      <FilterField label="To (WIB)" htmlFor="audit-to">
        <Input id="audit-to" type="date" value={dateTo} min={dateFrom || undefined} onChange={(e) => onChange({ dateTo: e.target.value })} />
      </FilterField>
    </>
  );
}
