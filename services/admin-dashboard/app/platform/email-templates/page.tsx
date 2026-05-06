"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { Mail, Pencil, Plus, Sparkles, Trash2 } from "lucide-react";
import { EmptyState } from "@/src/admin/empty-state";
import { RichTextEditor } from "@/src/admin/components/rich-text-editor";
import { Badge } from "@/src/ui/badge";
import { Button } from "@/src/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/src/ui/card";
import { Input } from "@/src/ui/input";
import { Label } from "@/src/ui/label";
import {
  Sheet,
  SheetContent,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from "@/src/ui/sheet";
import {
  createEmailTemplate,
  deleteEmailTemplate,
  listEmailTemplates,
  listPlatformBrands,
  listPlatformPrograms,
  type EmailTemplate,
  type PlatformBrand,
  type PlatformProgram,
  updateEmailTemplate,
} from "../api";
import {
  EMAIL_TEMPLATE_PRESETS,
  getEmailTemplatePreset,
  type EmailTemplatePreset,
} from "../email-template-presets";

type TemplateScope = "global" | "brand" | "program";

type SheetState = {
  template: EmailTemplate | null;
  initialType?: string;
  defaultScope: TemplateScope;
  allowScopeChange: boolean;
} | null;

function getTemplateScope(template: Pick<EmailTemplate, "brandId" | "programId">): TemplateScope {
  if (template.programId) return "program";
  if (template.brandId) return "brand";
  return "global";
}

function SelectField({
  id,
  label,
  value,
  onChange,
  children,
  disabled,
  hint,
}: {
  id: string;
  label: string;
  value: string;
  onChange: (value: string) => void;
  children: React.ReactNode;
  disabled?: boolean;
  hint?: string;
}) {
  return (
    <div className="space-y-1.5">
      <Label htmlFor={id}>{label}</Label>
      <select
        id={id}
        value={value}
        disabled={disabled}
        onChange={(event) => onChange(event.target.value)}
        className="flex h-10 w-full rounded-md border border-zinc-200 bg-white px-3 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 disabled:cursor-not-allowed disabled:bg-zinc-50"
      >
        {children}
      </select>
      {hint ? <p className="text-xs text-zinc-400">{hint}</p> : null}
    </div>
  );
}

function Message({
  message,
  tone,
}: {
  message: string | null;
  tone: "error" | "success";
}) {
  if (!message) return null;

  const cls = tone === "error"
    ? "border-red-200 bg-red-50 text-red-700"
    : "border-emerald-200 bg-emerald-50 text-emerald-700";

  return <div className={`rounded-lg border px-3 py-2 text-sm ${cls}`}>{message}</div>;
}

function TemplateEditorSheet({
  state,
  brands,
  programs,
  onClose,
  onSaved,
}: {
  state: NonNullable<SheetState>;
  brands: PlatformBrand[];
  programs: PlatformProgram[];
  onClose: () => void;
  onSaved: () => void;
}) {
  const isEdit = Boolean(state.template);
  const initialPreset =
    getEmailTemplatePreset(state.template?.type ?? state.initialType) ??
    EMAIL_TEMPLATE_PRESETS[0];
  const initialScope = state.template
    ? getTemplateScope(state.template)
    : state.defaultScope;

  const [scope, setScope] = useState<TemplateScope>(initialScope);
  const [brandId, setBrandId] = useState(state.template?.brandId ?? "");
  const [programId, setProgramId] = useState(state.template?.programId ?? "");
  const [name, setName] = useState(state.template?.name ?? initialPreset.label);
  const [type, setType] = useState(state.template?.type ?? initialPreset.type);
  const [subject, setSubject] = useState(
    state.template?.subject ?? initialPreset.defaultSubject,
  );
  const [body, setBody] = useState(state.template?.body ?? initialPreset.defaultBody);
  const [isActive, setIsActive] = useState(state.template?.isActive ?? true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const selectedPreset = getEmailTemplatePreset(type) ?? initialPreset;
  const selectedProgram = useMemo(
    () => programs.find((program) => program.id === programId) ?? null,
    [programId, programs],
  );

  const availablePrograms = useMemo(() => {
    if (!brandId) return programs;
    return programs.filter((program) => program.brandId === brandId);
  }, [brandId, programs]);

  function applyPreset(nextPreset: EmailTemplatePreset) {
    setType(nextPreset.type);
    setName(nextPreset.label);
    setSubject(nextPreset.defaultSubject);
    setBody(nextPreset.defaultBody);
    setError(null);
    setSuccess(null);
  }

  async function handleSave() {
    setSaving(true);
    setError(null);
    setSuccess(null);

    if (scope === "brand" && !brandId) {
      setSaving(false);
      setError("Choose a brand for this override.");
      return;
    }

    if (scope === "program" && !programId) {
      setSaving(false);
      setError("Choose a program for this override.");
      return;
    }

    const payload = {
      name,
      type,
      subject,
      body,
      variables: selectedPreset.variables,
      isActive,
    };

    try {
      if (isEdit && state.template) {
        await updateEmailTemplate(state.template.id, payload);
      } else {
        await createEmailTemplate({
          ...payload,
          brandId:
            scope === "brand"
              ? brandId
              : scope === "program"
                ? selectedProgram?.brandId
                : undefined,
          programId: scope === "program" ? programId : undefined,
        });
      }

      setSuccess(isEdit ? "Template updated." : "Template created.");
      onSaved();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save template.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <Sheet open onOpenChange={(open) => { if (!open) onClose(); }}>
      <SheetContent side="right" className="sm:max-w-3xl overflow-y-auto">
        <SheetHeader>
          <SheetTitle>{isEdit ? "Edit Email Template" : "Configure Email Template"}</SheetTitle>
        </SheetHeader>

        <div className="mt-6 space-y-5">
          <Message message={error} tone="error" />
          <Message message={success} tone="success" />

          <div className="rounded-xl border border-blue-100 bg-blue-50 p-4">
            <div className="flex items-start gap-3">
              <div className="rounded-full bg-white p-2 text-blue-600 shadow-sm">
                <Sparkles className="h-4 w-4" />
              </div>
              <div className="space-y-2">
                <p className="text-sm font-semibold text-blue-900">{selectedPreset.label}</p>
                <p className="text-sm text-blue-800">{selectedPreset.description}</p>
                <p className="text-xs uppercase tracking-wide text-blue-700">
                  Used for: {selectedPreset.usedFor}
                </p>
                <div className="flex flex-wrap gap-2">
                  {selectedPreset.variables.map((variable) => (
                    <Badge key={variable} variant="secondary" className="font-mono text-[11px]">
                      {variable}
                    </Badge>
                  ))}
                </div>
              </div>
            </div>
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            <SelectField
              id="template-type"
              label="Template Type"
              value={type}
              onChange={(value) => {
                const preset = getEmailTemplatePreset(value);
                if (preset) {
                  applyPreset(preset);
                }
              }}
              hint="Pick from the real system emails that are already wired into sending flows."
            >
              {EMAIL_TEMPLATE_PRESETS.map((preset) => (
                <option key={preset.type} value={preset.type}>
                  {preset.label}
                </option>
              ))}
            </SelectField>

            <SelectField
              id="template-scope"
              label="Scope"
              value={scope}
              onChange={(value) => setScope(value as TemplateScope)}
              disabled={!state.allowScopeChange || isEdit}
              hint={state.allowScopeChange
                ? "Use Global for the default template. Brand or Program creates an override."
                : "This flow is locked to the default global template."}
            >
              <option value="global">Global default</option>
              <option value="brand">Brand override</option>
              <option value="program">Program override</option>
            </SelectField>
          </div>

          {scope === "brand" ? (
            <SelectField
              id="template-brand"
              label="Brand"
              value={brandId}
              onChange={(value) => setBrandId(value)}
            >
              <option value="">Select a brand</option>
              {brands.map((brand) => (
                <option key={brand.id} value={brand.id}>
                  {brand.name}
                </option>
              ))}
            </SelectField>
          ) : null}

          {scope === "program" ? (
            <div className="grid gap-4 md:grid-cols-2">
              <SelectField
                id="template-program-brand"
                label="Brand"
                value={brandId}
                onChange={(value) => {
                  setBrandId(value);
                  setProgramId("");
                }}
                hint="Optional filter to make the program list easier to scan."
              >
                <option value="">All brands</option>
                {brands.map((brand) => (
                  <option key={brand.id} value={brand.id}>
                    {brand.name}
                  </option>
                ))}
              </SelectField>

              <SelectField
                id="template-program"
                label="Program"
                value={programId}
                onChange={(value) => {
                  setProgramId(value);
                  const program = programs.find((item) => item.id === value);
                  if (program) {
                    setBrandId(program.brandId);
                  }
                }}
              >
                <option value="">Select a program</option>
                {availablePrograms.map((program) => (
                  <option key={program.id} value={program.id}>
                    {program.name} ({program.year})
                  </option>
                ))}
              </SelectField>
            </div>
          ) : null}

          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor="template-name">Name</Label>
              <Input
                id="template-name"
                value={name}
                onChange={(event) => setName(event.target.value)}
                placeholder={selectedPreset.label}
              />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="template-subject">Subject</Label>
              <Input
                id="template-subject"
                value={subject}
                onChange={(event) => setSubject(event.target.value)}
                placeholder={selectedPreset.defaultSubject}
              />
            </div>
          </div>

          <div className="space-y-1.5">
            <Label>Body</Label>
            <RichTextEditor
              content={body}
              placeholder={selectedPreset.defaultBody}
              onChange={setBody}
              className="min-h-[360px]"
            />
            <p className="text-xs text-zinc-400">
              Use dynamic placeholders like <span className="font-mono">{"{{brand.name}}"}</span>,{" "}
              <span className="font-mono">{"{{program.name}}"}</span>, and the event-specific fields above.
            </p>
          </div>

          <label className="flex items-start gap-3 rounded-lg border border-zinc-200 p-3">
            <input
              type="checkbox"
              checked={isActive}
              onChange={(event) => setIsActive(event.target.checked)}
              className="mt-1 h-4 w-4 rounded border-zinc-300 accent-blue-600"
            />
            <div>
              <p className="text-sm font-medium text-zinc-900">Active</p>
              <p className="text-xs text-zinc-500">
                Inactive templates stay saved but the system will fall back to the next available template.
              </p>
            </div>
          </label>
        </div>

        <SheetFooter className="mt-6">
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button onClick={handleSave} disabled={saving} loading={saving}>
            {isEdit ? "Update template" : "Create template"}
          </Button>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  );
}

export default function PlatformEmailTemplatesPage() {
  const [templates, setTemplates] = useState<EmailTemplate[]>([]);
  const [brands, setBrands] = useState<PlatformBrand[]>([]);
  const [programs, setPrograms] = useState<PlatformProgram[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [sheetState, setSheetState] = useState<SheetState>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      const [templateList, brandList, programList] = await Promise.all([
        listEmailTemplates(),
        listPlatformBrands(),
        listPlatformPrograms({ page: 1, limit: 200 }),
      ]);

      setTemplates(templateList);
      setBrands(brandList);
      setPrograms(programList.data);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load email templates.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const globalTemplates = useMemo(
    () => templates.filter((template) => !template.brandId && !template.programId),
    [templates],
  );
  const overrideTemplates = useMemo(
    () => templates.filter((template) => template.brandId || template.programId),
    [templates],
  );
  const globalTemplatesByType = useMemo(
    () => new Map(globalTemplates.map((template) => [template.type, template])),
    [globalTemplates],
  );
  const brandNameById = useMemo(
    () => Object.fromEntries(brands.map((brand) => [brand.id, brand.name])),
    [brands],
  );
  const programNameById = useMemo(
    () => Object.fromEntries(programs.map((program) => [program.id, `${program.name} (${program.year})`])),
    [programs],
  );

  async function handleDelete(id: string) {
    if (!window.confirm("Delete this template?")) return;

    setDeletingId(id);
    try {
      await deleteEmailTemplate(id);
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to delete template.");
    } finally {
      setDeletingId(null);
    }
  }

  return (
    <main className="space-y-6">
      {sheetState ? (
        <TemplateEditorSheet
          state={sheetState}
          brands={brands}
          programs={programs}
          onClose={() => setSheetState(null)}
          onSaved={() => {
            setSheetState(null);
            void load();
          }}
        />
      ) : null}

      <Card>
        <CardHeader>
          <div className="inline-flex w-fit items-center gap-2 rounded-full border border-blue-100 bg-blue-50 px-3 py-1 text-xs font-semibold uppercase tracking-wide text-blue-700">
            <Mail className="h-3.5 w-3.5" />
            Content
          </div>
          <CardTitle className="text-2xl">Email Templates</CardTitle>
          <p className="text-sm text-zinc-500">
            Configure the default system emails once, then let the platform inject the correct brand, program, and user data dynamically at send time.
          </p>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="rounded-xl border border-blue-100 bg-blue-50 p-4 text-sm text-blue-900">
            <p className="font-semibold">Recommended setup</p>
            <p className="mt-1">
              Keep one <strong>global default</strong> for each template type. Only add a brand or program override when a specific audience needs different wording.
            </p>
          </div>
          <div className="rounded-xl border border-zinc-200 bg-zinc-50 p-4 text-sm text-zinc-600">
            Need a brand-specific change? You can still add it here as an override. The brand page now links back to this central email template manager.
          </div>
          {error ? (
            <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
              {error}
            </div>
          ) : null}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Global defaults</CardTitle>
          <p className="text-sm text-zinc-500">
            These are the real email flows already wired into the system. If no custom template exists, the built-in fallback still sends.
          </p>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="py-10 text-center text-sm text-zinc-500">Loading templates…</div>
          ) : (
            <div className="overflow-hidden rounded-lg border border-zinc-200 bg-white">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-zinc-200 bg-zinc-50">
                    <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wide text-zinc-500">Template</th>
                    <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wide text-zinc-500">Status</th>
                    <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wide text-zinc-500">Subject</th>
                    <th className="px-4 py-3 text-right text-xs font-medium uppercase tracking-wide text-zinc-500">Action</th>
                  </tr>
                </thead>
                <tbody>
                  {EMAIL_TEMPLATE_PRESETS.map((preset) => {
                    const configured = globalTemplatesByType.get(preset.type) ?? null;
                    return (
                      <tr key={preset.type} className="border-b border-zinc-100 last:border-0">
                        <td className="px-4 py-4 align-top">
                          <div className="space-y-1">
                            <div className="flex items-center gap-2">
                              <p className="font-medium text-zinc-900">{preset.label}</p>
                              <Badge variant="secondary" className="font-mono text-[11px]">
                                {preset.type}
                              </Badge>
                            </div>
                            <p className="text-xs text-zinc-500">{preset.description}</p>
                            <p className="text-xs text-zinc-400">Used for: {preset.usedFor}</p>
                          </div>
                        </td>
                        <td className="px-4 py-4 align-top">
                          <Badge variant={configured?.isActive ? "success" : configured ? "secondary" : "outline"}>
                            {configured
                              ? configured.isActive
                                ? "Customized"
                                : "Saved but inactive"
                              : "Using fallback"}
                          </Badge>
                        </td>
                        <td className="px-4 py-4 align-top max-w-md text-zinc-600">
                          <p className="truncate">{configured?.subject ?? preset.defaultSubject}</p>
                        </td>
                        <td className="px-4 py-4 text-right align-top">
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => setSheetState({
                              template: configured,
                              initialType: preset.type,
                              defaultScope: "global",
                              allowScopeChange: false,
                            })}
                          >
                            <Pencil className="mr-1.5 h-3.5 w-3.5" />
                            {configured ? "Edit" : "Configure"}
                          </Button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <div>
            <CardTitle className="text-lg">Overrides</CardTitle>
            <p className="text-sm text-zinc-500">
              Optional overrides for a specific brand or program.
            </p>
          </div>
          <Button
            size="sm"
            onClick={() => setSheetState({
              template: null,
              defaultScope: "brand",
              allowScopeChange: true,
            })}
          >
            <Plus className="mr-1.5 h-3.5 w-3.5" />
            Add override
          </Button>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="py-10 text-center text-sm text-zinc-500">Loading overrides…</div>
          ) : overrideTemplates.length === 0 ? (
            <EmptyState
              title="No overrides"
              description="Start with the global defaults. Create an override only when one brand or one program needs different copy."
              action={{
                label: "Add override",
                onClick: () => setSheetState({
                  template: null,
                  defaultScope: "brand",
                  allowScopeChange: true,
                }),
              }}
            />
          ) : (
            <div className="overflow-hidden rounded-lg border border-zinc-200 bg-white">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-zinc-200 bg-zinc-50">
                    <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wide text-zinc-500">Template</th>
                    <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wide text-zinc-500">Scope</th>
                    <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wide text-zinc-500">Status</th>
                    <th className="px-4 py-3 text-right text-xs font-medium uppercase tracking-wide text-zinc-500">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {overrideTemplates.map((template) => (
                    <tr key={template.id} className="border-b border-zinc-100 last:border-0">
                      <td className="px-4 py-4 align-top">
                        <div className="space-y-1">
                          <p className="font-medium text-zinc-900">{template.name}</p>
                          <div className="flex items-center gap-2">
                            <Badge variant="secondary" className="font-mono text-[11px]">
                              {template.type}
                            </Badge>
                            <span className="text-xs text-zinc-500">{template.subject}</span>
                          </div>
                        </div>
                      </td>
                      <td className="px-4 py-4 align-top text-zinc-600">
                        {template.programId
                          ? programNameById[template.programId] ?? template.programId
                          : template.brandId
                            ? brandNameById[template.brandId] ?? template.brandId
                            : "Global"}
                      </td>
                      <td className="px-4 py-4 align-top">
                        <Badge variant={template.isActive ? "success" : "secondary"}>
                          {template.isActive ? "Active" : "Inactive"}
                        </Badge>
                      </td>
                      <td className="px-4 py-4 align-top">
                        <div className="flex items-center justify-end gap-2">
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => setSheetState({
                              template,
                              defaultScope: getTemplateScope(template),
                              allowScopeChange: false,
                            })}
                          >
                            <Pencil className="mr-1.5 h-3.5 w-3.5" />
                            Edit
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            className="text-red-600 hover:text-red-700 hover:bg-red-50"
                            onClick={() => void handleDelete(template.id)}
                            disabled={deletingId === template.id}
                            loading={deletingId === template.id}
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </Button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Brand pages</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-3 text-sm text-zinc-600 md:flex-row md:items-center md:justify-between">
          <p>
            Brand detail pages now point here so admins manage one central template system instead of duplicating the same email setup brand by brand.
          </p>
          <Link
            href="/platform/brands"
            className="inline-flex items-center text-sm font-medium text-blue-600 hover:text-blue-700"
          >
            Back to Brands
          </Link>
        </CardContent>
      </Card>
    </main>
  );
}
