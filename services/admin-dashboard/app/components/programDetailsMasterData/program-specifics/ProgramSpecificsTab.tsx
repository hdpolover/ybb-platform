import {
  IdentificationIcon,
  DocumentTextIcon,
  CalendarDaysIcon,
  PhoneIcon,
  GlobeAltIcon,
} from "@heroicons/react/24/solid";
import {
  BookOpen,
  CreditCard,
  Film,
  Gift,
  Megaphone,
  Presentation,
  Sparkles,
  type LucideIcon,
} from "lucide-react";
import { useState, type ReactNode } from "react";
import { EmptyState } from "@/src/admin/empty-state";
import type { ProgramLandingContent } from "@/app/platform/api";
import { ProgramContactSheet } from "./ProgramContactSheet";
import { ProgramPartnersCanvaSheet } from "./ProgramPartnersCanvaSheet";
import { BenefitsSheet } from "../landing-content/BenefitsSheet";
import { FeaturesSheet } from "../landing-content/FeaturesSheet";
import { PromoCtaSheet } from "../landing-content/PromoCtaSheet";
import { FurtherInformationSheet } from "../landing-content/FurtherInformationSheet";
import { MomentsShortsSheet } from "../landing-content/MomentsShortsSheet";
import { PaymentInfoSheet } from "../landing-content/PaymentInfoSheet";
import { CopyFromProgramDialog } from "@/app/components/shared/copy-from-program/CopyFromProgramDialog";
import { CopyFromTemplateDialog } from "@/app/components/shared/copy-from-program/CopyFromTemplateDialog";

export interface ProgramSpecificsData {
  schedule: {
    year: string;
    theme: string;
    startDate: string;
    endDate: string;
    applicationDeadline: string;
    status: string;
    isPublished: string;
    isActive: string;
    visibility: string;
  };
  operations: {
    location: string;
    capacity: string;
    registrationStatus: string;
    /** Which bound (open in the future / close in the past) is gating registration, if any. */
    registrationStatusReason: string | null;
    registrationOpenDate: string;
    registrationCloseDate: string;
    requirePayment: string;
    currency: string;
    registrationFee: string;
    usdInIdr: string;
  };
  participantContent: {
    requirementsDescription: string;
    benefitsDescription: string;
    termsAndConditions: string;
  };
  contact: {
    contactEmail: string | null;
    contactPhone: string | null;
    contactWhatsapp: string | null;
    contactAddress: string | null;
  };
  landingContent: ProgramLandingContent;
  partnersCanvaUrl: string | null;
}

interface ProgramSpecificsTabProps {
  data: ProgramSpecificsData;
  programId: string;
  brandId: string;
  onDataChanged: () => void;
}

function RegistrationStatusBadge({ status }: { status: string }) {
  const colorMap: Record<string, string> = {
    Open: "border-emerald-200 bg-emerald-50 text-emerald-700",
    Closed: "border-rose-200 bg-rose-50 text-rose-700",
    Scheduled: "border-amber-200 bg-amber-50 text-amber-700",
    Disabled: "border-zinc-200 bg-zinc-100 text-zinc-500",
  };
  const cls = colorMap[status] ?? "border-zinc-200 bg-zinc-100 text-zinc-500";
  return (
    <dd className={`inline-flex items-center justify-center rounded-full border px-4 py-1.5 text-xs font-bold uppercase tracking-wide ${cls}`}>
      {status}
    </dd>
  );
}

// Wraps one landing-content sub-card: title + its own Edit sheet trigger in
// the header, and either a compact summary of what's configured or a proper
// EmptyState (never ad-hoc dashed borders / bare "Not configured" text) when
// the section hasn't been filled in yet — most programs start with none of
// these six sections configured, so the empty case is the common case here,
// not an edge case.
function LandingContentCard({
  title, icon, isEmpty, emptyDescription, action, children,
}: {
  title: string;
  icon: LucideIcon;
  isEmpty: boolean;
  emptyDescription: string;
  action: ReactNode;
  children: ReactNode;
}) {
  return (
    <div className="rounded-lg border border-zinc-200 bg-white p-4">
      <div className="mb-2 flex items-center justify-between">
        <h3 className="text-sm font-semibold text-zinc-800">{title}</h3>
        {action}
      </div>
      {isEmpty ? (
        <EmptyState icon={icon} title="Not configured yet" description={emptyDescription} className="py-8" />
      ) : (
        children
      )}
    </div>
  );
}

