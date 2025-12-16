import {
  IdentificationIcon,
  PhotoIcon,
  DocumentTextIcon,
  CalendarDaysIcon,
} from "@heroicons/react/24/solid";

export function ProgramSpecificsTab() {
  return (
    <div className="space-y-3 pt-1">
      {/* 1. Identitas Program */}
      <section className="rounded-md border border-zinc-200 bg-zinc-50/70 px-3 py-3">
        <div className="mb-2 flex items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <span className="inline-flex h-7 w-7 items-center justify-center rounded-full bg-blue-100 text-xs font-semibold text-blue-700 md:text-sm">
              1
            </span>
            <div>
              <h2 className="text-sm font-semibold text-zinc-900 md:text-base">Basic Information</h2>
              <p className="text-xs text-zinc-500 md:text-sm">
                Program name, theme, and identity for this specific cohort.
              </p>
            </div>
          </div>
          <IdentificationIcon className="hidden h-5 w-5 text-blue-500 md:block" />
        </div>
        <dl className="grid gap-2 text-xs md:grid-cols-2 md:text-sm">
          <div>
            <dt className="text-[10px] font-semibold uppercase tracking-wide text-zinc-500">Program Name</dt>
            <dd className="rounded-md border border-zinc-200 bg-white px-3 py-1.5 text-zinc-800">
              Japan Youth Summit 2026
            </dd>
          </div>
          <div>
            <dt className="text-[10px] font-semibold uppercase tracking-wide text-zinc-500">Theme</dt>
            <dd className="rounded-md border border-zinc-200 bg-white px-3 py-1.5 text-zinc-800">
              Empowering Youth Collaboration for Global Impact
            </dd>
          </div>
        </dl>
      </section>

      {/* 2. bagian Deskripsinya */}
      <section className="rounded-md border border-zinc-200 bg-zinc-50/70 px-3 py-3">
        <div className="mb-2 flex items-center gap-2">
          <span className="inline-flex h-7 w-7 items-center justify-center rounded-full bg-blue-100 text-xs font-semibold text-blue-700 md:text-sm">
            2
          </span>
          <div>
            <h2 className="text-sm font-semibold text-zinc-900 md:text-base">Description</h2>
            <p className="text-xs text-zinc-500 md:text-sm">Program-specific description for this cohort.</p>
          </div>
          <DocumentTextIcon className="ml-auto hidden h-5 w-5 text-blue-500 md:block" />
        </div>
        <div className="rounded-md border border-zinc-200 bg-white px-3 py-2 text-xs leading-relaxed text-zinc-800 md:text-sm">
          Japan Youth Summit 2026 focuses on youth-led innovation, diplomacy, and collaboration to address global
          challenges through intensive discussions, cultural immersion, and project-based activities in Japan.
        </div>
      </section>

      {/* 3. Status sama Tanggalnya */}
      <section className="rounded-md border border-zinc-200 bg-zinc-50/70 px-3 py-3">
        <div className="mb-2 flex items-center gap-2">
          <span className="inline-flex h-7 w-7 items-center justify-center rounded-full bg-blue-100 text-xs font-semibold text-blue-700 md:text-sm">
            3
          </span>
          <div>
            <h2 className="text-sm font-semibold text-zinc-900 md:text-base">Dates &amp; Status</h2>
            <p className="text-xs text-zinc-500 md:text-sm">Program schedule and registration status.</p>
          </div>
          <CalendarDaysIcon className="ml-auto hidden h-5 w-5 text-blue-500 md:block" />
        </div>
        <dl className="grid gap-2 text-xs md:grid-cols-4 md:text-sm">
          <div>
            <dt className="text-[10px] font-semibold uppercase tracking-wide text-zinc-500">Start Date</dt>
            <dd className="rounded-md border border-zinc-200 bg-white px-3 py-1.5 text-zinc-800">11 May 2026</dd>
          </div>
          <div>
            <dt className="text-[10px] font-semibold uppercase tracking-wide text-zinc-500">End Date</dt>
            <dd className="rounded-md border border-zinc-200 bg-white px-3 py-1.5 text-zinc-800">14 May 2026</dd>
          </div>
          <div>
            <dt className="text-[10px] font-semibold uppercase tracking-wide text-zinc-500">Status</dt>
            <dd className="rounded-md border border-emerald-200 bg-emerald-50 px-3 py-1.5 text-emerald-700">Active</dd>
          </div>
          <div>
            <dt className="text-[10px] font-semibold uppercase tracking-wide text-zinc-500">Registration Status</dt>
            <dd className="rounded-md border border-emerald-200 bg-emerald-50 px-3 py-1.5 text-emerald-700">Open</dd>
          </div>
        </dl>
      </section>

      {/* 4. Asset Media */}
      <section className="rounded-md border border-zinc-200 bg-zinc-50/70 px-3 py-3">
        <div className="mb-2 flex items-center gap-2">
          <span className="inline-flex h-7 w-7 items-center justify-center rounded-full bg-blue-100 text-xs font-semibold text-blue-700 md:text-sm">
            4
          </span>
          <div>
            <h2 className="text-sm font-semibold text-zinc-900 md:text-base">Media &amp; Assets</h2>
            <p className="text-xs text-zinc-500 md:text-sm">Program-specific promotional assets.</p>
          </div>
          <PhotoIcon className="ml-auto hidden h-5 w-5 text-blue-500 md:block" />
        </div>
        <dl className="grid gap-3 text-xs md:grid-cols-2 lg:grid-cols-3 md:text-sm">
          <div className="md:col-span-2 lg:col-span-1">
            <dt className="mb-1 text-[10px] font-semibold uppercase tracking-wide text-zinc-500">Banner Image</dt>
            <dd className="flex h-20 items-center justify-center rounded-md border border-dashed border-zinc-300 bg-white text-[11px] text-zinc-500">
              Program-specific banner preview / upload placeholder
            </dd>
          </div>
          <div>
            <dt className="mb-1 text-[10px] font-semibold uppercase tracking-wide text-zinc-500">Registration Video URL</dt>
            <dd className="rounded-md border border-zinc-200 bg-white px-3 py-1.5 text-blue-700">
              https://youtu.be/registration-video-jys-2026
            </dd>
          </div>
          <div>
            <dt className="mb-1 text-[10px] font-semibold uppercase tracking-wide text-zinc-500">Twibbon Video URL</dt>
            <dd className="rounded-md border border-zinc-200 bg-white px-3 py-1.5 text-blue-700">
              https://youtu.be/twibbon-video-jys-2026
            </dd>
          </div>
          <div>
            <dt className="mb-1 text-[10px] font-semibold uppercase tracking-wide text-zinc-500">T-Shirt Chart URL</dt>
            <dd className="rounded-md border border-zinc-200 bg-white px-3 py-1.5 text-blue-700">
              https://ybb.link/jys-2026-tshirt-chart
            </dd>
          </div>
          <div className="md:col-span-2">
            <dt className="mb-1 text-[10px] font-semibold uppercase tracking-wide text-zinc-500">Twibbon URL</dt>
            <dd className="rounded-md border border-zinc-200 bg-white px-3 py-1.5 text-blue-700">
              https://ybb.link/jys-2026-twibbon
            </dd>
          </div>
        </dl>
      </section>

      {/* 5. Content Programnya */}
      <section className="rounded-md border border-zinc-200 bg-zinc-50/70 px-3 py-3">
        <div className="mb-2 flex items-center gap-2">
          <span className="inline-flex h-7 w-7 items-center justify-center rounded-full bg-blue-100 text-xs font-semibold text-blue-700 md:text-sm">
            5
          </span>
          <div>
            <h2 className="text-sm font-semibold text-zinc-900 md:text-base">Program Content</h2>
            <p className="text-xs text-zinc-500 md:text-sm">Guidelines, essay information, and share flows.</p>
          </div>
          <DocumentTextIcon className="ml-auto hidden h-5 w-5 text-blue-500 md:block" />
        </div>
        <dl className="grid gap-2 text-xs md:grid-cols-2 md:text-sm">
          <div>
            <dt className="text-[10px] font-semibold uppercase tracking-wide text-zinc-500">Guideline URL</dt>
            <dd className="rounded-md border border-zinc-200 bg-white px-3 py-1.5 text-blue-700">
              https://ybb.link/jys-2026-guideline
            </dd>
          </div>
          <div>
            <dt className="text-[10px] font-semibold uppercase tracking-wide text-zinc-500">Essay Guideline URL</dt>
            <dd className="rounded-md border border-zinc-200 bg-white px-3 py-1.5 text-blue-700">
              https://ybb.link/jys-2026-essay-guideline
            </dd>
          </div>
          <div className="md:col-span-2">
            <dt className="text-[10px] font-semibold uppercase tracking-wide text-zinc-500">Main Essay Question</dt>
            <dd className="rounded-md border border-zinc-200 bg-white px-3 py-2 text-xs leading-relaxed text-zinc-800 md:text-sm">
              &quot;How can youth-led collaboration between countries contribute to solving global challenges such as
              climate change, inequality, and technological disruption? Provide concrete examples and proposed
              initiatives?&quot;
            </dd>
          </div>
        </dl>
        <div className="mt-2 grid gap-2 text-xs md:grid-cols-2 md:text-sm">
          <div>
            <dt className="text-[10px] font-semibold uppercase tracking-wide text-zinc-500">Share Description</dt>
            <dd className="rounded-md border border-zinc-200 bg-white px-3 py-2 text-xs leading-relaxed text-zinc-800 md:text-sm">
              Note: As mentioned in the Registration Guidelines, you need to complete the following steps: Follow our
              TikTok and Instagram accounts: Youth Break the Boundaries Instagram, Japan Youth Summit Instagram, Youth
              Break the Boundaries TikTok, Japan Youth Summit TikTok. Join our Telegram channels: Youth Break the
              Boundaries Telegram, Japan Youth Summit Telegram. Subscribe to the YBB YouTube Channel. Tag 5 of your
              friends and @youthbreaktheboundaries, @japanyouthsummitofficial on your posted twibbon on Instagram or
              any other social media platform. Share the program information for the Japan Youth Summit using this
              poster: &quot;Japan Youth Summit Poster&quot; with 3 WhatsApp groups or any other social media groups. Take a
              screenshot of each action mentioned above and upload them to your storage drive. Then, copy the link and
              paste it into the input forms provided above. Ensure that the folder is accessible to the public and not
              set to private.
            </dd>
          </div>
          <div>
            <dt className="text-[10px] font-semibold uppercase tracking-wide text-zinc-500">Confirmation Description</dt>
            <dd className="rounded-md border border-zinc-200 bg-white px-3 py-2 text-xs leading-relaxed text-zinc-800 md:text-sm">
              Japan Youth Summit 2026 — The Japan Youth Summit provides both Fully Funded and Self-Funded Opportunities.
              To qualify for Full Funding, delegates must complete all registration steps and fulfill payment by the
              specified deadline. If not selected for Full Funding, delegates can still participate through a
              self-funded scheme. The comprehensive expenses outlined in the Japan Youth Summit payment cover
              accommodation throughout the program (May 11 - 14, 2026), including airport transfers on the first day
              and the last day of the program. It is crucial to note that all fully funded or self-funded payments do
              not cover flight tickets and visa expenses. Fully-funded spots will be allocated based on registrants&#39;
              quality. With a delegate quota limited to only 200 youth, let&#39;s join hands and collaborate at the Japan
              Youth Summit 2026. I am ready to join the Japan Youth Summit 2026 in Osaka, Japan.
            </dd>
          </div>
        </div>
      </section>
    </div>
  );
}
