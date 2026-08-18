"use client";

import { use, useEffect, useMemo, useState } from "react";
import { useAuth } from "@/app/contexts/AuthContext";
import { useResolvedProgramId } from "@/app/hooks/useResolvedProgramId";
import { HeaderSection } from "@/app/components/programDetailsMasterData/HeaderSection";
import { TabNavigation } from "@/app/components/programDetailsMasterData/TabNavigation";
import { EditSpecificsAction } from "@/app/components/programDetailsMasterData/program-specifics/EditSpecificsAction";
import { EditGeneralAction } from "@/app/components/programDetailsMasterData/general-information/EditGeneralAction";
import {
  GeneralInformationTab,
  GeneralInformationData,
} from "@/app/components/programDetailsMasterData/general-information/GeneralInformationTab";
import {
  ProgramSpecificsTab,
  ProgramSpecificsData,
} from "@/app/components/programDetailsMasterData/program-specifics/ProgramSpecificsTab";
import {
  type ProgramSpecificsFormValues,
} from "@/app/components/programDetailsMasterData/program-specifics/EditProgramSpecificsModal";
import {
  type GeneralInformationFormValues,
} from "@/app/components/programDetailsMasterData/general-information/EditGeneralInformationModal";
import { buildApiUrl, getAccessToken, readErrorMessage } from "@/app/components/submissionsMasterData/api";
import { ExchangeRateTab } from "@/app/components/programDetailsMasterData/exchange-rate/ExchangeRateTab";
import { parseApiDate, toLocalDatetimeInputValue, toUtcIsoFromLocalInput } from "@/lib/utils";
import { formatInBusinessTz } from "@/lib/datetime";

type ProgramDetail = {
  id: string;
  name: string;
  slug: string;
  year: number;
  theme?: string | null;
  description?: string | null;
  shortDescription?: string | null;
  programType?: string | null;
  programFormat?: 'in_person' | 'hybrid' | 'online' | null;
  startDate?: string | null;
  endDate?: string | null;
  applicationDeadline?: string | null;
  registrationOpenDate?: string | null;
  registrationCloseDate?: string | null;
  location?: string | null;
  capacity?: number | null;
  logoUrl?: string | null;
  thumbnailUrl?: string | null;
  bannerUrl?: string | null;
  videoUrl?: string | null;
  status: string;
  isPublished: boolean;
  isActive: boolean;
  isVisibleToUsers: boolean;
  allowRegistration: boolean;
  requirePayment: boolean;
  currency?: string | null;
  registrationFee?: number | null;
  enableCurrencyConversion?: boolean | null;
  usdInIdr?: number | null;
  requirementsDescription?: string | null;
  benefitsDescription?: string | null;
  termsAndConditions?: string | null;
  metaTitle?: string | null;
  metaDescription?: string | null;
  brand?: {
    id: string;
    name: string;
    slug: string;
  } | null;
};

type ApiEnvelope<T> = {
  message: string;
  data: T;
};

function formatDisplayValue(value?: string | number | null): string {
  if (value === null || value === undefined) {
    return "Not configured";
  }

  const normalized = String(value).trim();
  return normalized === "" ? "Not configured" : normalized;
}

