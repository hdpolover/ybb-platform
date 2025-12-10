"use client";

import { useState, useRef } from "react";
import { IdentificationIcon, DocumentTextIcon, CalendarDaysIcon, PhotoIcon } from "@heroicons/react/24/solid";

interface EditProgramSpecificsModalProps {
  programName: string;
  onClose: () => void;
}

export function EditProgramSpecificsModal({ programName, onClose }: EditProgramSpecificsModalProps) {
  const [bannerFileName, setBannerFileName] = useState<string | null>(null);
  const bannerInputRef = useRef<HTMLInputElement | null>(null);

  const handleClickBannerUpload = () => {
    if (bannerInputRef.current) bannerInputRef.current.click();
  };

  const handleBannerFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0] ?? null;
    setBannerFileName(file ? file.name : null);
  };

  return (
    <div className="fixed inset-0 z-20 flex items-center justify-center bg-black/40 px-3 md:px-4">
      <div className="flex max-h-[90vh] w-full max-w-5xl flex-col overflow-hidden rounded-md border border-zinc-200 bg-white text-sm text-zinc-700 shadow-lg">
        <div className="flex items-start justify-between gap-3 border-b border-zinc-200 px-4 py-3">
          <div>
            <h2 className="text-base font-semibold text-zinc-900">Edit Program Specifics</h2>
            <p className="text-xs text-zinc-500 md:text-sm">
              Update program-specific information for <span className="font-semibold text-zinc-900">{programName}</span>,
              including dates, status, media assets, and content.
            </p>
          </div>
          <button
            type="button"
            className="flex h-7 w-7 items-center justify-center rounded-full text-zinc-400 hover:bg-zinc-100 hover:text-zinc-600"
            onClick={onClose}
          >
            ×
          </button>
        </div>

        <div className="flex-1 space-y-4 overflow-y-auto px-4 py-3 text-xs md:text-sm">
          {/* Basic Information */}
          <section className="space-y-2 rounded-md border border-zinc-200 bg-zinc-50/70 px-3 py-2.5">
            <div className="flex items-center gap-2">
              <IdentificationIcon className="h-5 w-5 text-blue-500" />
              <div>
                <h3 className="text-sm font-semibold text-zinc-900 md:text-base">Basic Information</h3>
                <p className="text-xs text-zinc-500 md:text-sm">Program name and theme for this specific cohort.</p>
              </div>
            </div>
            <div className="mt-2 grid gap-3 md:grid-cols-2">
              <div>
                <label className="mb-1 block text-xs font-medium text-zinc-700">Program Name</label>
                <input
                  type="text"
                  className="block w-full rounded-md border border-zinc-200 bg-white px-3 py-2 text-xs text-zinc-900 shadow-sm outline-none transition placeholder:text-zinc-400 focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
                  defaultValue="Japan Youth Summit 2026"
                />
              </div>
              <div>
                <label className="mb-1 block text-xs font-medium text-zinc-700">Theme</label>
                <input
                  type="text"
                  className="block w-full rounded-md border border-zinc-200 bg-white px-3 py-2 text-xs text-zinc-900 shadow-sm outline-none transition placeholder:text-zinc-400 focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
                  defaultValue="Empowering Youth Collaboration for Global Impact"
                />
              </div>
            </div>
          </section>

          {/* Description */}
          <section className="space-y-2 rounded-md border border-zinc-200 bg-zinc-50/70 px-3 py-2.5">
            <div className="flex items-center gap-2">
              <DocumentTextIcon className="h-5 w-5 text-blue-500" />
              <div>
                <h3 className="text-sm font-semibold text-zinc-900 md:text-base">Description</h3>
                <p className="text-xs text-zinc-500 md:text-sm">Program-specific description for this cohort.</p>
              </div>
            </div>
            <div className="mt-2">
              <textarea
                rows={4}
                className="block w-full rounded-md border border-zinc-200 bg-white px-3 py-2 text-xs text-zinc-900 shadow-sm outline-none transition placeholder:text-zinc-400 focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
                defaultValue="Japan Youth Summit 2026 focuses on youth-led innovation, diplomacy, and collaboration to address global challenges through intensive discussions, cultural immersion, and project-based activities in Japan."
              />
            </div>
          </section>

          {/* Dates & Status */}
          <section className="space-y-2 rounded-md border border-zinc-200 bg-zinc-50/70 px-3 py-2.5">
            <div className="flex items-center gap-2">
              <CalendarDaysIcon className="h-5 w-5 text-blue-500" />
              <div>
                <h3 className="text-sm font-semibold text-zinc-900 md:text-base">Dates &amp; Status</h3>
                <p className="text-xs text-zinc-500 md:text-sm">Configure program schedule and registration state.</p>
              </div>
            </div>
            <div className="mt-2 grid gap-3 md:grid-cols-4">
              <div>
                <label className="mb-1 block text-xs font-medium text-zinc-700">Start Date</label>
                <input
                  type="date"
                  className="block w-full rounded-md border border-zinc-200 bg-white px-3 py-2 text-xs text-zinc-900 shadow-sm outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
                  defaultValue="2026-05-11"
                />
              </div>
              <div>
                <label className="mb-1 block text-xs font-medium text-zinc-700">End Date</label>
                <input
                  type="date"
                  className="block w-full rounded-md border border-zinc-200 bg-white px-3 py-2 text-xs text-zinc-900 shadow-sm outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
                  defaultValue="2026-05-14"
                />
              </div>
              <div>
                <label className="mb-1 block text-xs font-medium text-zinc-700">Status</label>
                <select className="block w-full rounded-md border border-zinc-200 bg-white px-3 py-2 text-xs text-zinc-900 shadow-sm outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-100">
                  <option>Active</option>
                  <option>Inactive</option>
                </select>
              </div>
              <div>
                <label className="mb-1 block text-xs font-medium text-zinc-700">Registration Status</label>
                <select className="block w-full rounded-md border border-zinc-200 bg-white px-3 py-2 text-xs text-zinc-900 shadow-sm outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-100">
                  <option>Open</option>
                  <option>Closed</option>
                </select>
              </div>
            </div>
          </section>

          {/* Media & Assets */}
          <section className="space-y-2 rounded-md border border-zinc-200 bg-zinc-50/70 px-3 py-2.5">
            <div className="flex items-center gap-2">
              <PhotoIcon className="h-5 w-5 text-blue-500" />
              <div>
                <h3 className="text-sm font-semibold text-zinc-900 md:text-base">Media &amp; Assets</h3>
                <p className="text-xs text-zinc-500 md:text-sm">Configure banner and supporting URLs.</p>
              </div>
            </div>
            <div className="mt-2 grid gap-3 md:grid-cols-2 lg:grid-cols-3">
              <div className="md:col-span-2 lg:col-span-1">
                <label className="mb-1 block text-xs font-medium text-zinc-700">Banner Image</label>
                <button
                  type="button"
                  className="flex h-24 w-full items-center justify-center rounded-md border border-dashed border-zinc-300 bg-white text-center text-[11px] text-zinc-500 hover:border-blue-400 hover:bg-blue-50/40"
                  onClick={handleClickBannerUpload}
                >
                  <div className="space-y-1 px-2">
                    <div className="text-xs font-medium text-zinc-700">
                      {bannerFileName ? "Banner image selected" : "Drop banner here or click to upload."}
                    </div>
                    {bannerFileName ? (
                      <div className="truncate text-[11px] text-zinc-600">{bannerFileName}</div>
                    ) : (
                      <div className="text-[11px]">Supported formats: JPG, PNG, GIF. Max size: 2MB</div>
                    )}
                  </div>
                </button>
                <input
                  ref={bannerInputRef}
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={handleBannerFileChange}
                />
              </div>
              <div>
                <label className="mb-1 block text-xs font-medium text-zinc-700">Registration Video URL</label>
                <input
                  type="url"
                  className="block w-full rounded-md border border-zinc-200 bg-white px-3 py-2 text-xs text-blue-700 shadow-sm outline-none transition placeholder:text-zinc-400 focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
                  defaultValue="https://youtu.be/registration-video-jys-2026"
                />
              </div>
              <div>
                <label className="mb-1 block text-xs font-medium text-zinc-700">Twibbon Video URL</label>
                <input
                  type="url"
                  className="block w-full rounded-md border border-zinc-200 bg-white px-3 py-2 text-xs text-blue-700 shadow-sm outline-none transition placeholder:text-zinc-400 focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
                  defaultValue="https://youtu.be/twibbon-video-jys-2026"
                />
              </div>
              <div>
                <label className="mb-1 block text-xs font-medium text-zinc-700">T-Shirt Chart URL</label>
                <input
                  type="url"
                  className="block w-full rounded-md border border-zinc-200 bg-white px-3 py-2 text-xs text-blue-700 shadow-sm outline-none transition placeholder:text-zinc-400 focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
                  defaultValue="https://ybb.link/jys-2026-tshirt-chart"
                />
              </div>
              <div className="md:col-span-2">
                <label className="mb-1 block text-xs font-medium text-zinc-700">Twibbon URL</label>
                <input
                  type="url"
                  className="block w-full rounded-md border border-zinc-200 bg-white px-3 py-2 text-xs text-blue-700 shadow-sm outline-none transition placeholder:text-zinc-400 focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
                  defaultValue="https://ybb.link/jys-2026-twibbon"
                />
              </div>
            </div>
          </section>

          {/* Program Content */}
          <section className="space-y-2 rounded-md border border-zinc-200 bg-zinc-50/70 px-3 py-2.5">
            <div className="flex items-center gap-2">
              <DocumentTextIcon className="h-5 w-5 text-blue-500" />
              <div>
                <h3 className="text-sm font-semibold text-zinc-900 md:text-base">Program Content</h3>
                <p className="text-xs text-zinc-500 md:text-sm">Guidelines, essay question, and descriptions.</p>
              </div>
            </div>
            <div className="mt-2 grid gap-3 md:grid-cols-2">
              <div>
                <label className="mb-1 block text-xs font-medium text-zinc-700">Guideline URL</label>
                <input
                  type="url"
                  className="block w-full rounded-md border border-zinc-200 bg-white px-3 py-2 text-xs text-blue-700 shadow-sm outline-none transition placeholder:text-zinc-400 focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
                  defaultValue="https://ybb.link/jys-2026-guideline"
                />
              </div>
              <div>
                <label className="mb-1 block text-xs font-medium text-zinc-700">Essay Guideline URL</label>
                <input
                  type="url"
                  className="block w-full rounded-md border border-zinc-200 bg-white px-3 py-2 text-xs text-blue-700 shadow-sm outline-none transition placeholder:text-zinc-400 focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
                  defaultValue="https://ybb.link/jys-2026-essay-guideline"
                />
              </div>
            </div>
            <div className="mt-2">
              <label className="mb-1 block text-xs font-medium text-zinc-700">Main Essay Question</label>
              <textarea
                rows={3}
                className="block w-full rounded-md border border-zinc-200 bg-white px-3 py-2 text-xs text-zinc-900 shadow-sm outline-none transition placeholder:text-zinc-400 focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
                defaultValue={"How can youth-led collaboration between countries contribute to solving global challenges such as climate change, inequality, and technological disruption? Provide concrete examples and proposed initiatives."}
              />
            </div>
            <div className="mt-2 grid gap-3 md:grid-cols-2">
              <div>
                <label className="mb-1 block text-xs font-medium text-zinc-700">Share Description</label>
                <textarea
                  rows={6}
                  className="block w-full rounded-md border border-zinc-200 bg-white px-3 py-2 text-xs text-zinc-900 shadow-sm outline-none transition placeholder:text-zinc-400 focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
                  defaultValue={"Note: As mentioned in the Registration Guidelines, you need to complete the following steps: Follow our TikTok and Instagram accounts: Youth Break the Boundaries Instagram, Japan Youth Summit Instagram, Youth Break the Boundaries TikTok, Japan Youth Summit TikTok. Join our Telegram channels: Youth Break the Boundaries Telegram, Japan Youth Summit Telegram. Subscribe to the YBB YouTube Channel. Tag 5 of your friends and @youthbreaktheboundaries, @japanyouthsummitofficial on your posted twibbon on Instagram or any other social media platform. Share the program information for the Japan Youth Summit using this poster: \"Japan Youth Summit Poster\" with 3 WhatsApp groups or any other social media groups. Take a screenshot of each action mentioned above and upload them to your storage drive. Then, copy the link and paste it into the input forms provided above. Ensure that the folder is accessible to the public and not set to private."}
                />
              </div>
              <div>
                <label className="mb-1 block text-xs font-medium text-zinc-700">Confirmation Description</label>
                <textarea
                  rows={6}
                  className="block w-full rounded-md border border-zinc-200 bg-white px-3 py-2 text-xs text-zinc-900 shadow-sm outline-none transition placeholder:text-zinc-400 focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
                  defaultValue={"Japan Youth Summit 2026 — The Japan Youth Summit provides both Fully Funded and Self-Funded Opportunities. To qualify for Full Funding, delegates must complete all registration steps and fulfill payment by the specified deadline. If not selected for Full Funding, delegates can still participate through a self-funded scheme. The comprehensive expenses outlined in the Japan Youth Summit payment cover accommodation throughout the program (May 11 - 14, 2026), including airport transfers on the first day and the last day of the program. It is crucial to note that all fully funded or self-funded payments do not cover flight tickets and visa expenses. Fully-funded spots will be allocated based on registrants' quality. With a delegate quota limited to only 200 youth, let's join hands and collaborate at the Japan Youth Summit 2026. I am ready to join the Japan Youth Summit 2026 in Osaka, Japan."}
                />
              </div>
            </div>
          </section>
        </div>

        <div className="flex items-center justify-end gap-2 border-t border-zinc-200 bg-zinc-50 px-4 py-3 text-xs md:text-sm">
          <button
            type="button"
            className="rounded-md border border-zinc-200 bg-white px-3 py-1.5 font-medium text-zinc-700 shadow-sm hover:bg-zinc-100"
            onClick={onClose}
          >
            Cancel
          </button>
          <button
            type="button"
            className="rounded-md border border-blue-500 bg-blue-500 px-3 py-1.5 font-semibold text-white shadow-sm hover:bg-blue-600"
            onClick={onClose}
          >
            Save Changes
          </button>
        </div>
      </div>
    </div>
  );
}
