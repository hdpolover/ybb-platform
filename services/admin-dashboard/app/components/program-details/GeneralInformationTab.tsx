import {
  IdentificationIcon,
  PhotoIcon,
  GlobeAltIcon,
  PhoneIcon,
  AtSymbolIcon,
  HeartIcon,
  FlagIcon,
  PlayCircleIcon,
  GiftTopIcon,
} from "@heroicons/react/24/solid";

export function GeneralInformationTab() {
  return (
    <div className="space-y-3 pt-1">
      {/* 1. Program Identity */}
      <section className="rounded-md border border-zinc-200 bg-zinc-50/70 px-3 py-3">
        <div className="mb-2 flex items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <span className="inline-flex h-7 w-7 items-center justify-center rounded-full bg-blue-100 text-xs font-semibold text-blue-700 md:text-sm">
              1
            </span>
            <div>
              <h2 className="text-sm font-semibold text-zinc-900 md:text-base">Program Identity</h2>
              <p className="text-xs text-zinc-500 md:text-sm">
                Key identifiers that will appear across landing pages and communication.
              </p>
            </div>
          </div>
          <IdentificationIcon className="hidden h-5 w-5 text-blue-500 md:block" />
        </div>
        <dl className="grid gap-2 text-xs md:grid-cols-2 md:text-sm">
          <div>
            <dt className="text-[11px] font-semibold uppercase tracking-wide text-zinc-500 md:text-xs">
              Program Category Name
            </dt>
            <dd className="rounded-md border border-zinc-200 bg-white px-3 py-1.5 text-zinc-800">
              Youth Leadership & Cultural Immersion
            </dd>
          </div>
          <div>
            <dt className="text-[10px] font-semibold uppercase tracking-wide text-zinc-500">Program Type</dt>
            <dd className="rounded-md border border-zinc-200 bg-white px-3 py-1.5 text-zinc-800">
              Hybrid (Online Preparation + Onsite Program)
            </dd>
          </div>
          <div className="md:col-span-2">
            <dt className="text-[10px] font-semibold uppercase tracking-wide text-zinc-500">Tagline</dt>
            <dd className="rounded-md border border-zinc-200 bg-white px-3 py-1.5 text-zinc-800">
              Empowering young leaders to collaborate, innovate, and create global impact in Japan.
            </dd>
          </div>
          <div className="md:col-span-2">
            <dt className="text-[10px] font-semibold uppercase tracking-wide text-zinc-500">Website URL</dt>
            <dd className="rounded-md border border-zinc-200 bg-white px-3 py-1.5 text-blue-700">
              https://youthbreaktheboundaries.com/japan-youth-summit-2026
            </dd>
          </div>
        </dl>
      </section>

      {/* 2. Media Assets */}
      <section className="rounded-md border border-zinc-200 bg-zinc-50/70 px-3 py-3">
        <div className="mb-2 flex items-center gap-2">
          <span className="inline-flex h-7 w-7 items-center justify-center rounded-full bg-blue-100 text-xs font-semibold text-blue-700 md:text-sm">
            2
          </span>
          <div>
            <h2 className="text-sm font-semibold text-zinc-900 md:text-base">Media Assets</h2>
            <p className="text-xs text-zinc-500 md:text-sm">
              Visual assets used on program pages and promotional materials.
            </p>
          </div>
          <PhotoIcon className="ml-auto hidden h-5 w-5 text-blue-500 md:block" />
        </div>
        <dl className="grid gap-3 text-xs md:grid-cols-3 md:text-sm">
          <div>
            <dt className="mb-1 text-[10px] font-semibold uppercase tracking-wide text-zinc-500">Logo Image</dt>
            <dd className="flex h-20 items-center justify-center rounded-md border border-dashed border-zinc-300 bg-white text-[11px] text-zinc-500">
              Logo preview / URL placeholder
            </dd>
          </div>
          <div>
            <dt className="mb-1 text-[10px] font-semibold uppercase tracking-wide text-zinc-500">Main Banner Image</dt>
            <dd className="flex h-20 items-center justify-center rounded-md border border-dashed border-zinc-300 bg-white text-[11px] text-zinc-500">
              Main banner preview / URL placeholder
            </dd>
          </div>
          <div>
            <dt className="mb-1 text-[10px] font-semibold uppercase tracking-wide text-zinc-500">Main Video URL</dt>
            <dd className="rounded-md border border-zinc-200 bg-white px-3 py-1.5 text-[11px] text-blue-700">
              https://youtu.be/example-jys-2026
            </dd>
          </div>
        </dl>
      </section>

      {/* 3. Program Description */}
      <section className="rounded-md border border-zinc-200 bg-zinc-50/70 px-3 py-3">
        <div className="mb-2 flex items-center gap-2">
          <span className="inline-flex h-7 w-7 items-center justify-center rounded-full bg-blue-100 text-xs font-semibold text-blue-700 md:text-sm">
            3
          </span>
          <div>
            <h2 className="text-sm font-semibold text-zinc-900 md:text-base">Program Description</h2>
            <p className="text-xs text-zinc-500 md:text-sm">High-level overview of the program for landing pages.</p>
          </div>
          <GlobeAltIcon className="ml-auto hidden h-5 w-5 text-blue-500 md:block" />
        </div>
        <div className="rounded-md border border-zinc-200 bg-white px-3 py-2 text-xs leading-relaxed text-zinc-800 md:text-sm">
          Japan Youth Summit 2026 is a global youth forum that brings together emerging leaders from diverse
          backgrounds to discuss pressing global issues, experience Japanese culture, and collaborate on concrete
          youth-led initiatives.
        </div>
      </section>

      {/* 4. Contact Information */}
      <section className="rounded-md border border-zinc-200 bg-zinc-50/70 px-3 py-3">
        <div className="mb-2 flex items-center gap-2">
          <span className="inline-flex h-7 w-7 items-center justify-center rounded-full bg-blue-100 text-xs font-semibold text-blue-700 md:text-sm">
            4
          </span>
          <div>
            <h2 className="text-sm font-semibold text-zinc-900 md:text-base">Contact Information</h2>
            <p className="text-xs text-zinc-500 md:text-sm">Primary contact for participants and partners.</p>
          </div>
          <PhoneIcon className="ml-auto hidden h-5 w-5 text-blue-500 md:block" />
        </div>
        <dl className="grid gap-2 text-xs md:grid-cols-3 md:text-sm">
          <div>
            <dt className="text-[10px] font-semibold uppercase tracking-wide text-zinc-500">Contact</dt>
            <dd className="rounded-md border border-zinc-200 bg-white px-3 py-1.5 text-zinc-800">
              Youth Break the Boundaries (YBB) Program Team
            </dd>
          </div>
          <div>
            <dt className="text-[10px] font-semibold uppercase tracking-wide text-zinc-500">Location</dt>
            <dd className="rounded-md border border-zinc-200 bg-white px-3 py-1.5 text-zinc-800">Tokyo, Japan</dd>
          </div>
          <div>
            <dt className="text-[10px] font-semibold uppercase tracking-wide text-zinc-500">Email</dt>
            <dd className="rounded-md border border-zinc-200 bg-white px-3 py-1.5 text-blue-700">
              support@youthbreaktheboundaries.com
            </dd>
          </div>
        </dl>
      </section>

      {/* 5. Social Media */}
      <section className="rounded-md border border-zinc-200 bg-zinc-50/70 px-3 py-3">
        <div className="mb-2 flex items-center gap-2">
          <span className="inline-flex h-7 w-7 items-center justify-center rounded-full bg-blue-100 text-xs font-semibold text-blue-700 md:text-sm">
            5
          </span>
          <div>
            <h2 className="text-sm font-semibold text-zinc-900 md:text-base">Social Media</h2>
            <p className="text-xs text-zinc-500 md:text-sm">Official social channels for this program.</p>
          </div>
          <AtSymbolIcon className="ml-auto hidden h-5 w-5 text-blue-500 md:block" />
        </div>
        <dl className="grid gap-2 text-xs md:grid-cols-2 lg:grid-cols-3 md:text-sm">
          <div>
            <dt className="text-[10px] font-semibold uppercase tracking-wide text-zinc-500">Instagram</dt>
            <dd className="rounded-md border border-zinc-200 bg-white px-3 py-1.5 text-blue-700">
              https://instagram.com/japanyouthsummit
            </dd>
          </div>
          <div>
            <dt className="text-[10px] font-semibold uppercase tracking-wide text-zinc-500">TikTok</dt>
            <dd className="rounded-md border border-zinc-200 bg-white px-3 py-1.5 text-blue-700">
              https://tiktok.com/@japanyouthsummit
            </dd>
          </div>
          <div>
            <dt className="text-[10px] font-semibold uppercase tracking-wide text-zinc-500">YouTube</dt>
            <dd className="rounded-md border border-zinc-200 bg-white px-3 py-1.5 text-blue-700">
              https://youtube.com/@youthbreaktheboundaries
            </dd>
          </div>
          <div>
            <dt className="text-[10px] font-semibold uppercase tracking-wide text-zinc-500">Telegram</dt>
            <dd className="rounded-md border border-zinc-200 bg-white px-3 py-1.5 text-blue-700">
              https://t.me/jys2026_official
            </dd>
          </div>
          <div className="lg:col-span-2">
            <dt className="text-[10px] font-semibold uppercase tracking-wide text-zinc-500">Sponsor Canva URL</dt>
            <dd className="rounded-md border border-zinc-200 bg-white px-3 py-1.5 text-blue-700">
              https://www.canva.com/design/jys-2026-sponsorship-kit
            </dd>
          </div>
        </dl>
      </section>

      {/* 6. Additional Information */}
      <section className="rounded-md border border-zinc-200 bg-zinc-50/70 px-3 py-3">
        <div className="mb-2 flex items-center gap-2">
          <span className="inline-flex h-7 w-7 items-center justify-center rounded-full bg-blue-100 text-xs font-semibold text-blue-700 md:text-sm">
            6
          </span>
          <div>
            <h2 className="text-sm font-semibold text-zinc-900 md:text-base">Additional Information</h2>
            <p className="text-xs text-zinc-500 md:text-sm">Supporting narrative about the program.</p>
          </div>
          <HeartIcon className="ml-auto hidden h-5 w-5 text-blue-500 md:block" />
        </div>
        <div className="rounded-md border border-zinc-200 bg-white px-3 py-2 text-xs leading-relaxed text-zinc-800 md:text-sm">
          Japan Youth Summit is part of Youth Break the Boundaries&apos; global flagship programs, designed to create a
          safe, inclusive, and collaborative space for young leaders who are passionate about SDGs, diplomacy, and
          cross-cultural understanding.
        </div>
      </section>

      {/* 7. Core Values */}
      <section className="rounded-md border border-zinc-200 bg-zinc-50/70 px-3 py-3">
        <div className="mb-2 flex items-center gap-2">
          <span className="inline-flex h-7 w-7 items-center justify-center rounded-full bg-blue-100 text-xs font-semibold text-blue-700 md:text-sm">
            7
          </span>
          <div>
            <h2 className="text-sm font-semibold text-zinc-900 md:text-base">Core Values</h2>
            <p className="text-xs text-zinc-500 md:text-sm">Vision and mission specific to this program.</p>
          </div>
          <FlagIcon className="ml-auto hidden h-5 w-5 text-blue-500 md:block" />
        </div>
        <div className="grid gap-2 text-xs md:grid-cols-2 md:text-sm">
          <div className="rounded-md border border-zinc-200 bg-white px-3 py-2">
            <div className="mb-1 text-xs font-semibold text-zinc-900 md:text-sm">Japan Youth Summit Vision</div>
            <p className="text-xs text-zinc-800 md:text-sm">
              To become a leading youth platform that empowers young leaders to collaborate and co-create innovative
              solutions for global challenges through meaningful engagement in Japan.
            </p>
          </div>
          <div className="rounded-md border border-zinc-200 bg-white px-3 py-2">
            <div className="mb-1 text-xs font-semibold text-zinc-900 md:text-sm">Japan Youth Summit Mission</div>
            <ul className="list-disc space-y-1 pl-4 text-xs text-zinc-800 md:text-sm">
              <li>Facilitate intercultural dialogue and collaboration among youth leaders.</li>
              <li>Promote understanding of Japanese culture, innovation, and diplomacy.</li>
              <li>Encourage youth-led initiatives aligned with the Sustainable Development Goals.</li>
            </ul>
          </div>
        </div>
      </section>

      {/* 8. Objective */}
      <section className="rounded-md border border-zinc-200 bg-zinc-50/70 px-3 py-3">
        <div className="mb-2 flex items-center gap-2">
          <span className="inline-flex h-7 w-7 items-center justify-center rounded-full bg-blue-100 text-xs font-semibold text-blue-700 md:text-sm">
            8
          </span>
          <div>
            <h2 className="text-sm font-semibold text-zinc-900 md:text-base">Objectives</h2>
            <p className="text-xs text-zinc-500 md:text-sm">
              The Japan Youth Summit program is held to achieve the following objectives.
            </p>
          </div>
          <PlayCircleIcon className="ml-auto hidden h-5 w-5 text-blue-500 md:block" />
        </div>
        <ul className="list-disc space-y-1 rounded-md border border-zinc-200 bg-white px-4 py-2 text-xs text-zinc-800 md:text-sm">
          <li>Provide a platform for youth to present and discuss solutions to global challenges.</li>
          <li>Strengthen leadership, negotiation, and public speaking skills of participants.</li>
          <li>Build an international network of young leaders and changemakers.</li>
          <li>Expose participants to Japanese culture, innovation, and best practices.</li>
        </ul>
      </section>

      {/* 9. Benefits */}
      <section className="rounded-md border border-zinc-200 bg-zinc-50/70 px-3 py-3">
        <div className="mb-2 flex items-center gap-2">
          <span className="inline-flex h-7 w-7 items-center justify-center rounded-full bg-blue-100 text-xs font-semibold text-blue-700 md:text-sm">
            9
          </span>
          <div>
            <h2 className="text-sm font-semibold text-zinc-900 md:text-base">Benefits</h2>
            <p className="text-xs text-zinc-500 md:text-sm">Key benefits that will be highlighted to delegates.</p>
          </div>
          <GiftTopIcon className="ml-auto hidden h-5 w-5 text-blue-500 md:block" />
        </div>
        <div className="rounded-md border border-zinc-200 bg-white px-3 py-2 text-xs text-zinc-800 md:text-sm">
          <div className="mb-1 text-xs font-semibold text-zinc-900 md:text-sm">Delegates Benefits</div>
          <ul className="list-disc space-y-1 pl-4 text-xs md:text-sm">
            <li>International symposium and panel discussion with experts and practitioners.</li>
            <li>Cultural immersion activities and city tour in Tokyo or surrounding areas.</li>
            <li>Certificate of participation and potential award recognition.</li>
            <li>Access to YBB global alumni network and future program opportunities.</li>
          </ul>
        </div>
      </section>
    </div>
  );
}