function formatDate(value?: string | null): string {
  if (!value) {
    return "Not configured";
  }

  const date = parseApiDate(value);
  if (Number.isNaN(date.getTime())) {
    return "Not configured";
  }

  return new Intl.DateTimeFormat("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  }).format(date);
}

function toDateInputValue(value?: string | null): string {
  if (!value) {
    return "";
  }

  const date = parseApiDate(value);
  if (Number.isNaN(date.getTime())) {
    return "";
  }

  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

// Render registration boundaries in the canonical business timezone (WIB) so an
// end-of-day "23:59" cutoff never appears to roll onto the next calendar day.
function formatBusinessDateTime(value?: string | null): string {
  return formatInBusinessTz(value, {
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function getRegistrationStatus(detail: ProgramDetail): string {
  if (!detail.allowRegistration) {
    return "Disabled";
  }

  const now = Date.now();
  const openDate = detail.registrationOpenDate ? parseApiDate(detail.registrationOpenDate).getTime() : null;
  const closeDate = detail.registrationCloseDate ? parseApiDate(detail.registrationCloseDate).getTime() : null;

  if (openDate && now < openDate) {
    return "Scheduled";
  }

  if (closeDate && now > closeDate) {
    return "Closed";
  }

  return "Open";
}

// Explains which bound (open date in the future, or close date in the past)
// is currently gating registration, so an admin can tell why at a glance
// without opening the edit drawer.
function getRegistrationStatusReason(detail: ProgramDetail, status: string): string | null {
  if (status === "Scheduled" && detail.registrationOpenDate) {
    return `Opens ${formatBusinessDateTime(detail.registrationOpenDate)} WIB`;
  }

  if (status === "Closed" && detail.registrationCloseDate) {
    return `Closed since ${formatBusinessDateTime(detail.registrationCloseDate)} WIB`;
  }

  return null;
}

const PROGRAM_FORMAT_LABELS: Record<'in_person' | 'hybrid' | 'online', string> = {
  in_person: 'In-Person',
  hybrid: 'Hybrid',
  online: 'Online',
};

function toGeneralInformationData(detail: ProgramDetail): GeneralInformationData {
  return {
    brandName: formatDisplayValue(detail.brand?.name),
    programType: formatDisplayValue(detail.programType),
    programFormat: detail.programFormat ? PROGRAM_FORMAT_LABELS[detail.programFormat] : 'Not configured',
    tagline: formatDisplayValue(detail.shortDescription),
    media: {
      logo: detail.logoUrl ?? null,
      mainBanner: detail.bannerUrl ?? null,
      mainVideoUrl: formatDisplayValue(detail.videoUrl),
    },
    description: formatDisplayValue(detail.description),
  };
}

function toProgramSpecificsData(detail: ProgramDetail): ProgramSpecificsData {
  return {
    schedule: {
      year: String(detail.year),
      theme: formatDisplayValue(detail.theme),
      startDate: formatDate(detail.startDate),
      endDate: formatDate(detail.endDate),
      applicationDeadline: formatDate(detail.applicationDeadline),
      status: formatDisplayValue(detail.status),
      isPublished: detail.isPublished ? "Published" : "Not published",
      isActive: detail.isActive ? "Active" : "Inactive",
      visibility: detail.isVisibleToUsers ? "Visible" : "Hidden",
    },
    operations: {
      location: formatDisplayValue(detail.location),
      capacity: formatDisplayValue(detail.capacity),
      registrationStatus: getRegistrationStatus(detail),
      registrationStatusReason: getRegistrationStatusReason(detail, getRegistrationStatus(detail)),
      registrationOpenDate: detail.registrationOpenDate ? `${formatBusinessDateTime(detail.registrationOpenDate)} WIB` : "Not configured",
      registrationCloseDate: detail.registrationCloseDate ? `${formatBusinessDateTime(detail.registrationCloseDate)} WIB` : "Not configured",
      requirePayment: detail.requirePayment ? "Required" : "Not required",
      currency: formatDisplayValue(detail.currency ?? "USD"),
      registrationFee:
        typeof detail.registrationFee === "number"
          ? `${detail.currency ?? "USD"} ${detail.registrationFee}`
          : "Not configured",
      usdInIdr: detail.usdInIdr != null ? String(detail.usdInIdr) : "Not configured",
    },
    participantContent: {
      requirementsDescription: formatDisplayValue(detail.requirementsDescription),
      benefitsDescription: formatDisplayValue(detail.benefitsDescription),
      termsAndConditions: formatDisplayValue(detail.termsAndConditions),
    },
  };
}

function toGeneralFormValues(detail: ProgramDetail): GeneralInformationFormValues {
  return {
    name: detail.name ?? "",
    programType: detail.programType ?? "",
    programFormat: detail.programFormat ?? "",
    shortDescription: detail.shortDescription ?? "",
    description: detail.description ?? "",
    videoUrl: detail.videoUrl ?? "",
    metaTitle: detail.metaTitle ?? "",
    metaDescription: detail.metaDescription ?? "",
    isVisibleToUsers: detail.isVisibleToUsers,
  };
}

function toSpecificsFormValues(detail: ProgramDetail): ProgramSpecificsFormValues {
  return {
    year: String(detail.year),
    theme: detail.theme ?? "",
    startDate: toDateInputValue(detail.startDate),
    endDate: toDateInputValue(detail.endDate),
    applicationDeadline: toDateInputValue(detail.applicationDeadline),
    isPublished: detail.isPublished,
    location: detail.location ?? "",
    capacity: detail.capacity !== null && detail.capacity !== undefined ? String(detail.capacity) : "",
    requirePayment: detail.requirePayment,
    registrationOpenDate: toLocalDatetimeInputValue(detail.registrationOpenDate),
    registrationCloseDate: toLocalDatetimeInputValue(detail.registrationCloseDate),
    requirementsDescription: detail.requirementsDescription ?? "",
    benefitsDescription: detail.benefitsDescription ?? "",
    termsAndConditions: detail.termsAndConditions ?? "",
  };
}

export default function ProgramDetailsPage({
  params,
  searchParams,
}: {
  params: Promise<{ programId: string }>;
  searchParams: Promise<{ tab?: string }>;
}) {
  const resolvedParams = use(params);
  const resolvedSearchParams = use(searchParams);
  const { accessiblePrograms } = useAuth();

  const programId = resolvedParams.programId;
  const resolvedProgramId = useResolvedProgramId(programId);
  const fallbackProgramName =
    accessiblePrograms.find(
      (program) => program.programId === programId || program.programSlug === programId,
    )?.programName ?? "Selected Program";
  const activeTab = resolvedSearchParams.tab || "general";
  const [programDetail, setProgramDetail] = useState<ProgramDetail | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [pageError, setPageError] = useState<string | null>(null);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [generalSaveError, setGeneralSaveError] = useState<string | null>(null);
  const [isGeneralSaving, setIsGeneralSaving] = useState(false);

  useEffect(() => {
    let isMounted = true;

    async function loadProgramDetail() {
      setIsLoading(true);
      setPageError(null);

      try {
        const token = getAccessToken();
        const response = await fetch(buildApiUrl(`/admin/programs/${encodeURIComponent(resolvedProgramId)}`), {
          cache: "no-store",
          headers: token ? { Authorization: `Bearer ${token}` } : {},
        });

        if (!response.ok) {
          throw new Error(await readErrorMessage(response));
        }

        const envelope = (await response.json()) as ApiEnvelope<ProgramDetail>;
        if (!isMounted) {
          return;
        }

        setProgramDetail(envelope.data);
      } catch (error) {
        if (!isMounted) {
          return;
        }

        setPageError(error instanceof Error ? error.message : "Failed to load program details.");
      } finally {
        if (isMounted) {
          setIsLoading(false);
        }
      }
    }

    void loadProgramDetail();

    return () => {
      isMounted = false;
    };
  }, [resolvedProgramId]);

  const generalInformationData = useMemo(() => {
    return programDetail ? toGeneralInformationData(programDetail) : null;
  }, [programDetail]);

  const programSpecificsData = useMemo(() => {
    return programDetail ? toProgramSpecificsData(programDetail) : null;
  }, [programDetail]);

  const specificsFormValues = useMemo(() => {
    return programDetail ? toSpecificsFormValues(programDetail) : null;
  }, [programDetail]);

  const generalFormValues = useMemo(() => {
    return programDetail ? toGeneralFormValues(programDetail) : null;
  }, [programDetail]);

  const programName = programDetail?.name ?? fallbackProgramName;

  const handleSaveSpecifics = async (values: ProgramSpecificsFormValues) => {
    if (!programDetail) {
      return;
    }

    const accessToken = getAccessToken();
    if (!accessToken) {
      throw new Error("You must be signed in to update program settings.");
    }

    setIsSaving(true);
    setSaveError(null);

    try {
      const payload = {
        year: values.year.trim() === "" ? undefined : Number(values.year),
        theme: values.theme.trim() || undefined,
        startDate: values.startDate || undefined,
        endDate: values.endDate || undefined,
        applicationDeadline: values.applicationDeadline || undefined,
        isPublished: values.isPublished,
        location: values.location.trim() || undefined,
        capacity: values.capacity.trim() === "" ? undefined : Number(values.capacity),
        requirePayment: values.requirePayment,
        // Explicit null (not undefined) so an emptied input clears the bound in the DB
        // instead of being dropped as "no change" — see toUtcIsoFromLocalInput.
        registrationOpenDate: toUtcIsoFromLocalInput(values.registrationOpenDate),
        registrationCloseDate: toUtcIsoFromLocalInput(values.registrationCloseDate),
        requirementsDescription: values.requirementsDescription.trim() || undefined,
        benefitsDescription: values.benefitsDescription.trim() || undefined,
        termsAndConditions: values.termsAndConditions.trim() || undefined,
      };

      const response = await fetch(buildApiUrl(`/programs/${encodeURIComponent(programDetail.id)}`), {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${accessToken}`,
        },
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        throw new Error(await readErrorMessage(response));
      }

      await response.json() as ApiEnvelope<unknown>;

      const refreshedResponse = await fetch(buildApiUrl(`/admin/programs/${encodeURIComponent(programDetail.id)}`), {
        cache: "no-store",
        headers: { Authorization: `Bearer ${accessToken}` },
      });

      if (!refreshedResponse.ok) {
        throw new Error(await readErrorMessage(refreshedResponse));
      }

      const refreshedEnvelope = (await refreshedResponse.json()) as ApiEnvelope<ProgramDetail>;
      setProgramDetail(refreshedEnvelope.data);
    } catch (error) {
      const message = error instanceof Error ? error.message : "Failed to update program settings.";
      setSaveError(message);
      throw error;
    } finally {
      setIsSaving(false);
    }
  };

  const handleSaveGeneral = async (values: GeneralInformationFormValues) => {
    if (!programDetail) {
      return;
    }

    const accessToken = getAccessToken();
    if (!accessToken) {
      throw new Error("You must be signed in to update program settings.");
    }

    setIsGeneralSaving(true);
    setGeneralSaveError(null);

    try {
      const payload = {
        name: values.name.trim() || undefined,
        programType: values.programType.trim() || undefined,
        programFormat: values.programFormat || undefined,
        shortDescription: values.shortDescription.trim() || undefined,
        description: values.description.trim() || undefined,
        videoUrl: values.videoUrl.trim() || undefined,
        metaTitle: values.metaTitle.trim() || undefined,
        metaDescription: values.metaDescription.trim() || undefined,
        isVisibleToUsers: values.isVisibleToUsers,
      };

      const response = await fetch(buildApiUrl(`/programs/${encodeURIComponent(programDetail.id)}`), {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${accessToken}`,
        },
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        throw new Error(await readErrorMessage(response));
      }

      await response.json() as ApiEnvelope<unknown>;

      const refreshedResponse = await fetch(buildApiUrl(`/admin/programs/${encodeURIComponent(programDetail.id)}`), {
        cache: "no-store",
        headers: { Authorization: `Bearer ${accessToken}` },
      });

      if (!refreshedResponse.ok) {
        throw new Error(await readErrorMessage(refreshedResponse));
      }

      const refreshedEnvelope = (await refreshedResponse.json()) as ApiEnvelope<ProgramDetail>;
      setProgramDetail(refreshedEnvelope.data);
    } catch (error) {
      const message = error instanceof Error ? error.message : "Failed to update general information.";
      setGeneralSaveError(message);
      throw error;
    } finally {
      setIsGeneralSaving(false);
    }
  };

  return (
    <main className="space-y-4">
      <HeaderSection programName={programName} />

      <section className="rounded-xl border border-zinc-200 bg-white p-5 shadow-sm">
        <div className="mb-4 flex flex-col justify-between gap-4 md:flex-row md:items-center">
          <TabNavigation activeTab={activeTab} />

          {activeTab === "general" && generalFormValues ? (
            <EditGeneralAction
              programId={programId}
              brandId={programDetail?.brand?.id ?? ""}
              programName={programName}
              initialValues={generalFormValues}
              currentLogoUrl={programDetail?.logoUrl}
              currentBannerUrl={programDetail?.bannerUrl}
              currentThumbnailUrl={programDetail?.thumbnailUrl}
              onSave={handleSaveGeneral}
              onBrandingUploaded={async () => {
                const token = getAccessToken();
                const refreshedResponse = await fetch(buildApiUrl(`/admin/programs/${encodeURIComponent(resolvedProgramId)}`), {
                  cache: "no-store",
                  headers: token ? { Authorization: `Bearer ${token}` } : {},
                });

                if (!refreshedResponse.ok) {
                  throw new Error(await readErrorMessage(refreshedResponse));
                }

                const refreshedEnvelope = (await refreshedResponse.json()) as ApiEnvelope<ProgramDetail>;
                setProgramDetail(refreshedEnvelope.data);
              }}
              isSaving={isGeneralSaving}
              errorMessage={generalSaveError}
            />
          ) : activeTab === "specifics" && specificsFormValues ? (
            <EditSpecificsAction
              programName={programName}
              initialValues={specificsFormValues}
              onSave={handleSaveSpecifics}
              isSaving={isSaving}
              errorMessage={saveError}
            />
          ) : activeTab === "exchange-rate" ? null : null}
        </div>

        <div className="border-t border-zinc-100 pt-4">
          {isLoading ? (
            <div className="rounded-lg border border-zinc-200 bg-zinc-50 px-4 py-6 text-sm text-zinc-600">
              Loading program details...
            </div>
          ) : pageError ? (
            <div className="rounded-lg border border-rose-200 bg-rose-50 px-4 py-6 text-sm text-rose-700">
              {pageError}
            </div>
          ) : activeTab === "general" && generalInformationData ? (
            <GeneralInformationTab data={generalInformationData} />
          ) : activeTab === "exchange-rate" ? (
            <ExchangeRateTab programId={resolvedProgramId} />
          ) : programSpecificsData ? (
            <ProgramSpecificsTab data={programSpecificsData} />
          ) : (
            <div className="rounded-lg border border-zinc-200 bg-zinc-50 px-4 py-6 text-sm text-zinc-600">
              No program details available.
            </div>
          )}
        </div>
      </section>
    </main>
  );
}
