import {
  IdentificationIcon,
  DocumentTextIcon,
  CalendarDaysIcon,
  CurrencyDollarIcon,
} from "@heroicons/react/24/solid";

export interface ProgramSpecificsData {
  schedule: {
    startDate: string;
    endDate: string;
    applicationDeadline: string;
    status: string;
    visibility: string;
  };
  operations: {
    location: string;
    capacity: string;
    registrationStatus: string;
    registrationWindow: string;
    allowRegistration: string;
    requirePayment: string;
    currency: string;
    registrationFee: string;
  };
  participantContent: {
    requirementsDescription: string;
    benefitsDescription: string;
    termsAndConditions: string;
  };
}

export function ProgramSpecificsTab({ data }: { data: ProgramSpecificsData }) {
  return (
    <div className="space-y-6 pt-2">
      {/* Identitas Program */}
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

        <dl className="grid gap-5 md:grid-cols-2 lg:grid-cols-5">
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
          <div>
            <dt className="mb-1.5 block text-xs font-medium text-zinc-500">Program Status</dt>
            <dd className="inline-flex items-center justify-center rounded-full border border-zinc-200 bg-white px-4 py-1.5 text-xs font-bold uppercase tracking-wide text-zinc-700">
              {data.schedule.status}
            </dd>
          </div>
          <div>
            <dt className="mb-1.5 block text-xs font-medium text-zinc-500">Visibility</dt>
            <dd className="inline-flex items-center justify-center rounded-full border border-zinc-200 bg-white px-4 py-1.5 text-xs font-bold uppercase tracking-wide text-zinc-700">
              {data.schedule.visibility}
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
              <p className="text-xs text-zinc-500">Program-admin managed operational settings for applications and delivery.</p>
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
            <dt className="mb-1.5 block text-xs font-medium text-zinc-500">Capacity</dt>
            <dd className="rounded-md border border-zinc-200 bg-white px-4 py-2.5 text-sm font-semibold text-zinc-900 shadow-sm">
              {data.operations.capacity}
            </dd>
          </div>
          <div>
            <dt className="mb-1.5 block text-xs font-medium text-zinc-500">Registration Status</dt>
            <dd className="inline-flex items-center justify-center rounded-full border border-emerald-200 bg-emerald-50 px-4 py-1.5 text-xs font-bold uppercase tracking-wide text-emerald-700">
              {data.operations.registrationStatus}
            </dd>
          </div>
          <div>
            <dt className="mb-1.5 block text-xs font-medium text-zinc-500">Registration Window</dt>
            <dd className="rounded-md border border-zinc-200 bg-white px-4 py-2.5 text-sm font-semibold text-zinc-900 shadow-sm">
              {data.operations.registrationWindow}
            </dd>
          </div>
          <div>
            <dt className="mb-1.5 block text-xs font-medium text-zinc-500">Allow Registration</dt>
            <dd className="rounded-md border border-zinc-200 bg-white px-4 py-2.5 text-sm font-semibold text-zinc-900 shadow-sm">
              {data.operations.allowRegistration}
            </dd>
          </div>
          <div>
            <dt className="mb-1.5 block text-xs font-medium text-zinc-500">Payment Required</dt>
            <dd className="rounded-md border border-zinc-200 bg-white px-4 py-2.5 text-sm font-semibold text-zinc-900 shadow-sm">
              {data.operations.requirePayment}
            </dd>
          </div>
        </dl>
      </section>

      {/* Payment */}
      <section className="rounded-xl border border-zinc-200 bg-zinc-50/40 p-6 shadow-sm">
        <div className="mb-5 flex items-center justify-between gap-3 border-b border-zinc-200 pb-4">
          <div className="flex items-center gap-3">
            <span className="inline-flex h-8 w-8 items-center justify-center rounded-full bg-blue-100 text-sm font-bold text-blue-700">
              3
            </span>
            <div>
              <h2 className="text-base font-bold text-zinc-900">Payment Settings</h2>
              <p className="text-xs text-zinc-500">Checkout-related settings now managed at the program-admin level.</p>
            </div>
          </div>
          <CurrencyDollarIcon className="hidden h-6 w-6 text-blue-400 md:block" />
        </div>

        <dl className="grid gap-5 md:grid-cols-2">
          <div>
            <dt className="mb-1.5 block text-xs font-medium text-zinc-500">Currency</dt>
            <dd className="rounded-md border border-zinc-200 bg-white px-4 py-2.5 text-sm font-semibold text-zinc-900 shadow-sm">
              {data.operations.currency}
            </dd>
          </div>
          <div>
            <dt className="mb-1.5 block text-xs font-medium text-zinc-500">Registration Fee</dt>
            <dd className="rounded-md border border-zinc-200 bg-white px-4 py-2.5 text-sm font-semibold text-zinc-900 shadow-sm">
              {data.operations.registrationFee}
            </dd>
          </div>
        </dl>
      </section>

      {/* Participant Content */}
      <section className="rounded-xl border border-zinc-200 bg-zinc-50/40 p-6 shadow-sm">
        <div className="mb-5 flex items-center justify-between gap-3 border-b border-zinc-200 pb-4">
          <div className="flex items-center gap-3">
            <span className="inline-flex h-8 w-8 items-center justify-center rounded-full bg-blue-100 text-sm font-bold text-blue-700">
              4
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
            <dd className="rounded-md border border-zinc-200 bg-white p-5 text-sm font-semibold text-zinc-900 shadow-sm">
              {data.participantContent.requirementsDescription}
            </dd>
          </div>
          <div>
            <dt className="mb-1.5 block text-xs font-medium text-zinc-500">Benefits Description</dt>
            <dd className="rounded-md border border-zinc-200 bg-white p-5 text-sm leading-relaxed text-zinc-800 shadow-sm">
              {data.participantContent.benefitsDescription}
            </dd>
          </div>
          <div>
            <dt className="mb-1.5 block text-xs font-medium text-zinc-500">Terms &amp; Conditions</dt>
            <dd className="rounded-md border border-zinc-200 bg-white p-5 text-sm leading-relaxed text-zinc-800 shadow-sm">
              {data.participantContent.termsAndConditions}
            </dd>
          </div>
        </dl>
      </section>
    </div>
  );
}