export function ProgramSpecificsTab({ data, programId, brandId, onDataChanged }: ProgramSpecificsTabProps) {
  const [copyContactOpen, setCopyContactOpen] = useState(false);
  const [copyLandingOpen, setCopyLandingOpen] = useState(false);
  const [copyContactTemplateOpen, setCopyContactTemplateOpen] = useState(false);
  const [copyLandingTemplateOpen, setCopyLandingTemplateOpen] = useState(false);
  const lc = data.landingContent;

  const benefitsGroupCount = lc.benefits?.groups?.length ?? 0;
  const featuresCount = lc.features?.length ?? 0;
  const paymentInfoItemCount = lc.payment_info?.items?.length ?? 0;

  return (
    <div className="space-y-6 pt-2">
      {/* Program Shell Snapshot */}
      <section className="rounded-xl border border-zinc-200 bg-zinc-50/40 p-6 shadow-sm">
        <div className="mb-5 flex items-center justify-between gap-3 border-b border-zinc-200 pb-4">
          <div className="flex items-center gap-3">
            <span className="inline-flex h-8 w-8 items-center justify-center rounded-full bg-blue-100 text-sm font-bold text-blue-700">
              1
            </span>
            <div>
              <h2 className="text-base font-bold text-zinc-900">Program Shell Snapshot</h2>
              <p className="text-xs text-zinc-500">
                Platform-managed program shell fields that provide operational context.
              </p>
            </div>
          </div>
          <IdentificationIcon className="hidden h-6 w-6 text-blue-400 md:block" />
        </div>

        <dl className="grid gap-5 md:grid-cols-2 lg:grid-cols-4">
          <div>
            <dt className="mb-1.5 block text-xs font-medium text-zinc-500">Year</dt>
            <dd className="rounded-md border border-zinc-200 bg-white px-4 py-2.5 text-sm font-semibold text-zinc-900 shadow-sm">
              {data.schedule.year}
            </dd>
          </div>
          <div className="lg:col-span-3">
            <dt className="mb-1.5 block text-xs font-medium text-zinc-500">Theme</dt>
            <dd className="rounded-md border border-zinc-200 bg-white px-4 py-2.5 text-sm font-semibold text-zinc-900 shadow-sm">
              {data.schedule.theme}
            </dd>
          </div>
          <div>
            <dt className="mb-1.5 block text-xs font-medium text-zinc-500">Start Date</dt>
            <dd className="rounded-md border border-zinc-200 bg-white px-4 py-2.5 text-sm font-semibold text-zinc-900 shadow-sm">
              {data.schedule.startDate}
            </dd>
          </div>
          <div>
            <dt className="mb-1.5 block text-xs font-medium text-zinc-500">End Date</dt>
            <dd className="rounded-md border border-zinc-200 bg-white px-4 py-2.5 text-sm font-semibold text-zinc-900 shadow-sm">
              {data.schedule.endDate}
            </dd>
          </div>
          <div>
            <dt className="mb-1.5 block text-xs font-medium text-zinc-500">Application Deadline</dt>
            <dd className="rounded-md border border-zinc-200 bg-white px-4 py-2.5 text-sm font-semibold text-zinc-900 shadow-sm">
              {data.schedule.applicationDeadline}
            </dd>
          </div>
        </dl>
      </section>

      {/* Registration & Operations */}
      <section className="rounded-xl border border-zinc-200 bg-zinc-50/40 p-6 shadow-sm">
        <div className="mb-5 flex items-center justify-between gap-3 border-b border-zinc-200 pb-4">
          <div className="flex items-center gap-3">
            <span className="inline-flex h-8 w-8 items-center justify-center rounded-full bg-blue-100 text-sm font-bold text-blue-700">
              2
            </span>
            <div>
              <h2 className="text-base font-bold text-zinc-900">Registration &amp; Operations</h2>
              <p className="text-xs text-zinc-500">Landing-facing operational fields currently surfaced to participants.</p>
            </div>
          </div>
          <CalendarDaysIcon className="hidden h-6 w-6 text-blue-400 md:block" />
        </div>

        <dl className="grid gap-5 md:grid-cols-2 lg:grid-cols-4">
          <div>
            <dt className="mb-1.5 block text-xs font-medium text-zinc-500">Location</dt>
            <dd className="rounded-md border border-zinc-200 bg-white px-4 py-2.5 text-sm font-semibold text-zinc-900 shadow-sm">
              {data.operations.location}
            </dd>
          </div>
          <div>
            <dt className="mb-1.5 block text-xs font-medium text-zinc-500">Registration Status</dt>
            <RegistrationStatusBadge status={data.operations.registrationStatus} />
            {data.operations.registrationStatusReason ? (
              <p className="mt-1.5 text-xs text-zinc-500">{data.operations.registrationStatusReason}</p>
            ) : null}
          </div>
          <div>
            <dt className="mb-1.5 block text-xs font-medium text-zinc-500">Registration Opens</dt>
            <dd className="rounded-md border border-zinc-200 bg-white px-4 py-2.5 text-sm font-semibold text-zinc-900 shadow-sm">
              {data.operations.registrationOpenDate}
            </dd>
          </div>
          <div>
            <dt className="mb-1.5 block text-xs font-medium text-zinc-500">Registration Closes</dt>
            <dd className="rounded-md border border-zinc-200 bg-white px-4 py-2.5 text-sm font-semibold text-zinc-900 shadow-sm">
              {data.operations.registrationCloseDate}
            </dd>
          </div>
        </dl>
      </section>

      {/* Participant Content */}
      <section className="rounded-xl border border-zinc-200 bg-zinc-50/40 p-6 shadow-sm">
        <div className="mb-5 flex items-center justify-between gap-3 border-b border-zinc-200 pb-4">
          <div className="flex items-center gap-3">
            <span className="inline-flex h-8 w-8 items-center justify-center rounded-full bg-blue-100 text-sm font-bold text-blue-700">
              3
            </span>
            <div>
              <h2 className="text-base font-bold text-zinc-900">Participant-Facing Content</h2>
              <p className="text-xs text-zinc-500">Operational copy used to explain participation, benefits, and terms.</p>
            </div>
          </div>
          <DocumentTextIcon className="hidden h-6 w-6 text-blue-400 md:block" />
        </div>

        <dl className="grid gap-5">
          <div>
            <dt className="mb-1.5 block text-xs font-medium text-zinc-500">Requirements Description</dt>
            <dd className="rounded-md border border-zinc-200 bg-white p-5 text-sm leading-relaxed text-zinc-800 shadow-sm"
              dangerouslySetInnerHTML={{ __html: data.participantContent.requirementsDescription }}
            />
          </div>
          <div>
            <dt className="mb-1.5 block text-xs font-medium text-zinc-500">Benefits Description</dt>
            <dd className="rounded-md border border-zinc-200 bg-white p-5 text-sm leading-relaxed text-zinc-800 shadow-sm"
              dangerouslySetInnerHTML={{ __html: data.participantContent.benefitsDescription }}
            />
          </div>
          <div>
            <dt className="mb-1.5 block text-xs font-medium text-zinc-500">Terms &amp; Conditions</dt>
            <dd className="rounded-md border border-zinc-200 bg-white p-5 text-sm leading-relaxed text-zinc-800 shadow-sm"
              dangerouslySetInnerHTML={{ __html: data.participantContent.termsAndConditions }}
            />
          </div>
        </dl>
      </section>

      {/* Contact Information */}
      <section className="rounded-xl border border-zinc-200 bg-zinc-50/40 p-6 shadow-sm">
        <div className="mb-5 flex items-center justify-between gap-3 border-b border-zinc-200 pb-4">
          <div className="flex items-center gap-3">
            <span className="inline-flex h-8 w-8 items-center justify-center rounded-full bg-blue-100 text-sm font-bold text-blue-700">4</span>
            <div>
              <h2 className="text-base font-bold text-zinc-900">Contact Information</h2>
              <p className="text-xs text-zinc-500">Program-owned support contact, shown on this program&apos;s public landing page.</p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <PhoneIcon className="hidden h-6 w-6 text-blue-400 md:block" />
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setCopyContactOpen(true)}
                className="inline-flex items-center gap-1.5 rounded-md border border-zinc-200 bg-white px-3 py-2 text-sm font-semibold text-zinc-700 shadow-sm transition hover:bg-zinc-50"
              >
                Copy from program
              </button>
              <button
                type="button"
                onClick={() => setCopyContactTemplateOpen(true)}
                className="inline-flex items-center gap-1.5 rounded-md border border-zinc-200 bg-white px-3 py-2 text-sm font-semibold text-zinc-700 shadow-sm transition hover:bg-zinc-50"
              >
                Copy from template
              </button>
              <ProgramContactSheet programId={programId} initial={data.contact} onSaved={onDataChanged} />
            </div>
          </div>
        </div>
        <dl className="grid gap-5 md:grid-cols-2 lg:grid-cols-4">
          <div>
            <dt className="mb-1.5 block text-xs font-medium text-zinc-500">Email</dt>
            <dd className="rounded-md border border-zinc-200 bg-white px-4 py-2.5 text-sm font-semibold text-zinc-900 shadow-sm">{data.contact.contactEmail || "Not configured"}</dd>
          </div>
          <div>
            <dt className="mb-1.5 block text-xs font-medium text-zinc-500">Phone</dt>
            <dd className="rounded-md border border-zinc-200 bg-white px-4 py-2.5 text-sm font-semibold text-zinc-900 shadow-sm">{data.contact.contactPhone || "Not configured"}</dd>
          </div>
          <div>
            <dt className="mb-1.5 block text-xs font-medium text-zinc-500">WhatsApp</dt>
            <dd className="rounded-md border border-zinc-200 bg-white px-4 py-2.5 text-sm font-semibold text-zinc-900 shadow-sm">{data.contact.contactWhatsapp || "Not configured"}</dd>
          </div>
          <div>
            <dt className="mb-1.5 block text-xs font-medium text-zinc-500">Address</dt>
            <dd className="rounded-md border border-zinc-200 bg-white px-4 py-2.5 text-sm font-semibold text-zinc-900 shadow-sm">{data.contact.contactAddress || "Not configured"}</dd>
          </div>
        </dl>
      </section>

      {/* Landing Page Content */}
      <section className="rounded-xl border border-zinc-200 bg-zinc-50/40 p-6 shadow-sm">
        <div className="mb-5 flex items-center justify-between gap-3 border-b border-zinc-200 pb-4">
          <div className="flex items-center gap-3">
            <span className="inline-flex h-8 w-8 items-center justify-center rounded-full bg-blue-100 text-sm font-bold text-blue-700">5</span>
            <div>
              <h2 className="text-base font-bold text-zinc-900">Landing Page Content</h2>
              <p className="text-xs text-zinc-500">Program-owned structured sections rendered on the public landing page.</p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <GlobeAltIcon className="hidden h-6 w-6 text-blue-400 md:block" />
            <button
              type="button"
              onClick={() => setCopyLandingOpen(true)}
              className="inline-flex items-center gap-1.5 rounded-md border border-zinc-200 bg-white px-3 py-2 text-sm font-semibold text-zinc-700 shadow-sm transition hover:bg-zinc-50"
            >
              Copy from program
            </button>
            <button
              type="button"
              onClick={() => setCopyLandingTemplateOpen(true)}
              className="inline-flex items-center gap-1.5 rounded-md border border-zinc-200 bg-white px-3 py-2 text-sm font-semibold text-zinc-700 shadow-sm transition hover:bg-zinc-50"
            >
              Copy from template
            </button>
          </div>
        </div>

        <div className="space-y-4">
          <LandingContentCard
            title="Program Benefits"
            icon={Gift}
            isEmpty={benefitsGroupCount === 0}
            emptyDescription="Add audience groups and benefit items to show on the landing page."
            action={<BenefitsSheet programId={programId} brandId={brandId} initial={lc.benefits} onSaved={onDataChanged} />}
          >
            <p className="text-xs text-zinc-500">{benefitsGroupCount} group(s) configured.</p>
          </LandingContentCard>

          <LandingContentCard
            title="Key Features"
            icon={Sparkles}
            isEmpty={featuresCount === 0}
            emptyDescription="Add feature highlights to show on the landing page."
            action={<FeaturesSheet programId={programId} initial={lc.features} onSaved={onDataChanged} />}
          >
            <p className="text-xs text-zinc-500">{featuresCount} feature(s) configured.</p>
          </LandingContentCard>

          <LandingContentCard
            title="Promo / CTA Section"
            icon={Megaphone}
            isEmpty={!lc.promo_cta?.title}
            emptyDescription="Set up the promo call-to-action shown on the landing page."
            action={<PromoCtaSheet programId={programId} initial={lc.promo_cta} onSaved={onDataChanged} />}
          >
            <p className="text-xs text-zinc-500">{lc.promo_cta?.title}</p>
          </LandingContentCard>

          <LandingContentCard
            title="Further Information CTA"
            icon={BookOpen}
            isEmpty={!lc.further_information?.title}
            emptyDescription="Add the guidebook / further information call-to-action."
            action={<FurtherInformationSheet programId={programId} brandId={brandId} initial={lc.further_information} onSaved={onDataChanged} />}
          >
            <p className="text-xs text-zinc-500">{lc.further_information?.title}</p>
          </LandingContentCard>

          <LandingContentCard
            title="Moments Shorts"
            icon={Film}
            isEmpty={!lc.moments_shorts?.title}
            emptyDescription="Add the short-video highlights section shown on the landing page."
            action={<MomentsShortsSheet programId={programId} initial={lc.moments_shorts} onSaved={onDataChanged} />}
          >
            <p className="text-xs text-zinc-500">{lc.moments_shorts?.title}</p>
          </LandingContentCard>

          <LandingContentCard
            title="Payment & Selection"
            icon={CreditCard}
            isEmpty={paymentInfoItemCount === 0}
            emptyDescription="Add payment schedule and selection process cards."
            action={<PaymentInfoSheet programId={programId} initial={lc.payment_info} onSaved={onDataChanged} />}
          >
            <p className="text-xs text-zinc-500">{paymentInfoItemCount} item(s) configured.</p>
          </LandingContentCard>

          <LandingContentCard
            title="Partners Page — Canva Embed"
            icon={Presentation}
            isEmpty={!data.partnersCanvaUrl}
            emptyDescription="Add a Canva embed for this program, shown on the Partners page labelled with the program name."
            action={<ProgramPartnersCanvaSheet programId={programId} initial={data.partnersCanvaUrl} onSaved={onDataChanged} />}
          >
            <p className="truncate text-xs text-zinc-500">{data.partnersCanvaUrl}</p>
          </LandingContentCard>
        </div>
      </section>

      <CopyFromProgramDialog
        open={copyContactOpen}
        entityKey="contact"
        entityLabel="Contact Information"
        programId={programId}
        supportsAppend={false}
        onClose={() => setCopyContactOpen(false)}
        onApplied={() => {
          setCopyContactOpen(false);
          onDataChanged();
        }}
      />
      <CopyFromTemplateDialog
        open={copyContactTemplateOpen}
        entityKey="contact"
        entityLabel="Contact Information"
        programId={programId}
        supportsAppend={false}
        onClose={() => setCopyContactTemplateOpen(false)}
        onApplied={() => {
          setCopyContactTemplateOpen(false);
          onDataChanged();
        }}
      />
      <CopyFromProgramDialog
        open={copyLandingOpen}
        entityKey="landing"
        entityLabel="Landing Page Content"
        programId={programId}
        supportsAppend={false}
        onClose={() => setCopyLandingOpen(false)}
        onApplied={() => {
          setCopyLandingOpen(false);
          onDataChanged();
        }}
      />
      <CopyFromTemplateDialog
        open={copyLandingTemplateOpen}
        entityKey="landing"
        entityLabel="Landing Page Content"
        programId={programId}
        supportsAppend={false}
        onClose={() => setCopyLandingTemplateOpen(false)}
        onApplied={() => {
          setCopyLandingTemplateOpen(false);
          onDataChanged();
        }}
      />
    </div>
  );
}
