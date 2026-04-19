"use client";

import { use, useEffect, useMemo, useState } from "react";
import { useAuth } from "@/app/contexts/AuthContext";
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

type ProgramDetail = {
  id: string;
  name: string;
  slug: string;
  description?: string | null;
  shortDescription?: string | null;
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
  isVisibleToUsers: boolean;
  allowRegistration: boolean;
  requirePayment: boolean;
  currency?: string | null;
  registrationFee?: number | null;
  requirementsDescription?: string | null;
  benefitsDescription?: string | null;
  termsAndConditions?: string | null;
  metaTitle?: string | null;
  metaDescription?: string | null;
  brand: {
    id: string;
    name: string;
    slug: string;
  };
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

  const date = new Date(value);
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

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return "";
  }

  return date.toISOString().slice(0, 10);
}

function getRegistrationStatus(detail: ProgramDetail): string {
  if (!detail.allowRegistration) {
    return "Disabled";
  }

  const now = Date.now();
  const openDate = detail.registrationOpenDate ? new Date(detail.registrationOpenDate).getTime() : null;
  const closeDate = detail.registrationCloseDate ? new Date(detail.registrationCloseDate).getTime() : null;

  if (openDate && now < openDate) {
    return "Scheduled";
  }

  if (closeDate && now > closeDate) {
    return "Closed";
  }

  return "Open";
}

function getRegistrationWindow(detail: ProgramDetail): string {
  const openDate = formatDate(detail.registrationOpenDate);
  const closeDate = formatDate(detail.registrationCloseDate);

  if (openDate === "Not configured" && closeDate === "Not configured") {
    return "Not configured";
  }

  return `${openDate} - ${closeDate}`;
}

function toGeneralInformationData(detail: ProgramDetail): GeneralInformationData {
  return {
    brandName: detail.brand.name,
    programType: "Program cohort",
    tagline: formatDisplayValue(detail.shortDescription),
    websiteUrl: detail.slug ? `/programs/${detail.slug}` : "Not configured",
    media: {
      logo: detail.logoUrl ?? null,
      mainBanner: detail.bannerUrl ?? null,
      mainVideoUrl: formatDisplayValue(detail.videoUrl),
    },
    description: formatDisplayValue(detail.description),
    contact: {
      team: "Program admin team",
      location: formatDisplayValue(detail.location),
      email: "Not configured",
    },
    socialMedia: {
      instagram: "Not configured",
      tiktok: "Not configured",
      youtube: "Not configured",
      telegram: "Not configured",
      sponsorCanva: "Not configured",
    },
    additionalInfo: formatDisplayValue(detail.metaDescription ?? detail.shortDescription),
    coreValues: {
      vision: formatDisplayValue(detail.metaTitle),
      mission: ["Dedicated program-content APIs are still needed for full general-information editing."],
    },
    objectives: ["Program shell and operational settings are now sourced from live program data."],
    benefits: [formatDisplayValue(detail.benefitsDescription)],
  };
}

function toProgramSpecificsData(detail: ProgramDetail): ProgramSpecificsData {
  return {
    schedule: {
      startDate: formatDate(detail.startDate),
      endDate: formatDate(detail.endDate),
      applicationDeadline: formatDate(detail.applicationDeadline),
      status: formatDisplayValue(detail.status),
      visibility: detail.isVisibleToUsers ? "Visible" : "Hidden",
    },
    operations: {
      location: formatDisplayValue(detail.location),
      capacity: formatDisplayValue(detail.capacity),
      registrationStatus: getRegistrationStatus(detail),
      registrationWindow: getRegistrationWindow(detail),
      allowRegistration: detail.allowRegistration ? "Enabled" : "Disabled",
      requirePayment: detail.requirePayment ? "Required" : "Not required",
      currency: formatDisplayValue(detail.currency ?? "USD"),
      registrationFee:
        typeof detail.registrationFee === "number"
          ? `${detail.currency ?? "USD"} ${detail.registrationFee}`
          : "Not configured",
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
    slug: detail.slug ?? "",
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
    location: detail.location ?? "",
    capacity: detail.capacity !== null && detail.capacity !== undefined ? String(detail.capacity) : "",
    registrationOpenDate: toDateInputValue(detail.registrationOpenDate),
    registrationCloseDate: toDateInputValue(detail.registrationCloseDate),
    allowRegistration: detail.allowRegistration,
    requirePayment: detail.requirePayment,
    currency: detail.currency ?? "USD",
    registrationFee:
      typeof detail.registrationFee === "number" ? String(detail.registrationFee) : "",
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
  const fallbackProgramName =
    accessiblePrograms.find((program) => program.programId === programId)?.programName ??
    "Selected Program";
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
        const response = await fetch(buildApiUrl(`/admin/programs/${encodeURIComponent(programId)}`), {
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
  }, [programId]);

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
        location: values.location.trim() || undefined,
        capacity: values.capacity.trim() === "" ? undefined : Number(values.capacity),
        registrationOpenDate: values.registrationOpenDate || undefined,
        registrationCloseDate: values.registrationCloseDate || undefined,
        allowRegistration: values.allowRegistration,
        requirePayment: values.requirePayment,
        currency: values.currency.trim().toUpperCase() || undefined,
        registrationFee: values.registrationFee.trim() === "" ? undefined : Number(values.registrationFee),
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

      const refreshedResponse = await fetch(buildApiUrl(`/programs/${encodeURIComponent(programDetail.id)}`), {
        cache: "no-store",
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
        slug: values.slug.trim() || undefined,
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

      const refreshedResponse = await fetch(buildApiUrl(`/programs/${encodeURIComponent(programDetail.id)}`), {
        cache: "no-store",
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
              brandId={programDetail?.brand.id ?? ""}
              programName={programName}
              initialValues={generalFormValues}
              currentLogoUrl={programDetail?.logoUrl}
              currentBannerUrl={programDetail?.bannerUrl}
              currentThumbnailUrl={programDetail?.thumbnailUrl}
              onSave={handleSaveGeneral}
              onBrandingUploaded={() => {
                void fetch(buildApiUrl(`/programs/${encodeURIComponent(programId)}`), { cache: "no-store" })
                  .then((r) => r.json() as Promise<ApiEnvelope<ProgramDetail>>)
                  .then((envelope) => setProgramDetail(envelope.data))
                  .catch(() => null);
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
          ) : null}
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
